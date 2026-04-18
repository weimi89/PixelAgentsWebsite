import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { LAYOUT_FILE_DIR, USERS_FILE_NAME, JWT_SECRET_FILE_NAME, BCRYPT_SALT_ROUNDS, API_KEY_MASK_TAIL_LENGTH } from '../constants.js';
import { atomicWriteJson } from '../atomicWrite.js';
import { db } from '../db/database.js';

const userDir = path.join(os.homedir(), LAYOUT_FILE_DIR);

// ── AES-256-GCM API Key 加密 ──────────────────────────────────────

/** 加密演算法 */
const CIPHER_ALGORITHM = 'aes-256-gcm';
/** IV 長度（位元組） */
const IV_LENGTH = 12;
/** Auth tag 長度（位元組） */
const AUTH_TAG_LENGTH = 16;

/** 取得加密密鑰：優先從環境變數，退回 JWT secret — 兩者皆無則拋錯而非 fallback 到硬編碼常數 */
function getEncryptionKey(): Buffer {
	const envKey = process.env['API_KEY_ENCRYPTION_KEY'];
	if (envKey) {
		return crypto.createHash('sha256').update(envKey).digest();
	}
	const secretPath = path.join(userDir, JWT_SECRET_FILE_NAME);
	const jwtSecret = fs.readFileSync(secretPath, 'utf-8').trim();
	if (!jwtSecret) {
		throw new Error(`JWT secret file is empty: ${secretPath}`);
	}
	return crypto.createHash('sha256').update(jwtSecret).digest();
}

/** 常數時間比對：避免以 === 比對明文 API Key 造成 timing attack */
function timingSafeEqualStr(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf-8');
	const bufB = Buffer.from(b, 'utf-8');
	if (bufA.length !== bufB.length) return false;
	return crypto.timingSafeEqual(bufA, bufB);
}

/** 遮蔽 API Key：僅保留前綴 `pa_` 與尾碼 N 字元，其餘以 * 取代 */
export function maskApiKey(apiKey: string): string {
	if (!apiKey) return '';
	const tail = API_KEY_MASK_TAIL_LENGTH;
	if (apiKey.length <= tail + 3) return '*'.repeat(apiKey.length);
	const prefix = apiKey.startsWith('pa_') ? 'pa_' : '';
	const suffix = apiKey.slice(-tail);
	const maskedLen = apiKey.length - prefix.length - tail;
	return `${prefix}${'*'.repeat(maskedLen)}${suffix}`;
}

