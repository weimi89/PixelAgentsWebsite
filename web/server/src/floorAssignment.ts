import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BuildingConfig, FloorId } from './types.js';
import { LAYOUT_FILE_DIR, PROJECT_FLOOR_MAP_FILE_NAME, DEFAULT_FLOOR_ID } from './constants.js';

const userDir = path.join(os.homedir(), LAYOUT_FILE_DIR);

function getMapFilePath(): string {
	return path.join(userDir, PROJECT_FLOOR_MAP_FILE_NAME);
}

/** 讀取專案 → 樓層映射 */
export function readProjectFloorMap(): Record<string, FloorId> {
	try {
		const filePath = getMapFilePath();
		if (!fs.existsSync(filePath)) return {};
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, FloorId>;
	} catch {
		return {};
	}
}

/** 寫入專案 → 樓層映射 */
export function writeProjectFloorMap(map: Record<string, FloorId>): void {
	const filePath = getMapFilePath();
	const dir = path.dirname(filePath);
	try {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		const json = JSON.stringify(map, null, 2);
		const tmpPath = filePath + '.tmp';
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		console.error('[Pixel Agents] Failed to write project floor map:', err);
	}
}

/** 設定特定專案的樓層映射 */
export function setProjectFloor(projectDir: string, floorId: FloorId): void {
	const map = readProjectFloorMap();
	const key = path.basename(projectDir);
	map[key] = floorId;
	writeProjectFloorMap(map);
}

/** 解析專案所屬的樓層（查映射，無則回傳預設樓層） */
export function resolveFloorForProject(projectDir: string, _building: BuildingConfig): FloorId {
	const map = readProjectFloorMap();
	const key = path.basename(projectDir);
	return map[key] || DEFAULT_FLOOR_ID;
}
