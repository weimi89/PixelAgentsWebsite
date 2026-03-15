// ── SQLite Database Abstraction Layer ────────────────────────────────
import BetterSqlite3 from 'better-sqlite3';
import { runMigrations } from './migrations.js';

// ── Row types ────────────────────────────────────────────────────────

export interface UserRow {
	id: string;
	username: string;
	password_hash: string;
	role: string;
	must_change_password: number; // SQLite boolean: 0 | 1
	api_key: string | null;
	created_at: string;
	last_login_at: string | null;
}

export interface PublicUserRow {
	id: string;
	username: string;
	role: string;
	must_change_password: number;
	api_key: string | null;
	created_at: string;
}

export interface BuildingRow {
	id: number;
	default_floor_id: string;
	config: string;
	updated_at: string;
}

export interface FloorRow {
	id: string;
	name: string;
	sort_order: number;
	layout: string;
	owner_id: string | null;
	updated_at: string;
}

export interface AgentAppearanceRow {
	agent_key: string;
	palette: number;
	hue_shift: number;
	seat_id: string | null;
	floor_id: string;
	cli_type: string | null;
	xp: number;
	tool_call_count: number;
	session_count: number;
	bash_call_count: number;
	achievements: string; // JSON array
	updated_at: string;
}

// ── Database class ───────────────────────────────────────────────────

export class Database {
	private readonly db: BetterSqlite3.Database;

	// ── Prepared statement caches ────────────────────────────────────
	private readonly stmtGetSetting: BetterSqlite3.Statement;
	private readonly stmtSetSetting: BetterSqlite3.Statement;
	private readonly stmtGetUserByUsername: BetterSqlite3.Statement;
	private readonly stmtGetUserById: BetterSqlite3.Statement;
	private readonly stmtGetAgentAppearance: BetterSqlite3.Statement;
	private readonly stmtIncrementToolStat: BetterSqlite3.Statement;
	private readonly stmtAddAuditEntry: BetterSqlite3.Statement;
	private readonly stmtAddAgentHistory: BetterSqlite3.Statement;

	constructor(dbPath: string) {
		this.db = new BetterSqlite3(dbPath);

		// Enable WAL mode for better concurrent read performance
		this.db.pragma('journal_mode = WAL');
		// Ensure foreign keys are enforced
		this.db.pragma('foreign_keys = ON');

		// Run migrations
		runMigrations(this.db);

		// Prepare frequently-used statements
		this.stmtGetSetting = this.db.prepare(
			`SELECT value FROM settings WHERE key = ?`,
		);
		this.stmtSetSetting = this.db.prepare(
			`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
		);
		this.stmtGetUserByUsername = this.db.prepare(
			`SELECT * FROM users WHERE username = ?`,
		);
		this.stmtGetUserById = this.db.prepare(
			`SELECT * FROM users WHERE id = ?`,
		);
		this.stmtGetAgentAppearance = this.db.prepare(
			`SELECT * FROM agent_appearances WHERE agent_key = ?`,
		);
		this.stmtIncrementToolStat = this.db.prepare(
			`INSERT INTO tool_stats (tool_name, agent_key, floor_id) VALUES (?, ?, ?)`,
		);
		this.stmtAddAuditEntry = this.db.prepare(
			`INSERT INTO audit_log (user_id, action, detail, ip_address) VALUES (?, ?, ?, ?)`,
		);
		this.stmtAddAgentHistory = this.db.prepare(
			`INSERT INTO agent_history (agent_key, event_type, detail) VALUES (?, ?, ?)`,
		);
	}

	/** Expose raw db for advanced operations (e.g. JSON migration transactions) */
	get raw(): BetterSqlite3.Database {
		return this.db;
	}

	// ── Settings ─────────────────────────────────────────────────────

	getSetting(key: string): string | undefined {
		const row = this.stmtGetSetting.get(key) as { value: string } | undefined;
		return row?.value;
	}

	setSetting(key: string, value: string): void {
		this.stmtSetSetting.run(key, value);
	}

	// ── Users ────────────────────────────────────────────────────────

	createUser(user: {
		id: string;
		username: string;
		passwordHash: string;
		role?: string;
		mustChangePassword?: boolean;
		apiKey?: string;
	}): void {
		this.db.prepare(
			`INSERT INTO users (id, username, password_hash, role, must_change_password, api_key)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		).run(
			user.id,
			user.username,
			user.passwordHash,
			user.role ?? 'admin',
			user.mustChangePassword ? 1 : 0,
			user.apiKey ?? null,
		);
	}

