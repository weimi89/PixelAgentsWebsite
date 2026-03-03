import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { getProjectDirsForCli } from '../src/agentManager.js';
import type { CLIAdapter } from '../src/cliAdapters/index.js';

function createAdapter(projectsRoot: string): CLIAdapter {
	return {
		name: 'codex',
		getProjectsRoot: () => projectsRoot,
		isAvailable: () => true,
		getBinaryPath: () => 'codex',
		buildResumeArgs: (sessionId: string) => ['--resume', sessionId],
		buildCleanEnv: () => ({}),
		ignoredDirPatterns: () => [],
	};
}

describe('getProjectDirsForCli', () => {
	it('finds nested JSONL directories (codex sessions layout)', () => {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-agents-'));
		try {
			const dayDir = path.join(tempRoot, '2026', '03', '02');
			fs.mkdirSync(dayDir, { recursive: true });
			fs.writeFileSync(path.join(dayDir, 'rollout-abc.jsonl'), '{"type":"assistant"}\n');

			const dirs = getProjectDirsForCli(createAdapter(tempRoot));
			expect(dirs).toContain(dayDir);
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
