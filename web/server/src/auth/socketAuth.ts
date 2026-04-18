import type { Socket } from 'socket.io';
import { verifyToken } from './jwt.js';
import type { UserRole } from '../types.js';

/** Socket 上附帶的認證資料介面 */
export interface SocketAuthData {
	role: UserRole;
	userId?: string;
	username?: string;
}

// ── 匿名連線數限制 ──────────────────────────────────────────
/** 每 IP 的最大匿名連線數 */
const MAX_ANONYMOUS_CONNECTIONS_PER_IP = 5;
/** 每 IP 的匿名連線計數 */
const anonymousConnectionCounts = new Map<string, number>();

/** 取得 socket 的用戶端 IP：
 *  - 僅在 TRUST_PROXY 環境變數設定時才信任 x-forwarded-for
 *  - 取第一個 hop（最原始客戶端），避免攻擊者追加多個偽造 IP 繞過每 IP 限制
 */
function getSocketIp(socket: Socket): string {
	if (process.env['TRUST_PROXY']) {
		const header = socket.handshake.headers['x-forwarded-for'];
		const raw = Array.isArray(header) ? header[0] : header;
		if (raw) {
			const first = raw.split(',')[0]?.trim();
			if (first) return first;
		}
	}
	return socket.handshake.address || 'unknown';
}

/** 增加指定 IP 的匿名連線計數 */
function incrementAnonymousCount(ip: string): number {
	const current = anonymousConnectionCounts.get(ip) || 0;
	const next = current + 1;
	anonymousConnectionCounts.set(ip, next);
	return next;
}

/** 減少指定 IP 的匿名連線計數 */
export function decrementAnonymousCount(ip: string): void {
	const current = anonymousConnectionCounts.get(ip) || 0;
	if (current <= 1) {
		anonymousConnectionCounts.delete(ip);
	} else {
		anonymousConnectionCounts.set(ip, current - 1);
	}
}

/**
 * Socket.IO 認證中間件 — 驗證 handshake auth 中的 token。
 * 無 token 或 token 無效時降級為 anonymous（不拒絕連線）。
 * 匿名連線受每 IP 最大數量限制。
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
	const token = socket.handshake.auth?.token as string | undefined;
	if (!token) {
		// 無 token → anonymous — 檢查每 IP 匿名連線數限制
		const ip = getSocketIp(socket);
		const currentCount = anonymousConnectionCounts.get(ip) || 0;
		if (currentCount >= MAX_ANONYMOUS_CONNECTIONS_PER_IP) {
			return next(new Error('Too many anonymous connections'));
		}
		socket.data.role = 'anonymous' as UserRole;
		socket.data.userId = undefined;
		socket.data.username = undefined;
		socket.data._anonymousIp = ip;
		incrementAnonymousCount(ip);
		// 斷線時減少計數
		socket.on('disconnect', () => {
			decrementAnonymousCount(ip);
		});
		return next();
	}
	try {
		const payload = verifyToken(token);
		socket.data.role = (payload.role ?? 'member') as UserRole;
		socket.data.userId = payload.userId;
		socket.data.username = payload.username;
		return next();
	} catch {
		// token 無效 → 降級為 anonymous — 同樣檢查限制
		const ip = getSocketIp(socket);
		const currentCount = anonymousConnectionCounts.get(ip) || 0;
		if (currentCount >= MAX_ANONYMOUS_CONNECTIONS_PER_IP) {
			return next(new Error('Too many anonymous connections'));
		}
		socket.data.role = 'anonymous' as UserRole;
		socket.data.userId = undefined;
		socket.data.username = undefined;
		socket.data._anonymousIp = ip;
		incrementAnonymousCount(ip);
		socket.on('disconnect', () => {
			decrementAnonymousCount(ip);
		});
		return next();
	}
}

/**
 * 處理 auth:upgrade — 已連線的 socket 升級身份。
 * 回傳升級結果（成功時包含角色與使用者名稱）。
 */
export function handleAuthUpgrade(
	socket: Socket,
	token: string,
): { success: boolean; role?: UserRole; username?: string; error?: string } {
	try {
		const payload = verifyToken(token);
		socket.data.role = (payload.role ?? 'member') as UserRole;
		socket.data.userId = payload.userId;
		socket.data.username = payload.username;
		return { success: true, role: socket.data.role as UserRole, username: payload.username };
	} catch {
		return { success: false, error: 'Invalid or expired token' };
	}
}