	getUserByUsername(username: string): UserRow | undefined {
		return this.stmtGetUserByUsername.get(username) as UserRow | undefined;
	}

	getUserById(id: string): UserRow | undefined {
		return this.stmtGetUserById.get(id) as UserRow | undefined;
	}

	listUsers(): PublicUserRow[] {
		return this.db.prepare(
			`SELECT id, username, role, must_change_password, api_key, created_at FROM users`,
		).all() as PublicUserRow[];
	}

	/** 透過 API Key 查找使用者 */
	getUserByApiKey(apiKey: string): UserRow | undefined {
		return this.db.prepare(
			`SELECT * FROM users WHERE api_key = ?`,
		).get(apiKey) as UserRow | undefined;
	}

	/** 更新使用者的 API Key */
	updateApiKey(userId: string, apiKey: string): void {
		this.db.prepare(
			`UPDATE users SET api_key = ? WHERE id = ?`,
		).run(apiKey, userId);
	}

	updateUserPassword(username: string, hash: string): void {
		this.db.prepare(
			`UPDATE users SET password_hash = ? WHERE username = ?`,
		).run(hash, username);
	}

	updateUserRole(id: string, role: string): void {
		this.db.prepare(
			`UPDATE users SET role = ? WHERE id = ?`,
		).run(role, id);
	}

	deleteUser(id: string): void {
		this.db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
	}

	clearMustChangePassword(username: string): void {
		this.db.prepare(
			`UPDATE users SET must_change_password = 0 WHERE username = ?`,
		).run(username);
	}

	updateLastLogin(username: string): void {
		this.db.prepare(
			`UPDATE users SET last_login_at = datetime('now') WHERE username = ?`,
		).run(username);
	}

	// ── Building & Floors ────────────────────────────────────────────

	getBuilding(): BuildingRow | undefined {
		return this.db.prepare(
			`SELECT * FROM building WHERE id = 1`,
		).get() as BuildingRow | undefined;
	}

	saveBuilding(config: string, defaultFloorId?: string): void {
		this.db.prepare(
			`INSERT INTO building (id, config, default_floor_id, updated_at)
			 VALUES (1, ?, ?, datetime('now'))
			 ON CONFLICT(id) DO UPDATE SET config = excluded.config,
			   default_floor_id = excluded.default_floor_id,
			   updated_at = datetime('now')`,
		).run(config, defaultFloorId ?? '1F');
	}

	getFloor(id: string): FloorRow | undefined {
		return this.db.prepare(
			`SELECT * FROM floors WHERE id = ?`,
		).get(id) as FloorRow | undefined;
	}

	listFloors(): FloorRow[] {
		return this.db.prepare(
			`SELECT * FROM floors ORDER BY sort_order ASC`,
		).all() as FloorRow[];
	}

	saveFloor(id: string, name: string, order: number, layout: string, ownerId?: string | null): void {
		this.db.prepare(
			`INSERT INTO floors (id, name, sort_order, layout, owner_id, updated_at)
			 VALUES (?, ?, ?, ?, ?, datetime('now'))
			 ON CONFLICT(id) DO UPDATE SET name = excluded.name,
			   sort_order = excluded.sort_order,
			   layout = excluded.layout,
			   owner_id = excluded.owner_id,
			   updated_at = datetime('now')`,
		).run(id, name, order, layout, ownerId ?? null);
	}

