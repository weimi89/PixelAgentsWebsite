import { join } from 'path';
import { homedir } from 'os';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { LAYOUT_FILE_DIR } from './constants.js';
import { atomicWriteJson } from './atomicWrite.js';

const BEHAVIOR_SETTINGS_FILE = 'behavior-settings.json';

export interface BehaviorSettings {
	wanderWeightIdleLook: number;
	wanderWeightRandom: number;
	wanderWeightFurniture: number;
	wanderWeightChat: number;
	wanderWeightWall: number;
	wanderWeightMeeting: number;
	wanderWeightReturnSeat: number;
	wanderPauseMin: number;
	wanderPauseMax: number;
	seatRestMin: number;
	seatRestMax: number;
	sleepTrigger: number;
	stretchTrigger: number;
	chatDurationMin: number;
	chatDurationMax: number;
	furnitureCooldown: number;
}

export const DEFAULT_BEHAVIOR_SETTINGS: BehaviorSettings = {
	wanderWeightIdleLook: 30,
	wanderWeightRandom: 30,
	wanderWeightFurniture: 15,
	wanderWeightChat: 10,
	wanderWeightWall: 10,
	wanderWeightMeeting: 8,
	wanderWeightReturnSeat: 5,
	wanderPauseMin: 3,
	wanderPauseMax: 12,
	seatRestMin: 120,
	seatRestMax: 240,
	sleepTrigger: 300,
	stretchTrigger: 180,
	chatDurationMin: 3,
	chatDurationMax: 8,
	furnitureCooldown: 180,
};

function getBehaviorSettingsPath(): string {
	const dir = join(homedir(), LAYOUT_FILE_DIR);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return join(dir, BEHAVIOR_SETTINGS_FILE);
}

export function readBehaviorSettings(): BehaviorSettings {
	const filePath = getBehaviorSettingsPath();
	try {
		const data = JSON.parse(readFileSync(filePath, 'utf-8'));
		return { ...DEFAULT_BEHAVIOR_SETTINGS, ...data };
	} catch {
		return { ...DEFAULT_BEHAVIOR_SETTINGS };
	}
}

export function writeBehaviorSettings(settings: Partial<BehaviorSettings>): BehaviorSettings {
	const merged = { ...DEFAULT_BEHAVIOR_SETTINGS, ...settings };
	atomicWriteJson(getBehaviorSettingsPath(), merged);
	return merged;
}
