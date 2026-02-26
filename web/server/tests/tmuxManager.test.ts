import { describe, it, expect } from 'vitest';
import { tmuxSessionName, parseSessionUuid, TMUX_SESSION_PREFIX } from '../src/tmuxManager.js';

describe('tmuxSessionName', () => {
	it('builds session name from UUID', () => {
		const uuid = 'abc-123-def';
		expect(tmuxSessionName(uuid)).toBe(`${TMUX_SESSION_PREFIX}-abc-123-def`);
	});

	it('uses correct prefix', () => {
		expect(TMUX_SESSION_PREFIX).toBe('pixel-agents');
	});
});

describe('parseSessionUuid', () => {
	it('extracts UUID from valid session name', () => {
		expect(parseSessionUuid('pixel-agents-abc-123')).toBe('abc-123');
	});

	it('returns null for non-matching name', () => {
		expect(parseSessionUuid('other-session')).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(parseSessionUuid('')).toBeNull();
	});

	it('roundtrips with tmuxSessionName', () => {
		const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
		const name = tmuxSessionName(uuid);
		expect(parseSessionUuid(name)).toBe(uuid);
	});
});
