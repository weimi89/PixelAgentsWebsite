import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import * as https from 'https';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import type { AgentContext, AgentState, ClientMessage, MessageSender, FloorId } from './types.js';
import {
	loadFurnitureAssets,
	loadFloorTiles,
	loadWallTiles,
	loadCharacterSprites,
	loadDefaultLayout,
	loadLayoutTemplates,
} from './assetLoader.js';
import type { LoadedAssets, LoadedFloorTiles, LoadedWallTiles, LoadedCharacterSprites, LayoutTemplate } from './assetLoader.js';
// layoutPersistence 保留供舊路徑備用
import { loadBuildingConfig, loadFloorLayout, writeFloorLayout, addFloor as addBuildingFloor, removeFloor as removeBuildingFloor, renameFloor as renameBuildingFloor } from './buildingPersistence.js';
import { closeAgent, removeAgent, sendExistingAgents, getAllProjectDirs, getProjectDirPath, resumeSession, recoverTmuxAgents, checkTmuxHealth, savePersistedAgents, extractProjectName } from './agentManager.js';
import { setCustomName, addExcludedProject, removeExcludedProject, readExcludedProjects } from './projectNameStore.js';
import { setTeamName } from './teamNameStore.js';
import { atomicWriteJson } from './atomicWrite.js';
import { scanAllSessions } from './sessionScanner.js';
import { ensureProjectScan } from './fileWatcher.js';
import {
	DEFAULT_PORT,
	DEFAULT_FLOOR_ID,
	LAYOUT_FILE_DIR,
	SETTINGS_FILE_NAME,
	AGENT_SEATS_FILE_NAME,
	TMUX_HEALTH_CHECK_INTERVAL_MS,
	GRACEFUL_SHUTDOWN_TIMEOUT_MS,
	CHAT_MESSAGE_MAX_LENGTH,
	CHAT_RATE_LIMIT_MS,
	CHAT_HISTORY_MAX,
	SOCKET_IO_MAX_BUFFER_SIZE,
	GIT_ROOT_MAX_DEPTH,
} from './constants.js';
import { isDemoEnabled, startDemoMode, stopDemoMode } from './demoMode.js';
import { startAutoBackup, stopAutoBackup, runBackupNow } from './backup.js';
import { sendTmuxKeys } from './tmuxManager.js';
import { cancelPermissionTimer } from './timerManager.js';
import { initAuthRoutes, setOnBuildingChanged } from './auth/routes.js';
import { socketAuthMiddleware, handleAuthUpgrade } from './auth/socketAuth.js';
import { SENSITIVE_MESSAGE_TYPES, shouldSendMessage } from './auth/messageFilter.js';
import { setupAgentNodeNamespace, getConnectedNodes, syncExcludedProjectsToNodes, startRemoteTerminalRelay, sendRemoteTerminalInput, sendRemoteTerminalResize, detachRemoteTerminal, forwardResumeSessionToNode } from './agentNodeHandler.js';
import { cluster } from './cluster.js';
import { loadDashboardStats, getDashboardStats, flushDashboardStats, startStatsFlushTimer, stopStatsFlushTimer } from './dashboardStats.js';
import { startLanDiscovery, stopLanDiscovery, getLanPeers, isLanDiscoveryRunning } from './lanDiscovery.js';
import { LAN_DISCOVERY_HEARTBEAT_MS, NODE_HEALTH_BROADCAST_INTERVAL_MS } from './constants.js';
import { readBehaviorSettings, writeBehaviorSettings } from './behaviorSettingsStore.js';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { createTerminalPty, trackPty, cleanupAllTerminals } from './terminalManager.js';
import { TERMINAL_WS_PATH, TERMINAL_DEFAULT_COLS, TERMINAL_DEFAULT_ROWS } from './constants.js';
import { registerAdapter } from './cliAdapters/index.js';
import { claudeAdapter } from './cliAdapters/claudeAdapter.js';
import { codexAdapter } from './cliAdapters/codexAdapter.js';
import { geminiAdapter } from './cliAdapters/geminiAdapter.js';
import { startStressTest, stopStressTest } from './stressTest.js';
import { createRateLimit } from './rateLimit.js';
import { sanitizeSessionId, sanitizeProjectDir } from './pathSecurity.js';
import { logAudit } from './auditLog.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { initDatabase } from './db/database.js';
import { migrateFromJson } from './db/jsonMigration.js';
import { initRedis, redis } from './db/redis.js';
import {
	RATE_LIMIT_API_WINDOW_MS,
	RATE_LIMIT_API_MAX_REQUESTS,
	RATE_LIMIT_LOGIN_WINDOW_MS,
	RATE_LIMIT_LOGIN_MAX_REQUESTS,
	RATE_LIMIT_REGISTER_WINDOW_MS,
	RATE_LIMIT_REGISTER_MAX_REQUESTS,
	ALLOWED_ORIGINS_ENV_KEY,
} from './constants.js';

// 註冊 CLI 適配器
registerAdapter(claudeAdapter);
registerAdapter(codexAdapter);
registerAdapter(geminiAdapter);

// ── 狀態 ────────────────────────────────────────────────────

const agents = new Map<number, AgentState>();
const nextAgentIdRef = { current: 1 };
const activeAgentIdRef = { current: null as number | null };
const projectScanTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
const tmuxRecoveredRef = { current: false };

// 每個代理的計時器
const fileWatchers = new Map<number, fs.FSWatcher>();
const pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
const waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>();
const permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();

// ── 聊天狀態 ────────────────────────────────────────────────
/** 每個樓層的聊天歷史 */
const chatHistory = new Map<string, Array<{ nickname: string; text: string; ts: number }>>();
/** socketId → 暱稱 */
const socketNicknames = new Map<string, string>();
/** socketId → 上次聊天訊息時間戳（速率限制） */
const socketChatLastTs = new Map<string, number>();
let nextNicknameCounter = 1;

// ── 節點健康廣播狀態 ────────────────────────────────────────
let nodeHealthBroadcastTimer: ReturnType<typeof setInterval> | null = null;

// ── LAN 自動發現狀態 ────────────────────────────────────────
let lanPeerName = os.hostname();
let lanPeerBroadcastTimer: ReturnType<typeof setInterval> | null = null;
/** 上一次廣播的 peers JSON（用於偵測變更） */
let lastLanPeersJson = '';

// 已載入的素材（啟動時快取）
let cachedCharSprites: LoadedCharacterSprites | null = null;
let cachedFloorTiles: LoadedFloorTiles | null = null;
let cachedWallTiles: LoadedWallTiles | null = null;
let cachedFurnitureAssets: LoadedAssets | null = null;
let defaultLayout: Record<string, unknown> | null = null;
let layoutTemplates: import('./assetLoader.js').LayoutTemplate[] = [];

// ── 持久化輔助函式 ──────────────────────────────────────

const userDir = path.join(os.homedir(), LAYOUT_FILE_DIR);

function getSettingsPath(): string {
	return path.join(userDir, SETTINGS_FILE_NAME);
}

function getAgentSeatsPath(): string {
	return path.join(userDir, AGENT_SEATS_FILE_NAME);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
	try {
		if (!fs.existsSync(filePath)) return fallback;
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
	} catch {
		return fallback;
	}
}

function writeJsonFile(filePath: string, data: unknown): void {
	try {
		atomicWriteJson(filePath, data);
	} catch (err) {
		console.error(`[Pixel Agents] Failed to write ${filePath}:`, err);
	}
}

function persistAgents(): void {
	savePersistedAgents(agents);
}

// ── 決定工作目錄 ──────────────────────────────────────────

