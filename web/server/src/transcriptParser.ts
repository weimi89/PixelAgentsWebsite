/**
 * transcriptParser — 將 CLI 會話轉錄（JSONL / JSON）解析為標準代理事件
 *
 * 職責：
 *   - 依 cliType 將轉錄記錄分派至 Claude / Codex / Gemini 對應解析器
 *   - 從 tool_use / tool_result 偵測工具開始與結束，廣播至客戶端
 *   - 從 thinking / image / compact_boundary 等觸發對應表情
 *   - 管理等待氣泡、權限氣泡的計時器（在收到新資料時取消、在工具開始時啟動）
 *   - 將 Bash 輸出中的 git branch 資訊抽出並廣播
 *   - 處理子代理（Task 工具的 progress 事件）的工具開始/結束
 *   - 維護 transcriptLog（客戶端詳情面板用）與 statusHistory（狀態時序）
 *
 * 關鍵設計：
 *   - Claude 用 assistant/user/system 結構；Codex 用 response_item/event_msg；Gemini 用 gemini/user
 *   - 工具完成後延遲 300ms 廣播 agentToolDone，避免 React 批次處理隱藏短暫的活躍狀態
 *   - hadToolsInTurn 旗標：純文字回合才啟動文字閒置計時器（避免工具中途的文字觸發誤判）
 *   - 非豁免工具啟動 permission timer：5s 內無進度訊號就顯示權限氣泡
 *   - bash/mcp_progress 會 restart permission timer：代表工具還在跑，延長等待
 */
import type { AgentContext } from './types.js';
import {
	cancelWaitingTimer,
	startWaitingTimer,
	clearAgentActivity,
	startPermissionTimer,
	cancelPermissionTimer,
	restartPermissionTimerOnProgress,
} from './timerManager.js';
import {
	TOOL_DONE_DELAY_MS,
	TEXT_IDLE_DELAY_MS,
	MAX_TRANSCRIPT_LOG,
	MAX_STATUS_HISTORY,
	THINKING_DEPTH_THRESHOLD,
} from './constants.js';

/** Git branch 偵測正則：匹配 `git status` 或 `git branch` 輸出中的分支名稱 */
const GIT_BRANCH_ON_RE = /On branch\s+(\S+)/;
const GIT_BRANCH_STAR_RE = /^\*\s+(\S+)/m;
import { formatToolStatus, PERMISSION_EXEMPT_TOOLS } from 'pixel-agents-shared';
import { incrementToolCall } from './dashboardStats.js';
import { recordToolCall, recordTurnComplete } from './growthSystem.js';

export { formatToolStatus, PERMISSION_EXEMPT_TOOLS };

/** 追加一筆精簡轉錄記錄到代理的 transcriptLog，並推送至客戶端 */
function appendTranscript(
	agentId: number,
	agent: { transcriptLog: Array<{ ts: number; role: 'user' | 'assistant' | 'system'; summary: string }> },
	role: 'user' | 'assistant' | 'system',
	summary: string,
	sender: import('./types.js').MessageSender | undefined,
): void {
	// 建立一筆紀錄（附時間戳），供詳情面板顯示「最近在做什麼」
	const entry = { ts: Date.now(), role, summary };
	agent.transcriptLog.push(entry);
	// 超過上限就砍掉最舊的部分（維持長度 ≤ MAX_TRANSCRIPT_LOG）
	if (agent.transcriptLog.length > MAX_TRANSCRIPT_LOG) {
		agent.transcriptLog.splice(0, agent.transcriptLog.length - MAX_TRANSCRIPT_LOG);
	}
	// 推送完整 log（客戶端會取代舊的）— 長度受限所以成本可控
	sender?.postMessage({ type: 'agentTranscript', id: agentId, log: agent.transcriptLog });
}

/** 追加一筆狀態變更記錄到代理的 statusHistory，保留最近 MAX_STATUS_HISTORY 條 */
export function appendStatusHistory(
	agent: { statusHistory: Array<{ ts: number; status: string; detail?: string }> },
	status: string,
	detail?: string,
): void {
	// 建立基本項目（detail 可選）
	const entry: { ts: number; status: string; detail?: string } = { ts: Date.now(), status };
	if (detail !== undefined) entry.detail = detail;
	agent.statusHistory.push(entry);
	// 同上，超過上限砍頭
	if (agent.statusHistory.length > MAX_STATUS_HISTORY) {
		agent.statusHistory.splice(0, agent.statusHistory.length - MAX_STATUS_HISTORY);
	}
}