	deleteFloor(id: string): void {
		this.db.prepare(`DELETE FROM floors WHERE id = ?`).run(id);
	}

	// ── Agent Appearances ────────────────────────────────────────────

	getAgentAppearance(key: string): AgentAppearanceRow | undefined {
		return this.stmtGetAgentAppearance.get(key) as AgentAppearanceRow | undefined;
	}

	saveAgentAppearance(key: string, data: {
		palette?: number;
		hueShift?: number;
		seatId?: string | null;
		floorId?: string;
		cliType?: string | null;
		xp?: number;
		toolCallCount?: number;
		sessionCount?: number;
		bashCallCount?: number;
		achievements?: string[];
	}): void {
		this.db.prepare(
			`INSERT INTO agent_appearances
			   (agent_key, palette, hue_shift, seat_id, floor_id, cli_type,
			    xp, tool_call_count, session_count, bash_call_count, achievements, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
			 ON CONFLICT(agent_key) DO UPDATE SET
			   palette = excluded.palette,
			   hue_shift = excluded.hue_shift,
			   seat_id = excluded.seat_id,
			   floor_id = excluded.floor_id,
			   cli_type = excluded.cli_type,
			   xp = excluded.xp,
			   tool_call_count = excluded.tool_call_count,
			   session_count = excluded.session_count,
			   bash_call_count = excluded.bash_call_count,
			   achievements = excluded.achievements,
			   updated_at = datetime('now')`,
		).run(
			key,
			data.palette ?? 0,
			data.hueShift ?? 0,
			data.seatId ?? null,
			data.floorId ?? '1F',
			data.cliType ?? 'claude',
			data.xp ?? 0,
			data.toolCallCount ?? 0,
			data.sessionCount ?? 0,
			data.bashCallCount ?? 0,
			JSON.stringify(data.achievements ?? []),
		);
	}

	listAgentAppearances(): AgentAppearanceRow[] {
		return this.db.prepare(
			`SELECT * FROM agent_appearances`,
		).all() as AgentAppearanceRow[];
	}

	// ── Project Names & Exclusions ───────────────────────────────────

	getProjectName(basename: string): string | undefined {
		const row = this.db.prepare(
			`SELECT display_name FROM project_names WHERE dir_basename = ?`,
		).get(basename) as { display_name: string } | undefined;
		return row?.display_name;
	}

	setProjectName(basename: string, name: string): void {
		this.db.prepare(
			`INSERT INTO project_names (dir_basename, display_name, updated_at)
			 VALUES (?, ?, datetime('now'))
			 ON CONFLICT(dir_basename) DO UPDATE SET display_name = excluded.display_name,
			   updated_at = datetime('now')`,
		).run(basename, name);
	}

	listProjectNames(): Record<string, string> {
		const rows = this.db.prepare(
			`SELECT dir_basename, display_name FROM project_names`,
		).all() as Array<{ dir_basename: string; display_name: string }>;
		const result: Record<string, string> = {};
		for (const row of rows) {
			result[row.dir_basename] = row.display_name;
		}
		return result;
	}

	addExcludedProject(basename: string): void {
		this.db.prepare(
			`INSERT OR IGNORE INTO excluded_projects (dir_basename) VALUES (?)`,
		).run(basename);
	}

	removeExcludedProject(basename: string): void {
		this.db.prepare(
			`DELETE FROM excluded_projects WHERE dir_basename = ?`,
		).run(basename);
	}

	listExcludedProjects(): string[] {
		const rows = this.db.prepare(
			`SELECT dir_basename FROM excluded_projects`,
		).all() as Array<{ dir_basename: string }>;
		return rows.map(r => r.dir_basename);
	}

	// ── Floor Map ────────────────────────────────────────────────────

