import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import {
	createUser,
	verifyUser,
	verifyApiKey,
	ensureDefaultUser,
	updateUserPassword,
	clearMustChangePassword,
	listUsers,
	getUserById,
	updateUserRole,
	deleteUser,
	regenerateApiKey,
} from './userStore.js';
import { signToken, signAccessToken, signRefreshToken, verifyToken, verifyRefreshToken } from './jwt.js';
import type { TokenPayload } from './jwt.js';
import { validatePassword } from 'pixel-agents-shared';
import { logAudit } from '../auditLog.js';
import { loadBuildingConfig, addFloor as addBuildingFloor } from '../buildingPersistence.js';
import type { BuildingConfig } from '../types.js';

const router = Router();

/** 註冊時自動建立專屬樓層後的廣播回呼 */
let onBuildingChanged: ((building: BuildingConfig) => void) | null = null;

/** 設定建築物配置變更的廣播回呼（由 index.ts 在 io 就緒後呼叫） */
export function setOnBuildingChanged(cb: (building: BuildingConfig) => void): void {
	onBuildingChanged = cb;
}

// ── 擴展 Express Request 型別以包含認證資訊 ────────────────────
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			auth?: TokenPayload;
		}
	}
}

// ── 中介軟體 ──────────────────────────────────────────────────

/** 驗證 JWT token，將 payload 附加至 req.auth */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
	const header = req.headers.authorization;
	if (!header?.startsWith('Bearer ')) {
		res.status(401).json({ error: 'Authentication required' });
		return;
	}
	try {
		const token = header.slice(7);
		req.auth = verifyToken(token);
		next();
	} catch {
		res.status(401).json({ error: 'Invalid or expired token' });
	}
}

/** 驗證使用者角色為 admin */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
	if (req.auth?.role !== 'admin') {
		res.status(403).json({ error: 'Admin access required' });
		return;
	}
	next();
}

// ── 公開路由 ──────────────────────────────────────────────────

