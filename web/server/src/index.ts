import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import type { AgentState, MessageSender } from './types.js';
import {
	loadFurnitureAssets,
	loadFloorTiles,
	loadWallTiles,
	loadCharacterSprites,
	loadDefaultLayout,
} from './assetLoader.js';
import type { LoadedAssets, LoadedFloorTiles, LoadedWallTiles, LoadedCharacterSprites } from './assetLoader.js';
import { writeLayoutToFile, loadLayout } from './layoutPersistence.js';
import { launchNewAgent, closeAgent, sendExistingAgents, getAllProjectDirs, resumeSession, recoverTmuxAgents, checkTmuxHealth, savePersistedAgents } from './agentManager.js';
import { scanAllSessions } from './sessionScanner.js';
import { ensureProjectScan } from './fileWatcher.js';
import {
	DEFAULT_PORT,
	LAYOUT_FILE_DIR,
	SETTINGS_FILE_NAME,
	AGENT_SEATS_FILE_NAME,
	TMUX_HEALTH_CHECK_INTERVAL_MS,
} from './constants.js';
import { isDemoEnabled, startDemoMode, stopDemoMode } from './demoMode.js';

// ── 狀態 ────────────────────────────────────────────────────

const agents = new Map<number, AgentState>();
const nextAgentIdRef = { current: 1 };
const activeAgentIdRef = { current: null as number | null };
const knownJsonlFiles = new Set<string>();
const projectScanTimerRef = { current: null as ReturnType<typeof setInterval> | null };
const tmuxRecoveredRef = { current: false };

// 每個代理的計時器
const fileWatchers = new Map<number, fs.FSWatcher>();
const pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
const waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>();
const permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();

// 已載入的素材（啟動時快取）
let cachedCharSprites: LoadedCharacterSprites | null = null;
let cachedFloorTiles: LoadedFloorTiles | null = null;
let cachedWallTiles: LoadedWallTiles | null = null;
let cachedFurnitureAssets: LoadedAssets | null = null;
let defaultLayout: Record<string, unknown> | null = null;

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
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
	} catch (err) {
		console.error(`[Pixel Agents] Failed to write ${filePath}:`, err);
	}
}

function persistAgents(): void {
	savePersistedAgents(agents);
}

// ── tmux 健康檢查 ───────────────────────────────────────

let tmuxHealthTimer: ReturnType<typeof setInterval> | null = null;

function startTmuxHealthCheck(sender: MessageSender): void {
	if (tmuxHealthTimer) return;
	tmuxHealthTimer = setInterval(() => {
		checkTmuxHealth(
			agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
			jsonlPollTimers, knownJsonlFiles, sender, persistAgents,
		);
	}, TMUX_HEALTH_CHECK_INTERVAL_MS);
}

// ── 決定工作目錄 ──────────────────────────────────────────

