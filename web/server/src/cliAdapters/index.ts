/**
 * CLI Adapter 介面與註冊機制
 *
 * 每個支援的 AI CLI 工具提供一個適配器，定義其專案目錄位置、
 * JSONL 掃描邏輯、二進位偵測等 CLI 特定行為。
 */

import * as fs from 'fs';

/** 支援的 CLI 類型 */
export const CLI_TYPES = ['claude', 'codex', 'gemini'] as const;
export type CliType = (typeof CLI_TYPES)[number];

/** CLI 適配器介面 — 每個 CLI 工具需實作這些方法 */
export interface CLIAdapter {
	/** CLI 識別名稱 */
	readonly name: CliType;

	/** 取得此 CLI 的專案根目錄（如 ~/.claude/projects/） */
	getProjectsRoot(): string;

	/** 檢查此 CLI 是否可用（二進位是否存在） */
	isAvailable(): boolean;

	/** 取得 CLI 二進位路徑 */
	getBinaryPath(): string;

	/** 建構恢復會話的命令列參數 */
	buildResumeArgs(sessionId: string): string[];

	/** 建構不含 CLI 專屬變數的乾淨環境 */
	buildCleanEnv(): Record<string, string | undefined>;

	/** 掃描時忽略的目錄名稱模式 */
	ignoredDirPatterns(): string[];
}

/** 已註冊的適配器 */
const adapters = new Map<CliType, CLIAdapter>();

/** 註冊一個 CLI 適配器 */
export function registerAdapter(adapter: CLIAdapter): void {
	adapters.set(adapter.name, adapter);
}

/** 取得指定 CLI 類型的適配器 */
export function getAdapter(cliType: CliType): CLIAdapter | undefined {
	return adapters.get(cliType);
}

/** 取得所有已註冊的適配器 */
export function getAllAdapters(): CLIAdapter[] {
	return [...adapters.values()];
}

/** 取得所有可用的適配器（二進位存在或專案目錄存在） */
export function getAvailableAdapters(): CLIAdapter[] {
	return getAllAdapters().filter(a => {
		try {
			return a.isAvailable() || fs.existsSync(a.getProjectsRoot());
		} catch {
			return false;
		}
	});
}
