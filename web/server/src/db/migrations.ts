// ── SQLite Migration System ─────────────────────────────────────────
import type BetterSqlite3 from 'better-sqlite3';
import { SCHEMA_VERSION, INITIAL_SCHEMA } from './schema.js';

export interface Migration {
	version: number;
	up: string;
	description: string;
	/** 遷移後執行的回呼（用於需要程式邏輯的資料回填） */
	afterUp?: (db: BetterSqlite3.Database) => void;
}

/**
 * Migration registry. Each entry's `up` SQL is executed inside a transaction.
 * Version numbers MUST be sequential starting from 1.
 */
export const MIGRATIONS: Migration[] = [
	{
		version: 1,
		up: INITIAL_SCHEMA,
		description: 'Initial schema: all core tables and indexes',
	},
	{
		version: 2,
		up: [
			// 新增 api_key 欄位至 users 表
			`ALTER TABLE users ADD COLUMN api_key TEXT;`,
			// 將 viewer 角色更新為 member
			`UPDATE users SET role = 'member' WHERE role = 'viewer';`,
			// 建立 api_key 索引（用於快速查找）
			`CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);`,
		].join('\n'),
		description: 'Add api_key column, rename viewer role to member',
		afterUp: (db) => {
			// 為已有使用者回填 api_key（使用隨機英數字串）
			const generateApiKey = (): string => {
				const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
				let result = 'pa_';
				for (let i = 0; i < 32; i++) {
					result += chars.charAt(Math.floor(Math.random() * chars.length));
				}
				return result;
			};
			const rows = db.prepare(`SELECT id FROM users WHERE api_key IS NULL`).all() as Array<{ id: string }>;
			const stmt = db.prepare(`UPDATE users SET api_key = ? WHERE id = ?`);
			for (const row of rows) {
				stmt.run(generateApiKey(), row.id);
			}
			if (rows.length > 0) {
				console.log(`[DB Migration]   Backfilled api_key for ${rows.length} existing user(s)`);
			}
		},
	},
	{
		version: 3,
		up: [
			// 新增 owner_id 欄位至 floors 表（樓層所有權模型）
			`ALTER TABLE floors ADD COLUMN owner_id TEXT;`,
		].join('\n'),
		description: 'Add owner_id column to floors for per-user floor ownership',
	},
];

/**
 * Returns the current schema version stored in the database.
 * Returns 0 if the schema_version table does not exist yet.
 */
function getCurrentVersion(db: BetterSqlite3.Database): number {
	try {
		const row = db.prepare(
			`SELECT MAX(version) AS version FROM schema_version`,
		).get() as { version: number | null } | undefined;
		return row?.version ?? 0;
	} catch {
		// Table does not exist yet
		return 0;
	}
}

/**
 * Apply all pending migrations in order.
 * Each migration is wrapped in a transaction for atomicity.
 */
export function runMigrations(db: BetterSqlite3.Database): void {
	const current = getCurrentVersion(db);

	if (current >= SCHEMA_VERSION) {
		return; // Already up to date
	}

	const pending = MIGRATIONS.filter(m => m.version > current);
	if (pending.length === 0) return;

	console.log(
		`[DB] Running ${pending.length} migration(s): v${current} -> v${SCHEMA_VERSION}`,
	);

	for (const migration of pending) {
		const applyMigration = db.transaction(() => {
			db.exec(migration.up);
			// 執行遷移後回呼（資料回填等）
			if (migration.afterUp) {
				migration.afterUp(db);
			}
			db.prepare(
				`INSERT OR REPLACE INTO schema_version (version) VALUES (?)`,
			).run(migration.version);
		});

		applyMigration();
		console.log(
			`[DB] Applied migration v${migration.version}: ${migration.description}`,
		);
	}
}