function findGitRoot(startDir: string): string | null {
	let dir = startDir;
	while (true) {
		if (fs.existsSync(path.join(dir, '.git'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

const cwd = process.argv[2] || findGitRoot(process.cwd()) || process.cwd();
console.log(`[Pixel Agents] Working directory: ${cwd}`);

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
	const port = parseInt(process.env['PORT'] || String(DEFAULT_PORT), 10);

	// 載入素材
	const assetsRoot = findAssetsRoot();
	console.log(`[Pixel Agents] Assets root: ${assetsRoot}`);

	defaultLayout = await loadDefaultLayout(assetsRoot);
	cachedCharSprites = await loadCharacterSprites(assetsRoot);
	cachedFloorTiles = await loadFloorTiles(assetsRoot);
	cachedWallTiles = await loadWallTiles(assetsRoot);
	cachedFurnitureAssets = await loadFurnitureAssets(assetsRoot);

	// 設定 Express + Socket.IO
	const app = express();
	const httpServer = createServer(app);
	const io = new Server(httpServer, {
		cors: { origin: '*' },
		maxHttpBufferSize: 10 * 1024 * 1024, // 10MB，用於大型素材傳輸
	});

	// 提供客戶端靜態檔案（正式環境）
	const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
	if (fs.existsSync(clientDistPath)) {
		app.use(express.static(clientDistPath));
	}

	// Socket.IO 連線處理器
	io.on('connection', (socket) => {
		console.log(`[Pixel Agents] Client connected: ${socket.id}`);

		const sender: MessageSender = {
			postMessage(msg: unknown) {
				socket.emit('message', msg);
			},
		};

		socket.on('message', (msg: Record<string, unknown>) => {
			handleClientMessage(msg, sender);
		});

		socket.on('disconnect', () => {
			console.log(`[Pixel Agents] Client disconnected: ${socket.id}`);
			if (isDemoEnabled()) {
				stopDemoMode();
			}
		});
	});

	httpServer.listen(port, () => {
		console.log(`\n  Pixel Agents Web running at http://localhost:${port}\n`);
	});
}

function handleClientMessage(msg: Record<string, unknown>, sender: MessageSender): void {
	console.log(`[Pixel Agents] Received message: ${msg.type}`);
	switch (msg.type) {
		case 'webviewReady': {
			// 依序傳送素材
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

			// 傳送佈局
			const layout = loadLayout(defaultLayout);
			sender.postMessage({ type: 'layoutLoaded', layout });

			// 傳送設定
			const settings = readJsonFile<{ soundEnabled?: boolean }>(getSettingsPath(), {});
			sender.postMessage({ type: 'settingsLoaded', soundEnabled: settings.soundEnabled ?? true });

			// 傳送現有代理
			const agentMeta = readJsonFile<Record<string, { palette?: number; hueShift?: number; seatId?: string }>>(
				getAgentSeatsPath(), {},
			);
			sendExistingAgents(agents, agentMeta, sender);

			// 演示模式或真實的自動偵測
			if (isDemoEnabled()) {
				const demoCount = parseInt(process.env['DEMO_AGENTS'] || '3', 10);
				startDemoMode(sender, demoCount);
			} else {
				// 在專案掃描之前，從上一次伺服器執行中恢復 tmux 代理（僅一次）
				if (!tmuxRecoveredRef.current) {
					tmuxRecoveredRef.current = true;
					recoverTmuxAgents(
						nextAgentIdRef, agents, knownJsonlFiles,
						fileWatchers, pollingTimers, waitingTimers, permissionTimers,
						sender, persistAgents,
					);
				}
				// 恢復後重新傳送現有代理（包含已恢復的 tmux 代理）
				sendExistingAgents(agents, agentMeta, sender);

				// 啟動專案掃描 — 自動偵測所有專案中正在執行的 Claude 會話
				const projectDirs = getAllProjectDirs();
				ensureProjectScan(
					projectDirs, knownJsonlFiles, projectScanTimerRef,
					nextAgentIdRef, agents,
					fileWatchers, pollingTimers, waitingTimers, permissionTimers,
					jsonlPollTimers, sender, persistAgents,
				);

				// 啟動 tmux 健康檢查
				startTmuxHealthCheck(sender);
			}
			break;
		}
		case 'openClaude': {
			launchNewAgent(
				cwd,
				nextAgentIdRef, agents, activeAgentIdRef, knownJsonlFiles,
				fileWatchers, pollingTimers, waitingTimers, permissionTimers,
				jsonlPollTimers,
				sender, persistAgents,
			);
			break;
		}
		case 'closeAgent': {
			const id = msg.id as number;
			closeAgent(
				id, agents,
				fileWatchers, pollingTimers, waitingTimers, permissionTimers,
				jsonlPollTimers, knownJsonlFiles, sender, persistAgents,
			);
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
			writeLayoutToFile(msg.layout as Record<string, unknown>);
			break;
		}
		case 'setSoundEnabled': {
			const current = readJsonFile<Record<string, unknown>>(getSettingsPath(), {});
			current.soundEnabled = msg.enabled;
			writeJsonFile(getSettingsPath(), current);
			break;
		}
		case 'listSessions': {
			const sessions = scanAllSessions(agents);
			sender.postMessage({ type: 'sessionsList', sessions });
			break;
		}
		case 'resumeSession': {
			const sessionId = msg.sessionId as string;
			const sessionProjectDir = msg.projectDir as string;
			resumeSession(
				sessionId, sessionProjectDir, cwd,
				nextAgentIdRef, agents, activeAgentIdRef, knownJsonlFiles,
				fileWatchers, pollingTimers, waitingTimers, permissionTimers,
				jsonlPollTimers, sender, persistAgents,
			);
			break;
		}
		// exportLayout / importLayout 在 Web 版本中由客戶端處理
	}
}

main().catch((err) => {
	console.error('[Pixel Agents] Failed to start:', err);
	process.exit(1);
});
