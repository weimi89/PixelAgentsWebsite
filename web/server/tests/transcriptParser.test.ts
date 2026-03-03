import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatToolStatus, processTranscriptLine, PERMISSION_EXEMPT_TOOLS } from '../src/transcriptParser.js';
import type { AgentState, AgentContext, MessageSender } from '../src/types.js';

// ── formatToolStatus ────────────────────────────────────────

describe('formatToolStatus', () => {
	it('formats Read with basename', () => {
		expect(formatToolStatus('Read', { file_path: '/foo/bar/index.ts' }))
			.toBe('Reading index.ts');
	});

	it('formats Edit with basename', () => {
		expect(formatToolStatus('Edit', { file_path: '/src/App.tsx' }))
			.toBe('Editing App.tsx');
	});

	it('formats Write with basename', () => {
		expect(formatToolStatus('Write', { file_path: '/tmp/config.ts' }))
			.toBe('Writing config.ts');
	});

	it('formats Bash with truncation', () => {
		const cmd = 'npm run build:production --verbose --all';
		const result = formatToolStatus('Bash', { command: cmd });
		expect(result).toContain('Running: ');
		expect(result.length).toBeLessThanOrEqual('Running: '.length + 31); // 30 + ellipsis
	});

	it('formats Bash with short command', () => {
		expect(formatToolStatus('Bash', { command: 'ls' }))
			.toBe('Running: ls');
	});

	it('formats Glob', () => {
		expect(formatToolStatus('Glob', {})).toBe('Searching files');
	});

	it('formats Grep', () => {
		expect(formatToolStatus('Grep', {})).toBe('Searching code');
	});

	it('formats Task with description', () => {
		expect(formatToolStatus('Task', { description: 'Explore codebase' }))
			.toBe('Subtask: Explore codebase');
	});

	it('formats Task with long description truncation', () => {
		const desc = 'A'.repeat(50);
		const result = formatToolStatus('Task', { description: desc });
		expect(result).toContain('Subtask: ');
		expect(result.endsWith('\u2026')).toBe(true);
	});

	it('formats Task without description', () => {
		expect(formatToolStatus('Task', {})).toBe('Running subtask');
	});

	it('formats unknown tool', () => {
		expect(formatToolStatus('CustomTool', {})).toBe('Using CustomTool');
	});

	it('formats WebFetch', () => {
		expect(formatToolStatus('WebFetch', {})).toBe('Fetching web content');
	});

	it('formats WebSearch', () => {
		expect(formatToolStatus('WebSearch', {})).toBe('Searching the web');
	});

	it('formats AskUserQuestion', () => {
		expect(formatToolStatus('AskUserQuestion', {})).toBe('Waiting for your answer');
	});

	it('handles missing file_path for Read', () => {
		expect(formatToolStatus('Read', {})).toBe('Reading ');
	});
});

// ── PERMISSION_EXEMPT_TOOLS ─────────────────────────────────

describe('PERMISSION_EXEMPT_TOOLS', () => {
	it('contains Task and AskUserQuestion', () => {
		expect(PERMISSION_EXEMPT_TOOLS.has('Task')).toBe(true);
		expect(PERMISSION_EXEMPT_TOOLS.has('AskUserQuestion')).toBe(true);
	});

	it('does not contain Read or Bash', () => {
		expect(PERMISSION_EXEMPT_TOOLS.has('Read')).toBe(false);
		expect(PERMISSION_EXEMPT_TOOLS.has('Bash')).toBe(false);
	});
});

// ── processTranscriptLine ───────────────────────────────────

