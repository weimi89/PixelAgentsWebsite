/**
 * 監控與健康檢查端點集合：/health、/ready、/metrics、/api/metrics、/api/status
 *
 * 抽出至此檔案以降低 index.ts 的體積，並讓路由定義集中便於測試與維護。
 */

import type { Express } from 'express';
import type { AgentContext } from './types.js';
import { config } from './config.js';
import { redis } from './db/redis.js';

/**
 * 將監控相關的路由註冊到 Express app。
 * 注意：ctx 於函式內以 closure 方式捕獲，呼叫時資料即時反映最新代理狀態。
 */
export function registerMonitoringRoutes(app: Express, ctx: AgentContext): void {
	// ── 健康檢查（Docker HEALTHCHECK / 負載均衡器）────────
	// /health：liveness — 進程存活即回 200
	app.get('/health', (_req, res) => {
		res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
	});

	// /ready：readiness — 檢查資料庫/關鍵資源可用，否則回 503
	app.get('/ready', (_req, res) => {
		try {
			if (config.redisUrl && !redis.isConnected()) {
				res.status(503).json({ ready: false, reason: 'redis_disconnected' });
				return;
			}
			res.json({ ready: true, uptime: Math.round(process.uptime()) });
		} catch (err) {
			res.status(503).json({ ready: false, reason: err instanceof Error ? err.message : 'unknown' });
		}
	});

	// ── JSON 指標（向下相容，壓力測試/內部工具使用） ────────
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

	// ── Prometheus OpenMetrics text 格式 ────────
	// 使用 Prometheus `scrape_configs` 設定 `metrics_path: /metrics` 即可
	app.get('/metrics', (_req, res) => {
		const mem = process.memoryUsage();
		const uptime = process.uptime();
		const lines = [
			'# HELP pixel_agents_active_total Currently active agents (local + remote)',
			'# TYPE pixel_agents_active_total gauge',
			`pixel_agents_active_total ${ctx.agents.size}`,
			'# HELP pixel_agents_remote_total Currently active remote agents (via Agent Node)',
			'# TYPE pixel_agents_remote_total gauge',
			`pixel_agents_remote_total ${ctx.remoteAgentMap.size}`,
			'# HELP pixel_agents_tracked_files_total JSONL files currently being watched',
			'# TYPE pixel_agents_tracked_files_total gauge',
			`pixel_agents_tracked_files_total ${ctx.trackedJsonlFiles.size}`,
			'# HELP pixel_agents_floors_total Configured building floors',
			'# TYPE pixel_agents_floors_total gauge',
			`pixel_agents_floors_total ${ctx.building.floors.length}`,
			'# HELP process_resident_memory_bytes Resident set size in bytes',
			'# TYPE process_resident_memory_bytes gauge',
			`process_resident_memory_bytes ${mem.rss}`,
			'# HELP process_heap_used_bytes Heap memory used in bytes',
			'# TYPE process_heap_used_bytes gauge',
			`process_heap_used_bytes ${mem.heapUsed}`,
			'# HELP process_heap_total_bytes Heap memory allocated in bytes',
			'# TYPE process_heap_total_bytes gauge',
			`process_heap_total_bytes ${mem.heapTotal}`,
			'# HELP process_uptime_seconds Process uptime in seconds',
			'# TYPE process_uptime_seconds gauge',
			`process_uptime_seconds ${uptime.toFixed(3)}`,
		];
		res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
		res.send(lines.join('\n') + '\n');
	});

	// ── 詳細狀態端點（版本、樓層、記憶體等） ────────
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
}
