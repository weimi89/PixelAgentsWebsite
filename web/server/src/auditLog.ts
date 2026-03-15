import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LAYOUT_FILE_DIR, AUDIT_LOG_FILE_NAME, AUDIT_LOG_MAX_SIZE_BYTES } from './constants.js';
import { db } from './db/database.js';

/**
 * 稽核日誌 — SQLite 優先，JSONL 檔案作為備份。
 *
 * 若 DB 可用，寫入 audit_log 表（同步、高效）。
 * 否則追加至 ~/.pixel-agents/audit.jsonl（非同步）。
 * 自動輪替：JSONL 檔案超過 1MB 時重新命名為 audit-{timestamp}.jsonl。
 */

/** 稽核動作類型 */
export type AuditAction =
	| 'login'
	| 'login_failed'
	| 'login_apikey'
	| 'register'
	| 'password_change'
	| 'role_change'
	| 'user_delete'
	| 'agent_close'
	| 'layout_save'
	| 'token_refresh'
	| 'apikey_regenerate'
	| 'assign_agent_owner'
	| 'invite_create'
	| 'invite_use'
	| 'invite_delete'
	| 'registration_blocked'
	| 'user_delete_cleanup'
	| 'apikey_reset';

interface AuditEntry {
	timestamp: string;
	action: AuditAction;
	userId?: string;
	detail?: string;
	ip?: string;
}

const userDir = path.join(os.homedir(), LAYOUT_FILE_DIR);

function getAuditLogPath(): string {
	return path.join(userDir, AUDIT_LOG_FILE_NAME);
}

/** 確保目錄存在 */
function ensureDir(): void {
	if (!fs.existsSync(userDir)) {
		fs.mkdirSync(userDir, { recursive: true });
	}
}

/**
 * 檢查並執行日誌輪替（非同步）。
 * 若當前日誌檔案超過限制大小，將其重新命名為 audit-{timestamp}.jsonl。
 */
async function rotateIfNeeded(): Promise<void> {
	const logPath = getAuditLogPath();
	try {
		const stat = await fs.promises.stat(logPath);
		if (stat.size > AUDIT_LOG_MAX_SIZE_BYTES) {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const rotatedName = `audit-${timestamp}.jsonl`;
			const rotatedPath = path.join(userDir, rotatedName);
			await fs.promises.rename(logPath, rotatedPath);
		}
	} catch {
		// 檔案不存在或其他錯誤 — 忽略
	}
}

/**
 * 寫入一筆稽核日誌。
 *
 * 若 DB 可用，同步寫入 audit_log 表。
 * 否則非同步追加至 JSONL 檔案。
 * 寫入失敗時僅 console.error，不會拋出異常。
 */
export function logAudit(
	action: AuditAction,
	userId?: string,
	detail?: string,
	ip?: string,
): void {
	// 優先寫入 SQLite
	if (db) {
		try {
			db.addAuditEntry(action, userId, detail, ip);
			return;
		} catch (err) {
			console.error('[Pixel Agents] Audit log DB write failed:', err);
			// 回退至 JSONL
		}
	}

	// JSONL 備份路徑
	const entry: AuditEntry = {
		timestamp: new Date().toISOString(),
		action,
	};
	if (userId) entry.userId = userId;
	if (detail) entry.detail = detail;
	if (ip) entry.ip = ip;

	const line = JSON.stringify(entry) + '\n';

	// 非同步寫入 — fire and forget
	(async () => {
		try {
			ensureDir();
			await rotateIfNeeded();
			await fs.promises.appendFile(getAuditLogPath(), line, 'utf-8');
		} catch (err) {
			console.error('[Pixel Agents] Audit log write failed:', err);
		}
	})();
}
