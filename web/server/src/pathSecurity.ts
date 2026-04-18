import * as path from 'path';
import * as fs from 'fs';

/**
 * 路徑安全工具 — 防止路徑遍歷攻擊。
 *
 * 驗證使用者提供的路徑不包含 `..` 逃逸序列，
 * 並且不會超出預期的根目錄範圍。
 */

/** 路徑驗證結果 */
interface PathValidationResult {
	valid: boolean;
	/** 驗證失敗時的錯誤訊息 */
	error?: string;
	/** 正規化後的路徑（僅在 valid=true 時有值） */
	normalized?: string;
}

/**
 * 驗證路徑是否安全（不含路徑遍歷攻擊向量）。
 *
 * 檢查項目：
 * 1. 拒絕包含 `..` 的路徑
 * 2. 拒絕包含 null 位元組的路徑
 * 3. 正規化路徑分隔符號
 */
export function validatePath(userPath: string): PathValidationResult {
	if (!userPath || typeof userPath !== 'string') {
		return { valid: false, error: 'Path is empty or invalid' };
	}

	// 拒絕 null 位元組（可用於繞過某些路徑檢查）
	if (userPath.includes('\0')) {
		return { valid: false, error: 'Path contains null byte' };
	}

	// 正規化路徑
	const normalized = path.normalize(userPath);

	// 拒絕包含 .. 的路徑（正規化後檢查）
	// 將路徑拆分為段落後逐一檢查
	const segments = normalized.split(path.sep);
	if (segments.includes('..')) {
		return { valid: false, error: 'Path contains directory traversal (..)' };
	}

	return { valid: true, normalized };
}

/**
 * 驗證相對路徑 — 額外拒絕絕對路徑。
 */
export function validateRelativePath(userPath: string): PathValidationResult {
	const result = validatePath(userPath);
	if (!result.valid) return result;

	if (path.isAbsolute(userPath)) {
		return { valid: false, error: 'Expected relative path but received absolute path' };
	}

	return result;
}

/**
 * 驗證路徑是否在指定根目錄之下（containment check）。
 *
 * 這是最強的路徑安全保證：確保解析後的絕對路徑
 * 確實位於預期的根目錄範圍內。
 */
export function validatePathWithinRoot(userPath: string, rootDir: string): PathValidationResult {
	const result = validatePath(userPath);
	if (!result.valid) return result;

	// 解析為絕對路徑
	const resolved = path.resolve(rootDir, userPath);
	const normalizedRoot = path.resolve(rootDir);

	// 確保解析後的路徑以根目錄開頭
	if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
		return { valid: false, error: 'Path escapes the allowed root directory' };
	}

	// 解析符號連結以防 `ln -s /etc/passwd <root>/link` 類型的逃逸
	// 僅對已存在的路徑檢查 realpath；不存在的路徑交由呼叫者在寫入前再驗證。
	try {
		if (fs.existsSync(resolved)) {
			const realPath = fs.realpathSync(resolved);
			const realRoot = fs.realpathSync(normalizedRoot);
			if (!realPath.startsWith(realRoot + path.sep) && realPath !== realRoot) {
				return { valid: false, error: 'Path resolves (via symlink) outside the allowed root directory' };
			}
			return { valid: true, normalized: realPath };
		}
	} catch {
		// realpath 失敗（權限等）→ 保守拒絕
		return { valid: false, error: 'Unable to verify real path' };
	}

	return { valid: true, normalized: resolved };
}

/**
 * 清理 sessionId — 只允許安全的字元。
 * Claude 的 sessionId 格式為 UUID-like 字串。
 */
export function sanitizeSessionId(sessionId: string): PathValidationResult {
	if (!sessionId || typeof sessionId !== 'string') {
		return { valid: false, error: 'Session ID is empty or invalid' };
	}

	// 只允許字母數字、破折號和底線
	if (!/^[\w-]+$/.test(sessionId)) {
		return { valid: false, error: 'Session ID contains invalid characters' };
	}

	// 長度限制（UUID = 36 chars，留有餘裕）
	if (sessionId.length > 128) {
		return { valid: false, error: 'Session ID is too long' };
	}

	return { valid: true, normalized: sessionId };
}

/**
 * 清理專案目錄路徑 — 用於使用者提供的 projectDir 參數。
 *
 * 專案目錄應為絕對路徑且不含遍歷序列。
 */
export function sanitizeProjectDir(projectDir: string): PathValidationResult {
	const result = validatePath(projectDir);
	if (!result.valid) return result;

	if (!path.isAbsolute(projectDir)) {
		return { valid: false, error: 'Project directory must be an absolute path' };
	}

	return { valid: true, normalized: path.normalize(projectDir) };
}
