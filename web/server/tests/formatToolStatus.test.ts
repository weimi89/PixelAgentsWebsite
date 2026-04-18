import { describe, it, expect } from 'vitest';
import { formatToolStatus, PERMISSION_EXEMPT_TOOLS, BASH_COMMAND_DISPLAY_MAX_LENGTH } from 'pixel-agents-shared';

describe('formatToolStatus', () => {
	describe('檔案工具', () => {
		it('Read uses basename', () => {
			expect(formatToolStatus('Read', { file_path: '/abs/path/to/foo.ts' })).toBe('Reading foo.ts');
		});

		it('Edit uses basename', () => {
			expect(formatToolStatus('Edit', { file_path: '/tmp/bar.js' })).toBe('Editing bar.js');
		});

		it('Write uses basename', () => {
			expect(formatToolStatus('Write', { file_path: '/var/log/baz.log' })).toBe('Writing baz.log');
		});

		it('handles missing file_path gracefully', () => {
			expect(formatToolStatus('Read', {})).toBe('Reading ');
		});
	});

	describe('Bash', () => {
		it('shows short commands in full', () => {
			const result = formatToolStatus('Bash', { command: 'ls -la' });
			expect(result).toBe('Running: ls -la');
		});

		it('truncates long commands with ellipsis', () => {
			const longCmd = 'npm install very-long-package-name-that-exceeds-limit';
			const result = formatToolStatus('Bash', { command: longCmd });
			expect(result).toContain('\u2026');
			expect(result.length).toBeLessThan(longCmd.length + 'Running: '.length);
			expect(result.startsWith('Running: ')).toBe(true);
		});

		it('truncation respects BASH_COMMAND_DISPLAY_MAX_LENGTH', () => {
			const cmd = 'x'.repeat(BASH_COMMAND_DISPLAY_MAX_LENGTH + 10);
			const result = formatToolStatus('Bash', { command: cmd });
			// Running: + 30 char + \u2026
			expect(result).toBe('Running: ' + 'x'.repeat(BASH_COMMAND_DISPLAY_MAX_LENGTH) + '\u2026');
		});

		it('handles missing command', () => {
			expect(formatToolStatus('Bash', {})).toBe('Running: ');
		});
	});

	describe('Task（子代理）', () => {
		it('formats with description', () => {
			const result = formatToolStatus('Task', { description: 'Explore codebase' });
			expect(result).toContain('Subtask:');
			expect(result).toContain('Explore codebase');
		});

		it('includes agent type tag when provided', () => {
			const result = formatToolStatus('Task', {
				description: 'Plan feature',
				subagent_type: 'Plan',
			});
			expect(result).toContain('[Plan]');
			expect(result).toContain('Plan feature');
		});

		it('falls back to "Running subtask" when no description', () => {
			expect(formatToolStatus('Task', {})).toBe('Running subtask');
		});
	});

	describe('搜尋類', () => {
		it.each([
			['Glob', 'Searching files'],
			['Grep', 'Searching code'],
			['WebFetch', 'Fetching web content'],
			['WebSearch', 'Searching the web'],
		])('%s → %s', (tool, expected) => {
			expect(formatToolStatus(tool, {})).toBe(expected);
		});
	});

	describe('Codex / Gemini CLI 工具', () => {
		it('shell with command string', () => {
			expect(formatToolStatus('shell', { command: 'echo hi' })).toBe('Running: echo hi');
		});

		it('shell with cmd array', () => {
			const result = formatToolStatus('shell', { cmd: ['bash', '-c', 'ls'] });
			expect(result).toBe('Running: ls');
		});

		it('apply_patch returns fixed label', () => {
			expect(formatToolStatus('apply_patch', {})).toBe('Applying patch');
		});

		it('read_file (Gemini/Serena) uses basename from alternative keys', () => {
			expect(formatToolStatus('read_file', { file_path: '/a/b.ts' })).toBe('Reading b.ts');
			expect(formatToolStatus('read_file', { path: '/a/b.ts' })).toBe('Reading b.ts');
			expect(formatToolStatus('read_file', { relative_path: 'b.ts' })).toBe('Reading b.ts');
		});
	});

	describe('未知工具', () => {
		it('falls back to "Using X"', () => {
			expect(formatToolStatus('CustomMcpTool', {})).toBe('Using CustomMcpTool');
		});
	});
});

describe('PERMISSION_EXEMPT_TOOLS', () => {
	it('contains Task and AskUserQuestion', () => {
		expect(PERMISSION_EXEMPT_TOOLS.has('Task')).toBe(true);
		expect(PERMISSION_EXEMPT_TOOLS.has('AskUserQuestion')).toBe(true);
	});

	it('does not include typical tools', () => {
		expect(PERMISSION_EXEMPT_TOOLS.has('Read')).toBe(false);
		expect(PERMISSION_EXEMPT_TOOLS.has('Bash')).toBe(false);
	});
});