/** 加密 API Key — 回傳格式 enc:iv:authTag:ciphertext（全為 hex） */
function encryptApiKey(plaintext: string): string {
	const key = getEncryptionKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** 解密 API Key — 接受 enc:iv:authTag:ciphertext 格式 */
function decryptApiKey(encrypted: string): string {
	if (!encrypted.startsWith('enc:')) {
		// 未加密的舊格式 — 直接回傳明文
		return encrypted;
	}
	const parts = encrypted.split(':');
	if (parts.length !== 4) {
		throw new Error('Invalid encrypted API key format');
	}
	const key = getEncryptionKey();
	const iv = Buffer.from(parts[1], 'hex');
	const authTag = Buffer.from(parts[2], 'hex');
	const ciphertext = Buffer.from(parts[3], 'hex');
	const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	decipher.setAuthTag(authTag);
	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return decrypted.toString('utf-8');
}

// ── 記憶體快取：明文 API Key → userId（用於快速查找） ──────────
const apiKeyCache = new Map<string, string>();
let apiKeyCacheInitialized = false;

/** 初始化 API Key 快取（延遲載入） */
function ensureApiKeyCache(): void {
	if (apiKeyCacheInitialized) return;
	apiKeyCacheInitialized = true;
	try {
		if (db) {
			const rows = db.listUsers();
			for (const row of rows) {
				if (row.api_key) {
					try {
						const plain = decryptApiKey(row.api_key);
						apiKeyCache.set(plain, row.id);
					} catch { /* 解密失敗跳過 */ }
				}
			}
		} else {
			const data = readUsersDataFromJson();
			for (const user of data.users) {
				if (user.apiKey) {
					try {
						const plain = decryptApiKey(user.apiKey);
						apiKeyCache.set(plain, user.id);
					} catch { /* 解密失敗跳過 */ }
				}
			}
		}
	} catch { /* 初始化失敗不中斷 */ }
}

/** 更新快取中的 API Key 映射 */
function updateApiKeyCache(plainKey: string, userId: string): void {
	ensureApiKeyCache();
	apiKeyCache.set(plainKey, userId);
}

/** 從快取中移除舊的 API Key */
function removeApiKeyCacheByUserId(userId: string): void {
	ensureApiKeyCache();
	for (const [key, id] of apiKeyCache) {
		if (id === userId) {
			apiKeyCache.delete(key);
			break;
		}
	}
}

export interface StoredUser {
	id: string;
	username: string;
	passwordHash: string;
	createdAt: string;
	mustChangePassword?: boolean;
	role?: 'admin' | 'member';
	apiKey: string;
}

/** 對外公開的使用者資訊（不含密碼雜湊） */
export interface PublicUser {
	id: string;
	username: string;
	role: 'admin' | 'member';
	createdAt: string;
	mustChangePassword: boolean;
	apiKey: string;
}

interface UsersData {
	users: StoredUser[];
}

function getUsersFilePath(): string {
	return path.join(userDir, USERS_FILE_NAME);
}

/** 產生 API Key：pa_ + 32 字元隨機英數字串 */
export function generateApiKey(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const randomBytes = crypto.randomBytes(32);
	let result = 'pa_';
	for (let i = 0; i < 32; i++) {
		result += chars.charAt(randomBytes[i] % chars.length);
	}
	return result;
}

/** 讀取時自動補全缺失欄位（向下相容舊格式）— apiKey 解密後回傳 */
function migrateUser(user: StoredUser): StoredUser {
	// viewer 角色自動遷移為 member
	const role = user.role === ('viewer' as string) ? 'member' : (user.role ?? 'admin');
	let apiKey = user.apiKey;
	if (!apiKey) {
		apiKey = generateApiKey();
	} else {
		// 嘗試解密（若已加密）
		try {
			apiKey = decryptApiKey(apiKey);
		} catch { /* 解密失敗保持原值 */ }
	}
	return {
		...user,
		role,
		mustChangePassword: user.mustChangePassword ?? false,
		apiKey,
	};
}

/** 從 JSON 檔案讀取（回退路徑） */
function readUsersDataFromJson(): UsersData {
	try {
		const filePath = getUsersFilePath();
		if (!fs.existsSync(filePath)) return { users: [] };
		const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as UsersData;
		return { users: raw.users.map(migrateUser) };
	} catch {
		return { users: [] };
	}
}

function writeUsersData(data: UsersData): void {
	atomicWriteJson(getUsersFilePath(), data);
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 將 DB UserRow 轉換為 StoredUser — apiKey 解密後回傳 */
function dbRowToStoredUser(row: { id: string; username: string; password_hash: string; role: string; must_change_password: number; created_at: string; api_key?: string | null }): StoredUser {
	// viewer 角色自動遷移為 member
	const role = row.role === 'viewer' ? 'member' : row.role;
	let apiKey = row.api_key || '';
	if (!apiKey) {
		// 無 API Key 時自動生成並加密儲存
		apiKey = generateApiKey();
		const encrypted = encryptApiKey(apiKey);
		try { db?.updateApiKey(row.id, encrypted); } catch { /* 寫入失敗不中斷 */ }
		updateApiKeyCache(apiKey, row.id);
	} else {
		// 嘗試解密
		try {
			apiKey = decryptApiKey(apiKey);
		} catch { /* 解密失敗保持原值（可能是舊的明文格式） */ }
	}
	return {
		id: row.id,
		username: row.username,
		passwordHash: row.password_hash,
		createdAt: row.created_at,
		role: role as 'admin' | 'member',
		mustChangePassword: row.must_change_password === 1,
		apiKey,
	};
}

export async function createUser(
	username: string,
	password: string,
	options?: { mustChangePassword?: boolean; role?: 'admin' | 'member' },
): Promise<StoredUser> {
	const apiKey = generateApiKey();
	const encryptedApiKey = encryptApiKey(apiKey);

	if (db) {
		const existing = db.getUserByUsername(username);
		if (existing) {
			throw new Error('Username already exists');
		}
		const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const id = generateId();
		const role = options?.role ?? 'admin';
		const mustChangePassword = options?.mustChangePassword ?? false;
		// 儲存加密後的 API Key
		db.createUser({ id, username, passwordHash, role, mustChangePassword, apiKey: encryptedApiKey });
		// 更新記憶體快取
		updateApiKeyCache(apiKey, id);
		const row = db.getUserByUsername(username);
		if (row) {
			const user = dbRowToStoredUser(row);
			// 回傳明文 API Key（供首次顯示）
			user.apiKey = apiKey;
			return user;
		}
		return {
			id, username, passwordHash,
			createdAt: new Date().toISOString(),
			mustChangePassword, role, apiKey,
		};
	}

	const data = readUsersDataFromJson();
	const existing = data.users.find(u => u.username === username);
	if (existing) {
		throw new Error('Username already exists');
	}
	const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
	const user: StoredUser = {
		id: generateId(),
		username,
		passwordHash,
		createdAt: new Date().toISOString(),
		mustChangePassword: options?.mustChangePassword ?? false,
		role: options?.role ?? 'admin',
		apiKey: encryptedApiKey,
	};
	data.users.push(user);
	writeUsersData(data);
	// 更新記憶體快取
	updateApiKeyCache(apiKey, user.id);
	// 回傳明文 API Key（供首次顯示）
	return { ...user, apiKey };
}

export async function verifyUser(username: string, password: string): Promise<StoredUser | null> {
	if (db) {
		const row = db.getUserByUsername(username);
		if (!row) return null;
		const valid = await bcrypt.compare(password, row.password_hash);
		if (!valid) return null;
		db.updateLastLogin(username);
		return dbRowToStoredUser(row);
	}

	const data = readUsersDataFromJson();
	const user = data.users.find(u => u.username === username);
	if (!user) return null;
	const valid = await bcrypt.compare(password, user.passwordHash);
	return valid ? user : null;
}

/** 透過 API Key 驗證使用者 — 使用記憶體快取進行快速查找 */
export function verifyApiKey(apiKey: string): StoredUser | null {
	ensureApiKeyCache();

	// 先從快取查找明文 API Key → userId
	const userId = apiKeyCache.get(apiKey);
	if (userId) {
		const user = getUserById(userId);
		if (user) {
			// 解密回傳明文
			try {
				user.apiKey = decryptApiKey(user.apiKey);
			} catch { /* 解密失敗保持原值 */ }
			return user;
		}
	}

	// 快取未命中 — 遍歷所有使用者嘗試解密比對（相容舊格式遷移情境）
	if (db) {
		const rows = db.listUsers();
		for (const row of rows) {
			if (!row.api_key) continue;
			try {
				const plain = decryptApiKey(row.api_key);
				if (timingSafeEqualStr(plain, apiKey)) {
					// 更新快取
					updateApiKeyCache(plain, row.id);
					// 透過 getUserById 取得完整的 StoredUser
					const fullRow = db.getUserById(row.id);
					if (fullRow) {
						const user = dbRowToStoredUser(fullRow);
						user.apiKey = plain;
						return user;
					}
					return null;
				}
			} catch { /* 解密失敗跳過 */ }
		}
		return null;
	}

	const data = readUsersDataFromJson();
	for (const u of data.users) {
		try {
			const plain = decryptApiKey(u.apiKey);
			if (timingSafeEqualStr(plain, apiKey)) {
				updateApiKeyCache(plain, u.id);
				return { ...u, apiKey: plain };
			}
		} catch { /* 解密失敗跳過 */ }
	}
	return null;
}

export function getUserByUsername(username: string): StoredUser | null {
	if (db) {
		const row = db.getUserByUsername(username);
		return row ? dbRowToStoredUser(row) : null;
	}
	const data = readUsersDataFromJson();
	return data.users.find(u => u.username === username) || null;
}

export function getUserById(id: string): StoredUser | null {
	if (db) {
		const row = db.getUserById(id);
		return row ? dbRowToStoredUser(row) : null;
	}
	const data = readUsersDataFromJson();
	return data.users.find(u => u.id === id) || null;
}

export function getUserCount(): number {
	if (db) {
		return db.listUsers().length;
	}
	return readUsersDataFromJson().users.length;
}

/** 更新使用者密碼雜湊 */
export function updateUserPassword(username: string, newPasswordHash: string): void {
	if (db) {
		const row = db.getUserByUsername(username);
		if (!row) throw new Error('User not found');
		db.updateUserPassword(username, newPasswordHash);
		return;
	}
	const data = readUsersDataFromJson();
	const user = data.users.find(u => u.username === username);
	if (!user) throw new Error('User not found');
	user.passwordHash = newPasswordHash;
	writeUsersData(data);
}

/** 清除強制變更密碼標記 */
export function clearMustChangePassword(username: string): void {
	if (db) {
		db.clearMustChangePassword(username);
		return;
	}
	const data = readUsersDataFromJson();
	const user = data.users.find(u => u.username === username);
	if (!user) throw new Error('User not found');
	user.mustChangePassword = false;
	writeUsersData(data);
}

/** 更新使用者角色 */
export function updateUserRole(id: string, role: 'admin' | 'member'): void {
	if (db) {
		const row = db.getUserById(id);
		if (!row) throw new Error('User not found');
		db.updateUserRole(id, role);
		return;
	}
	const data = readUsersDataFromJson();
	const user = data.users.find(u => u.id === id);
	if (!user) throw new Error('User not found');
	user.role = role;
	writeUsersData(data);
}

/** 重新生成使用者的 API Key，回傳新的明文 key */
export function regenerateApiKey(userId: string): string {
	const newKey = generateApiKey();
	const encryptedKey = encryptApiKey(newKey);
	// 移除舊的快取條目並新增新的
	removeApiKeyCacheByUserId(userId);
	updateApiKeyCache(newKey, userId);
	if (db) {
		const row = db.getUserById(userId);
		if (!row) throw new Error('User not found');
		db.updateApiKey(userId, encryptedKey);
		return newKey;
	}
	const data = readUsersDataFromJson();
	const user = data.users.find(u => u.id === userId);
	if (!user) throw new Error('User not found');
	user.apiKey = encryptedKey;
	writeUsersData(data);
	return newKey;
}

/** 刪除使用者 */
export function deleteUser(id: string): void {
	if (db) {
		const row = db.getUserById(id);
		if (!row) throw new Error('User not found');
		db.deleteUser(id);
		return;
	}
	const data = readUsersDataFromJson();
	const idx = data.users.findIndex(u => u.id === id);
	if (idx === -1) throw new Error('User not found');
	data.users.splice(idx, 1);
	writeUsersData(data);
}

/** 列出所有使用者（不含密碼雜湊）— apiKey 解密後回傳 */
export function listUsers(): PublicUser[] {
	if (db) {
		return db.listUsers().map(u => {
			// viewer 角色自動遷移為 member
			const role = u.role === 'viewer' ? 'member' : u.role;
			let apiKey = u.api_key || '';
			if (!apiKey) {
				apiKey = generateApiKey();
			} else {
				try { apiKey = decryptApiKey(apiKey); } catch { /* 保持原值 */ }
			}
			return {
				id: u.id,
				username: u.username,
				role: role as 'admin' | 'member',
				createdAt: u.created_at,
				mustChangePassword: u.must_change_password === 1,
				apiKey,
			};
		});
	}
	const data = readUsersDataFromJson();
	return data.users.map(u => {
		let apiKey = u.apiKey;
		try { apiKey = decryptApiKey(apiKey); } catch { /* 保持原值 */ }
		return {
			id: u.id,
			username: u.username,
			role: u.role ?? 'admin',
			createdAt: u.createdAt,
			mustChangePassword: u.mustChangePassword ?? false,
			apiKey,
		};
	});
}

/** 首次啟動時若無使用者，建立預設 admin 帳號（標記須變更密碼） */
export async function ensureDefaultUser(): Promise<void> {
	if (getUserCount() > 0) return;
	console.log('[Pixel Agents] No users found, creating default admin account');
	await createUser('admin', 'admin', { mustChangePassword: true, role: 'admin' });
}