	getProjectFloor(key: string): string | undefined {
		const row = this.db.prepare(
			`SELECT floor_id FROM project_floor_map WHERE project_key = ?`,
		).get(key) as { floor_id: string } | undefined;
		return row?.floor_id;
	}

	setProjectFloor(key: string, floorId: string): void {
		this.db.prepare(
			`INSERT INTO project_floor_map (project_key, floor_id, updated_at)
			 VALUES (?, ?, datetime('now'))
			 ON CONFLICT(project_key) DO UPDATE SET floor_id = excluded.floor_id,
			   updated_at = datetime('now')`,
		).run(key, floorId);
	}

	listProjectFloorMap(): Record<string, string> {
		const rows = this.db.prepare(
			`SELECT project_key, floor_id FROM project_floor_map`,
		).all() as Array<{ project_key: string; floor_id: string }>;
		const result: Record<string, string> = {};
		for (const row of rows) {
			result[row.project_key] = row.floor_id;
		}
		return result;
	}

	// ── Team Names ───────────────────────────────────────────────────

	getTeamName(key: string): string | undefined {
		const row = this.db.prepare(
			`SELECT team_name FROM team_names WHERE agent_key = ?`,
		).get(key) as { team_name: string } | undefined;
		return row?.team_name;
	}

	setTeamName(key: string, teamName: string | null): void {
		if (teamName) {
			this.db.prepare(
				`INSERT INTO team_names (agent_key, team_name, updated_at)
				 VALUES (?, ?, datetime('now'))
				 ON CONFLICT(agent_key) DO UPDATE SET team_name = excluded.team_name,
				   updated_at = datetime('now')`,
			).run(key, teamName);
		} else {
			this.db.prepare(
				`DELETE FROM team_names WHERE agent_key = ?`,
			).run(key);
		}
	}

	listTeamNames(): Record<string, string> {
		const rows = this.db.prepare(
			`SELECT agent_key, team_name FROM team_names`,
		).all() as Array<{ agent_key: string; team_name: string }>;
		const result: Record<string, string> = {};
		for (const row of rows) {
			result[row.agent_key] = row.team_name;
		}
		return result;
	}

	// ── Tool Stats ───────────────────────────────────────────────────

	incrementToolStat(toolName: string, agentKey?: string, floorId?: string): void {
		this.stmtIncrementToolStat.run(toolName, agentKey ?? null, floorId ?? null);
	}

	getToolStats(): { totalCalls: number; toolCounts: Record<string, number> } {
		const totalRow = this.db.prepare(
			`SELECT COUNT(*) AS total FROM tool_stats`,
		).get() as { total: number };

		const rows = this.db.prepare(
			`SELECT tool_name, COUNT(*) AS cnt FROM tool_stats GROUP BY tool_name`,
		).all() as Array<{ tool_name: string; cnt: number }>;

		const toolCounts: Record<string, number> = {};
		for (const row of rows) {
			toolCounts[row.tool_name] = row.cnt;
		}

		return { totalCalls: totalRow.total, toolCounts };
	}

	// ── Agent History ────────────────────────────────────────────────

	addAgentHistory(key: string, type: string, detail?: string): void {
		this.stmtAddAgentHistory.run(key, type, detail ?? null);
	}

	// ── Audit Log ────────────────────────────────────────────────────

	addAuditEntry(action: string, userId?: string, detail?: string, ip?: string): void {
		this.stmtAddAuditEntry.run(userId ?? null, action, detail ?? null, ip ?? null);
	}

	// ── Lifecycle ────────────────────────────────────────────────────

	close(): void {
		this.db.close();
	}
}

// ── Singleton ────────────────────────────────────────────────────────

export let db: Database;

/**
 * Initialize the database singleton.
 * Must be called once at server startup before any DB operations.
 */
export function initDatabase(dbPath: string): Database {
	db = new Database(dbPath);
	return db;
}
