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

const userDir = path.join(os.homedir(), LAYOUT_FILE_DIR);
const floorsDir = path.join(userDir, FLOOR_LAYOUT_DIR);

function ensureDir(dir: string): void {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

/** 原子寫入 JSON 檔案（.tmp + rename） */
function atomicWriteJson(filePath: string, data: unknown): void {
	ensureDir(path.dirname(filePath));
	const json = JSON.stringify(data, null, 2);
	const tmpPath = filePath + '.tmp';
	fs.writeFileSync(tmpPath, json, 'utf-8');
	fs.renameSync(tmpPath, filePath);
}

function getBuildingFilePath(): string {
	return path.join(userDir, BUILDING_FILE_NAME);
}

function getFloorLayoutPath(floorId: FloorId): string {
	return path.join(floorsDir, `${floorId}.json`);
}

/** 載入建築物配置，若不存在則執行遷移 */
export function loadBuildingConfig(): BuildingConfig {
	const filePath = getBuildingFilePath();
	try {
		if (fs.existsSync(filePath)) {
			return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as BuildingConfig;
		}
	} catch (err) {
		console.error('[Pixel Agents] Failed to read building config:', err);
	}

	// 遷移：建立預設建築物配置
	console.log('[Pixel Agents] No building.json found, creating default with migration');
	const defaultConfig: BuildingConfig = {
		version: 1,
		defaultFloorId: DEFAULT_FLOOR_ID,
		floors: [{ id: DEFAULT_FLOOR_ID, name: '1F 大廳', order: 1 }],
	};

	// 如果舊的 layout.json 存在，複製為 floors/1F.json
	const oldLayoutPath = path.join(userDir, LAYOUT_FILE_NAME);
	try {
		if (fs.existsSync(oldLayoutPath)) {
			const layout = fs.readFileSync(oldLayoutPath, 'utf-8');
			ensureDir(floorsDir);
			const floorPath = getFloorLayoutPath(DEFAULT_FLOOR_ID);
			if (!fs.existsSync(floorPath)) {
				atomicWriteJson(floorPath, JSON.parse(layout));
				console.log(`[Pixel Agents] Migrated layout.json → floors/${DEFAULT_FLOOR_ID}.json`);
			}
		}
	} catch (err) {
		console.error('[Pixel Agents] Migration error:', err);
	}

	atomicWriteJson(filePath, defaultConfig);
	return defaultConfig;
}

/** 寫入建築物配置 */
export function writeBuildingConfig(config: BuildingConfig): void {
	atomicWriteJson(getBuildingFilePath(), config);
}

/** 讀取樓層佈局 */
export function readFloorLayout(floorId: FloorId): Record<string, unknown> | null {
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

/** 新增樓層 */
export function addFloor(building: BuildingConfig, name: string): FloorConfig {
	const maxOrder = building.floors.reduce((max, f) => Math.max(max, f.order), 0);
	const newOrder = maxOrder + 1;
	const newId = `${newOrder}F`;
	const floor: FloorConfig = { id: newId, name, order: newOrder };
	building.floors.push(floor);
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
	writeBuildingConfig(building);
	return true;
}

/** 重新命名樓層 */
export function renameFloor(building: BuildingConfig, floorId: FloorId, name: string): void {
	const floor = building.floors.find(f => f.id === floorId);
	if (floor) {
		floor.name = name;
		writeBuildingConfig(building);
	}
}
