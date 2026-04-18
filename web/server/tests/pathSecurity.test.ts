import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
	validatePath,
	validateRelativePath,
	validatePathWithinRoot,
	sanitizeSessionId,
	sanitizeProjectDir,
} from '../src/pathSecurity.js';

describe('validatePath', () => {
	it('rejects empty / non-string', () => {
		expect(validatePath('').valid).toBe(false);
		expect(validatePath(null as unknown as string).valid).toBe(false);
	});

	it('rejects null byte', () => {
		const r = validatePath('foo\0bar');
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/null byte/i);
	});

	it('rejects upward `..` traversal that escapes relative base', () => {
		expect(validatePath('../../etc/passwd').valid).toBe(false);
	});

	it('accepts interior `..` that normalizes away', () => {
		// foo/../bar → bar，normalize 後沒有 `..`，視為安全
		expect(validatePath('foo/../bar').valid).toBe(true);
	});

	it('accepts normal relative paths', () => {
		expect(validatePath('foo/bar.txt').valid).toBe(true);
		expect(validatePath('./foo/bar').valid).toBe(true);
	});
});

describe('validateRelativePath', () => {
	it('rejects absolute path', () => {
		expect(validateRelativePath('/etc/passwd').valid).toBe(false);
	});

	it('accepts relative path', () => {
		expect(validateRelativePath('foo/bar.txt').valid).toBe(true);
	});
});

describe('validatePathWithinRoot', () => {
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pathsec-'));
	const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathsec-outside-'));

	beforeAll(() => {
		fs.mkdirSync(path.join(tmpRoot, 'sub'), { recursive: true });
		fs.writeFileSync(path.join(tmpRoot, 'sub/ok.txt'), 'x');
		fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'y');
	});

	afterAll(() => {
		fs.rmSync(tmpRoot, { recursive: true, force: true });
		fs.rmSync(outsideDir, { recursive: true, force: true });
	});

	it('accepts path inside root', () => {
		const r = validatePathWithinRoot('sub/ok.txt', tmpRoot);
		expect(r.valid).toBe(true);
	});

	it('rejects `..` escape', () => {
		const r = validatePathWithinRoot('../../etc/passwd', tmpRoot);
		expect(r.valid).toBe(false);
	});

	it('rejects symlink escape (realpath check)', () => {
		const linkPath = path.join(tmpRoot, 'escape-link');
		fs.symlinkSync(outsideDir, linkPath);
		const r = validatePathWithinRoot('escape-link/secret.txt', tmpRoot);
		expect(r.valid).toBe(false);
		expect(r.error).toMatch(/symlink|outside/i);
		fs.unlinkSync(linkPath);
	});
});

describe('sanitizeSessionId', () => {
	it('accepts UUID-like ids', () => {
		expect(sanitizeSessionId('a1b2c3d4-e5f6-7890').valid).toBe(true);
	});

	it('rejects special characters', () => {
		expect(sanitizeSessionId('abc/def').valid).toBe(false);
		expect(sanitizeSessionId('abc;rm').valid).toBe(false);
		expect(sanitizeSessionId('abc..def').valid).toBe(false);
	});

	it('rejects over-long ids', () => {
		expect(sanitizeSessionId('a'.repeat(200)).valid).toBe(false);
	});
});

describe('sanitizeProjectDir', () => {
	it('accepts absolute path', () => {
		expect(sanitizeProjectDir('/Users/foo/project').valid).toBe(true);
	});

	it('rejects relative path', () => {
		expect(sanitizeProjectDir('foo/bar').valid).toBe(false);
	});

	it('normalizes interior `..` to canonical absolute path', () => {
		// /foo/../etc → /etc，normalize 後為安全的絕對路徑
		const r = sanitizeProjectDir('/foo/../etc');
		expect(r.valid).toBe(true);
		expect(r.normalized).toBe('/etc');
	});
});