/** 解析單行轉錄記錄，根據 CLI 類型分派到對應的解析函式 */
export function processTranscriptLine(
	agentId: number,
	line: string,
	ctx: AgentContext,
): void {
	const { agents } = ctx;
	const agent = agents.get(agentId);
	// 代理已被移除 → 這行資料作廢
	if (!agent) return;
	try {
		// JSONL 一行為一筆 JSON；Gemini 則是序列化過的單一 message
		const record = JSON.parse(line);

		// 依 CLI 類型分派到對應解析器（三種 CLI 的格式完全不同）
		if (agent.cliType === 'codex') {
			processCodexLine(agentId, record, ctx);
			return;
		}
		if (agent.cliType === 'gemini') {
			processGeminiMessage(agentId, record, ctx);
			return;
		}

		// 預設為 Claude
		processClaudeLine(agentId, record, ctx);
	} catch {
		// 寫到一半的 JSONL 行會解析失敗 — 下一輪會補上
	}
}

/** 解析 Claude JSONL 轉錄記錄 */
function processClaudeLine(
	agentId: number,
	record: Record<string, unknown>,
	ctx: AgentContext,
): void {
	const { agents, waitingTimers, permissionTimers, progressExtensions } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;
	// 取對應樓層的訊息廣播器（訊息只送給同樓層的瀏覽器）
	const sender = ctx.floorSender(agent.floorId);
	// Claude 格式：外層有 record.type，內層有 record.message 包含 content 陣列
	const msg = record.message as Record<string, unknown> | undefined;

	// ── assistant 記錄：模型回應、thinking、tool_use、image ──────
	if (record.type === 'assistant' && Array.isArray(msg?.content)) {
		// 從 msg.model 抽出模型名稱（如 claude-opus-4-7），變更時廣播給客戶端
		const model = msg?.model as string | undefined;
		if (model && agent.model !== model) {
			agent.model = model;
			sender?.postMessage({ type: 'agentModel', id: agentId, model });
		}

		// content 是 block 陣列；一筆 assistant 記錄可能含多個 block（thinking + tool_use）
		const blocks = msg.content as Array<{
			type: string; id?: string; name?: string; input?: Record<string, unknown>;
		}>;

		// thinking 區塊：啟動 thinking 動畫（角色踱步）
		const thinkingBlocks = blocks.filter(b => b.type === 'thinking');
		if (thinkingBlocks.length > 0) {
			sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: true });
			// 深度思考偵測：計算所有 thinking 文字總長度
			const thinkingLength = thinkingBlocks.reduce((sum, b) => {
				const text = (b as Record<string, unknown>).thinking as string | undefined;
				return sum + (text?.length ?? 0);
			}, 0);
			// 超過閾值視為深度思考 → 顯示燈泡表情
			if (thinkingLength > THINKING_DEPTH_THRESHOLD) {
				sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'idea' });
			}
		}
		const hasThinking = thinkingBlocks.length > 0;

		// image 區塊：模型正在看圖片 → 相機表情
		const hasImage = blocks.some(b => b.type === 'image');
		if (hasImage) {
			sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'camera' });
		}

		// 是否包含工具呼叫
		const hasToolUse = blocks.some(b => b.type === 'tool_use');

		if (hasToolUse) {
			// 工具開始：取消等待氣泡並切換至 active 狀態
			cancelWaitingTimer(agentId, waitingTimers);
			agent.isWaiting = false;
			// 標記本回合已用過工具（避免純文字閒置計時器誤觸發）
			agent.hadToolsInTurn = true;
			// 工具開始時清除思考動畫（代表已經從思考進入執行）
			sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });
			sender?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
			appendStatusHistory(agent, 'active', 'tool_use');
			// 是否有非豁免工具（需要權限氣泡計時）
			let hasNonExemptTool = false;
			// 遍歷每個 tool_use block，記錄到 active 狀態 Map 並廣播
			for (const block of blocks) {
				if (block.type === 'tool_use' && block.id) {
					const toolName = block.name || '';
					// 格式化為人類可讀狀態字串（e.g. "Reading index.ts"）
					const status = formatToolStatus(toolName, block.input || {});
					console.log(`[Pixel Agents] Agent ${agentId} tool start: ${block.id} ${status}`);
					// 記錄三個 Map：ID Set + 狀態字串 + 工具名稱
					agent.activeToolIds.add(block.id);
					agent.activeToolStatuses.set(block.id, status);
					agent.activeToolNames.set(block.id, toolName);
					// Read/Glob/Grep 等唯讀工具在豁免清單中，不觸發權限氣泡
					if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
						hasNonExemptTool = true;
					}
					sender?.postMessage({
						type: 'agentToolStart',
						id: agentId,
						toolId: block.id,
						status,
					});
				}
			}
			// 有非豁免工具 → 啟動權限氣泡計時器（5s 後若無進度就顯示）
			if (hasNonExemptTool) {
				progressExtensions.delete(agentId); // 新工具開始，重設進度延長計數
				startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
			}
			// 成長系統：每個工具呼叫都增加經驗值
			for (const block of blocks) {
				if (block.type === "tool_use" && block.id) {
					recordToolCall(agentId, agent, block.name || "", sender);
				}
			}
			// 取最後一個工具的狀態字串作為轉錄摘要
			const lastStatus = agent.activeToolStatuses.size > 0 ? [...agent.activeToolStatuses.values()].pop()! : 'Using tools';
			appendTranscript(agentId, agent, 'assistant', lastStatus, sender);
		} else if (hasThinking) {
			// 純 thinking（尚未出工具）→ 記錄狀態
			appendStatusHistory(agent, 'thinking');
			appendTranscript(agentId, agent, 'assistant', '[thinking]', sender);
		} else if (blocks.some(b => b.type === 'text') && !agent.hadToolsInTurn) {
			// 純文字回覆且本回合從未使用工具 → 啟動文字閒置計時器
			// （用工具的回合有 turn_duration 作結束訊號，這裡處理的是純對話回合）
			startWaitingTimer(agentId, TEXT_IDLE_DELAY_MS, agents, waitingTimers, sender);
			appendTranscript(agentId, agent, 'assistant', 'Responding...', sender);
		}
	} else if (record.type === 'progress') {
		// progress 記錄：子代理事件、bash/mcp 進度等 → 另外處理
		processProgressRecord(agentId, record, ctx);
	} else if (record.type === 'user') {
		// user 記錄有兩種形態：tool_result 陣列 或 使用者提示字串
		const content = msg?.content;
		if (Array.isArray(content)) {
			const blocks = content as Array<{ type: string; tool_use_id?: string }>;
			const hasToolResult = blocks.some(b => b.type === 'tool_result');
			if (hasToolResult) {
				// 陣列中有 tool_result → 工具完成處理
				for (const block of blocks) {
					if (block.type === 'tool_result' && block.tool_use_id) {
						console.log(`[Pixel Agents] Agent ${agentId} tool done: ${block.tool_use_id}`);
						const completedToolId = block.tool_use_id as string;
						// Bash 結果特殊處理：嘗試抽出 git branch 名稱
						const completedName = agent.activeToolNames.get(completedToolId);
						if (completedName === 'Bash') {
							// tool_result 可能是字串或 content 陣列（都要處理）
							const resultContent = (block as Record<string, unknown>).content;
							const text = typeof resultContent === 'string'
								? resultContent
								: Array.isArray(resultContent)
									? (resultContent as Array<{ text?: string }>).map(c => c.text || '').join('')
									: '';
							if (text) {
								// 優先匹配 "On branch xxx"（git status），退而 "* branch"（git branch）
								const m1 = GIT_BRANCH_ON_RE.exec(text);
								const m2 = !m1 ? GIT_BRANCH_STAR_RE.exec(text) : null;
								const branch = m1?.[1] || m2?.[1];
								// 變更時才廣播，避免重複訊息
								if (branch && branch !== agent.gitBranch) {
									agent.gitBranch = branch;
									sender?.postMessage({ type: 'agentGitBranch', id: agentId, branch });
								}
							}
						}
						// Task 工具完成 → 清除所有子代理記錄並通知客戶端移除子代理角色
						if (agent.activeToolNames.get(completedToolId) === 'Task') {
							agent.activeSubagentToolIds.delete(completedToolId);
							agent.activeSubagentToolNames.delete(completedToolId);
							sender?.postMessage({
								type: 'subagentClear',
								id: agentId,
								parentToolId: completedToolId,
							});
						}
						// 統計：dashboard 計數 + 狀態歷程記錄
						const completedToolName = agent.activeToolNames.get(completedToolId);
						if (completedToolName) {
							incrementToolCall(completedToolName);
							appendStatusHistory(agent, 'tool_done', completedToolName);
						}
						// 從三個 active Map 中移除此工具
						agent.activeToolIds.delete(completedToolId);
						agent.activeToolStatuses.delete(completedToolId);
						agent.activeToolNames.delete(completedToolId);
						// 延遲 300ms 廣播 agentToolDone：避免 React 批次合併隱藏過短的活躍狀態
						const toolId = completedToolId;
						setTimeout(() => {
							sender?.postMessage({
								type: 'agentToolDone',
								id: agentId,
								toolId,
							});
						}, TOOL_DONE_DELAY_MS);
					}
				}
				// 所有工具都完成 → 重設 hadToolsInTurn（下次純文字可啟動閒置計時器）
				if (agent.activeToolIds.size === 0) {
					agent.hadToolsInTurn = false;
				}
				// 轉錄記錄：列出完成的工具 ID 前 8 碼
				appendTranscript(agentId, agent, 'user', `Result: ${blocks.filter(b => b.type === 'tool_result').map(b => (b.tool_use_id || '').slice(0, 8)).join(', ')}`, sender);
			} else {
				// 陣列但無 tool_result（可能是 ephemeral context）→ 清理狀態
				cancelWaitingTimer(agentId, waitingTimers);
				clearAgentActivity(agent, agentId, permissionTimers, sender, progressExtensions);
				agent.hadToolsInTurn = false;
			}
		} else if (typeof content === 'string' && content.trim()) {
			// 字串型 content = 使用者提示訊息 → 新回合開始
			cancelWaitingTimer(agentId, waitingTimers);
			clearAgentActivity(agent, agentId, permissionTimers, sender, progressExtensions);
			agent.hadToolsInTurn = false;
			appendStatusHistory(agent, 'user_prompt');
			// 過長訊息截斷至 60 字顯示在詳情面板
			const trimmed = content.trim();
			appendTranscript(agentId, agent, 'user', trimmed.length > 60 ? trimmed.slice(0, 60) + '\u2026' : trimmed, sender);
		}
	} else if (record.type === 'system' && record.subtype === 'compact_boundary') {
		// 上下文壓縮（/compact 或自動觸發）→ 壓縮表情
		sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'compress' });
		appendStatusHistory(agent, 'compact');
		appendTranscript(agentId, agent, 'system', 'Context compacted', sender);
	} else if (record.type === 'system' && record.subtype === 'turn_duration') {
		// turn_duration = 回合真正結束的可靠訊號（由 Claude CLI 在回合完成後寫入）
		cancelWaitingTimer(agentId, waitingTimers);
		cancelPermissionTimer(agentId, permissionTimers);
		// 清除思考動畫
		sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });

		// 安全防護：若還有殘留工具（未收到 tool_result）也一併清除
		if (agent.activeToolIds.size > 0) {
			agent.activeToolIds.clear();
			agent.activeToolStatuses.clear();
			agent.activeToolNames.clear();
			agent.activeSubagentToolIds.clear();
			agent.activeSubagentToolNames.clear();
			sender?.postMessage({ type: 'agentToolsClear', id: agentId });
		}

		// 設為等待狀態（顯示綠色勾號氣泡 + 音效）
		agent.isWaiting = true;
		agent.permissionSent = false;
		agent.hadToolsInTurn = false;
		sender?.postMessage({
			type: 'agentStatus',
			id: agentId,
			status: 'waiting',
		});
		// 成長系統：記錄回合完成（加經驗值）
		recordTurnComplete(agentId, agent, sender);
		appendStatusHistory(agent, 'waiting', 'turn_complete');
		appendTranscript(agentId, agent, 'system', 'Turn complete', sender);
	}
}

