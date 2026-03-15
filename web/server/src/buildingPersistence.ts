import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BuildingConfig, FloorConfig, FloorId } from './types.js';
import {
	LAYOUT_FILE_DIR,
	LAYOUT_FILE_NAME,
	BUILDING_FILE_NAME,
	FLOOR_LAYOUT_DIR,
	DEFAULT_FLOOR_ID,
} from './constants.js';
import { atomicWriteJson } from './atomicWrite.js';
import { db } from './db/database.js';

const userDir = path.join(os.homedir(), LAYOUT_FILE_DIR);
const floorsDir = path.join(userDir, FLOOR_LAYOUT_DIR);

function getBuildingFilePath(): string {
	return path.join(userDir, BUILDING_FILE_NAME);
}

function getFloorLayoutPath(floorId: FloorId): string {
	return path.join(floorsDir, `${floorId}.json`);
}

/** 載入建築物配置，若不存在則執行遷移 */
export function loadBuildingConfig(): BuildingConfig {
	// 優先從 SQLite 讀取
	if (db) {
		const row = db.getBuilding();
		if (row) {
			try {
				return JSON.parse(row.config) as BuildingConfig;
			} catch {
				console.error('[Pixel Agents] Failed to parse building config from DB');
			}
		}
	}

	// 回退至 JSON 檔案
	const filePath = getBuildingFilePath();
	try {
		if (fs.existsSync(filePath)) {
			const config = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as BuildingConfig;
			// 同步至 DB（若可用）
			if (db) {
				db.saveBuilding(JSON.stringify(config), config.defaultFloorId);
			}
			return config;
		}
	} catch (err) {
		console.error('[Pixel Agents] Failed to read building config:', err);
	}

	// 遷移：建立預設建築物配置
	console.log('[Pixel Agents] No building config found, creating default with migration');
	const defaultConfig: BuildingConfig = {
		version: 1,
		defaultFloorId: DEFAULT_FLOOR_ID,
		floors: [{ id: DEFAULT_FLOOR_ID, name: '1F 大廳', order: 1, ownerId: null }],
	};

	// 如果舊的 layout.json 存在，複製為 floors/1F.json
	const oldLayoutPath = path.join(userDir, LAYOUT_FILE_NAME);
	try {
		if (fs.existsSync(oldLayoutPath)) {
			const layout = fs.readFileSync(oldLayoutPath, 'utf-8');
			const parsed = JSON.parse(layout) as Record<string, unknown>;
			if (db) {
				db.saveFloor(DEFAULT_FLOOR_ID, '1F 大廳', 1, JSON.stringify(parsed), null);
			} else {
				const floorPath = getFloorLayoutPath(DEFAULT_FLOOR_ID);
				if (!fs.existsSync(floorPath)) {
					atomicWriteJson(floorPath, parsed);
				}
			}
			console.log(`[Pixel Agents] Migrated layout.json → floor ${DEFAULT_FLOOR_ID}`);
		}
	} catch (err) {
		console.error('[Pixel Agents] Migration error:', err);
	}

	// 寫入 DB 和 JSON 備份
	if (db) {
		db.saveBuilding(JSON.stringify(defaultConfig), defaultConfig.defaultFloorId);
	}
	atomicWriteJson(filePath, defaultConfig);
	return defaultConfig;
}

/** 寫入建築物配置 */
export function writeBuildingConfig(config: BuildingConfig): void {
	if (db) {
		db.saveBuilding(JSON.stringify(config), config.defaultFloorId);
		// 同步樓層到 DB（包含 ownerId）
		for (const floor of config.floors) {
			const existingFloor = db.getFloor(floor.id);
			if (existingFloor) {
				// 更新名稱、排序和擁有者，保留佈局
				db.saveFloor(floor.id, floor.name, floor.order, existingFloor.layout, floor.ownerId ?? null);
			}
		}
	}
	atomicWriteJson(getBuildingFilePath(), config);
}

/** 讀取樓層佈局 */
export function readFloorLayout(floorId: FloorId): Record<string, unknown> | null {
	// 優先從 SQLite 讀取
	if (db) {
		const row = db.getFloor(floorId);
		if (row) {
			try {
				return JSON.parse(row.layout) as Record<string, unknown>;
			} catch {
				console.error(`[Pixel Agents] Failed to parse floor layout ${floorId} from DB`);
			}
		}
	}

	// 回退至 JSON 檔案
	const filePath = getFloorLayoutPath(floorId);
	try {
		if (!fs.existsSync(filePath)) return null;
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
	} catch (err) {
		console.error(`[Pixel Agents] Failed to read floor layout ${floorId}:`, err);
		return null;
	}
}

/** 寫入樓層佈局 */
export function writeFloorLayout(floorId: FloorId, layout: Record<string, unknown>): void {
	if (db) {
		// 取得現有樓層 metadata 或使用預設值
		const existing = db.getFloor(floorId);
		db.saveFloor(
			floorId,
			existing?.name ?? floorId,
			existing?.sort_order ?? 0,
			JSON.stringify(layout),
		);
	}
	atomicWriteJson(getFloorLayoutPath(floorId), layout);
}

/** 載入樓層佈局（優先從檔案，回退至預設佈局） */
export function loadFloorLayout(
	floorId: FloorId,
	defaultLayout?: Record<string, unknown> | null,
): Record<string, unknown> | null {
	const fromFile = readFloorLayout(floorId);
	if (fromFile) {
		console.log(`[Pixel Agents] Floor layout loaded: ${floorId}`);
		return fromFile;
	}

	if (defaultLayout) {
		console.log(`[Pixel Agents] Writing default layout for floor ${floorId}`);
		writeFloorLayout(floorId, defaultLayout);
		return defaultLayout;
	}

	return null;
}

/** 新增樓層（可指定擁有者，null 為公共樓層） */
export function addFloor(building: BuildingConfig, name: string, ownerId?: string | null): FloorConfig {
	const maxOrder = building.floors.reduce((max, f) => Math.max(max, f.order), 0);
	const newOrder = maxOrder + 1;
	const newId = `${newOrder}F`;
	const floor: FloorConfig = { id: newId, name, order: newOrder, ownerId: ownerId ?? null };
	building.floors.push(floor);
	// 在 DB 中建立空樓層記錄（包含擁有者）
	if (db) {
		db.saveFloor(newId, name, newOrder, '{}', ownerId ?? null);
	}
	writeBuildingConfig(building);
	return floor;
}

/** 移除樓層（不可移除最後一層） */
export function removeFloor(building: BuildingConfig, floorId: FloorId): boolean {
	if (building.floors.length <= 1) return false;
	const idx = building.floors.findIndex(f => f.id === floorId);
	if (idx === -1) return false;
	building.floors.splice(idx, 1);
	// 若移除的是預設樓層，將預設設為第一層
	if (building.defaultFloorId === floorId) {
		building.defaultFloorId = building.floors[0].id;
	}
	// 從 DB 中刪除樓層
	if (db) {
		db.deleteFloor(floorId);
	}
	writeBuildingConfig(building);
	return true;
}

/** 重新命名樓層（回傳是否成功；名稱重複時回傳 false） */
export function renameFloor(building: BuildingConfig, floorId: FloorId, name: string): { success: boolean; error?: string } {
	const floor = building.floors.find(f => f.id === floorId);
	if (!floor) return { success: false, error: 'floor_not_found' };
	// 名稱唯一性檢查（排除自身）
	const duplicate = building.floors.find(f => f.id !== floorId && f.name === name);
	if (duplicate) return { success: false, error: 'name_already_exists' };
	floor.name = name;
	writeBuildingConfig(building);
	return { success: true };
}
