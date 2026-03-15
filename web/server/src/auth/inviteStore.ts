// ── 邀請碼持久化 ──────────────────────────────────────────────
// 使用 JSON 檔案儲存邀請碼，支援建立、驗證、列出、刪除操作。
// 持久化路徑：~/.pixel-agents/invites.json

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { LAYOUT_FILE_DIR, INVITES_FILE_NAME, INVITE_CODE_LENGTH, INVITE_DEFAULT_EXPIRY_HOURS } from '../constants.js';
import { atomicWriteJson } from '../atomicWrite.js';

const userDir = path.join(os.homedir(), LAYOUT_FILE_DIR);

export interface InviteCode {
	code: string;
	createdBy: string;  // admin userId
	createdAt: string;
	expiresAt?: string;
	usedBy?: string;
	usedAt?: string;
}

interface InvitesData {
	invites: InviteCode[];
}

function getInvitesFilePath(): string {
	return path.join(userDir, INVITES_FILE_NAME);
}

/** 讀取邀請碼資料 */
function readInvitesData(): InvitesData {
	try {
		const filePath = getInvitesFilePath();
		if (!fs.existsSync(filePath)) return { invites: [] };
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as InvitesData;
	} catch {
		return { invites: [] };
	}
}

/** 寫入邀請碼資料 */
function writeInvitesData(data: InvitesData): void {
	atomicWriteJson(getInvitesFilePath(), data);
}

/** 產生隨機邀請碼（16 字元英數字） */
function generateCode(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const randomBytes = crypto.randomBytes(INVITE_CODE_LENGTH);
	let result = '';
	for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
		result += chars.charAt(randomBytes[i] % chars.length);
	}
	return result;
}

/** 建立邀請碼 */
export function createInvite(createdBy: string, expiresInHours?: number): InviteCode {
	const data = readInvitesData();
	const hours = expiresInHours ?? INVITE_DEFAULT_EXPIRY_HOURS;
	const now = new Date();
	const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

	const invite: InviteCode = {
		code: generateCode(),
		createdBy,
		createdAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
	};

	data.invites.push(invite);
	writeInvitesData(data);
	return invite;
}

/** 使用邀請碼（驗證並標記為已使用），回傳是否成功 */
export function useInvite(code: string, username: string): boolean {
	const data = readInvitesData();
	const invite = data.invites.find(i => i.code === code);
	if (!invite) return false;

	// 已被使用
	if (invite.usedBy) return false;

	// 已過期
	if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return false;

	invite.usedBy = username;
	invite.usedAt = new Date().toISOString();
	writeInvitesData(data);
	return true;
}

/** 列出所有邀請碼 */
export function listInvites(): InviteCode[] {
	const data = readInvitesData();
	return data.invites;
}

/** 刪除邀請碼 */
export function deleteInvite(code: string): boolean {
	const data = readInvitesData();
	const idx = data.invites.findIndex(i => i.code === code);
	if (idx === -1) return false;
	data.invites.splice(idx, 1);
	writeInvitesData(data);
	return true;
}