function createAgent(overrides: Partial<AgentState> = {}): AgentState {
	return {
		id: 1,
		process: null,
		projectDir: '/tmp',
		jsonlFile: '/tmp/test.jsonl',
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		isWaiting: false,
		permissionSent: false,
		hadToolsInTurn: false,
		model: null,
		tmuxSessionName: null,
		isDetached: false,
		transcriptLog: [],
		floorId: '1F',
		isRemote: false,
		owner: null,
		remoteSessionId: null,
		gitBranch: null,
		statusHistory: [],
		teamName: null,
		cliType: 'claude',
		growth: { xp: 0, toolCallCount: 0, sessionCount: 0, bashCallCount: 0, achievements: [] },
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

describe('processTranscriptLine', () => {
	let agents: Map<number, AgentState>;
	let waitingTimers: Map<number, ReturnType<typeof setTimeout>>;
	let permissionTimers: Map<number, ReturnType<typeof setTimeout>>;
	let sender: ReturnType<typeof createSender>;
	let ctx: AgentContext;

	beforeEach(() => {
		agents = new Map();
		waitingTimers = new Map();
		permissionTimers = new Map();
		sender = createSender();
		ctx = {
			agents,
			nextAgentIdRef: { current: 1 },
			activeAgentIdRef: { current: null },
			knownJsonlFiles: new Set(),
			fileWatchers: new Map(),
			pollingTimers: new Map(),
			waitingTimers,
			permissionTimers,
			jsonlPollTimers: new Map(),
			sender,
			floorSender: () => sender,
			progressExtensions: new Map(),
			persistAgents: () => {},
		} as AgentContext;
		vi.useFakeTimers();
	});

	it('ignores malformed JSON', () => {
		agents.set(1, createAgent());
		processTranscriptLine(1, 'not json', ctx);
		expect(sender.messages).toHaveLength(0);
	});

	it('ignores line for unknown agent', () => {
		const line = JSON.stringify({ type: 'assistant', message: { content: [] } });
		processTranscriptLine(99, line, ctx);
		expect(sender.messages).toHaveLength(0);
	});

	it('extracts model from assistant record', () => {
		const agent = createAgent();
		agents.set(1, agent);
		const line = JSON.stringify({
			type: 'assistant',
			message: { model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'hello' }] },
		});
		processTranscriptLine(1, line, ctx);
		expect(agent.model).toBe('claude-sonnet-4-6');
		expect(sender.messages).toContainEqual({ type: 'agentModel', id: 1, model: 'claude-sonnet-4-6' });
	});

	it('processes tool_use blocks', () => {
		const agent = createAgent();
		agents.set(1, agent);
		const line = JSON.stringify({
			type: 'assistant',
			message: {
				content: [
					{ type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/src/index.ts' } },
				],
			},
		});
		processTranscriptLine(1, line, ctx);
		expect(agent.activeToolIds.has('tool-1')).toBe(true);
		expect(agent.hadToolsInTurn).toBe(true);
		expect(sender.messages).toContainEqual({
			type: 'agentToolStart', id: 1, toolId: 'tool-1', status: 'Reading index.ts',
		});
	});

	it('processes tool_result and clears tool after delay', () => {
		const agent = createAgent();
		agent.activeToolIds.add('tool-1');
		agent.activeToolStatuses.set('tool-1', 'Reading index.ts');
		agent.activeToolNames.set('tool-1', 'Read');
		agent.hadToolsInTurn = true;
		agents.set(1, agent);

		const line = JSON.stringify({
			type: 'user',
			message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1' }] },
		});
		processTranscriptLine(1, line, ctx);

		expect(agent.activeToolIds.has('tool-1')).toBe(false);

		// agentToolDone is delayed
		vi.advanceTimersByTime(300);
		expect(sender.messages).toContainEqual({ type: 'agentToolDone', id: 1, toolId: 'tool-1' });
	});

	it('handles turn_duration — clears all state and marks waiting', () => {
		const agent = createAgent();
		agent.activeToolIds.add('tool-1');
		agent.activeToolStatuses.set('tool-1', 'test');
		agent.activeToolNames.set('tool-1', 'Read');
		agent.hadToolsInTurn = true;
		agents.set(1, agent);

		const line = JSON.stringify({ type: 'system', subtype: 'turn_duration' });
		processTranscriptLine(1, line, ctx);

		expect(agent.activeToolIds.size).toBe(0);
		expect(agent.isWaiting).toBe(true);
		expect(agent.hadToolsInTurn).toBe(false);
		expect(sender.messages).toContainEqual({ type: 'agentToolsClear', id: 1 });
		expect(sender.messages).toContainEqual({ type: 'agentStatus', id: 1, status: 'waiting' });
	});

	it('handles user text prompt — clears activity', () => {
		const agent = createAgent();
		agent.hadToolsInTurn = false;
		agents.set(1, agent);

		const line = JSON.stringify({
			type: 'user',
			message: { content: 'help me fix this' },
		});
		processTranscriptLine(1, line, ctx);

		expect(agent.hadToolsInTurn).toBe(false);
		expect(sender.messages).toContainEqual({ type: 'agentStatus', id: 1, status: 'active' });
	});
});