/** 處理 progress 類型記錄（子代理工具啟動/完成、bash/mcp 進度） */
function processProgressRecord(
	agentId: number,
	record: Record<string, unknown>,
	ctx: AgentContext,
): void {
	const { agents, permissionTimers, progressExtensions } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;
	const sender = ctx.floorSender(agent.floorId);

	// progress 記錄必須附上 parentToolUseID（告訴我們這是哪個父工具的進度）
	const parentToolId = record.parentToolUseID as string | undefined;
	if (!parentToolId) return;

	// 實際 payload 在 record.data
	const data = record.data as Record<string, unknown> | undefined;
	if (!data) return;

	const dataType = data.type as string | undefined;
	// 父代理等待子任務完成 → 眼睛表情
	if (dataType === 'waiting_for_task') {
		sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'eye' });
		return;
	}
	// Bash 長時間執行的階段性輸出 / MCP 工具的進度訊號
	// → restart permission timer（代表工具還活著，不要顯示權限氣泡）
	if (dataType === 'bash_progress' || dataType === 'mcp_progress') {
		if (agent.activeToolIds.has(parentToolId)) {
			restartPermissionTimerOnProgress(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender, progressExtensions);
		}
		return;
	}

	// 以下只處理 Task 工具（子代理）的進度事件
	if (agent.activeToolNames.get(parentToolId) !== 'Task') return;

	// 子代理的訊息結構：data.message.message.content（多層包裝）
	const msg = data.message as Record<string, unknown> | undefined;
	if (!msg) return;

	const msgType = msg.type as string;
	const innerMsg = msg.message as Record<string, unknown> | undefined;
	const content = innerMsg?.content;
	// content 必須是 block 陣列
	if (!Array.isArray(content)) return;

	if (msgType === 'assistant') {
		// 子代理的 assistant 訊息：掃描 tool_use 區塊
		let hasNonExemptSubTool = false;
		for (const block of content) {
			if (block.type === 'tool_use' && block.id) {
				const toolName = block.name || '';
				const status = formatToolStatus(toolName, block.input || {});
				console.log(`[Pixel Agents] Agent ${agentId} subagent tool start: ${block.id} ${status} (parent: ${parentToolId})`);

				// 巢狀 Map：parentToolId → Set<subToolId>（追蹤哪個子代理在跑哪些工具）
				let subTools = agent.activeSubagentToolIds.get(parentToolId);
				if (!subTools) {
					subTools = new Set();
					agent.activeSubagentToolIds.set(parentToolId, subTools);
				}
				subTools.add(block.id);

				// 另一個巢狀 Map：parentToolId → Map<subToolId, toolName>（用於豁免檢查）
				let subNames = agent.activeSubagentToolNames.get(parentToolId);
				if (!subNames) {
					subNames = new Map();
					agent.activeSubagentToolNames.set(parentToolId, subNames);
				}
				subNames.set(block.id, toolName);

				// 子代理也要檢查豁免清單
				if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
					hasNonExemptSubTool = true;
				}

				// 廣播子代理工具開始事件（客戶端會畫出子代理角色）
				sender?.postMessage({
					type: 'subagentToolStart',
					id: agentId,
					parentToolId,
					toolId: block.id,
					status,
				});
			}
		}
		// 子代理用了非豁免工具 → 父代理啟動 permission timer（權限氣泡會同時出現在父子上）
		if (hasNonExemptSubTool) {
			progressExtensions.delete(agentId); // 子代理新工具開始，重設進度延長計數
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
		}
	} else if (msgType === 'user') {
		// 子代理的 user 訊息：tool_result（子工具完成）
		for (const block of content) {
			if (block.type === 'tool_result' && block.tool_use_id) {
				console.log(`[Pixel Agents] Agent ${agentId} subagent tool done: ${block.tool_use_id} (parent: ${parentToolId})`);

				// 從父→子 Map 中移除此子工具
				const subTools = agent.activeSubagentToolIds.get(parentToolId);
				if (subTools) {
					subTools.delete(block.tool_use_id);
				}
				const subNames = agent.activeSubagentToolNames.get(parentToolId);
				if (subNames) {
					subNames.delete(block.tool_use_id);
				}

				// 同樣延遲 300ms 廣播 done，避免批次合併
				const toolId = block.tool_use_id;
				setTimeout(() => {
					sender?.postMessage({
						type: 'subagentToolDone',
						id: agentId,
						parentToolId,
						toolId,
					});
				}, TOOL_DONE_DELAY_MS);
			}
		}
		// 走訪所有父代理的子代理，檢查是否仍有非豁免的活躍子工具
		let stillHasNonExempt = false;
		for (const [, subNames] of agent.activeSubagentToolNames) {
			for (const [, toolName] of subNames) {
				if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
					stillHasNonExempt = true;
					break;
				}
			}
			if (stillHasNonExempt) break;
		}
		// 仍有非豁免工具 → 重新啟動 permission timer 繼續監看
		if (stillHasNonExempt) {
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
		}
	}
}