function findGitRoot(startDir: string): string | null {
	let dir = startDir;
	let depth = 0;
	while (depth < GIT_ROOT_MAX_DEPTH) {
		if (fs.existsSync(path.join(dir, '.git'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
		depth++;
	}
	return null;
}

const cwd = process.argv[2] || findGitRoot(process.cwd()) || process.cwd();
const ownProjectDir = getProjectDirPath(cwd);
logger.info('Working directory', { cwd });
logger.info('Own project dir', { ownProjectDir });

// ── AgentContext — 集中管理的共享狀態 ──────────────────────

// ── SQLite 資料庫初始化 ──────────────────────────────────────
const dbPath = path.join(config.dataDir, 'pixel-agents.db');
const database = initDatabase(dbPath);
logger.info('Database initialized', { dbPath });
// 自動匯入既有 JSON 資料（僅首次）
const migrated = migrateFromJson(database, config.dataDir);
if (migrated) {
	logger.info('JSON data migrated to SQLite');
}

// ── 樓層 / 建築物 ──────────────────────────────────────────
const socketFloors = new Map<string, FloorId>();
const building = loadBuildingConfig();
const floorAgentCounts = new Map<string, number>();
logger.info('Building loaded', { floors: building.floors.length, defaultFloor: building.defaultFloorId });

/** 暫時的 sender 佔位 — 在 socket 連線時更新 */
const ctx: AgentContext = {
	agents,
	nextAgentIdRef,
	activeAgentIdRef,
	fileWatchers,
	pollingTimers,
	waitingTimers,
	permissionTimers,
	jsonlPollTimers,
	sender: undefined,
	persistAgents,
	trackedJsonlFiles: new Map(),
	ownProjectDir,
	socketFloors,
	building,
	floorSender: () => ({ postMessage() {} }), // 佔位，main() 中替換
	broadcastFloorSummaries: () => {}, // 佔位，main() 中替換
	remoteAgentMap: new Map(),
	progressExtensions: new Map(),
	incrementFloorCount: (floorId: FloorId) => {
		floorAgentCounts.set(floorId, (floorAgentCounts.get(floorId) || 0) + 1);
	},
	decrementFloorCount: (floorId: FloorId) => {
		const count = (floorAgentCounts.get(floorId) || 0) - 1;
		if (count <= 0) floorAgentCounts.delete(floorId);
		else floorAgentCounts.set(floorId, count);
	},
};

// ── tmux 健康檢查 ───────────────────────────────────────

let tmuxHealthTimer: ReturnType<typeof setInterval> | null = null;

function startTmuxHealthCheck(): void {
	if (tmuxHealthTimer) return;
	tmuxHealthTimer = setInterval(() => {
		checkTmuxHealth(ctx);
	}, TMUX_HEALTH_CHECK_INTERVAL_MS);
}

// ── 解析素材根目錄 ──────────────────────────────────────

function findAssetsRoot(): string {
	// 檢查 1：web/client/public/（開發模式）
	const clientPublic = path.join(__dirname, '..', '..', 'client', 'public');
	if (fs.existsSync(path.join(clientPublic, 'assets'))) {
		return clientPublic;
	}
	// 檢查 2：web/client/dist/（正式建置）
	const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
	if (fs.existsSync(path.join(clientDist, 'assets'))) {
		return clientDist;
	}
	// 檢查 3：專案根目錄的 webview-ui/public/
	const webviewPublic = path.join(__dirname, '..', '..', '..', 'webview-ui', 'public');
	if (fs.existsSync(path.join(webviewPublic, 'assets'))) {
		return webviewPublic;
	}
	// 備選：當前目錄
	return cwd;
}

// ── 主程式 ─────────────────────────────────────────────────────

async function main(): Promise<void> {
	const port = config.port;

	// 載入素材
	const assetsRoot = findAssetsRoot();
	logger.info('Assets root', { assetsRoot });

	loadDashboardStats();
	startStatsFlushTimer();
	defaultLayout = await loadDefaultLayout(assetsRoot);
	layoutTemplates = await loadLayoutTemplates(assetsRoot);
	cachedCharSprites = await loadCharacterSprites(assetsRoot);
	cachedFloorTiles = await loadFloorTiles(assetsRoot);
	cachedWallTiles = await loadWallTiles(assetsRoot);
	cachedFurnitureAssets = await loadFurnitureAssets(assetsRoot);

	// 設定 Express + Socket.IO
	const app = express();

	// ── 選擇性 HTTPS 支援 ─────────────────────────────────────
	const useHttps = config.https;
	let httpServer: ReturnType<typeof createServer>;
	if (useHttps) {
		// 自簽憑證（僅供本地開發使用）
		const selfSignedCertPath = path.join(userDir, 'self-signed-cert.pem');
		const selfSignedKeyPath = path.join(userDir, 'self-signed-key.pem');
		let cert: string;
		let key: string;
		try {
			if (fs.existsSync(selfSignedCertPath) && fs.existsSync(selfSignedKeyPath)) {
				cert = fs.readFileSync(selfSignedCertPath, 'utf-8');
				key = fs.readFileSync(selfSignedKeyPath, 'utf-8');
			} else {
				// 使用 openssl 生成自簽憑證
				const { execSync } = await import('child_process');
				execSync(
					`openssl req -x509 -newkey rsa:2048 -keyout "${selfSignedKeyPath}" -out "${selfSignedCertPath}" -days 365 -nodes -subj "/CN=localhost"`,
					{ stdio: 'pipe' },
				);
				cert = fs.readFileSync(selfSignedCertPath, 'utf-8');
				key = fs.readFileSync(selfSignedKeyPath, 'utf-8');
				logger.info('Generated self-signed certificate for HTTPS');
			}
			httpServer = https.createServer({ cert, key }, app) as unknown as ReturnType<typeof createServer>;
			logger.info('HTTPS mode enabled (self-signed certificate)');
		} catch (err) {
			logger.warn('Failed to create HTTPS server, falling back to HTTP', { error: String(err) });
			httpServer = createServer(app);
		}
	} else {
		httpServer = createServer(app);
	}

	const io = new Server(httpServer, {
		cors: {
			origin: [
				`http://localhost:${port}`,
				'http://localhost:5173', // Vite 開發伺服器
			],
		},
		maxHttpBufferSize: SOCKET_IO_MAX_BUFFER_SIZE,
		perMessageDeflate: {
			threshold: 256, // 僅壓縮 > 256 bytes 的訊息
		},
	});

	// ── Redis 初始化 + Socket.IO Redis Adapter ─────────────────
	if (config.redisUrl) {
		await initRedis(config.redisUrl);
	}
	if (redis.isConnected()) {
		const pubClient = redis.getClient();
		const subClient = redis.getSubClient();
		if (pubClient && subClient) {
			const { createAdapter } = await import('@socket.io/redis-adapter');
			io.adapter(createAdapter(pubClient, subClient));
			logger.info('Socket.IO Redis adapter enabled');
		}
	}

	// ── Socket.IO CSRF 來源驗證 ────────────────────────────────
	const allowedOrigins = [
		`http://localhost:${port}`,
		`http://127.0.0.1:${port}`,
		`https://localhost:${port}`,
		`https://127.0.0.1:${port}`,
		'http://localhost:5173', // Vite 開發伺服器
		'https://online-pixel-agents.build-site.dev',
	];
	// 從環境變數擴充允許的來源（逗號分隔）
	const envOrigins = process.env[ALLOWED_ORIGINS_ENV_KEY];
	if (envOrigins) {
		for (const origin of envOrigins.split(',')) {
			const trimmed = origin.trim();
			if (trimmed) allowedOrigins.push(trimmed);
		}
	}
	io.engine.use((req: import('http').IncomingMessage, res: import('http').ServerResponse, next: (err?: Error) => void) => {
		const origin = req.headers.origin;
		// 無 origin（同源請求或非瀏覽器客戶端）→ 允許
		if (!origin) {
			next();
			return;
		}
		if (allowedOrigins.includes(origin)) {
			next();
			return;
		}
		console.warn(`[Pixel Agents] Socket.IO CSRF blocked origin: ${origin}`);
		res.writeHead(403);
		res.end();
	});

	// JSON body 解析（API 路由需要）
	app.use(express.json());

	// ── 速率限制 ────────────────────────────────────────────────
	const apiRateLimit = createRateLimit({
		windowMs: RATE_LIMIT_API_WINDOW_MS,
		maxRequests: RATE_LIMIT_API_MAX_REQUESTS,
	});
	const loginRateLimit = createRateLimit({
		windowMs: RATE_LIMIT_LOGIN_WINDOW_MS,
		maxRequests: RATE_LIMIT_LOGIN_MAX_REQUESTS,
	});
	const registerRateLimit = createRateLimit({
		windowMs: RATE_LIMIT_REGISTER_WINDOW_MS,
		maxRequests: RATE_LIMIT_REGISTER_MAX_REQUESTS,
	});

	// 認證路由（套用速率限制）
	const authRouter = await initAuthRoutes();
	app.use('/api/auth/login', loginRateLimit);
	app.use('/api/auth/register', registerRateLimit);
	app.use('/api/auth', apiRateLimit, authRouter);

	// 健康檢查端點
	app.get('/health', (_req, res) => {
		res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
	});

	// ── 健康檢查端點（Docker HEALTHCHECK / 負載均衡器）────────
	app.get('/health', (_req, res) => {
		res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
	});

	// 指標端點（壓力測試與監控用）
	app.get('/api/metrics', (_req, res) => {
		const mem = process.memoryUsage();
		res.json({
			agents: ctx.agents.size,
			remoteAgents: ctx.remoteAgentMap.size,
			trackedFiles: ctx.trackedJsonlFiles.size,
			heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
			rssMB: Math.round(mem.rss / 1024 / 1024),
			uptimeSeconds: Math.round(process.uptime()),
		});
	});

	// 詳細狀態端點（含版本、樓層、記憶體等）
	app.get('/api/status', (_req, res) => {
		const mem = process.memoryUsage();
		res.json({
			status: 'ok',
			version: '1.0.0',
			agents: { total: ctx.agents.size, remote: ctx.remoteAgentMap.size },
			memory: {
				heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
				rssMB: Math.round(mem.rss / 1024 / 1024),
			},
			uptime: Math.round(process.uptime()),
			floors: ctx.building.floors.length,
			trackedFiles: ctx.trackedJsonlFiles.size,
		});
	});

	// 叢集狀態端點（Task 7.2: 伺服器聯邦）
	app.get('/api/cluster/status', (_req, res) => {
		res.json({
			serverId: config.serverId,
			peers: cluster.listPeerServers(),
			totalAgents: ctx.agents.size,
			clusterEnabled: config.clusterEnabled,
		});
	});

	// 提供客戶端靜態檔案（正式環境）
	const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
	if (fs.existsSync(clientDistPath)) {
		app.use(express.static(clientDistPath));
	}

	// Agent Node namespace（遠端代理連線）
	setupAgentNodeNamespace(io, ctx);

	// ── 叢集管理器（Task 7.1: 多伺服器叢集）──────────────────
	await cluster.start(ctx);

	// 定期廣播節點健康狀態至所有瀏覽器客戶端
	nodeHealthBroadcastTimer = setInterval(() => {
		const nodes = getConnectedNodes();
		if (nodes.length > 0) {
			io.emit('message', { type: 'nodeHealth', nodes });
		}
	}, NODE_HEALTH_BROADCAST_INTERVAL_MS);

	// 全域廣播 sender — 用於需要送達所有客戶端的訊息（如 projectNameUpdated）
	// 敏感訊息會依角色過濾，僅發送給 admin/member
	ctx.sender = {
		postMessage(msg: unknown) {
			const msgObj = msg as Record<string, unknown>;
			const msgType = msgObj.type as string;
			// 非敏感訊息 → 直接全域廣播（效能最佳）
			if (!SENSITIVE_MESSAGE_TYPES.has(msgType)) {
				io.emit('message', msg);
				return;
			}
			// 敏感訊息 → 逐 socket 檢查角色
			for (const [, s] of io.sockets.sockets) {
				if (shouldSendMessage(s.data.role || 'anonymous', msgType)) {
					s.emit('message', msg);
				}
			}
		},
	};

	// P2.2: 設定註冊時自動建立專屬樓層後的廣播回呼
	setOnBuildingChanged((updatedBuilding) => {
		// 更新 ctx.building 的樓層列表（保持引用同步）
		ctx.building.floors = updatedBuilding.floors;
		ctx.building.defaultFloorId = updatedBuilding.defaultFloorId;
		ctx.sender?.postMessage({ type: 'buildingConfig', building: ctx.building });
		ctx.broadcastFloorSummaries();
	});

	// 樓層 sender — 僅廣播至特定樓層的客戶端
	// 敏感訊息會依角色過濾，僅發送給 admin/member
	ctx.floorSender = (floorId: FloorId) => ({
		postMessage(msg: unknown) {
			const msgObj = msg as Record<string, unknown>;
			const msgType = msgObj.type as string;
			const room = `floor:${floorId}`;
			// 非敏感訊息 → 直接 Room 廣播（效能最佳）
			if (!SENSITIVE_MESSAGE_TYPES.has(msgType)) {
				io.to(room).emit('message', msg);
				return;
			}
			// 敏感訊息 → 只發給 admin/member（逐 socket 檢查）
			const sockets = io.sockets.adapter.rooms.get(room);
			if (!sockets) return;
			for (const socketId of sockets) {
				const s = io.sockets.sockets.get(socketId);
				if (s && shouldSendMessage(s.data.role || 'anonymous', msgType)) {
					s.emit('message', msg);
				}
			}
		},
	});

	// 從已恢復的代理初始化樓層計數器
	for (const agent of agents.values()) {
		ctx.incrementFloorCount(agent.floorId);
	}

	// 各樓層代理數量摘要廣播
	ctx.broadcastFloorSummaries = () => {
		const summaries = ctx.building.floors.map((f) => ({
			floorId: f.id,
			agentCount: floorAgentCounts.get(f.id) || 0,
		}));
		ctx.sender?.postMessage({ type: 'floorSummaries', summaries });
	};

	// Socket.IO 認證中間件（主 namespace，不影響 /agent-node）
	io.use(socketAuthMiddleware);

	// Socket.IO 連線處理器
	io.on('connection', (socket) => {
		console.log(`[Pixel Agents] Client connected: ${socket.id} (role=${socket.data.role || 'anonymous'})`);

		// 推送認證狀態（讓客戶端知道目前身份）
		socket.emit('message', {
			type: 'auth:status',
			role: socket.data.role || 'anonymous',
			username: socket.data.username || null,
		});

		// 預設加入預設樓層的 room
		const defaultFloor = ctx.building.defaultFloorId;
		socket.join(`floor:${defaultFloor}`);
		socketFloors.set(socket.id, defaultFloor);
		socketNicknames.set(socket.id, `User-${nextNicknameCounter++}`);

		// 單播 sender — 用於對請求者的直接回覆（webviewReady 素材/佈局等）
		const directSender: MessageSender = {
			postMessage(msg: unknown) {
				socket.emit('message', msg);
			},
		};

		socket.on('message', (msg: unknown) => {
			handleClientMessage(msg as ClientMessage, directSender, socket);
		});

		// auth:upgrade — 匿名用戶登入後升級身份（不走 ClientMessage）
		socket.on('auth:upgrade', (data: { token: string }) => {
			const result = handleAuthUpgrade(socket, data.token);
			if (result.success) {
				socket.emit('message', { type: 'auth:upgraded', username: result.username, role: result.role });
				// 升級後重新推送代理詳情（重走 webviewReady 的代理部分）
				const currentFloor = socketFloors.get(socket.id) || defaultFloor;
				const agentMeta = readJsonFile<Record<string, { palette?: number; hueShift?: number; seatId?: string }>>(
					getAgentSeatsPath(), {},
				);
				sendExistingAgents(agents, agentMeta, directSender, ownProjectDir, currentFloor);
			} else {
				socket.emit('message', { type: 'auth:error', error: result.error });
			}
		});

		socket.on('disconnect', () => {
			console.log(`[Pixel Agents] Client disconnected: ${socket.id}`);
			socketFloors.delete(socket.id);
			socketNicknames.delete(socket.id);
			socketChatLastTs.delete(socket.id);
			if (isDemoEnabled()) {
				stopDemoMode();
			}
		});
	});

	// ── 終端 WebSocket 伺服器 ──────────────────────────────────
	const terminalWss = new WebSocketServer({ noServer: true });

	httpServer.on('upgrade', (request, socket, head) => {
		if (request.url?.startsWith(TERMINAL_WS_PATH)) {
			// Origin 驗證：僅允許同源請求
			const origin = request.headers.origin;
			const host = request.headers.host;
			if (origin && host) {
				try {
					const originHost = new URL(origin).host;
					if (originHost !== host) {
						console.warn(`[Pixel Agents] Terminal WS rejected: origin ${origin} != host ${host}`);
						socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
						socket.destroy();
						return;
					}
				} catch {
					socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
					socket.destroy();
					return;
				}
			}
			terminalWss.handleUpgrade(request, socket, head, (ws) => {
				terminalWss.emit('connection', ws, request);
			});
		}
		// 其他路徑（如 /socket.io/）由 Socket.IO 自己處理
	});

	terminalWss.on('connection', (ws: WebSocket) => {
		handleTerminalConnection(ws);
	});

	const protocol = useHttps ? 'https' : 'http';
	httpServer.listen(port, () => {
		logger.info(`Pixel Agents Web running at ${protocol}://localhost:${port}`);
	});

	// LAN 自動發現（opt-in）
	const settings = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
	if (settings.lanDiscoveryEnabled) {
		startLanDiscovery(port, () => lanPeerName, () => agents.size);
		startLanPeerBroadcast(io);
	}
	// 從設定中恢復 peer 名稱
	if (typeof settings.lanPeerName === 'string' && settings.lanPeerName) {
		lanPeerName = settings.lanPeerName;
	}

	// 壓力測試模式（opt-in：--stress N 或 STRESS_TEST=N）
	if (config.stressTest > 0) {
		startStressTest(config.stressTest, ctx);
	}

	// 自動備份（每 6 小時）
	startAutoBackup();

	setupGracefulShutdown(httpServer, io);
}

/** 定期檢查 LAN peers 變更並廣播至所有客戶端 */
function startLanPeerBroadcast(io: Server): void {
	if (lanPeerBroadcastTimer) return;
	lanPeerBroadcastTimer = setInterval(() => {
		if (!isLanDiscoveryRunning()) return;
		const peers = getLanPeers().map((p) => ({
			name: p.name,
			host: p.host,
			port: p.port,
			agentCount: p.agentCount,
		}));
		const json = JSON.stringify(peers);
		if (json !== lastLanPeersJson) {
			lastLanPeersJson = json;
			io.emit('message', { type: 'lanPeers', peers });
		}
	}, LAN_DISCOVERY_HEARTBEAT_MS);
}

function stopLanPeerBroadcast(): void {
	if (lanPeerBroadcastTimer) {
		clearInterval(lanPeerBroadcastTimer);
		lanPeerBroadcastTimer = null;
	}
	lastLanPeersJson = '';
}

function setupGracefulShutdown(
	httpServer: ReturnType<typeof createServer>,
	io: Server,
): void {
	let shuttingDown = false;
	function shutdown(signal: string): void {
		if (shuttingDown) return;
		shuttingDown = true;
		logger.info(`${signal} received, shutting down...`);

		// Phase 1: 停止接受新連線
		httpServer.close(() => {
			logger.debug('HTTP server closed, no longer accepting connections');
		});

		// Phase 2: 清除全域計時器
		if (projectScanTimerRef.current) {
			clearTimeout(projectScanTimerRef.current);
			projectScanTimerRef.current = null;
		}
		if (tmuxHealthTimer) {
			clearInterval(tmuxHealthTimer);
			tmuxHealthTimer = null;
		}
		if (isDemoEnabled()) stopDemoMode();
		stopStressTest();
		stopAutoBackup();
		stopStatsFlushTimer();
		stopLanDiscovery();
		stopLanPeerBroadcast();
		if (nodeHealthBroadcastTimer) {
			clearInterval(nodeHealthBroadcastTimer);
			nodeHealthBroadcastTimer = null;
		}
		cleanupAllTerminals();

		// Phase 2.5: 停止叢集管理器
		cluster.stop().catch((err) => {
			logger.error('Failed to stop cluster manager', { error: err });
		});

		// Phase 3: 清除代理資源（不終止 tmux — 保留供下次恢復）
		for (const [agentId, agent] of agents) {
			const jp = jsonlPollTimers.get(agentId);
			if (jp) clearInterval(jp);
			fileWatchers.get(agentId)?.close();
			const pt = pollingTimers.get(agentId);
			if (pt) clearInterval(pt);
			const wt = waitingTimers.get(agentId);
			if (wt) clearTimeout(wt);
			const pm = permissionTimers.get(agentId);
			if (pm) clearTimeout(pm);
			if (agent.process && !agent.process.killed) {
				agent.process.kill('SIGTERM');
			}
		}
		jsonlPollTimers.clear();
		fileWatchers.clear();
		pollingTimers.clear();
		waitingTimers.clear();
		permissionTimers.clear();

		// Phase 4: 刷新所有待寫入資料
		persistAgents();
		flushDashboardStats();
		logger.info('Pending data flushed');

		// Phase 4.5: 關閉資料庫連線
		try {
			database.close();
			logger.info('Database closed');
		} catch (err) {
			logger.error('Failed to close database', { error: err });
		}

		// Phase 4.6: 斷開 Redis 連線
		if (redis.isConnected()) {
			redis.disconnect().catch((err) => {
				logger.error('Failed to disconnect Redis', { error: err });
			});
		}

		// Phase 5: 等待 Socket.IO 連線排空後退出
		io.close(() => {
			logger.info('Shutdown complete');
			process.exit(0);
		});

		// 強制退出保護
		setTimeout(() => {
			logger.warn('Forced shutdown after timeout');
			process.exit(1);
		}, GRACEFUL_SHUTDOWN_TIMEOUT_MS).unref();
	}
	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/** 處理終端 WebSocket 連線 — 每個連線對應一個 pty 實例（本地）或終端中繼（遠端） */
function handleTerminalConnection(ws: WebSocket): void {
	let pty: import('node-pty').IPty | null = null;
	let attachedAgentId: number | null = null;
	/** 遠端代理的 sessionId（中繼模式下使用） */
	let remoteSessionId: string | null = null;

	ws.on('message', (raw) => {
		// 所有客戶端→伺服器訊息皆為 JSON 文字
		let msg: { type: string; agentId?: number; data?: string; cols?: number; rows?: number };
		try {
			msg = JSON.parse(raw.toString());
		} catch {
			return;
		}

		switch (msg.type) {
			case 'attach': {
				// 清除先前的連線
				if (pty) {
					pty.kill();
					pty = null;
				}
				if (remoteSessionId) {
					detachRemoteTerminal(remoteSessionId);
					remoteSessionId = null;
				}

				const agentId = msg.agentId;
				if (agentId === undefined) {
					ws.send(JSON.stringify({ type: 'error', message: 'Missing agentId' }));
					return;
				}
				const agent = agents.get(agentId);
				if (!agent) {
					ws.send(JSON.stringify({ type: 'error', message: 'Agent not found' }));
					return;
				}

				// 遠端代理 — 透過 Agent Node 中繼
				if (agent.isRemote) {
					if (!agent.remoteSessionId) {
						ws.send(JSON.stringify({ type: 'error', message: 'Remote agent has no session ID' }));
						return;
					}
					const cols = msg.cols || TERMINAL_DEFAULT_COLS;
					const rows = msg.rows || TERMINAL_DEFAULT_ROWS;
					const ok = startRemoteTerminalRelay(agent.remoteSessionId, ws, cols, rows);
					if (!ok) {
						ws.send(JSON.stringify({ type: 'error', message: 'Agent Node not connected' }));
						return;
					}
					remoteSessionId = agent.remoteSessionId;
					attachedAgentId = agentId;
					console.log(`[Pixel Agents] Terminal relay started for remote agent ${agentId} (session: ${remoteSessionId})`);
					break;
				}

				// 本地代理 — 直接建立 pty
				if (!agent.tmuxSessionName) {
					ws.send(JSON.stringify({ type: 'error', message: 'Agent has no tmux session' }));
					return;
				}
				const newPty = createTerminalPty(agent.tmuxSessionName, msg.cols, msg.rows);
				if (!newPty) {
					ws.send(JSON.stringify({ type: 'error', message: 'Failed to create terminal' }));
					return;
				}
				pty = newPty;
				attachedAgentId = agentId;
				trackPty(newPty);

				newPty.onData((data: string) => {
					if (ws.readyState === 1 /* WebSocket.OPEN */) {
						ws.send(Buffer.from(data, 'utf-8'));
					}
				});
				newPty.onExit(({ exitCode }) => {
					if (ws.readyState === 1) {
						ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
					}
					pty = null;
					attachedAgentId = null;
				});

				ws.send(JSON.stringify({ type: 'attached', agentId }));
				console.log(`[Pixel Agents] Terminal attached to agent ${agentId} (tmux: ${agent.tmuxSessionName})`);
				break;
			}
			case 'input': {
				if (typeof msg.data !== 'string') break;
				if (remoteSessionId) {
					sendRemoteTerminalInput(remoteSessionId, msg.data);
				} else if (pty) {
					pty.write(msg.data);
				}
				break;
			}
			case 'resize': {
				if (typeof msg.cols !== 'number' || typeof msg.rows !== 'number') break;
				if (remoteSessionId) {
					sendRemoteTerminalResize(remoteSessionId, msg.cols, msg.rows);
				} else if (pty) {
					pty.resize(Math.max(1, msg.cols), Math.max(1, msg.rows));
				}
				break;
			}
			case 'detach': {
				if (remoteSessionId) {
					detachRemoteTerminal(remoteSessionId);
					remoteSessionId = null;
				}
				if (pty) {
					pty.kill();
					pty = null;
				}
				attachedAgentId = null;
				ws.send(JSON.stringify({ type: 'detached' }));
				break;
			}
		}
	});

	ws.on('close', () => {
		if (remoteSessionId) {
			detachRemoteTerminal(remoteSessionId);
			remoteSessionId = null;
		}
		if (pty) {
			pty.kill();
			pty = null;
		}
		if (attachedAgentId !== null) {
			console.log(`[Pixel Agents] Terminal disconnected from agent ${attachedAgentId}`);
		}
		attachedAgentId = null;
	});
}

// ── P2.3: 樓層編輯權限檢查 ──────────────────────────────────────

/** 檢查使用者是否有權限編輯指定樓層的佈局 */
function checkFloorEditPermission(socket: import('socket.io').Socket | undefined, floorId: FloorId): boolean {
	if (!socket) return false;
	const role = socket.data.role as string;
	if (role === 'admin') return true;
	if (role === 'anonymous') return false;
	// member 只能編輯自己的樓層
	const floor = ctx.building.floors.find(f => f.id === floorId);
	if (!floor) return false;
	return floor.ownerId === socket.data.userId;
}

/** 檢查使用者是否為 admin 角色 */
function isAdmin(socket: import('socket.io').Socket | undefined): boolean {
	return socket?.data.role === 'admin';
}

/** 檢查使用者是否已登入（admin 或 member） */
function isAuthenticated(socket: import('socket.io').Socket | undefined): boolean {
	const role = socket?.data.role;
	return role === 'admin' || role === 'member';
}

/** 發送權限被拒絕訊息至客戶端 */
function sendPermissionDenied(sender: MessageSender, action: string, reason: string): void {
	sender.postMessage({ type: 'permissionDenied', action, reason });
}

function handleClientMessage(msg: ClientMessage, sender: MessageSender, socket?: import('socket.io').Socket): void {
	console.log(`[Pixel Agents] Received message: ${msg.type}`);
	switch (msg.type) {
		case 'webviewReady': {
			// 依序傳送素材（共用，unicast）
			if (cachedCharSprites) {
				sender.postMessage({
					type: 'characterSpritesLoaded',
					characters: cachedCharSprites.characters,
				});
			}
			if (cachedFloorTiles) {
				sender.postMessage({
					type: 'floorTilesLoaded',
					sprites: cachedFloorTiles.sprites,
				});
			}
			if (cachedWallTiles) {
				sender.postMessage({
					type: 'wallTilesLoaded',
					sprites: cachedWallTiles.sprites,
				});
			}
			if (cachedFurnitureAssets) {
				const spritesObj: Record<string, string[][]> = {};
				for (const [id, spriteData] of cachedFurnitureAssets.sprites) {
					spritesObj[id] = spriteData;
				}
				sender.postMessage({
					type: 'furnitureAssetsLoaded',
					catalog: cachedFurnitureAssets.catalog,
					sprites: spritesObj,
				});
			}

			// 傳送建築物配置
			sender.postMessage({ type: 'buildingConfig', building: ctx.building });

			// 傳送當前樓層佈局
			const currentFloor = (socket && socketFloors.get(socket.id)) || ctx.building.defaultFloorId;
			const layout = loadFloorLayout(currentFloor, defaultLayout);
			sender.postMessage({ type: 'layoutLoaded', layout });

			// 傳送設定
			const wvSettings = readJsonFile<{ soundEnabled?: boolean; zoom?: number; soundConfig?: { master?: boolean; waiting?: boolean; permission?: boolean; turnComplete?: boolean }; uiScale?: number; lanDiscoveryEnabled?: boolean; lanPeerName?: string }>(getSettingsPath(), {});
			sender.postMessage({ type: 'settingsLoaded', soundEnabled: wvSettings.soundEnabled ?? true, zoom: wvSettings.zoom, soundConfig: wvSettings.soundConfig, uiScale: wvSettings.uiScale, lanDiscoveryEnabled: wvSettings.lanDiscoveryEnabled ?? false, lanPeerName: wvSettings.lanPeerName ?? lanPeerName });

			// 傳送目前的 LAN peers（若已啟用）
			if (isLanDiscoveryRunning()) {
				const peers = getLanPeers().map((p) => ({ name: p.name, host: p.host, port: p.port, agentCount: p.agentCount }));
				sender.postMessage({ type: 'lanPeers', peers });
			}

			// 傳送行為參數設定
			sender.postMessage({ type: 'behaviorSettingsLoaded', settings: readBehaviorSettings() });

			// 傳送當前樓層的現有代理
			const agentMeta = readJsonFile<Record<string, { palette?: number; hueShift?: number; seatId?: string }>>(
				getAgentSeatsPath(), {},
			);
			sendExistingAgents(agents, agentMeta, sender, ownProjectDir, currentFloor);

			// 傳送排除專案清單
			sender.postMessage({ type: 'excludedProjectsUpdated', excluded: readExcludedProjects() });

			// 傳送各樓層代理數量摘要
			ctx.broadcastFloorSummaries();

			// 傳送當前樓層的聊天歷史
			const floorChatHistory = chatHistory.get(currentFloor) || [];
			sender.postMessage({ type: 'chatHistory', messages: floorChatHistory });

			// 演示模式或真實的自動偵測
			if (isDemoEnabled()) {
				const demoCount = parseInt(process.env['DEMO_AGENTS'] || '3', 10);
				startDemoMode(sender, demoCount);
			} else {
				// 在專案掃描之前，從上一次伺服器執行中恢復 tmux 代理（僅一次）
				if (!tmuxRecoveredRef.current) {
					tmuxRecoveredRef.current = true;
					recoverTmuxAgents(ctx);
				}
				// 恢復後重新傳送現有代理（包含已恢復的 tmux 代理，過濾至當前樓層）
				sendExistingAgents(agents, agentMeta, sender, ownProjectDir, currentFloor);

				// 啟動專案掃描 — 自動偵測所有專案中正在執行的 Claude 會話
				const projectDirs = getAllProjectDirs();
				ensureProjectScan(projectDirs, projectScanTimerRef, ctx);

				// 啟動 tmux 健康檢查
				startTmuxHealthCheck();
			}
			break;
		}
		case 'closeAgent': {
			// P2.3: 僅 admin 可關閉代理
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'closeAgent', 'insufficient_role');
				break;
			}
			// 遠端代理不可被瀏覽器關閉
			const targetAgent = agents.get(msg.id);
			if (targetAgent?.isRemote) {
				console.log(`[Pixel Agents] Ignoring closeAgent for remote agent ${msg.id}`);
				break;
			}
			logAudit('agent_close', socket?.data.userId, `agentId=${msg.id}`);
			closeAgent(msg.id, ctx);
			break;
		}
		case 'focusAgent': {
			// Web 版本：僅視覺選取，沒有終端可聚焦
			break;
		}
		case 'saveAgentSeats': {
			writeJsonFile(getAgentSeatsPath(), msg.seats);
			break;
		}
		case 'saveLayout': {
			// P2.3: admin 或 member（自己的樓層）才能儲存佈局
			const floorId = (socket && socketFloors.get(socket.id)) || DEFAULT_FLOOR_ID;
			if (!checkFloorEditPermission(socket, floorId)) {
				sendPermissionDenied(sender, 'saveLayout', 'insufficient_role');
				break;
			}
			writeFloorLayout(floorId, msg.layout);
			logAudit('layout_save', socket?.data.userId, `floorId=${floorId}`);
			break;
		}
		case 'setSoundEnabled': {
			const current = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
			current.soundEnabled = msg.enabled;
			writeJsonFile(getSettingsPath(), current);
			break;
		}
		case 'setSoundConfig': {
			const current = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
			current.soundConfig = msg.config;
			writeJsonFile(getSettingsPath(), current);
			break;
		}
		case 'setUiScale': {
			const current = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
			current.uiScale = msg.scale;
			writeJsonFile(getSettingsPath(), current);
			break;
		}
		case 'setZoom': {
			const current = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
			current.zoom = msg.zoom;
			writeJsonFile(getSettingsPath(), current);
			break;
		}
		case 'listSessions': {
			// P2.3: 僅 admin 可瀏覽工作列表
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'listSessions', 'insufficient_role');
				break;
			}
			const sessions = scanAllSessions(agents);
			sender.postMessage({ type: 'sessionsList', sessions });
			break;
		}
		case 'resumeSession': {
			// P2.3: 僅 admin 可恢復工作
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'resumeSession', 'insufficient_role');
				break;
			}
			// 路徑安全驗證
			const sessionCheck = sanitizeSessionId(msg.sessionId);
			if (!sessionCheck.valid) {
				console.warn(`[Pixel Agents] resumeSession rejected: ${sessionCheck.error}`);
				break;
			}
			const projCheck = sanitizeProjectDir(msg.projectDir);
			if (!projCheck.valid) {
				console.warn(`[Pixel Agents] resumeSession projectDir rejected: ${projCheck.error}`);
				break;
			}
			// Task 7.3: 檢查是否為遠端代理的會話 — 若是則轉發至 Agent Node
			let forwardedToNode = false;
			for (const [remoteSessionId, agentId] of ctx.remoteAgentMap) {
				const agent = ctx.agents.get(agentId);
				if (agent && agent.remoteSessionId === sessionCheck.normalized) {
					forwardedToNode = forwardResumeSessionToNode(
						remoteSessionId,
						sessionCheck.normalized!,
						projCheck.normalized!,
					);
					if (forwardedToNode) {
						console.log(`[Pixel Agents] resumeSession forwarded to Agent Node: ${sessionCheck.normalized}`);
					}
					break;
				}
			}
			if (!forwardedToNode) {
				resumeSession(sessionCheck.normalized!, projCheck.normalized!, cwd, ctx);
			}
			break;
		}
		case 'requestExportLayout': {
			// P2.5: 任何已登入用戶可匯出（member 可匯出自己的樓層，admin 可匯出任何樓層）
			const exportFloor = (socket && socketFloors.get(socket.id)) || DEFAULT_FLOOR_ID;
			if (!isAuthenticated(socket)) {
				sendPermissionDenied(sender, 'requestExportLayout', 'insufficient_role');
				break;
			}
			// member 只能匯出自己的樓層或公共樓層
			if (!checkFloorEditPermission(socket, exportFloor) && !isAdmin(socket)) {
				// member 仍可匯出公共樓層（ownerId 為 null），但不能匯出別人的私有樓層
				const floorCfg = ctx.building.floors.find(f => f.id === exportFloor);
				if (floorCfg?.ownerId && floorCfg.ownerId !== socket?.data.userId) {
					sendPermissionDenied(sender, 'requestExportLayout', 'insufficient_role');
					break;
				}
			}
			const exportLayout = loadFloorLayout(exportFloor, defaultLayout);
			sender.postMessage({ type: 'exportLayoutData', layout: exportLayout });
			break;
		}
		case 'setProjectName': {
			const agent = agents.get(msg.agentId);
			if (!agent) break;
			const projectDir = agent.projectDir;
			setCustomName(projectDir, msg.name);
			// 找出所有同 projectDir 的代理，一起更新名稱
			const updates: Record<number, string> = {};
			for (const [id, a] of agents) {
				if (a.projectDir === projectDir) {
					updates[id] = msg.name;
				}
			}
			// 廣播給所有客戶端
			ctx.sender?.postMessage({ type: 'projectNameUpdated', updates });
			break;
		}
		case 'excludeProject': {
			// P2.3: 僅 admin 可排除專案
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'excludeProject', 'insufficient_role');
				break;
			}
			addExcludedProject(msg.projectDir);
			// 以 basename 比對，收集該專案下所有自動收養的代理 ID（process=null 且非 tmux）
			const excludeKey = path.basename(msg.projectDir);
			const toRemove: number[] = [];
			for (const [agentId, agent] of agents) {
				if (path.basename(agent.projectDir) === excludeKey && agent.process === null && !agent.tmuxSessionName) {
					toRemove.push(agentId);
				}
			}
			for (const agentId of toRemove) {
				const removedAgent = agents.get(agentId);
				const removedFloor = removedAgent?.floorId || DEFAULT_FLOOR_ID;
				removeAgent(agentId, ctx);
				ctx.floorSender(removedFloor).postMessage({ type: 'agentClosed', id: agentId });
			}
			const excludedAfterAdd = readExcludedProjects();
			ctx.sender?.postMessage({ type: 'excludedProjectsUpdated', excluded: excludedAfterAdd });
			syncExcludedProjectsToNodes(excludedAfterAdd);
			break;
		}
		case 'includeProject': {
			// P2.3: 僅 admin 可取消排除專案
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'includeProject', 'insufficient_role');
				break;
			}
			removeExcludedProject(msg.projectDir);
			// 立即重新掃描一次
			const projectDirs = getAllProjectDirs();
			ensureProjectScan(projectDirs, projectScanTimerRef, ctx);
			const excludedAfterRemove = readExcludedProjects();
			ctx.sender?.postMessage({ type: 'excludedProjectsUpdated', excluded: excludedAfterRemove });
			syncExcludedProjectsToNodes(excludedAfterRemove);
			break;
		}
		case 'listProjectDirs': {
			const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
			const excluded = readExcludedProjects();
			const dirs: { name: string; excluded: boolean }[] = [];
			try {
				const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
				for (const entry of entries) {
					if (!entry.isDirectory()) continue;
					dirs.push({ name: entry.name, excluded: excluded.includes(entry.name) });
				}
			} catch { /* 目錄不存在則回傳空陣列 */ }
			dirs.sort((a, b) => a.name.localeCompare(b.name));
			sender.postMessage({ type: 'projectDirsList', dirs });
			break;
		}
		case 'switchFloor': {
			if (!socket) break;
			const oldFloor = socketFloors.get(socket.id);
			if (oldFloor) socket.leave(`floor:${oldFloor}`);
			socket.join(`floor:${msg.floorId}`);
			socketFloors.set(socket.id, msg.floorId);
			sender.postMessage({ type: 'floorSwitched', floorId: msg.floorId });
			// 發送新樓層的佈局和代理
			const switchLayout = loadFloorLayout(msg.floorId, defaultLayout);
			sender.postMessage({ type: 'layoutLoaded', layout: switchLayout });
			const switchMeta = readJsonFile<Record<string, { palette?: number; hueShift?: number; seatId?: string }>>(
				getAgentSeatsPath(), {},
			);
			sendExistingAgents(agents, switchMeta, sender, ownProjectDir, msg.floorId);
			// 傳送新樓層的聊天歷史
			const switchChatHistory = chatHistory.get(msg.floorId) || [];
			sender.postMessage({ type: 'chatHistory', messages: switchChatHistory });
			break;
		}
		case 'saveFloorLayout': {
			// P2.3: 檢查樓層編輯權限
			if (!checkFloorEditPermission(socket, msg.floorId)) {
				sendPermissionDenied(sender, 'saveFloorLayout', 'insufficient_role');
				break;
			}
			writeFloorLayout(msg.floorId, msg.layout);
			break;
		}
		case 'requestLayoutTemplates': {
			const templateList = layoutTemplates.map((tmpl: LayoutTemplate) => ({
				id: tmpl.id,
				name: tmpl.name,
				cols: tmpl.layout.cols,
				rows: tmpl.layout.rows,
			}));
			sender.postMessage({ type: 'layoutTemplatesList', templates: templateList });
			break;
		}
		case 'loadLayoutTemplate': {
			const tmpl = layoutTemplates.find((t: LayoutTemplate) => t.id === msg.templateId);
			if (!tmpl) break;
			const targetFloor = msg.floorId || (socket && socketFloors.get(socket.id)) || DEFAULT_FLOOR_ID;
			// P2.3: 檢查樓層編輯權限
			if (!checkFloorEditPermission(socket, targetFloor)) {
				sendPermissionDenied(sender, 'loadLayoutTemplate', 'insufficient_role');
				break;
			}
			writeFloorLayout(targetFloor, tmpl.layout);
			// 廣播至同樓層的客戶端
			ctx.floorSender(targetFloor).postMessage({ type: 'layoutLoaded', layout: tmpl.layout });
			console.log(`[Pixel Agents] Loaded template "${tmpl.id}" for floor ${targetFloor}`);
			break;
		}
		case 'addFloor': {
			// P2.3: 僅 admin 可手動新增公共樓層
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'addFloor', 'insufficient_role');
				break;
			}
			const newFloor = addBuildingFloor(ctx.building, msg.name);
			console.log(`[Pixel Agents] Added floor: ${newFloor.id} "${newFloor.name}"`);
			ctx.sender?.postMessage({ type: 'buildingConfig', building: ctx.building });
			ctx.broadcastFloorSummaries();
			break;
		}
		case 'removeFloor': {
			// P2.3: 僅 admin 可移除樓層
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'removeFloor', 'insufficient_role');
				break;
			}
			const removed = removeBuildingFloor(ctx.building, msg.floorId);
			if (removed) {
				// 清理該樓層的聊天歷史
				chatHistory.delete(msg.floorId);

				// 將該樓層的代理遷移至預設樓層（更新計數器）
				const defaultFloorId = ctx.building.defaultFloorId;
				for (const [id, agent] of agents) {
					if (agent.floorId === msg.floorId) {
						ctx.decrementFloorCount(msg.floorId);
						agent.floorId = defaultFloorId;
						ctx.incrementFloorCount(defaultFloorId);
						ctx.floorSender(defaultFloorId).postMessage({
							type: 'agentCreated', id,
							projectName: extractProjectName(agent.projectDir),
							floorId: defaultFloorId,
							...(agent.projectDir !== ctx.ownProjectDir ? { isExternal: true } : {}),
							...(agent.cliType !== 'claude' ? { cliType: agent.cliType } : {}),
						});
					}
				}

				console.log(`[Pixel Agents] Removed floor: ${msg.floorId}`);
				ctx.sender?.postMessage({ type: 'buildingConfig', building: ctx.building });
				ctx.broadcastFloorSummaries();
			}
			break;
		}
		case 'renameFloor': {
			// P2.4: 權限檢查（admin 可改任何樓層，member 只能改自己的樓層）
			if (!checkFloorEditPermission(socket, msg.floorId)) {
				sendPermissionDenied(sender, 'renameFloor', 'insufficient_role');
				break;
			}
			// P2.4: 名稱唯一性驗證
			const renameResult = renameBuildingFloor(ctx.building, msg.floorId, msg.name);
			if (!renameResult.success) {
				sendPermissionDenied(sender, 'renameFloor', renameResult.error || 'rename_failed');
				break;
			}
			console.log(`[Pixel Agents] Renamed floor ${msg.floorId} to "${msg.name}"`);
			ctx.sender?.postMessage({ type: 'buildingConfig', building: ctx.building });
			break;
		}
		case 'chatMessage': {
			if (!socket) break;
			const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH) : '';
			if (!text) break;
			// 速率限制
			const now = Date.now();
			const lastTs = socketChatLastTs.get(socket.id) || 0;
			if (now - lastTs < CHAT_RATE_LIMIT_MS) break;
			socketChatLastTs.set(socket.id, now);
			const nickname = socketNicknames.get(socket.id) || 'User';
			const floorId = socketFloors.get(socket.id) || ctx.building.defaultFloorId;
			const chatMsg = { nickname, text, ts: now };
			// 儲存至歷史
			let history = chatHistory.get(floorId);
			if (!history) {
				history = [];
				chatHistory.set(floorId, history);
			}
			history.push(chatMsg);
			if (history.length > CHAT_HISTORY_MAX) {
				history.splice(0, history.length - CHAT_HISTORY_MAX);
			}
			// 廣播至同樓層
			ctx.floorSender(floorId).postMessage({ type: 'chatMessage', ...chatMsg });
			break;
		}
		case 'setNickname': {
			if (!socket) break;
			const nickname = typeof msg.nickname === 'string' ? msg.nickname.trim().slice(0, 20) : '';
			if (nickname) {
				socketNicknames.set(socket.id, nickname);
			}
			break;
		}
		case 'moveAgentToFloor': {
			const agent = agents.get(msg.agentId);
			if (!agent) break;
			const targetFloor = ctx.building.floors.find((f) => f.id === msg.targetFloorId);
			if (!targetFloor) break;
			if (agent.floorId === msg.targetFloorId) break;
			const oldFloorId = agent.floorId;
			// 通知舊樓層角色將離開
			ctx.floorSender(oldFloorId).postMessage({ type: 'agentFloorTransfer', id: msg.agentId, targetFloorId: msg.targetFloorId });
			// 更新代理樓層與計數器
			ctx.decrementFloorCount(oldFloorId);
			agent.floorId = msg.targetFloorId;
			ctx.incrementFloorCount(msg.targetFloorId);
			persistAgents();
			// 通知新樓層角色到達（帶 fromElevator 標記）
			ctx.floorSender(msg.targetFloorId).postMessage({
				type: 'agentCreated',
				id: msg.agentId,
				projectName: agent.projectDir ? path.basename(agent.projectDir) : undefined,
				floorId: msg.targetFloorId,
				isRemote: agent.isRemote || undefined,
				owner: agent.owner || undefined,
				fromElevator: true,
			});
			ctx.broadcastFloorSummaries();
			console.log(`[Pixel Agents] Agent ${msg.agentId} transferred from ${oldFloorId} to ${msg.targetFloorId}`);
			break;
		}
		case 'requestStatusHistory': {
			const agent = agents.get(msg.agentId);
			if (agent) {
				sender.postMessage({
					type: 'statusHistory',
					id: msg.agentId,
					history: agent.statusHistory,
				});
			}
			break;
		}
		case 'setAgentTeam': {
			const agent = agents.get(msg.agentId);
			if (agent) {
				agent.teamName = msg.teamName;
				// 持久化團隊名稱（以專案目錄為鍵）
				if (agent.projectDir) {
					setTeamName(agent.projectDir, msg.teamName);
				}
				// 廣播至同樓層的所有客戶端
				ctx.floorSender(agent.floorId).postMessage({
					type: 'agentTeam',
					id: msg.agentId,
					teamName: msg.teamName,
				});
			}
			break;
		}
		case 'setLanDiscoveryEnabled': {
			const current = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
			current.lanDiscoveryEnabled = msg.enabled;
			writeJsonFile(getSettingsPath(), current);
			const httpPort = parseInt(process.env['PORT'] || String(DEFAULT_PORT), 10);
			if (msg.enabled && !isLanDiscoveryRunning()) {
				startLanDiscovery(httpPort, () => lanPeerName, () => agents.size);
				// 需要從 handleClientMessage 的作用域取得 io — 透過 ctx.sender 廣播
				// 啟動 peer 廣播計時器：由於 io 不在 handleClientMessage 作用域中，
				// 我們在 main() 中統一管理。這裡僅發送啟動訊號。
				// 為了讓 peer 廣播在啟用後運作，在 webviewReady 已有初始化邏輯，
				// 這裡需要另一種方式啟動計時器。
				// 解決方案：將 io 放入 ctx 或使用全域函式。
				// 這裡使用簡單的全域函式重新啟動廣播。
				if (!lanPeerBroadcastTimer && ctx.sender) {
					// 使用 ctx.sender 作為簡化廣播
					lanPeerBroadcastTimer = setInterval(() => {
						if (!isLanDiscoveryRunning()) return;
						const peers = getLanPeers().map((p) => ({
							name: p.name, host: p.host, port: p.port, agentCount: p.agentCount,
						}));
						const json = JSON.stringify(peers);
						if (json !== lastLanPeersJson) {
							lastLanPeersJson = json;
							ctx.sender?.postMessage({ type: 'lanPeers', peers });
						}
					}, LAN_DISCOVERY_HEARTBEAT_MS);
				}
				console.log('[Pixel Agents] LAN discovery enabled');
			} else if (!msg.enabled && isLanDiscoveryRunning()) {
				stopLanDiscovery();
				stopLanPeerBroadcast();
				// 廣播空的 peers 清單
				ctx.sender?.postMessage({ type: 'lanPeers', peers: [] });
				console.log('[Pixel Agents] LAN discovery disabled');
			}
			break;
		}
		case 'setLanPeerName': {
			const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, 50) : '';
			if (name) {
				lanPeerName = name;
				const current = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
				current.lanPeerName = name;
				writeJsonFile(getSettingsPath(), current);
			}
			break;
		}
		case 'approvePermission': {
			// P2.3: 僅 admin 可核准權限請求
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'approvePermission', 'insufficient_role');
				break;
			}
			const agent = agents.get(msg.agentId);
			if (!agent || !agent.permissionSent) break;
			if (agent.tmuxSessionName) {
				sendTmuxKeys(agent.tmuxSessionName, 'y');
				sendTmuxKeys(agent.tmuxSessionName, 'Enter');
			}
			cancelPermissionTimer(msg.agentId, permissionTimers);
			agent.permissionSent = false;
			ctx.floorSender(agent.floorId)?.postMessage({
				type: 'agentToolPermissionClear', id: msg.agentId,
			});
			break;
		}
		case 'approveAllPermissions': {
			// P2.3: 僅 admin 可批量核准權限請求
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'approveAllPermissions', 'insufficient_role');
				break;
			}
			for (const [agentId, agent] of agents) {
				if (!agent.permissionSent) continue;
				if (agent.tmuxSessionName) {
					sendTmuxKeys(agent.tmuxSessionName, 'y');
					sendTmuxKeys(agent.tmuxSessionName, 'Enter');
				}
				cancelPermissionTimer(agentId, permissionTimers);
				agent.permissionSent = false;
				ctx.floorSender(agent.floorId)?.postMessage({
					type: 'agentToolPermissionClear', id: agentId,
				});
			}
			break;
		}
		case 'saveBehaviorSettings': {
			// P2.3: 僅 admin 可修改行為設定
			if (!isAdmin(socket)) {
				sendPermissionDenied(sender, 'saveBehaviorSettings', 'insufficient_role');
				break;
			}
			const merged = writeBehaviorSettings(msg.settings);
			// 廣播給所有客戶端
			ctx.sender?.postMessage({ type: 'behaviorSettingsLoaded', settings: merged });
			break;
		}
		case 'requestBehaviorSettings': {
			sender.postMessage({ type: 'behaviorSettingsLoaded', settings: readBehaviorSettings() });
			break;
		}
		case 'requestNodeHealth': {
			const nodes = getConnectedNodes();
			sender.postMessage({ type: 'nodeHealth', nodes });
			break;
		}
		case 'requestDashboardData': {
			const dashStats = getDashboardStats();
			const floorCounts = new Map<string, { total: number; active: number }>();
			for (const f of ctx.building.floors) {
				floorCounts.set(f.id, { total: 0, active: 0 });
			}
			const agentList: Array<{ id: number; projectName: string; floorId: string; floorName: string; isActive: boolean; model: string; isRemote: boolean; owner: string; activeToolName: string; toolCount: number }> = [];
			let activeCount = 0;
			for (const [agentId, agent] of agents) {
				const isActive = agent.activeToolIds.size > 0;
				if (isActive) activeCount++;
				const fc = floorCounts.get(agent.floorId);
				if (fc) {
					fc.total++;
					if (isActive) fc.active++;
				}
				const floorCfg = ctx.building.floors.find((f) => f.id === agent.floorId);
				const toolNames = Array.from(agent.activeToolNames.values());
				agentList.push({
					id: agentId,
					projectName: agent.projectDir ? path.basename(agent.projectDir) : '',
					floorId: agent.floorId,
					floorName: floorCfg?.name || agent.floorId,
					isActive,
					model: agent.model || '',
					isRemote: agent.isRemote,
					owner: agent.owner || '',
					activeToolName: toolNames.length > 0 ? toolNames[0] : '',
					toolCount: agent.activeToolIds.size,
				});
			}
			const floors = ctx.building.floors.map((f) => {
				const c = floorCounts.get(f.id) || { total: 0, active: 0 };
				return { id: f.id, name: f.name, order: f.order, agentCount: c.total, activeCount: c.active };
			});
			sender.postMessage({
				type: 'dashboardData',
				data: {
					floors,
					agents: agentList,
					stats: {
						totalAgents: agents.size,
						activeAgents: activeCount,
						totalToolCalls: dashStats.totalToolCalls,
						toolDistribution: dashStats.toolDistribution,
					},
				},
			});
			break;
		}
	}
}

// --backup-now：執行一次備份後退出（不啟動伺服器）
if (process.argv.includes('--backup-now')) {
	runBackupNow().then((dir) => {
		if (dir) {
			console.log(`[Pixel Agents] Backup completed: ${dir}`);
			process.exit(0);
		} else {
			console.error('[Pixel Agents] Backup failed or skipped');
			process.exit(1);
		}
	}).catch((err) => {
		console.error('[Pixel Agents] Backup error:', err);
		process.exit(1);
	});
} else {
	main().catch((err) => {
		console.error('[Pixel Agents] Failed to start:', err);
		process.exit(1);
	});
}
