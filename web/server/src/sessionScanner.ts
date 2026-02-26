import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AgentState } from './types.js';

const SESSION_TITLE_MAX_LENGTH = 80;
const SESSION_SCAN_READ_BYTES = 16384;
const MAX_SESSIONS = 50;

export interface SessionInfo {
	sessionId: string;
	projectDir: string;
	projectName: string;
	title: string;
	modifiedAt: number;
	size: number;
	isActive: boolean;
}

export function scanAllSessions(
	agents: Map<number, AgentState>,
): SessionInfo[] {
	const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
	const sessions: SessionInfo[] = [];

	let dirs: fs.Dirent[];
	try {
		dirs = fs.readdirSync(projectsRoot, { withFileTypes: true });
	} catch { return sessions; }

	// 建構活躍 JSONL 檔案的集合
	const activeFiles = new Set<string>();
	for (const agent of agents.values()) {
		activeFiles.add(agent.jsonlFile);
	}

	for (const dirEntry of dirs) {
		if (!dirEntry.isDirectory()) continue;
		const dirPath = path.join(projectsRoot, dirEntry.name);

		let files: string[];
		try {
			files = fs.readdirSync(dirPath)
				.filter(f => f.endsWith('.jsonl'));
		} catch { continue; }

		for (const file of files) {
			const filePath = path.join(dirPath, file);
			const sessionId = file.replace('.jsonl', '');

			try {
				const stat = fs.statSync(filePath);
				if (stat.size === 0) continue;

				const info = extractSessionInfo(
					filePath, sessionId, dirPath,
					stat, activeFiles.has(filePath),
				);
				if (info) sessions.push(info);
			} catch { continue; }
		}
	}

	// 按修改時間降序排列
	sessions.sort((a, b) => b.modifiedAt - a.modifiedAt);

	return sessions.slice(0, MAX_SESSIONS);
}

function extractSessionInfo(
	filePath: string,
	sessionId: string,
	dirPath: string,
	stat: fs.Stats,
	isActive: boolean,
): SessionInfo | null {
	const readSize = Math.min(stat.size, SESSION_SCAN_READ_BYTES);
	const buf = Buffer.alloc(readSize);
	const fd = fs.openSync(filePath, 'r');
	try {
		fs.readSync(fd, buf, 0, readSize, 0);
	} finally {
		fs.closeSync(fd);
	}

	const text = buf.toString('utf-8');
	const lines = text.split('\n');

	let title = '';
	let projectName = '';

	for (const line of lines) {
		if (!line.trim()) continue;
		try {
			const record = JSON.parse(line);

			// 從 cwd 提取專案名稱
			if (!projectName && record.cwd) {
				projectName = path.basename(record.cwd);
			}

			// 找到第一則真實的使用者文字訊息（跳過系統、元資料、tool_results）
			if (!title && record.type === 'user') {
				const content = record.message?.content;
				if (typeof content === 'string') {
					const cleaned = content
						.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
						.trim();
					if (cleaned && !cleaned.startsWith('<')) {
						title = cleaned.split('\n')[0].trim();
						if (title.length > SESSION_TITLE_MAX_LENGTH) {
							title = title.slice(0, SESSION_TITLE_MAX_LENGTH) + '…';
						}
					}
				}
			}

			if (title && projectName) break;
		} catch { continue; }
	}

	if (!projectName) {
		projectName = path.basename(dirPath);
	}

	return {
		sessionId,
		projectDir: dirPath,
		projectName,
		title: title || `Session ${sessionId.slice(0, 8)}…`,
		modifiedAt: stat.mtimeMs,
		size: stat.size,
		isActive,
	};
}