// ── Codex 解析器 ─────────────────────────────────────────────

/** 解析 Codex JSONL 記錄，映射至標準代理事件 */
function processCodexLine(
	agentId: number,
	record: Record<string, unknown>,
	ctx: AgentContext,
): void {
	const { agents, waitingTimers, permissionTimers, progressExtensions } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;
	const sender = ctx.floorSender(agent.floorId);

	// Codex 格式：外層 type + payload（含 payload.type 作為細分）
	const recordType = record.type as string;
	const payload = record.payload as Record<string, unknown> | undefined;
	if (!payload) return;

	const payloadType = payload.type as string | undefined;

	// ── turn_context：包含本回合使用的模型名稱 ──
	if (recordType === 'turn_context') {
		const model = payload.model as string | undefined;
		if (model && agent.model !== model) {
			agent.model = model;
			sender?.postMessage({ type: 'agentModel', id: agentId, model });
		}
		return;
	}

	// ── session_meta：會話層級資訊，有時也帶模型供應商 ──
	if (recordType === 'session_meta') {
		const model = payload.model_provider as string | undefined;
		// 只在代理尚未有模型資訊時採用（避免覆蓋 turn_context 的準確模型）
		if (model && !agent.model) {
			agent.model = model;
			sender?.postMessage({ type: 'agentModel', id: agentId, model });
		}
		return;
	}

	// ── function_call：Codex 的工具呼叫（相當於 Claude 的 tool_use） ──
	if (recordType === 'response_item' && payloadType === 'function_call') {
		const toolName = payload.name as string || '';
		const callId = payload.call_id as string || '';
		if (!callId) return;

		// 進入工具執行狀態
		cancelWaitingTimer(agentId, waitingTimers);
		agent.isWaiting = false;
		agent.hadToolsInTurn = true;
		sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });
		sender?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
		appendStatusHistory(agent, 'active', 'tool_use');

		// Codex 的 arguments 通常是 JSON 字串，需自行解析
		let toolInput: Record<string, unknown> = {};
		if (typeof payload.arguments === 'string') {
			// 解析失敗不中斷（某些版本用物件）
			try { toolInput = JSON.parse(payload.arguments as string); } catch { /* 忽略 */ }
		} else if (typeof payload.arguments === 'object' && payload.arguments) {
			// 也有可能直接是物件
			toolInput = payload.arguments as Record<string, unknown>;
		}

		// 格式化狀態並記錄至 active Map
		const status = formatToolStatus(toolName, toolInput);
		console.log(`[Pixel Agents] Agent ${agentId} (codex) tool start: ${callId} ${status}`);
		agent.activeToolIds.add(callId);
		agent.activeToolStatuses.set(callId, status);
		agent.activeToolNames.set(callId, toolName);

		// 非豁免工具啟動 permission timer
		if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
			progressExtensions.delete(agentId);
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
		}

		sender?.postMessage({ type: 'agentToolStart', id: agentId, toolId: callId, status });
		// 成長系統：增加經驗值
		recordToolCall(agentId, agent, toolName, sender);
		appendTranscript(agentId, agent, 'assistant', status, sender);
		return;
	}

	// ── function_call_output：Codex 工具結果（相當於 Claude 的 tool_result） ──
	if (recordType === 'response_item' && payloadType === 'function_call_output') {
		const callId = payload.call_id as string || '';
		// 必須對應到一個追蹤中的工具呼叫
		if (!callId || !agent.activeToolIds.has(callId)) return;

		console.log(`[Pixel Agents] Agent ${agentId} (codex) tool done: ${callId}`);
		// 統計 + 歷程
		const completedName = agent.activeToolNames.get(callId);
		if (completedName) {
			incrementToolCall(completedName);
			appendStatusHistory(agent, 'tool_done', completedName);
		}
		// 從 active Map 清除
		agent.activeToolIds.delete(callId);
		agent.activeToolStatuses.delete(callId);
		agent.activeToolNames.delete(callId);

		// 延遲 300ms 廣播 done（同 Claude 邏輯）
		const toolId = callId;
		setTimeout(() => {
			sender?.postMessage({ type: 'agentToolDone', id: agentId, toolId });
		}, TOOL_DONE_DELAY_MS);

		// 所有工具完成 → 重設 hadToolsInTurn
		if (agent.activeToolIds.size === 0) {
			agent.hadToolsInTurn = false;
		}
		return;
	}

	// ── reasoning：Codex 的 thinking 區塊 ──
	if (recordType === 'response_item' && payloadType === 'reasoning') {
		sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: true });
		appendStatusHistory(agent, 'thinking');
		appendTranscript(agentId, agent, 'assistant', '[thinking]', sender);
		return;
	}

	// ── user_message：新回合開始（使用者提示） ──
	if (recordType === 'event_msg' && payloadType === 'user_message') {
		cancelWaitingTimer(agentId, waitingTimers);
		clearAgentActivity(agent, agentId, permissionTimers, sender, progressExtensions);
		agent.hadToolsInTurn = false;
		appendStatusHistory(agent, 'user_prompt');
		return;
	}

	// ── task_complete：Codex 的回合結束訊號（相當於 Claude 的 turn_duration） ──
	if (recordType === 'event_msg' && payloadType === 'task_complete') {
		cancelWaitingTimer(agentId, waitingTimers);
		cancelPermissionTimer(agentId, permissionTimers);
		sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });

		// 安全防護：清除殘留工具
		if (agent.activeToolIds.size > 0) {
			agent.activeToolIds.clear();
			agent.activeToolStatuses.clear();
			agent.activeToolNames.clear();
			sender?.postMessage({ type: 'agentToolsClear', id: agentId });
		}

		// 進入等待狀態（顯示勾號氣泡）
		agent.isWaiting = true;
		agent.permissionSent = false;
		agent.hadToolsInTurn = false;
		sender?.postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
		recordTurnComplete(agentId, agent, sender);
		appendStatusHistory(agent, 'waiting', 'turn_complete');
		appendTranscript(agentId, agent, 'system', 'Turn complete', sender);
		return;
	}
}

