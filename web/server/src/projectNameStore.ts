import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LAYOUT_FILE_DIR, PROJECT_NAMES_FILE_NAME, EXCLUDED_PROJECTS_FILE_NAME } from './constants.js';

function getFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, PROJECT_NAMES_FILE_NAME);
}

export function readProjectNames(): Record<string, string> {
	try {
		const filePath = getFilePath();
		if (!fs.existsSync(filePath)) return {};
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, string>;
	} catch {
		return {};
	}
}

function writeProjectNames(map: Record<string, string>): void {
	const filePath = getFilePath();
	const dir = path.dirname(filePath);
	try {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		const json = JSON.stringify(map, null, 2);
		const tmpPath = filePath + '.tmp';
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		console.error('[Pixel Agents] Failed to write project names:', err);
	}
}

export function getCustomName(projectDir: string): string | undefined {
	const key = path.basename(projectDir);
	const map = readProjectNames();
	return map[key];
}

export function setCustomName(projectDir: string, name: string): void {
	const key = path.basename(projectDir);
	const map = readProjectNames();
	map[key] = name;
	writeProjectNames(map);
}

// ── 排除專案清單 ──────────────────────────────────────

function getExcludedFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, EXCLUDED_PROJECTS_FILE_NAME);
}

export function readExcludedProjects(): string[] {
	try {
		const filePath = getExcludedFilePath();
		if (!fs.existsSync(filePath)) return [];
		const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
		return Array.isArray(data) ? data : [];
	} catch {
		return [];
	}
}

function writeExcludedProjects(list: string[]): void {
	const filePath = getExcludedFilePath();
	const dir = path.dirname(filePath);
	try {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		const json = JSON.stringify(list, null, 2);
		const tmpPath = filePath + '.tmp';
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		console.error('[Pixel Agents] Failed to write excluded projects:', err);
	}
}

export function addExcludedProject(projectDir: string): void {
	const key = path.basename(projectDir);
	const list = readExcludedProjects();
	if (!list.includes(key)) {
		list.push(key);
		writeExcludedProjects(list);
	}
}

export function removeExcludedProject(projectDir: string): void {
	const key = path.basename(projectDir);
	const list = readExcludedProjects();
	const idx = list.indexOf(key);
	if (idx !== -1) {
		list.splice(idx, 1);
		writeExcludedProjects(list);
	}
}

export function isProjectExcluded(projectDir: string): boolean {
	const key = path.basename(projectDir);
	return readExcludedProjects().includes(key);
}
