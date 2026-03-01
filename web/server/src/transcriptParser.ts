import * as path from 'path';
import type { AgentContext } from './types.js';
import {
	cancelWaitingTimer,
	startWaitingTimer,
	clearAgentActivity,
	startPermissionTimer,
	cancelPermissionTimer,
} from './timerManager.js';
import {
	TOOL_DONE_DELAY_MS,
	TEXT_IDLE_DELAY_MS,
	BASH_COMMAND_DISPLAY_MAX_LENGTH,
	TASK_DESCRIPTION_DISPLAY_MAX_LENGTH,
	MAX_TRANSCRIPT_LOG,
} from './constants.js';

/** 工具權限豁免清單 — 這些工具不會觸發權限等待偵測 */
export const PERMISSION_EXEMPT_TOOLS = new Set(['Task', 'AskUserQuestion']);

/** 依照工具名稱與輸入參數，格式化可讀的工具狀態文字 */
export function formatToolStatus(toolName: string, input: Record<string, unknown>): string {
	const base = (p: unknown) => typeof p === 'string' ? path.basename(p) : '';
	switch (toolName) {
		case 'Read': return `Reading ${base(input.file_path)}`;
		case 'Edit': return `Editing ${base(input.file_path)}`;
		case 'Write': return `Writing ${base(input.file_path)}`;
		case 'Bash': {
			const cmd = (input.command as string) || '';
			return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + '\u2026' : cmd}`;
		}
		case 'Glob': return 'Searching files';
		case 'Grep': return 'Searching code';
		case 'WebFetch': return 'Fetching web content';
		case 'WebSearch': return 'Searching the web';
		case 'Task': {
			const desc = typeof input.description === 'string' ? input.description : '';
			const agentType = typeof input.subagent_type === 'string' ? input.subagent_type : '';
			const typeTag = agentType ? `[${agentType}] ` : '';
			return desc ? `Subtask: ${typeTag}${desc.length > TASK_DESCRIPTION_DISPLAY_MAX_LENGTH ? desc.slice(0, TASK_DESCRIPTION_DISPLAY_MAX_LENGTH) + '\u2026' : desc}` : 'Running subtask';
		}
		case 'AskUserQuestion': return 'Waiting for your answer';
		case 'EnterPlanMode': return 'Planning';
		case 'NotebookEdit': return `Editing notebook`;
		default: return `Using ${toolName}`;
	}
}

/** 追加一筆精簡轉錄記錄到代理的 transcriptLog，並推送至客戶端 */
function appendTranscript(
	agentId: number,
	agent: { transcriptLog: Array<{ ts: number; role: 'user' | 'assistant' | 'system'; summary: string }> },
	role: 'user' | 'assistant' | 'system',
	summary: string,
	sender: import('./types.js').MessageSender | undefined,
): void {
	const entry = { ts: Date.now(), role, summary };
	agent.transcriptLog.push(entry);
	if (agent.transcriptLog.length > MAX_TRANSCRIPT_LOG) {
		agent.transcriptLog.splice(0, agent.transcriptLog.length - MAX_TRANSCRIPT_LOG);
	}
	sender?.postMessage({ type: 'agentTranscript', id: agentId, log: agent.transcriptLog });
}

/** 解析單行 JSONL 轉錄記錄，更新代理狀態並發送對應訊息 */
export function processTranscriptLine(
	agentId: number,
	line: string,
	ctx: AgentContext,
): void {
	const { agents, waitingTimers, permissionTimers } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;
	const sender = ctx.floorSender(agent.floorId);
	try {
		const record = JSON.parse(line);

		if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
			// 從助手記錄中提取模型名稱
			const model = record.message?.model as string | undefined;
			if (model && agent.model !== model) {
				agent.model = model;
				sender?.postMessage({ type: 'agentModel', id: agentId, model });
			}

			const blocks = record.message.content as Array<{
				type: string; id?: string; name?: string; input?: Record<string, unknown>;
			}>;

			// 偵測 thinking 區塊
			const hasThinking = blocks.some(b => b.type === 'thinking');
			if (hasThinking) {
				sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: true });
			}

			// 偵測 image 區塊 → 相機表情
			const hasImage = blocks.some(b => b.type === 'image');
			if (hasImage) {
				sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'camera' });
			}

			const hasToolUse = blocks.some(b => b.type === 'tool_use');

			if (hasToolUse) {
				cancelWaitingTimer(agentId, waitingTimers);
				agent.isWaiting = false;
				agent.hadToolsInTurn = true;
				// 工具使用開始時清除思考狀態
				sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });
				sender?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
				let hasNonExemptTool = false;
				for (const block of blocks) {
					if (block.type === 'tool_use' && block.id) {
						const toolName = block.name || '';
						const status = formatToolStatus(toolName, block.input || {});
						console.log(`[Pixel Agents] Agent ${agentId} tool start: ${block.id} ${status}`);
						agent.activeToolIds.add(block.id);
						agent.activeToolStatuses.set(block.id, status);
						agent.activeToolNames.set(block.id, toolName);
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
				if (hasNonExemptTool) {
					startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
				}
				// 轉錄：記錄工具呼叫
				const lastStatus = agent.activeToolStatuses.size > 0 ? [...agent.activeToolStatuses.values()].pop()! : 'Using tools';
				appendTranscript(agentId, agent, 'assistant', lastStatus, sender);
			} else if (hasThinking) {
				appendTranscript(agentId, agent, 'assistant', '[thinking]', sender);
			} else if (blocks.some(b => b.type === 'text') && !agent.hadToolsInTurn) {
				startWaitingTimer(agentId, TEXT_IDLE_DELAY_MS, agents, waitingTimers, sender);
				appendTranscript(agentId, agent, 'assistant', 'Responding...', sender);
			}
		} else if (record.type === 'progress') {
			processProgressRecord(agentId, record, ctx);
		} else if (record.type === 'user') {
			const content = record.message?.content;
			if (Array.isArray(content)) {
				const blocks = content as Array<{ type: string; tool_use_id?: string }>;
				const hasToolResult = blocks.some(b => b.type === 'tool_result');
				if (hasToolResult) {
					for (const block of blocks) {
						if (block.type === 'tool_result' && block.tool_use_id) {
							console.log(`[Pixel Agents] Agent ${agentId} tool done: ${block.tool_use_id}`);
							const completedToolId = block.tool_use_id;
							if (agent.activeToolNames.get(completedToolId) === 'Task') {
								agent.activeSubagentToolIds.delete(completedToolId);
								agent.activeSubagentToolNames.delete(completedToolId);
								sender?.postMessage({
									type: 'subagentClear',
									id: agentId,
									parentToolId: completedToolId,
								});
							}
							agent.activeToolIds.delete(completedToolId);
							agent.activeToolStatuses.delete(completedToolId);
							agent.activeToolNames.delete(completedToolId);
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
					if (agent.activeToolIds.size === 0) {
						agent.hadToolsInTurn = false;
					}
					appendTranscript(agentId, agent, 'user', `Result: ${blocks.filter(b => b.type === 'tool_result').map(b => (b.tool_use_id || '').slice(0, 8)).join(', ')}`, sender);
				} else {
					cancelWaitingTimer(agentId, waitingTimers);
					clearAgentActivity(agent, agentId, permissionTimers, sender);
					agent.hadToolsInTurn = false;
				}
			} else if (typeof content === 'string' && content.trim()) {
				cancelWaitingTimer(agentId, waitingTimers);
				clearAgentActivity(agent, agentId, permissionTimers, sender);
				agent.hadToolsInTurn = false;
				const trimmed = content.trim();
				appendTranscript(agentId, agent, 'user', trimmed.length > 60 ? trimmed.slice(0, 60) + '\u2026' : trimmed, sender);
			}
		} else if (record.type === 'system' && record.subtype === 'compact_boundary') {
			sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'compress' });
			appendTranscript(agentId, agent, 'system', 'Context compacted', sender);
		} else if (record.type === 'system' && record.subtype === 'turn_duration') {
			cancelWaitingTimer(agentId, waitingTimers);
			cancelPermissionTimer(agentId, permissionTimers);
			// 回合結束時清除思考狀態
			sender?.postMessage({ type: 'agentThinking', id: agentId, thinking: false });

			if (agent.activeToolIds.size > 0) {
				agent.activeToolIds.clear();
				agent.activeToolStatuses.clear();
				agent.activeToolNames.clear();
				agent.activeSubagentToolIds.clear();
				agent.activeSubagentToolNames.clear();
				sender?.postMessage({ type: 'agentToolsClear', id: agentId });
			}

			agent.isWaiting = true;
			agent.permissionSent = false;
			agent.hadToolsInTurn = false;
			sender?.postMessage({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
			appendTranscript(agentId, agent, 'system', 'Turn complete', sender);
		}
	} catch {
		// 忽略格式錯誤的行
	}
}

/** 處理 progress 類型記錄（子代理工具啟動/完成、bash/mcp 進度） */
function processProgressRecord(
	agentId: number,
	record: Record<string, unknown>,
	ctx: AgentContext,
): void {
	const { agents, permissionTimers } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;
	const sender = ctx.floorSender(agent.floorId);

	const parentToolId = record.parentToolUseID as string | undefined;
	if (!parentToolId) return;

	const data = record.data as Record<string, unknown> | undefined;
	if (!data) return;

	const dataType = data.type as string | undefined;
	if (dataType === 'waiting_for_task') {
		sender?.postMessage({ type: 'agentEmote', id: agentId, emote: 'eye' });
		return;
	}
	if (dataType === 'bash_progress' || dataType === 'mcp_progress') {
		if (agent.activeToolIds.has(parentToolId)) {
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
		}
		return;
	}

	if (agent.activeToolNames.get(parentToolId) !== 'Task') return;

	const msg = data.message as Record<string, unknown> | undefined;
	if (!msg) return;

	const msgType = msg.type as string;
	const innerMsg = msg.message as Record<string, unknown> | undefined;
	const content = innerMsg?.content;
	if (!Array.isArray(content)) return;

	if (msgType === 'assistant') {
		let hasNonExemptSubTool = false;
		for (const block of content) {
			if (block.type === 'tool_use' && block.id) {
				const toolName = block.name || '';
				const status = formatToolStatus(toolName, block.input || {});
				console.log(`[Pixel Agents] Agent ${agentId} subagent tool start: ${block.id} ${status} (parent: ${parentToolId})`);

				let subTools = agent.activeSubagentToolIds.get(parentToolId);
				if (!subTools) {
					subTools = new Set();
					agent.activeSubagentToolIds.set(parentToolId, subTools);
				}
				subTools.add(block.id);

				let subNames = agent.activeSubagentToolNames.get(parentToolId);
				if (!subNames) {
					subNames = new Map();
					agent.activeSubagentToolNames.set(parentToolId, subNames);
				}
				subNames.set(block.id, toolName);

				if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
					hasNonExemptSubTool = true;
				}

				sender?.postMessage({
					type: 'subagentToolStart',
					id: agentId,
					parentToolId,
					toolId: block.id,
					status,
				});
			}
		}
		if (hasNonExemptSubTool) {
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
		}
	} else if (msgType === 'user') {
		for (const block of content) {
			if (block.type === 'tool_result' && block.tool_use_id) {
				console.log(`[Pixel Agents] Agent ${agentId} subagent tool done: ${block.tool_use_id} (parent: ${parentToolId})`);

				const subTools = agent.activeSubagentToolIds.get(parentToolId);
				if (subTools) {
					subTools.delete(block.tool_use_id);
				}
				const subNames = agent.activeSubagentToolNames.get(parentToolId);
				if (subNames) {
					subNames.delete(block.tool_use_id);
				}

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
		if (stillHasNonExempt) {
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, sender);
		}
	}
}
