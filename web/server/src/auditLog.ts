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

/**
 * 遮蔽 detail 字串中可能的敏感資訊（密碼、token、API Key 等）。
 * 同時處理 `key=value` 與 JSON-style `"key":"value"` 兩種型式。
 * 呼叫方應避免傳入敏感欄位；此函式為最後一道防線。
 */
const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|token|secret|apikey|api_key|authorization|auth|cookie|session)/i;

function redactSensitive(detail: string): string {
	// 形式 1：key=value （以空白、& 或行尾分隔）
	let redacted = detail.replace(
		/([A-Za-z_]+)=([^\s&]+)/g,
		(match, key: string, _value: string) => SENSITIVE_KEY_PATTERN.test(key) ? `${key}=***` : match,
	);
	// 形式 2："key":"value" 或 'key':'value'
	redacted = redacted.replace(
		/(["'])([A-Za-z_]+)\1\s*:\s*(["'])([^"']*)\3/g,
		(match, q1: string, key: string, q2: string, _value: string) =>
			SENSITIVE_KEY_PATTERN.test(key) ? `${q1}${key}${q1}:${q2}***${q2}` : match,
	);
	return redacted;
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
	// 最後一道防線：遮蔽 detail 中可能混入的敏感欄位（password/token/apikey 等）
	const safeDetail = detail ? redactSensitive(detail) : detail;

	// 優先寫入 SQLite
	if (db) {
		try {
			db.addAuditEntry(action, userId, safeDetail, ip);
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
	if (safeDetail) entry.detail = safeDetail;
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