router.post('/register', async (req, res) => {
	try {
		const { username, password } = req.body as { username?: string; password?: string };
		if (!username || !password) {
			res.status(400).json({ error: 'Username and password are required' });
			return;
		}
		if (username.length < 2 || username.length > 32) {
			res.status(400).json({ error: 'Username must be 2-32 characters' });
			return;
		}
		const validation = validatePassword(password);
		if (!validation.valid) {
			res.status(400).json({ error: validation.error });
			return;
		}
		const user = await createUser(username, password);
		const token = signToken(user.id, user.username, user.mustChangePassword, user.role);
		const accessToken = signAccessToken(user.id, user.username, user.mustChangePassword, user.role);
		const refreshToken = signRefreshToken(user.id, user.username, user.role);

		// P2.2: 為新使用者自動建立專屬樓層（member 角色）
		if (user.role === 'member') {
			try {
				const building = loadBuildingConfig();
				// 確保樓層名稱唯一（若重複則加數字後綴）
				let floorName = username;
				let suffix = 2;
				while (building.floors.some(f => f.name === floorName)) {
					floorName = `${username}-${suffix}`;
					suffix++;
				}
				const newFloor = addBuildingFloor(building, floorName, user.id);
				console.log(`[Pixel Agents] Auto-created floor "${newFloor.name}" (${newFloor.id}) for user ${username}`);
				// 廣播更新的建築物配置至所有連線中的客戶端
				onBuildingChanged?.(building);
			} catch (floorErr) {
				// 樓層建立失敗不影響註冊結果
				console.error('[Pixel Agents] Failed to auto-create floor for new user:', floorErr);
			}
		}

		logAudit('register', user.id, `username=${username}`, req.ip);
		res.json({
			token, accessToken, refreshToken,
			username: user.username,
			role: user.role ?? 'admin',
			apiKey: user.apiKey,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Registration failed';
		res.status(409).json({ error: message });
	}
});

router.post('/login', async (req, res) => {
	try {
		const { username, password, apiKey } = req.body as { username?: string; password?: string; apiKey?: string };

		// 若 body 包含 apiKey，自動走 API Key 驗證路徑
		if (apiKey) {
			const user = verifyApiKey(apiKey);
			if (!user) {
				logAudit('login_failed', undefined, 'method=apikey', req.ip);
				res.status(401).json({ error: 'Invalid API key' });
				return;
			}
			const accessToken = signAccessToken(user.id, user.username, user.mustChangePassword, user.role);
			const refreshToken = signRefreshToken(user.id, user.username, user.role);
			const legacyToken = signToken(user.id, user.username, user.mustChangePassword, user.role);
			logAudit('login_apikey', user.id, `username=${user.username}`, req.ip);
			res.json({
				token: legacyToken,
				accessToken,
				refreshToken,
				username: user.username,
				role: user.role ?? 'admin',
				mustChangePassword: user.mustChangePassword ?? false,
			});
			return;
		}

		if (!username || !password) {
			res.status(400).json({ error: 'Username and password are required' });
			return;
		}
		const user = await verifyUser(username, password);
		if (!user) {
			logAudit('login_failed', undefined, `username=${username}`, req.ip);
			res.status(401).json({ error: 'Invalid credentials' });
			return;
		}
		// 簽發存取 token + 刷新 token（同時保留舊式 token 欄位供向後相容）
		const accessToken = signAccessToken(user.id, user.username, user.mustChangePassword, user.role);
		const refreshToken = signRefreshToken(user.id, user.username, user.role);
		const legacyToken = signToken(user.id, user.username, user.mustChangePassword, user.role);
		logAudit('login', user.id, `username=${username}`, req.ip);
		res.json({
			token: legacyToken,
			accessToken,
			refreshToken,
			username: user.username,
			role: user.role ?? 'admin',
			mustChangePassword: user.mustChangePassword ?? false,
		});
	} catch {
		res.status(500).json({ error: 'Login failed' });
	}
});

// ── API Key 登入端點 ──────────────────────────────────────────

router.post('/login-key', (req, res) => {
	try {
		const { apiKey } = req.body as { apiKey?: string };
		if (!apiKey) {
			res.status(400).json({ error: 'API key is required' });
			return;
		}
		const user = verifyApiKey(apiKey);
		if (!user) {
			logAudit('login_failed', undefined, 'method=apikey', req.ip);
			res.status(401).json({ error: 'Invalid API key' });
			return;
		}
		const accessToken = signAccessToken(user.id, user.username, user.mustChangePassword, user.role);
		const refreshToken = signRefreshToken(user.id, user.username, user.role);
		const legacyToken = signToken(user.id, user.username, user.mustChangePassword, user.role);
		logAudit('login_apikey', user.id, `username=${user.username}`, req.ip);
		res.json({
			token: legacyToken,
			accessToken,
			refreshToken,
			username: user.username,
			role: user.role ?? 'admin',
			mustChangePassword: user.mustChangePassword ?? false,
		});
	} catch {
		res.status(500).json({ error: 'Login failed' });
	}
});

// ── 需要認證的路由 ────────────────────────────────────────────

router.post('/change-password', requireAuth, async (req, res) => {
	try {
		const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
		if (!oldPassword || !newPassword) {
			res.status(400).json({ error: 'Old password and new password are required' });
			return;
		}
		const validation = validatePassword(newPassword);
		if (!validation.valid) {
			res.status(400).json({ error: validation.error });
			return;
		}
		// 驗證舊密碼
		const user = await verifyUser(req.auth!.username, oldPassword);
		if (!user) {
			res.status(401).json({ error: 'Current password is incorrect' });
			return;
		}
		// 更新密碼
		const newHash = await bcrypt.hash(newPassword, 10);
		updateUserPassword(user.username, newHash);
		clearMustChangePassword(user.username);
		// 簽發新 token（不含 mustChangePassword 標記）
		const token = signToken(user.id, user.username, false, user.role);
		logAudit('password_change', user.id, `username=${user.username}`, req.ip);
		res.json({ token, message: 'Password changed successfully' });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Password change failed';
		res.status(500).json({ error: message });
	}
});

// ── API Key 查看與重新生成端點 ────────────────────────────────

/** 取得當前使用者的 API Key */
router.get('/api-key', requireAuth, (req, res) => {
	try {
		const user = getUserById(req.auth!.userId);
		if (!user) {
			res.status(404).json({ error: 'User not found' });
			return;
		}
		res.json({ apiKey: user.apiKey });
	} catch {
		res.status(500).json({ error: 'Failed to get API key' });
	}
});

/** 重新生成當前使用者的 API Key */
router.post('/api-key/regenerate', requireAuth, (req, res) => {
	try {
		const newKey = regenerateApiKey(req.auth!.userId);
		logAudit('apikey_regenerate', req.auth!.userId, `username=${req.auth!.username}`, req.ip);
		res.json({ apiKey: newKey });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to regenerate API key';
		res.status(500).json({ error: message });
	}
});

// ── 需要 Admin 角色的路由 ─────────────────────────────────────

router.get('/users', requireAuth, requireAdmin, (_req, res) => {
	try {
		const users = listUsers();
		res.json({ users });
	} catch {
		res.status(500).json({ error: 'Failed to list users' });
	}
});

router.put('/users/:id/role', requireAuth, requireAdmin, (req, res) => {
	try {
		const id = req.params.id as string;
		const { role } = req.body as { role?: string };
		if (role !== 'admin' && role !== 'member') {
			res.status(400).json({ error: 'Role must be "admin" or "member"' });
			return;
		}
		const target = getUserById(id);
		if (!target) {
			res.status(404).json({ error: 'User not found' });
			return;
		}
		updateUserRole(id, role);
		logAudit('role_change', req.auth!.userId, `targetUserId=${id} newRole=${role}`, req.ip);
		res.json({ message: 'Role updated', userId: id, role });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to update role';
		res.status(500).json({ error: message });
	}
});

router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
	try {
		const id = req.params.id as string;
		// 不能刪除自己
		if (req.auth!.userId === id) {
			res.status(400).json({ error: 'Cannot delete your own account' });
			return;
		}
		const target = getUserById(id);
		if (!target) {
			res.status(404).json({ error: 'User not found' });
			return;
		}
		deleteUser(id);
		logAudit('user_delete', req.auth!.userId, `deletedUserId=${id}`, req.ip);
		res.json({ message: 'User deleted', userId: id });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete user';
		res.status(500).json({ error: message });
	}
});

// ── Token 刷新端點 ─────────────────────────────────────────────

router.post('/refresh', (req, res) => {
	try {
		const { refreshToken } = req.body as { refreshToken?: string };
		if (!refreshToken) {
			res.status(400).json({ error: 'Refresh token is required' });
			return;
		}
		const payload = verifyRefreshToken(refreshToken);
		// 查找使用者以取得最新角色（可能已被 admin 變更）
		const user = getUserById(payload.userId);
		if (!user) {
			res.status(401).json({ error: 'User no longer exists' });
			return;
		}
		const newAccessToken = signAccessToken(user.id, user.username, user.mustChangePassword, user.role);
		logAudit('token_refresh', user.id, `username=${user.username}`, req.ip);
		res.json({
			accessToken: newAccessToken,
			// 同時回傳舊式 token 供向後相容
			token: signToken(user.id, user.username, user.mustChangePassword, user.role),
		});
	} catch {
		res.status(401).json({ error: 'Invalid or expired refresh token' });
	}
});

/** 初始化認證路由（確保預設使用者存在） */
export async function initAuthRoutes(): Promise<Router> {
	await ensureDefaultUser();
	return router;
}
