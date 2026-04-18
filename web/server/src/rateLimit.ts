import type { Request, Response, NextFunction } from 'express';

/**
 * 簡易滑動視窗速率限制中間件（記憶體內實作，無外部依賴）。
 *
 * 以來源 IP 為鍵，記錄每個視窗內的請求次數。
 * 超過限制時回傳 HTTP 429 Too Many Requests。
 */

interface WindowEntry {
	/** 視窗開始時間戳（ms） */
	windowStart: number;
	/** 此視窗內的請求計數 */
	count: number;
}

interface RateLimitOptions {
	/** 視窗長度（毫秒） */
	windowMs: number;
	/** 每個視窗內允許的最大請求數 */
	maxRequests: number;
	/** store 最大鍵數（預設 10000）— 防止攻擊者用大量偽造 IP 填滿記憶體 */
	maxKeys?: number;
}

/** 預設 store 容量上限 */
const DEFAULT_MAX_KEYS = 10_000;

/**
 * 建立速率限制中間件。
 * 使用簡易固定視窗演算法：每個 IP 在 `windowMs` 內最多允許 `maxRequests` 次請求。
 *
 * 記憶體保護：
 *   - 定期清理過期條目
 *   - 達到 `maxKeys` 上限時以 FIFO 驅逐最舊的條目（Map 原生保留插入順序）
 */
export function createRateLimit(options: RateLimitOptions) {
	const { windowMs, maxRequests } = options;
	const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
	const store = new Map<string, WindowEntry>();

	// 定期清理過期的條目以防止記憶體洩漏
	const cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (now - entry.windowStart > windowMs * 2) {
				store.delete(key);
			}
		}
	}, windowMs * 2);
	cleanupInterval.unref();

	return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
		const ip = req.ip || req.socket.remoteAddress || 'unknown';
		const now = Date.now();
		const entry = store.get(ip);

		if (!entry || now - entry.windowStart > windowMs) {
			// 新視窗或已過期 — 檢查容量，必要時驅逐最舊條目（FIFO）
			if (store.size >= maxKeys) {
				const oldestKey = store.keys().next().value;
				if (oldestKey !== undefined) store.delete(oldestKey);
			}
			store.set(ip, { windowStart: now, count: 1 });
			next();
			return;
		}

		entry.count++;
		if (entry.count > maxRequests) {
			const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
			res.set('Retry-After', String(retryAfterSec));
			res.status(429).json({ error: 'Too many requests, please try again later' });
			return;
		}

		next();
	};
}
