import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cancelWaitingTimer, startWaitingTimer, cancelPermissionTimer, clearAgentActivity } from '../src/timerManager.js';
import type { AgentState, MessageSender } from '../src/types.js';

function createAgent(overrides: Partial<AgentState> = {}): AgentState {
	return {
		id: 1,
		process: null,
		projectDir: '/tmp',
		jsonlFile: '/tmp/test.jsonl',
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(['tool-1']),
		activeToolStatuses: new Map([['tool-1', 'Reading']]),
		activeToolNames: new Map([['tool-1', 'Read']]),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		isWaiting: false,
		permissionSent: true,
		hadToolsInTurn: true,
		model: null,
		tmuxSessionName: null,
		isDetached: false,
		...overrides,
	};
}

function createSender(): MessageSender & { messages: unknown[] } {
	const messages: unknown[] = [];
	return {
		messages,
		postMessage(msg: unknown) { messages.push(msg); },
	};
}

describe('cancelWaitingTimer', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('clears and removes existing timer', () => {
		const timers = new Map<number, ReturnType<typeof setTimeout>>();
		timers.set(1, setTimeout(() => {}, 5000));
		expect(timers.has(1)).toBe(true);

		cancelWaitingTimer(1, timers);
		expect(timers.has(1)).toBe(false);
	});

	it('does nothing if no timer exists', () => {
		const timers = new Map<number, ReturnType<typeof setTimeout>>();
		cancelWaitingTimer(1, timers);
		expect(timers.size).toBe(0);
	});
});

describe('startWaitingTimer', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('sets agent to waiting after delay', () => {
		const agents = new Map<number, AgentState>();
		const agent = createAgent({ isWaiting: false });
		agents.set(1, agent);
		const timers = new Map<number, ReturnType<typeof setTimeout>>();
		const sender = createSender();

		startWaitingTimer(1, 5000, agents, timers, sender);
		expect(timers.has(1)).toBe(true);
		expect(agent.isWaiting).toBe(false);

		vi.advanceTimersByTime(5000);
		expect(agent.isWaiting).toBe(true);
		expect(sender.messages).toContainEqual({ type: 'agentStatus', id: 1, status: 'waiting' });
		expect(timers.has(1)).toBe(false);
	});

	it('cancels previous timer when starting new one', () => {
		const agents = new Map<number, AgentState>();
		agents.set(1, createAgent());
		const timers = new Map<number, ReturnType<typeof setTimeout>>();
		const sender = createSender();

		startWaitingTimer(1, 5000, agents, timers, sender);
		startWaitingTimer(1, 5000, agents, timers, sender);

		vi.advanceTimersByTime(5000);
		// Only one waiting message should be sent
		const waitingMsgs = sender.messages.filter(
			(m: unknown) => (m as { type: string }).type === 'agentStatus',
		);
		expect(waitingMsgs).toHaveLength(1);
	});
});

describe('clearAgentActivity', () => {
	it('clears all tool state and sends messages', () => {
		const agent = createAgent();
		const permTimers = new Map<number, ReturnType<typeof setTimeout>>();
		const sender = createSender();

		clearAgentActivity(agent, 1, permTimers, sender);

		expect(agent.activeToolIds.size).toBe(0);
		expect(agent.activeToolStatuses.size).toBe(0);
		expect(agent.activeToolNames.size).toBe(0);
		expect(agent.isWaiting).toBe(false);
		expect(agent.permissionSent).toBe(false);
		expect(sender.messages).toContainEqual({ type: 'agentToolsClear', id: 1 });
		expect(sender.messages).toContainEqual({ type: 'agentStatus', id: 1, status: 'active' });
	});

	it('handles undefined agent gracefully', () => {
		const permTimers = new Map<number, ReturnType<typeof setTimeout>>();
		const sender = createSender();
		clearAgentActivity(undefined, 1, permTimers, sender);
		expect(sender.messages).toHaveLength(0);
	});
});
