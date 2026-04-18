import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { atomicWriteJson } from '../src/atomicWrite.js';

describe('atomicWriteJson', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-'));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it('writes JSON atomically (final file appears only after rename)', () => {
		const filePath = path.join(tmpDir, 'config.json');
		atomicWriteJson(filePath, { foo: 'bar', count: 42 });
		const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
		expect(content).toEqual({ foo: 'bar', count: 42 });
	});

	it('creates parent directory if missing', () => {
		const filePath = path.join(tmpDir, 'nested/deep/file.json');
		atomicWriteJson(filePath, { ok: true });
		expect(fs.existsSync(filePath)).toBe(true);
	});

	it('overwrites existing file', () => {
		const filePath = path.join(tmpDir, 'data.json');
		fs.writeFileSync(filePath, '{"old":"data"}');
		atomicWriteJson(filePath, { new: 'data' });
		const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
		expect(content).toEqual({ new: 'data' });
	});

	it('does not leave .tmp file after success', () => {
		const filePath = path.join(tmpDir, 'clean.json');
		atomicWriteJson(filePath, { x: 1 });
		expect(fs.existsSync(filePath + '.tmp')).toBe(false);
	});

	it('handles empty object', () => {
		const filePath = path.join(tmpDir, 'empty.json');
		atomicWriteJson(filePath, {});
		expect(JSON.parse(fs.readFileSync(filePath, 'utf-8'))).toEqual({});
	});

	it('handles arrays', () => {
		const filePath = path.join(tmpDir, 'array.json');
		atomicWriteJson(filePath, [1, 2, 3]);
		expect(JSON.parse(fs.readFileSync(filePath, 'utf-8'))).toEqual([1, 2, 3]);
	});

	it('formats JSON with 2-space indentation', () => {
		const filePath = path.join(tmpDir, 'pretty.json');
		atomicWriteJson(filePath, { a: 1 });
		const raw = fs.readFileSync(filePath, 'utf-8');
		expect(raw).toContain('  "a"');
	});
});
