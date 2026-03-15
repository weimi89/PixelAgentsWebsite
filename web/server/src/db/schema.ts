// ── SQLite Schema Definition ────────────────────────────────────────

export const SCHEMA_VERSION = 3;

export const INITIAL_SCHEMA = `
-- ── Schema versioning ────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Key-value settings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── User accounts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- ── Building configuration ───────────────────────────────
CREATE TABLE IF NOT EXISTS building (
  id INTEGER PRIMARY KEY DEFAULT 1,
  default_floor_id TEXT NOT NULL DEFAULT '1F',
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Floor layouts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  layout TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Agent appearance persistence ─────────────────────────
CREATE TABLE IF NOT EXISTS agent_appearances (
  agent_key TEXT PRIMARY KEY,
  palette INTEGER NOT NULL DEFAULT 0,
  hue_shift INTEGER NOT NULL DEFAULT 0,
  seat_id TEXT,
  floor_id TEXT NOT NULL DEFAULT '1F',
  cli_type TEXT DEFAULT 'claude',
  xp INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  bash_call_count INTEGER NOT NULL DEFAULT 0,
  achievements TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Custom project display names ─────────────────────────
CREATE TABLE IF NOT EXISTS project_names (
  dir_basename TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Excluded projects (hidden from auto-detection) ───────
CREATE TABLE IF NOT EXISTS excluded_projects (
  dir_basename TEXT PRIMARY KEY,
  excluded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Project-to-floor mapping ─────────────────────────────
CREATE TABLE IF NOT EXISTS project_floor_map (
  project_key TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Agent team names ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_names (
  agent_key TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Tool call statistics ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  agent_key TEXT,
  floor_id TEXT,
  called_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Agent event history ──────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Audit log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tool_stats_name ON tool_stats(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_stats_time ON tool_stats(called_at);
CREATE INDEX IF NOT EXISTS idx_agent_history_key ON agent_history(agent_key);
CREATE INDEX IF NOT EXISTS idx_agent_history_time ON agent_history(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
`;
