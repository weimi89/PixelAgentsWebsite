import type { MessageSender } from './types.js';
import { DEFAULT_FLOOR_ID } from './constants.js';

interface DemoTool {
	name: string;
	status: string;
	duration: number;
	isSubagent?: boolean;
}

// 演示工具序列，用於模擬真實的代理行為
const DEMO_TOOL_SEQUENCES: DemoTool[][] = [
	[
		{ name: 'Read', status: 'Reading index.ts', duration: 1500 },
		{ name: 'Edit', status: 'Editing index.ts', duration: 2500 },
		{ name: 'Bash', status: 'Running: npm run build', duration: 3000 },
	],
	[
		{ name: 'Glob', status: 'Searching files', duration: 800 },
		{ name: 'Read', status: 'Reading App.tsx', duration: 1200 },
		{ name: 'Grep', status: 'Searching code', duration: 1000 },
		{ name: 'Edit', status: 'Editing App.tsx', duration: 2000 },
	],
	[
		{ name: 'Read', status: 'Reading package.json', duration: 1000 },
		{ name: 'Write', status: 'Writing config.ts', duration: 1800 },
		{ name: 'Bash', status: 'Running: npx tsc --noEmit', duration: 4000 },
	],
	[
		{ name: 'WebSearch', status: 'Searching the web', duration: 2000 },
		{ name: 'WebFetch', status: 'Fetching web content', duration: 2500 },
		{ name: 'Read', status: 'Reading utils.ts', duration: 1000 },
		{ name: 'Edit', status: 'Editing utils.ts', duration: 2000 },
	],
	[
		{ name: 'Task', status: 'Subtask: Explore codebase', duration: 5000, isSubagent: true },
	],
];

interface DemoAgent {
	id: number;
	currentSequence: number;
	timers: ReturnType<typeof setTimeout>[];
}

const demoAgents: DemoAgent[] = [];
let nextDemoId = 1;
let demoSender: MessageSender | undefined;
const spawnTimers: ReturnType<typeof setTimeout>[] = [];

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickSequence(): typeof DEMO_TOOL_SEQUENCES[number] {
	return DEMO_TOOL_SEQUENCES[randomInt(0, DEMO_TOOL_SEQUENCES.length - 1)];
}

function runToolSequence(agent: DemoAgent): void {
	const sender = demoSender;
	if (!sender) return;

	const sequence = pickSequence();
	let delay = randomInt(500, 2000); // 啟動工具前的初始暫停

	for (let i = 0; i < sequence.length; i++) {
		const tool = sequence[i];
		const toolId = `demo-${agent.id}-${agent.currentSequence}-${i}`;

		// 啟動工具
		agent.timers.push(setTimeout(() => {
			sender.postMessage({
				type: 'agentToolStart',
				id: agent.id,
				toolId,
				status: tool.status,
			});
			sender.postMessage({
				type: 'agentStatus',
				id: agent.id,
				status: 'active',
			});

			// 如果是子任務，建立子代理
			if (tool.isSubagent) {
				sender.postMessage({
					type: 'subagentToolStart',
					id: agent.id,
					parentToolId: toolId,
					toolId: `${toolId}-sub-0`,
					status: 'Reading README.md',
				});
				// 稍後完成子代理工具
				agent.timers.push(setTimeout(() => {
					sender.postMessage({
						type: 'subagentToolDone',
						id: agent.id,
						parentToolId: toolId,
						toolId: `${toolId}-sub-0`,
					});
					// 第二個子代理工具
					agent.timers.push(setTimeout(() => {
						sender.postMessage({
							type: 'subagentToolStart',
							id: agent.id,
							parentToolId: toolId,
							toolId: `${toolId}-sub-1`,
							status: 'Searching code',
						});
						agent.timers.push(setTimeout(() => {
							sender.postMessage({
								type: 'subagentToolDone',
								id: agent.id,
								parentToolId: toolId,
								toolId: `${toolId}-sub-1`,
							});
						}, 1500));
					}, 500));
				}, 2000));
			}
		}, delay));

		delay += tool.duration;

		// 結束工具
		agent.timers.push(setTimeout(() => {
			sender.postMessage({
				type: 'agentToolDone',
				id: agent.id,
				toolId,
			});
			if (tool.isSubagent) {
				sender.postMessage({
					type: 'subagentClear',
					id: agent.id,
					parentToolId: toolId,
				});
			}
		}, delay));

		delay += randomInt(300, 800); // 工具之間的間隔
	}

	// 所有工具完成後 → 等待狀態
	agent.timers.push(setTimeout(() => {
		sender.postMessage({
			type: 'agentStatus',
			id: agent.id,
			status: 'waiting',
		});
		// 等待期結束後，啟動下一個序列
		const waitTime = randomInt(3000, 8000);
		agent.timers.push(setTimeout(() => {
			agent.currentSequence++;
			runToolSequence(agent);
		}, waitTime));
	}, delay + 500));
}

export function startDemoMode(sender: MessageSender, agentCount: number = 3): void {
	demoSender = sender;
	console.log(`[Pixel Agents] Demo mode: spawning ${agentCount} agents`);

	// 以交錯時間生成代理
	for (let i = 0; i < agentCount; i++) {
		spawnTimers.push(setTimeout(() => {
			const id = nextDemoId++;
			const agent: DemoAgent = {
				id,
				currentSequence: 0,
				timers: [],
			};
			demoAgents.push(agent);
			sender.postMessage({ type: 'agentCreated', id, floorId: DEFAULT_FLOOR_ID });
			// 模擬模型指派 — 在模型間交替
			const demoModels = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'];
			sender.postMessage({ type: 'agentModel', id, model: demoModels[(id - 1) % demoModels.length] });
			console.log(`[Pixel Agents] Demo agent ${id} created`);

			// 短暫延遲後開始活動
			agent.timers.push(setTimeout(() => {
				runToolSequence(agent);
			}, randomInt(1000, 3000)));
		}, i * 1500));
	}
}

export function stopDemoMode(): void {
	for (const t of spawnTimers) {
		clearTimeout(t);
	}
	spawnTimers.length = 0;
	for (const agent of demoAgents) {
		for (const t of agent.timers) {
			clearTimeout(t);
		}
	}
	demoAgents.length = 0;
	nextDemoId = 1;
	demoSender = undefined;
	console.log('[Pixel Agents] Demo mode stopped');
}

export function isDemoEnabled(): boolean {
	return process.argv.includes('--demo') || process.env['DEMO'] === '1';
}
