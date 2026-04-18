// ── 環境變數集中配置 ──────────────────────────────────────────
// 所有環境變數讀取集中於此模組，提供型別安全的 config 物件。
// 預設值來自 constants.ts。

import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import {
	DEFAULT_PORT,
	LAYOUT_FILE_DIR,
	REGISTRATION_POLICY_DEFAULT,
} from './constants.js';

function parseIntOrDefault(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
	/** HTTP 伺服器監聽端口 */
	port: parseIntOrDefault(process.env['PORT'], DEFAULT_PORT),
	/** 是否啟用演示模式 */
	demo: process.argv.includes('--demo') || process.env['DEMO'] === '1',
	/** 演示模式代理數量 */
	demoAgents: parseIntOrDefault(process.env['DEMO_AGENTS'], 3),
	/** 壓力測試代理數量（0 = 停用） */
	stressTest: (() => {
		const stressArgIdx = process.argv.indexOf('--stress');
		if (stressArgIdx !== -1) {
			return parseIntOrDefault(process.argv[stressArgIdx + 1], 10);
		}
		return parseIntOrDefault(process.env['STRESS_TEST'], 0);
	})(),
	/** 是否啟用 HTTPS */
	https: process.argv.includes('--https') || process.env['HTTPS'] === '1',
	/** 額外允許的 CORS 來源（逗號分隔） */
	allowedOrigins: (process.env['ALLOWED_ORIGINS']?.split(',').map(s => s.trim()).filter(Boolean)) || [],
	/** 日誌等級 */
	logLevel: process.env['LOG_LEVEL'] || 'info',
	/** 使用者資料目錄 */
	dataDir: process.env['DATA_DIR'] || path.join(os.homedir(), LAYOUT_FILE_DIR),
	/** 執行環境 */
	nodeEnv: process.env['NODE_ENV'] || 'development',
	/** Redis 連線 URL（未設定時停用 Redis） */
	redisUrl: process.env['REDIS_URL'] || '',
	/** 本伺服器唯一識別碼（叢集模式用） */
	serverId: process.env['SERVER_ID'] || crypto.randomUUID().slice(0, 8),
	/** 是否啟用叢集模式（有 Redis 時自動啟用） */
	clusterEnabled: !!process.env['REDIS_URL'],
	/** 註冊策略：open（開放）、invite（邀請制）、closed（僅管理員可建立帳號） */
	registrationPolicy: (process.env['REGISTRATION_POLICY'] || REGISTRATION_POLICY_DEFAULT) as 'open' | 'invite' | 'closed',
	/** 是否強制要求密碼含特殊字元（REQUIRE_PASSWORD_SPECIAL_CHAR=1 啟用） */
	requirePasswordSpecialChar: process.env['REQUIRE_PASSWORD_SPECIAL_CHAR'] === '1',
} as const;
