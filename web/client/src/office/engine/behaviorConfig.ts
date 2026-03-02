import {
  WANDER_WEIGHT_IDLE_LOOK,
  WANDER_WEIGHT_RANDOM,
  WANDER_WEIGHT_FURNITURE,
  WANDER_WEIGHT_CHAT,
  WANDER_WEIGHT_WALL,
  WANDER_WEIGHT_MEETING,
  WANDER_WEIGHT_RETURN_SEAT,
  WANDER_PAUSE_MIN_SEC,
  WANDER_PAUSE_MAX_SEC,
  SEAT_REST_MIN_SEC,
  SEAT_REST_MAX_SEC,
  SLEEP_TRIGGER_IDLE_SEC,
  STRETCH_TRIGGER_SIT_SEC,
  CHAT_DURATION_MIN_SEC,
  CHAT_DURATION_MAX_SEC,
  FURNITURE_COOLDOWN_SEC,
} from '../../constants.js'

export interface BehaviorConfig {
  wanderWeightIdleLook: number
  wanderWeightRandom: number
  wanderWeightFurniture: number
  wanderWeightChat: number
  wanderWeightWall: number
  wanderWeightMeeting: number
  wanderWeightReturnSeat: number
  wanderPauseMin: number
  wanderPauseMax: number
  seatRestMin: number
  seatRestMax: number
  sleepTrigger: number
  stretchTrigger: number
  chatDurationMin: number
  chatDurationMax: number
  furnitureCooldown: number
}

/** 從常數建立的預設值 */
export const DEFAULT_BEHAVIOR_CONFIG: BehaviorConfig = {
  wanderWeightIdleLook: WANDER_WEIGHT_IDLE_LOOK,
  wanderWeightRandom: WANDER_WEIGHT_RANDOM,
  wanderWeightFurniture: WANDER_WEIGHT_FURNITURE,
  wanderWeightChat: WANDER_WEIGHT_CHAT,
  wanderWeightWall: WANDER_WEIGHT_WALL,
  wanderWeightMeeting: WANDER_WEIGHT_MEETING,
  wanderWeightReturnSeat: WANDER_WEIGHT_RETURN_SEAT,
  wanderPauseMin: WANDER_PAUSE_MIN_SEC,
  wanderPauseMax: WANDER_PAUSE_MAX_SEC,
  seatRestMin: SEAT_REST_MIN_SEC,
  seatRestMax: SEAT_REST_MAX_SEC,
  sleepTrigger: SLEEP_TRIGGER_IDLE_SEC,
  stretchTrigger: STRETCH_TRIGGER_SIT_SEC,
  chatDurationMin: CHAT_DURATION_MIN_SEC,
  chatDurationMax: CHAT_DURATION_MAX_SEC,
  furnitureCooldown: FURNITURE_COOLDOWN_SEC,
}

/** 運行時行為配置 singleton */
let currentConfig: BehaviorConfig = { ...DEFAULT_BEHAVIOR_CONFIG }

/** 取得當前行為配置 */
export function getBehaviorConfig(): BehaviorConfig {
  return currentConfig
}

/** 更新行為配置（由伺服器 behaviorSettingsLoaded 訊息觸發） */
export function setBehaviorConfig(config: Partial<BehaviorConfig>): void {
  currentConfig = { ...DEFAULT_BEHAVIOR_CONFIG, ...config }
}
