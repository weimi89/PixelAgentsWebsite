# Pixel Agents

[![CI](https://github.com/weimi89/PixelAgentsWebsite/actions/workflows/ci.yml/badge.svg)](https://github.com/weimi89/PixelAgentsWebsite/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](#requirements)
[![Tests](https://img.shields.io/badge/tests-139_passing-brightgreen.svg)](#testing)

> **Languages**: **English**（本頁）· [繁體中文](README.zh-TW.md)

**Watch your AI coding sessions come alive as a pixel-art office.**

Every Claude Code, Codex, or Gemini CLI session becomes an animated pixel character in a virtual office — typing at a desk, reading documentation, running bash, or getting coffee while you wait for tool calls. No more staring at raw terminal output; see your agents *work*.

![Pixel Agents screenshot](webview-ui/public/Screenshot.jpg)

> 🎬 Demo GIF coming soon — in the meantime, try `npm run cli -- --demo` to see it live with 3 simulated agents.

---

## Why

If you use Claude Code (or similar CLI AI agents) heavily, you know the pain:

- You kick off 5 agents in different terminals → lose track of which one is doing what
- You glance at logs and see `tool_use: Bash { ... }` → abstract, forgettable
- You get bored watching text scroll → miss the moment an agent actually needs your input

Pixel Agents turns invisible work into **something you can feel**:

- 🏢 Every agent becomes a named character in a shared office
- 🎨 Tools become animations: typing, reading, thinking, drinking coffee
- 💬 Waiting for permission? Your agent holds a speech bubble — you can't miss it
- 👥 Working with a team? Everyone's agents appear in the same office
- 📊 At the end of the day, see what each agent actually got done

---

## Quick Start (30 seconds)

### 🚀 One-liner demo

```bash
git clone https://github.com/weimi89/PixelAgentsWebsite.git
cd PixelAgentsWebsite/web
npm install
npm run build
npm run cli -- --demo
```

A browser window opens at `http://localhost:13001` with 3 simulated agents typing, reading, and walking around. **No Claude Code installation required for demo mode.**

### 🔌 Real mode (auto-detect your Claude sessions)

```bash
npm run cli
```

The server passively scans `~/.claude/projects/` and visualizes any active session. **You don't launch agents through Pixel Agents — keep using Claude Code as normal, the visualization just appears.**

### ⚙️ CLI flags

```bash
npm run cli -- --help               # all options
npm run cli -- --demo --demo-agents 8
npm run cli -- --port 8080
npm run cli -- --no-open            # don't auto-open browser
```

---

## Features

**Agent visualization**
- 🧍 Animated pixel characters (6 unique palettes + unlimited hue variants)
- 🎬 10 emote types: ☕ coffee, 💡 idea, ❤️ chat, 💤 sleep, 📷 camera, 💫 compact, etc.
- 🎨 Per-tool animation: type vs read vs think vs wait
- ✨ Matrix-style spawn/despawn effects
- 🚶 Natural walk cycle with body bob + turn pauses

**Office simulation**
- 🏢 Multi-floor building with per-project routing
- 🪑 Seat assignment (agents remember their favorite desk)
- 🛋 Idle behaviors: coffee machine, water cooler, whiteboard, chatting with neighbors
- 🌗 Day/night cycle + seasonal backdrops
- 🎨 Built-in layout editor (floors, walls, furniture with color + rotation)

**Multi-CLI support**
- ✅ Claude Code (first-class)
- ✅ Codex CLI
- ✅ Gemini CLI (with Serena MCP integration)
- 🔜 Custom CLI adapters via plugin API

**Team & remote**
- 🌐 Remote Agent Node CLI (push agents from any machine to a central server)
- 👥 Multi-user floors with ownership
- 💬 Built-in chat per floor
- 🔔 Real-time activity sync across devices

**Developer experience**
- 🔒 Full auth (bcrypt 12, AES-256-GCM API keys, timing-safe comparisons)
- 📊 Prometheus `/metrics` endpoint
- 💾 SQLite-backed with automatic backups
- 🔌 Redis-based clustering (optional)
- 🎛 Feature-rich dashboard (tool stats, agent history, audit logs)

---

## How it works

```
                  ┌───────────────────────────┐
                  │   Claude Code / Codex /   │  You run agents normally
                  │     Gemini CLI            │  (nothing changes in your workflow)
                  └─────────────┬─────────────┘
                                │ writes JSONL
                                ▼
                  ~/.claude/projects/<hash>/<id>.jsonl
                                │
                                │ watched (fs.watch + poll)
                                ▼
                  ┌───────────────────────────┐
                  │  Pixel Agents Server      │  Parses tool_use events,
                  │  (Express + Socket.IO)    │  broadcasts to clients
                  └─────────────┬─────────────┘
                                │ Socket.IO
                                ▼
                  ┌───────────────────────────┐
                  │  Browser (Canvas 2D)      │  Renders pixel office,
                  │                           │  animates agents
                  └───────────────────────────┘
```

**Passive detection** — no modification to your Claude setup. Start Pixel Agents, open the browser, and your current sessions appear automatically.

For remote machines, [PixelAgentsDesktop](https://github.com/weimi89/PixelAgentsDesktop) provides a Tauri menu-bar app that connects to a central server.

---

## Requirements

- **Node.js 18+** (20+ recommended)
- **Claude Code CLI** (optional — demo mode works without it)
- One of: macOS / Linux / Windows

---

## Development

```bash
cd web
npm install
npm run dev        # Vite HMR + tsx watch
npm run build      # production build
npm test           # 139 tests
npm run lint       # 0 errors
npm run typecheck
```

Pre-commit hook auto-runs typecheck + tests when you commit to `web/`. Installed automatically via `npm install`.

### Project structure

```
web/
  shared/      — Protocol types + pure functions (server + agent-node)
  server/      — Express + Socket.IO + SQLite + auth + clustering
  client/      — React 19 + Canvas 2D + Socket.IO client
  agent-node/  — Remote machine CLI (push agents to central server)
  bin/         — `pixel-agents` launcher (npm run cli)
  scripts/     — Drift check, sync, demo recording helpers
```

See [CLAUDE.md](CLAUDE.md) for full architecture.

---

## Environment variables

Server accepts the following (all optional):

### Basics
| Variable | Default | Description |
|---|---|---|
| `PORT` | `13001` | HTTP server port |
| `HTTPS` / `--https` | — | Enable HTTPS with self-signed cert |
| `DEMO` / `--demo` | — | Demo mode (no real sessions needed) |
| `DEMO_AGENTS` | `3` | Agents in demo mode |
| `DATA_DIR` | `~/.pixel-agents` | User data directory |
| `NODE_ENV` | `development` | `production` enables strict CSP |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

### Auth & security
| Variable | Default | Description |
|---|---|---|
| `REGISTRATION_POLICY` | `open` | `open` / `invite` / `closed` |
| `REQUIRE_PASSWORD_SPECIAL_CHAR` | — | `1` to require special chars in passwords |
| `API_KEY_ENCRYPTION_KEY` | — | Custom API key encryption key |
| `TRUST_PROXY` | — | **Set to `1` or CIDR when behind nginx/Cloudflare**, else `req.ip` is wrong |
| `ALLOWED_ORIGINS` | — | Comma-separated CORS/Socket.IO origins |

### Clustering
| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | — | Enables cluster mode (Socket.IO adapter + heartbeat) |
| `SERVER_ID` | random | Cluster node identifier |

> **Production deployment tip**: If you run behind a reverse proxy, **set `TRUST_PROXY=1`** — otherwise rate limiting treats all requests as the same IP.

---

## Deployment notes

### First-load bundle

| | Size | gzipped |
|---|---|---|
| Main route | 569 KB | 154 KB |
| React vendor (cached) | 192 KB | 60 KB |
| Socket.IO vendor (cached) | 41 KB | 13 KB |
| Terminal (lazy) | 336 KB | 85 KB |
| Dashboard (lazy) | 17 KB | 6 KB |

Font file (`FSPixelSansUnicode-Regular.ttf`, 1MB) is the main weight — see [scripts/subset-font.md](scripts/subset-font.md) to reduce to ~400KB.

### User data

All user data lives in `~/.pixel-agents/`:
- `pixel-agents.db` — Main SQLite database (users, audit log, tool stats, history)
- `building.json` + `floors/*.json` — Office layouts
- `jwt-secret.key` — JWT signing + API key encryption
- `backups/` — Auto-backups (every 6h, keeps 5)

---

## Multi-machine setup

Remote machines can push their Claude sessions to a central server:

```bash
# On the remote machine
npx pixel-agents-node login --server https://your-server.example.com
npx pixel-agents-node start
```

Remote agents appear with an **orange glow** and show the owner's username in the label.

For a native desktop experience (menu bar app), see [PixelAgentsDesktop](https://github.com/weimi89/PixelAgentsDesktop).

---

## Testing

- **139 tests passing** (server-side; client-side coverage planned)
- **0 lint errors**, 0 TypeScript errors
- **npm audit clean** (CI checks weekly via Dependabot)

```bash
cd web && npm test
```

---

## Contributing & growing

This project aims to **keep growing**, not just ship once. Every contribution — typo fixes, tests, feature ideas — is welcome.

- 📜 [ROADMAP.md](ROADMAP.md) — Short / medium / long-term direction with an explicit "not doing" list
- 🛠 [CONTRIBUTING.md](CONTRIBUTING.md) — Dev environment, style, PR flow, shared/ sync with Desktop
- 🔒 [SECURITY.md](SECURITY.md) — Vulnerability reporting + current safeguards
- 📝 [CHANGELOG.md](CHANGELOG.md) — Cumulative changes

### Quick contribution path

```bash
git clone https://github.com/weimi89/PixelAgentsWebsite.git
cd PixelAgentsWebsite/web
npm install                      # auto-enables pre-commit hook
# Make changes, commit triggers typecheck + tests automatically
```

### Current health snapshot

| Metric | Value |
|---|---|
| Tests | 139 passing |
| Lint errors | 0 |
| npm audit (moderate+) | 0 vulnerabilities |
| First-load (gzipped) | 154 KB |
| TypeScript | strict mode |

---

## Art assets

Office tileset uses **[Office Interior Tileset (16x16)](https://donarg.itch.io/officetileset)** by **Donarg** ($2 USD on itch.io). This is the only paid asset; tiles are **not** included in this repo. After purchase, run the asset import pipeline:

```bash
npm run import-tileset
```

Without tiles, the app still runs with default characters and a minimal layout — but the full furniture catalog requires Donarg's tileset.

Character sprites and default assets are original work, free to use within this project.

---

## Tech stack

- **Server**: Node.js 20, Express 5, Socket.IO 4, TypeScript strict, better-sqlite3, bcryptjs, ioredis (optional)
- **Client**: React 19, TypeScript, Vite 7, Canvas 2D, Socket.IO Client, xterm.js (lazy)
- **Original extension**: TypeScript, VS Code Webview API, esbuild (preserved in `src/` + `webview-ui/` for reference)

---

## Acknowledgements

Forked and rearchitected from [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents) (VS Code extension). Thanks to [Pablo De Lucca](https://github.com/pablodelucca) for the original concept.

---

## License

[MIT](LICENSE)