// ── Gemini 解析器 ────────────────────────────────────────────

/** 解析 Gemini JSON 會話訊息，映射至標準代理事件 */
function processGeminiMessage(
	agentId: number,
	record: Record<string, unknown>,
	ctx: AgentContext,
): void {
	const { agents, waitingTimers, permissionTimers, progressExtensions } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;
	const sender = ctx.floorSender(agent.floorId);

	// Gemini 每則 message 一定有 type 欄位
	const msgType = record.type as string;

	// ── gemini：模型回覆（可能含 thoughts、toolCalls、content） ──
	if (msgType === 'gemini') {
		// 模型名稱偵測（同 Claude/Codex 路徑）
		const model = record.model as string | undefined;
		if (model && agent.model !== model) {
			agent.model = model;
			sender?.postMessage({ type: 'agentModel', id: agentId, model });
		}

		// Gemini 沒有明確的 tool_result 訊息，於下一個 gemini 訊息時視為前一輪工具完成
		if (agent.activeToolIds.size > 0) {
			for (const toolId of agent.activeToolIds) {
				// 逐一結算上一輪的工具
				const completedName = agent.activeToolNames.get(toolId);
				if (completedName) {
					incrementToolCall(completedName);
					appendStatusHistory(agent, 'tool_done', completedName);
				}
				sender?.postMessage({ type: 'agentToolDone', id: agentId, toolId });
			}
			// 清空 active 狀態
			agent.activeToolIds.clear();
			agent.activeToolStatuses.clear();
			agent.activeToolNames.clear();
		}

		// thoughts：Gemini 的 thinking 結構（description 欄位）
		const thoughts = record.thoughts as Array<Record<string, unknown>> | undefined;
		if (thoughts && thoughts.length > 0) {
			sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: true });
			// 深度思考偵測：累計所有 description 長度
			const totalLength = thoughts.reduce((sum, t) => {
				const desc = t.description as string | undefined;
				return sum + (desc?.length ?? 0);
			}, 0);
			if (totalLength > THINKING_DEPTH_THRESHOLD) {
				sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'idea' });
			}
		}

		// toolCalls：本輪的工具呼叫陣列
		const toolCalls = record.toolCalls as Array<Record<string, unknown>> | undefined;
		if (toolCalls && toolCalls.length > 0) {
			// 進入工具執行狀態
			cancelWaitingTimer(agentId, waitingTimers);
			agent.isWaiting = false;
			agent.hadToolsInTurn = true;
			sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });
			sender?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
			appendStatusHistory(agent, 'active', 'tool_use');

			let hasNonExempt = false;
			for (const tc of toolCalls) {
				const toolName = tc.name as string || '';
				// Gemini 不一定給 call ID，沒有就合成一個（時間戳 + 隨機碼）
				const callId = tc.id as string || `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
				// args 作為工具輸入參數
				const toolInput = (tc.args || {}) as Record<string, unknown>;

				const status = formatToolStatus(toolName, toolInput);
				console.log(`[Pixel Agents] Agent ${agentId} (gemini) tool start: ${callId} ${status}`);
				agent.activeToolIds.add(callId);
				agent.activeToolStatuses.set(callId, status);
				agent.activeToolNames.set(callId, toolName);

				// 豁免檢查（同其他 CLI）
				if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
					hasNonExempt = true;
				}

				sender?.postMessage({ type: 'agentToolStart', id: agentId, toolId: callId, status });
				recordToolCall(agentId, agent, toolName, sender);
			}

			// 有非豁免工具 → 啟動 permission timer
			if (hasNonExempt) {
				progressExtensions.delete(agentId);
				startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
			}

			// 取最後一個工具的狀態作為轉錄摘要
			const lastStatus = [...agent.activeToolStatuses.values()].pop() || 'Using tools';
			appendTranscript(agentId, agent, 'assistant', lastStatus, sender);
		} else {
			// 純文字回覆（無工具）→ 視為回合結束（Gemini 沒有 turn_duration）
			sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });
			const content = record.content as string | undefined;
			if (content) {
				// 進入等待狀態
				agent.isWaiting = true;
				agent.hadToolsInTurn = false;
				sender?.postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
				recordTurnComplete(agentId, agent, sender);
				appendStatusHistory(agent, 'waiting', 'turn_complete');
				// 轉錄記錄：文字超過 60 字截斷
				const trimmed = content.trim();
				appendTranscript(agentId, agent, 'assistant', trimmed.length > 60 ? trimmed.slice(0, 60) + '\u2026' : trimmed, sender);
			}
		}
		return;
	}

	// ── user：使用者提示訊息 ──
	if (msgType === 'user') {
		cancelWaitingTimer(agentId, waitingTimers);
		clearAgentActivity(agent, agentId, permissionTimers, sender, progressExtensions);
		agent.hadToolsInTurn = false;
		appendStatusHistory(agent, 'user_prompt');

		// content 是陣列，每項可能是 {text: "..."} 結構，合併後截斷顯示
		const contentArr = record.content as Array<Record<string, unknown>> | undefined;
		if (contentArr && contentArr.length > 0) {
			const text = contentArr.map(c => (c.text as string) || '').join(' ').trim();
			if (text) {
				appendTranscript(agentId, agent, 'user', text.length > 60 ? text.slice(0, 60) + '\u2026' : text, sender);
			}
		}
		return;
	}

	// ── error：錯誤訊息（只記入狀態歷程，不影響代理狀態） ──
	if (msgType === 'error') {
		appendStatusHistory(agent, 'error');
		return;
	}
}
