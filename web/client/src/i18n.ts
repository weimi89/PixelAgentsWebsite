// 集中管理的 UI 字串 — 多語言支援

const zh_TW = {
  // 底部工具列
  layout: '佈局',
  editOfficeLayout: '編輯辦公室佈局',
  settings: '設定',

  // 縮放控制
  zoomIn: '放大 (Ctrl+滾輪)',
  zoomOut: '縮小 (Ctrl+滾輪)',
  zoomLevel: (n: number) => `${n}x`,

  // 設定面板
  exportLayout: '匯出佈局',
  importLayout: '匯入佈局',
  soundNotifications: '音效通知',
  soundWaiting: '等待提示音',
  soundPermission: '權限請求音',
  soundTurnComplete: '回合完成音',
  debugView: '除錯檢視',

  // 代理
  agent: (id: number) => `代理 #${id}`,
  closeAgent: '關閉代理',

  // Git 分支
  gitBranch: '分支',

  // 右鍵選單
  contextGoToSeat: '回到座位',
  contextFollowCamera: '鏡頭追蹤',
  contextMoveFloor: '移動到其他樓層',
  contextFocusParent: '聚焦父代理',

  // 狀態
  needsApproval: '需要核准',
  idle: '閒置中',
  mightBeWaiting: '可能正在等待輸入',

  // 編輯器工具列
  floor: '地板',
  paintFloorTiles: '繪製地板磚塊',
  wall: '牆壁',
  paintWalls: '繪製牆壁（點擊切換）',
  erase: '清除',
  eraseTilesToVoid: '清除磚塊為空白',
  furniture: '家具',
  placeFurniture: '放置家具',
  color: '顏色',
  adjustFloorColor: '調整地板顏色',
  adjustWallColor: '調整牆壁顏色',
  adjustFurnitureColor: '調整所選家具顏色',
  pick: '吸管',
  pickFloorPattern: '從現有磚塊取色',
  pickFurnitureType: '從已放置的家具取樣',
  clearColor: '清除',
  removeColor: '移除顏色（恢復原始）',
  colorize: '著色',
  floorPattern: (index: number) => `地板 ${index}`,

  // 編輯動作列
  undo: '復原',
  undoShortcut: '復原 (Ctrl+Z)',
  redo: '重做',
  redoShortcut: '重做 (Ctrl+Y)',
  save: '儲存',
  saveLayout: '儲存佈局',
  reset: '重設',
  resetToLastSaved: '重設為上次儲存的佈局',
  resetConfirm: '確定重設？',
  yes: '是',
  no: '否',

  // 錯誤邊界
  errorOccurred: '發生錯誤',
  retry: '重試',

  // 載入中
  loading: '載入中...',

  // 提示
  pressRToRotate: '按 <b>R</b> 旋轉',

  // 模型
  unknownModel: '未知模型',

  // 已斷線 (tmux)
  detached: '已斷線',

  // 工作選擇器
  sessions: '工作',
  browseSessions: '瀏覽過去的工作',
  noSessions: '沒有找到工作',
  resumeSession: '恢復',
  activeSession: '進行中',
  loadingSessions: '載入中...',
  sessionProject: '專案',
  searchSessions: '搜尋工作...',
  noMatchingSessions: '沒有符合的工作',

  // 專案排除
  hideProject: '隱藏',
  showProject: '顯示',
  excludedProjects: '已隱藏的專案',
  noExcludedProjects: '無隱藏的專案',
  projectFolders: '專案資料夾',
  projectFoldersCount: (n: number) => `專案資料夾 (${n})`,

  // 連線狀態
  disconnected: '已斷線，重連中...',

  // 子任務
  subtask: '子任務',

  // 時間格式
  timeAgoSeconds: (n: number) => `${n} 秒前`,
  timeAgoMinutes: (n: number) => `${n} 分鐘前`,
  timeAgoHours: (n: number) => `${n} 小時前`,
  timeAgoDays: (n: number) => `${n} 天前`,
  timeAgoMonths: (n: number) => `${n} 個月前`,

  // 佈局模板
  layoutTemplates: '空間',
  loadTemplate: '套用',
  templateClassicOffice: '經典辦公室',
  templateOpenPlan: '開放空間',
  templateCoworking: '共享工作室',
  templateMinimal: '簡約小室',
  templateLShapeStudio: 'L 型工作室',
  templateConferenceCenter: '會議中心',
  templateMazeHall: '迷宮大廳',
  templateTwinWing: '雙翼大樓',
  templateRingOffice: '環形辦公室',
  templateCubicleFarm: '格子間',
  templateTerraced: '階梯式',
  templateGrandPlaza: '大廳廣場',
  templateConfirmLoad: '確定套用？佈局將被覆蓋。',
  templateTargetFloor: '套用到：',

  // 佈局匯入驗證
  invalidLayoutFile: '無效的佈局檔案',
  parseLayoutFailed: '解析佈局檔案失敗',

  // 樓層
  lobby: '大廳',
  addFloor: '新增樓層',
  removeFloor: '移除樓層',
  renameFloor: '重新命名',

  // 遠端代理
  remoteAgent: '遠端',
  owner: '擁有者',

  // 大樓面板
  building: '大樓',
  buildingPanel: '大樓面板',
  floorAgentCount: (n: number) => `${n} 個代理`,
  newFloorName: '新樓層',
  deleteFloorConfirm: '確定移除此樓層？',
  cannotDeleteLastFloor: '無法移除唯一的樓層',
  // 日夜循環
  dayNightCycle: '日夜循環',
  useRealTime: '使用真實時間',
  timeOverride: '時間覆寫',

  // 聊天
  chatPlaceholder: '輸入訊息...',
  chatSend: '傳送',
  chat: '聊天',
  chatNickname: '暱稱',

  // 會議
  meeting: '會議中',

  // 跨樓層
  elevator: '電梯',
  movingFloor: '移動樓層中',

  // 儀表板
  dashboard: '儀表板',
  officeView: '辦公室',
  openDashboard: '在新分頁開啟儀表板',
  totalAgents: '總代理數',
  activeAgents: '活躍代理',
  totalToolCalls: '工具呼叫數',
  toolDistribution: '工具使用分布',
  floorOverview: '樓層總覽',
  agentList: '代理列表',
  project: '專案',
  status: '狀態',
  tool: '工具',
  model: '模型',
  active: '活躍',
  inactive: '閒置',
  remote: '遠端',
  noAgentsYet: '尚無代理',
  noToolData: '尚無工具資料',

  // 狀態歷史
  statusHistory: '狀態歷史',

  // 代理詳情面板
  agentDetail: '代理詳情',
  loginToSeeDetails: '請登入以查看詳細資訊',
  agentDetailInfo: '基本資訊',
  agentDetailTools: '工具活動',
  agentDetailHistory: '狀態歷史',
  agentDetailClose: '關閉面板',
  agentDetailTimeline: '時間軸',
  agentDetailTranscript: '對話記錄',
  workStartTime: '開始工作',
  workDuration: '工作時長',
  noTranscript: '尚無對話記錄',
  noHistory: '尚無歷史記錄',

  // UI 縮放
  uiScale: 'UI 縮放',

  // 像素文字
  pixelText: '像素文字',
  pixelTextPlaceholder: '輸入文字...',
  pixelTextLabel: '文字',
  // 團隊
  team: '團隊',
  setTeam: '設定團隊',
  noTeam: '無團隊',
  teamName: '團隊名稱',

  // CLI 類型
  cliType: 'CLI 類型',
  cliClaude: 'Claude',
  cliCodex: 'Codex',
  cliGemini: 'Gemini',

  // 區網發現
  lanDiscovery: '區網發現',
  lanDiscoveryEnabled: '啟用區網發現',
  lanPeerName: '顯示名稱',
  lanPeers: '區網同伴',
  lanNoPeers: '尚未發現其他實例',
  lanAgentCount: '個代理',

  // 終端
  terminal: '終端',
  openTerminal: '開啟終端',
  terminalCloseTab: '關閉此分頁',
  terminalClosePanel: '關閉終端面板',
  terminalSelectTab: '選擇一個分頁',
  terminalError: '終端錯誤',
  terminalConnectionError: '終端連線失敗',
  terminalDisconnected: '終端已斷線',
  terminalExited: '終端已結束',
  terminalNoTmux: '此代理沒有 tmux 工作',

  // 行動裝置
  touchEditHint: '單指繪製/放置 | 雙指縮放平移',
  doubleTapZoom: '雙擊縮放',

  // 行為編輯器
  behavior: '行為',
  behaviorEditor: '行為參數編輯',
  behaviorWeights: '漫遊行為權重',
  behaviorTiming: '時間參數',
  behaviorWeightIdleLook: '站著看看',
  behaviorWeightRandom: '隨機漫遊',
  behaviorWeightFurniture: '家具互動',
  behaviorWeightChat: '聊天',
  behaviorWeightWall: '牆壁互動',
  behaviorWeightMeeting: '會議',
  behaviorWeightReturnSeat: '回座位',
  behaviorWanderPause: '漫遊暫停',
  behaviorSeatRest: '座位休息',
  behaviorSleepTrigger: '睡眠觸發',
  behaviorStretchTrigger: '伸展觸發',
  behaviorChatDuration: '聊天時長',
  behaviorFurnitureCooldown: '家具冷卻',
  behaviorWeightTotal: (n: number) => `權重總和：${n}`,
  behaviorResetDefaults: '恢復預設',
  behaviorSeconds: (n: number) => `${n}s`,
  behaviorMinMax: (label: string) => `${label}（最小/最大）`,

  // 成長系統
  growthLevel: (n: number) => `Lv.${n}`,
  growthXp: (n: number) => `${n} XP`,
  growthSection: '成長',
  achievementNames: {
    first_tool: '初次呼叫',
    ten_tools: '十連呼叫',
    hundred_tools: '百次呼叫',
    thousand_tools: '千次呼叫',
    level_5: '等級 5',
    level_10: '等級 10',
    level_25: '等級 25',
    level_50: '等級 50',
    five_sessions: '老手',
    bash_user: '命令行達人',
  } as Record<string, string>,

  // 錄製/回放
  recording: '錄製',
  stopRecording: '停止錄製',
  recordingList: '錄製清單',
  noRecordings: '沒有錄製',
  playRecording: '播放',
  deleteRecording: '刪除',
  exportRecording: '匯出',
  importRecording: '匯入',
  recordingDuration: (n: number) => `${n.toFixed(1)}s`,
  recordingFrames: (n: number) => `${n} 幀`,
  playback: '回放中',
  stopPlayback: '停止',
  recordingName: '名稱',
  importRecordingFailed: '匯入錄製失敗',

  // 認證 / 密碼
  login: '登入',
  logout: '登出',
  register: '註冊',
  username: '帳號',
  password: '密碼',
  apiKeyLogin: 'API Key 登入',
  accountLogin: '帳號登入',
  loginFailed: '登入失敗',
  registerFailed: '註冊失敗',
  noAccountYet: '還沒有帳號？',
  firstTimeHint: '首次使用？預設管理員帳號 admin，密碼 admin',
  apiKeyLabel: 'API Key',
  apiKeyCopied: '已複製',
  apiKeyRegenerate: '重新生成',
  apiKeyRegenerateConfirm: '重新生成後舊的 API Key 將立即失效，確定嗎？',
  apiKeyShowOnce: '請保存你的 API Key，此畫面關閉後無法再次顯示',
  viewApiKey: '查看 API Key',
  pasteApiKey: '貼上你的 API Key',
  changePassword: '變更密碼',
  currentPassword: '當前密碼',
  newPassword: '新密碼',
  confirmPassword: '確認密碼',
  passwordChanged: '密碼已變更',
  passwordMismatch: '密碼不一致',
  passwordRequirements: '至少 8 字元，含大小寫字母及數字',
  forceChangePassword: '請先變更預設密碼',

  // 角色 / 使用者管理
  roleAdmin: '管理員',
  roleViewer: '觀察者',
  roleMember: '成員',
  userManagement: '使用者管理',
  noPermission: '權限不足',
  deleteUser: '刪除使用者',
  changeRole: '變更角色',

  // 使用者管理
  userManagementPanel: '使用者管理',
  userListTitle: '使用者列表',
  userUsername: '使用者名稱',
  userRole: '角色',
  userCreatedAt: '建立時間',
  userActions: '操作',
  userDeleteConfirm: (name: string) => `確定要刪除使用者「${name}」嗎？其專屬樓層將轉為公共樓層。`,
  userRoleUpdated: '角色已更新',
  userDeleted: '使用者已刪除',
  userLoadFailed: '無法載入使用者列表',
  noUsers: '沒有使用者',
  resetApiKey: '重設 API Key',
  resetApiKeyConfirm: (name: string) => `確定要重設「${name}」的 API Key 嗎？舊的 Key 將立即失效。`,
  resetApiKeySuccess: 'API Key 已重設',
  showApiKey: '顯示',
  hideApiKey: '隱藏',
  userApiKey: 'API Key',

  // 遠端節點健康
  remoteNodes: '遠端節點',
  nodeLatency: '延遲',
  nodeConnectedTime: '連線時間',
  nodeActiveSessions: '活躍代理',
  noRemoteNodes: '目前沒有連線的遠端節點',
  latencyGood: '良好',
  latencyFair: '普通',
  latencyPoor: '不佳',
  nodeHealth: '節點狀態',

  // Phase 6 新增 — 成就系統 UI
  achievements: '成就',
  achievementUnlocked: '解鎖成就',
  allAchievements: '所有成就',
  locked: '未解鎖',

  // Phase 6 新增 — 團隊系統
  teams: '團隊',
  allTeams: '所有團隊',
  teamMembers: '成員',
  filterByTeam: '依團隊篩選',

  // Phase 6 新增 — 佈局分享
  shareLayout: '分享佈局',
  copyToClipboard: '複製到剪貼簿',
  pasteFromClipboard: '從剪貼簿貼上',
  copied: '已複製',

  // Phase 6 新增 — 多語言 & 主題
  language: '語言',
  theme: '主題',
  darkTheme: '深色',
  lightTheme: '淺色',

  // Phase 6 新增 — 家具計數
  furnitureCount: (n: number) => `${n} 個素材`,

  // Phase 2 — 樓層權限
  permissionDenied: '權限不足',
  cannotEditOthersFloor: '無法編輯他人的樓層',
  floorNameAlreadyExists: '樓層名稱已被使用',
  personalFloor: '個人樓層',
  publicFloor: '公共樓層',
}

/** 語言字串型別（結構型別，非 literal） */
type LocaleStrings = typeof zh_TW

const en_US: LocaleStrings = {
  // Bottom toolbar
  layout: 'Layout',
  editOfficeLayout: 'Edit office layout',
  settings: 'Settings',

  // Zoom controls
  zoomIn: 'Zoom In (Ctrl+Scroll)',
  zoomOut: 'Zoom Out (Ctrl+Scroll)',
  zoomLevel: (n: number) => `${n}x`,

  // Settings panel
  exportLayout: 'Export Layout',
  importLayout: 'Import Layout',
  soundNotifications: 'Sound Notifications',
  soundWaiting: 'Waiting Sound',
  soundPermission: 'Permission Sound',
  soundTurnComplete: 'Turn Complete Sound',
  debugView: 'Debug View',

  // Agent
  agent: (id: number) => `Agent #${id}`,
  closeAgent: 'Close Agent',

  // Git branch
  gitBranch: 'Branch',

  // Context menu
  contextGoToSeat: 'Go to Seat',
  contextFollowCamera: 'Follow Camera',
  contextMoveFloor: 'Move to Floor',
  contextFocusParent: 'Focus Parent',

  // Status
  needsApproval: 'Needs Approval',
  idle: 'Idle',
  mightBeWaiting: 'May be waiting for input',

  // Editor toolbar
  floor: 'Floor',
  paintFloorTiles: 'Paint floor tiles',
  wall: 'Wall',
  paintWalls: 'Paint walls (click to toggle)',
  erase: 'Erase',
  eraseTilesToVoid: 'Erase tiles to void',
  furniture: 'Furniture',
  placeFurniture: 'Place furniture',
  color: 'Color',
  adjustFloorColor: 'Adjust floor color',
  adjustWallColor: 'Adjust wall color',
  adjustFurnitureColor: 'Adjust selected furniture color',
  pick: 'Pick',
  pickFloorPattern: 'Pick color from existing tile',
  pickFurnitureType: 'Pick type from placed furniture',
  clearColor: 'Clear',
  removeColor: 'Remove color (restore original)',
  colorize: 'Colorize',
  floorPattern: (index: number) => `Floor ${index}`,

  // Edit action bar
  undo: 'Undo',
  undoShortcut: 'Undo (Ctrl+Z)',
  redo: 'Redo',
  redoShortcut: 'Redo (Ctrl+Y)',
  save: 'Save',
  saveLayout: 'Save Layout',
  reset: 'Reset',
  resetToLastSaved: 'Reset to last saved layout',
  resetConfirm: 'Confirm reset?',
  yes: 'Yes',
  no: 'No',

  // Error boundary
  errorOccurred: 'An error occurred',
  retry: 'Retry',

  // Loading
  loading: 'Loading...',

  // Hint
  pressRToRotate: 'Press <b>R</b> to rotate',

  // Model
  unknownModel: 'Unknown model',

  // Detached (tmux)
  detached: 'Detached',

  // Session picker
  sessions: 'Sessions',
  browseSessions: 'Browse past sessions',
  noSessions: 'No sessions found',
  resumeSession: 'Resume',
  activeSession: 'Active',
  loadingSessions: 'Loading...',
  sessionProject: 'Project',
  searchSessions: 'Search sessions...',
  noMatchingSessions: 'No matching sessions',

  // Project exclude
  hideProject: 'Hide',
  showProject: 'Show',
  excludedProjects: 'Hidden Projects',
  noExcludedProjects: 'No hidden projects',
  projectFolders: 'Project Folders',
  projectFoldersCount: (n: number) => `Project Folders (${n})`,

  // Connection status
  disconnected: 'Disconnected, reconnecting...',

  // Subtask
  subtask: 'Subtask',

  // Time format
  timeAgoSeconds: (n: number) => `${n}s ago`,
  timeAgoMinutes: (n: number) => `${n}m ago`,
  timeAgoHours: (n: number) => `${n}h ago`,
  timeAgoDays: (n: number) => `${n}d ago`,
  timeAgoMonths: (n: number) => `${n}mo ago`,

  // Layout templates
  layoutTemplates: 'Spaces',
  loadTemplate: 'Apply',
  templateClassicOffice: 'Classic Office',
  templateOpenPlan: 'Open Plan',
  templateCoworking: 'Co-working',
  templateMinimal: 'Minimal',
  templateLShapeStudio: 'L-Shape Studio',
  templateConferenceCenter: 'Conference Center',
  templateMazeHall: 'Maze Hall',
  templateTwinWing: 'Twin Wing',
  templateRingOffice: 'Ring Office',
  templateCubicleFarm: 'Cubicle Farm',
  templateTerraced: 'Terraced',
  templateGrandPlaza: 'Grand Plaza',
  templateConfirmLoad: 'Confirm apply? Layout will be overwritten.',
  templateTargetFloor: 'Apply to:',

  // Layout import validation
  invalidLayoutFile: 'Invalid layout file',
  parseLayoutFailed: 'Failed to parse layout file',

  // Floors
  lobby: 'Lobby',
  addFloor: 'Add Floor',
  removeFloor: 'Remove Floor',
  renameFloor: 'Rename',

  // Remote agents
  remoteAgent: 'Remote',
  owner: 'Owner',

  // Building panel
  building: 'Building',
  buildingPanel: 'Building Panel',
  floorAgentCount: (n: number) => `${n} agents`,
  newFloorName: 'New Floor',
  deleteFloorConfirm: 'Delete this floor?',
  cannotDeleteLastFloor: 'Cannot delete the last floor',
  // Day-night cycle
  dayNightCycle: 'Day/Night Cycle',
  useRealTime: 'Use real time',
  timeOverride: 'Time Override',

  // Chat
  chatPlaceholder: 'Type a message...',
  chatSend: 'Send',
  chat: 'Chat',
  chatNickname: 'Nickname',

  // Meeting
  meeting: 'In Meeting',

  // Cross-floor
  elevator: 'Elevator',
  movingFloor: 'Moving floors',

  // Dashboard
  dashboard: 'Dashboard',
  officeView: 'Office',
  openDashboard: 'Open dashboard in new tab',
  totalAgents: 'Total Agents',
  activeAgents: 'Active Agents',
  totalToolCalls: 'Tool Calls',
  toolDistribution: 'Tool Distribution',
  floorOverview: 'Floor Overview',
  agentList: 'Agent List',
  project: 'Project',
  status: 'Status',
  tool: 'Tool',
  model: 'Model',
  active: 'Active',
  inactive: 'Idle',
  remote: 'Remote',
  noAgentsYet: 'No agents yet',
  noToolData: 'No tool data',

  // Status history
  statusHistory: 'Status History',

  // Agent detail panel
  agentDetail: 'Agent Details',
  loginToSeeDetails: 'Please login to see details',
  agentDetailInfo: 'Basic Info',
  agentDetailTools: 'Tool Activity',
  agentDetailHistory: 'Status History',
  agentDetailClose: 'Close Panel',
  agentDetailTimeline: 'Timeline',
  agentDetailTranscript: 'Transcript',
  workStartTime: 'Work Start',
  workDuration: 'Work Duration',
  noTranscript: 'No transcript',
  noHistory: 'No history',

  // UI scale
  uiScale: 'UI Scale',

  // Pixel text
  pixelText: 'Pixel Text',
  pixelTextPlaceholder: 'Enter text...',
  pixelTextLabel: 'Text',
  // Team
  team: 'Team',
  setTeam: 'Set Team',
  noTeam: 'No Team',
  teamName: 'Team Name',

  // CLI type
  cliType: 'CLI Type',
  cliClaude: 'Claude',
  cliCodex: 'Codex',
  cliGemini: 'Gemini',

  // LAN discovery
  lanDiscovery: 'LAN Discovery',
  lanDiscoveryEnabled: 'Enable LAN Discovery',
  lanPeerName: 'Display Name',
  lanPeers: 'LAN Peers',
  lanNoPeers: 'No other instances found',
  lanAgentCount: 'agents',

  // Terminal
  terminal: 'Terminal',
  openTerminal: 'Open Terminal',
  terminalCloseTab: 'Close this tab',
  terminalClosePanel: 'Close terminal panel',
  terminalSelectTab: 'Select a tab',
  terminalError: 'Terminal Error',
  terminalConnectionError: 'Terminal connection failed',
  terminalDisconnected: 'Terminal disconnected',
  terminalExited: 'Terminal exited',
  terminalNoTmux: 'No tmux session for this agent',

  // Mobile
  touchEditHint: 'One finger draw/place | Two fingers zoom/pan',
  doubleTapZoom: 'Double tap to zoom',

  // Behavior editor
  behavior: 'Behavior',
  behaviorEditor: 'Behavior Parameters',
  behaviorWeights: 'Wander Behavior Weights',
  behaviorTiming: 'Timing Parameters',
  behaviorWeightIdleLook: 'Idle Look',
  behaviorWeightRandom: 'Random Wander',
  behaviorWeightFurniture: 'Furniture Interact',
  behaviorWeightChat: 'Chat',
  behaviorWeightWall: 'Wall Interact',
  behaviorWeightMeeting: 'Meeting',
  behaviorWeightReturnSeat: 'Return to Seat',
  behaviorWanderPause: 'Wander Pause',
  behaviorSeatRest: 'Seat Rest',
  behaviorSleepTrigger: 'Sleep Trigger',
  behaviorStretchTrigger: 'Stretch Trigger',
  behaviorChatDuration: 'Chat Duration',
  behaviorFurnitureCooldown: 'Furniture Cooldown',
  behaviorWeightTotal: (n: number) => `Total Weight: ${n}`,
  behaviorResetDefaults: 'Reset Defaults',
  behaviorSeconds: (n: number) => `${n}s`,
  behaviorMinMax: (label: string) => `${label} (min/max)`,

  // Growth system
  growthLevel: (n: number) => `Lv.${n}`,
  growthXp: (n: number) => `${n} XP`,
  growthSection: 'Growth',
  achievementNames: {
    first_tool: 'First Call',
    ten_tools: '10 Calls',
    hundred_tools: '100 Calls',
    thousand_tools: '1000 Calls',
    level_5: 'Level 5',
    level_10: 'Level 10',
    level_25: 'Level 25',
    level_50: 'Level 50',
    five_sessions: 'Veteran',
    bash_user: 'CLI Master',
  } as Record<string, string>,

  // Recording/Playback
  recording: 'Record',
  stopRecording: 'Stop Recording',
  recordingList: 'Recording List',
  noRecordings: 'No recordings',
  playRecording: 'Play',
  deleteRecording: 'Delete',
  exportRecording: 'Export',
  importRecording: 'Import',
  recordingDuration: (n: number) => `${n.toFixed(1)}s`,
  recordingFrames: (n: number) => `${n} frames`,
  playback: 'Playing',
  stopPlayback: 'Stop',
  recordingName: 'Name',
  importRecordingFailed: 'Failed to import recording',

  // Auth / Password
  login: 'Login',
  logout: 'Logout',
  register: 'Register',
  username: 'Username',
  password: 'Password',
  apiKeyLogin: 'API Key',
  accountLogin: 'Account',
  loginFailed: 'Login failed',
  registerFailed: 'Registration failed',
  noAccountYet: 'No account yet?',
  firstTimeHint: 'First time? Default admin account: admin, password: admin',
  apiKeyLabel: 'API Key',
  apiKeyCopied: 'Copied',
  apiKeyRegenerate: 'Regenerate',
  apiKeyRegenerateConfirm: 'The old API Key will be invalidated immediately. Are you sure?',
  apiKeyShowOnce: 'Save your API Key now. It will not be shown again after closing.',
  viewApiKey: 'View API Key',
  pasteApiKey: 'Paste your API Key',
  changePassword: 'Change Password',
  currentPassword: 'Current Password',
  newPassword: 'New Password',
  confirmPassword: 'Confirm Password',
  passwordChanged: 'Password Changed',
  passwordMismatch: 'Passwords do not match',
  passwordRequirements: 'At least 8 chars, with upper/lowercase and numbers',
  forceChangePassword: 'Please change the default password first',

  // Role / User management
  roleAdmin: 'Admin',
  roleViewer: 'Viewer',
  roleMember: 'Member',
  userManagement: 'User Management',
  noPermission: 'Insufficient permissions',
  deleteUser: 'Delete User',
  changeRole: 'Change Role',

  // User management
  userManagementPanel: 'User Management',
  userListTitle: 'User List',
  userUsername: 'Username',
  userRole: 'Role',
  userCreatedAt: 'Created',
  userActions: 'Actions',
  userDeleteConfirm: (name: string) => `Delete user "${name}"? Their personal floors will become public.`,
  userRoleUpdated: 'Role updated',
  userDeleted: 'User deleted',
  userLoadFailed: 'Failed to load user list',
  noUsers: 'No users',
  resetApiKey: 'Reset API Key',
  resetApiKeyConfirm: (name: string) => `Reset API Key for "${name}"? The old key will be invalidated immediately.`,
  resetApiKeySuccess: 'API Key reset',
  showApiKey: 'Show',
  hideApiKey: 'Hide',
  userApiKey: 'API Key',

  // Remote node health
  remoteNodes: 'Remote Nodes',
  nodeLatency: 'Latency',
  nodeConnectedTime: 'Connected',
  nodeActiveSessions: 'Active Agents',
  noRemoteNodes: 'No connected remote nodes',
  latencyGood: 'Good',
  latencyFair: 'Fair',
  latencyPoor: 'Poor',
  nodeHealth: 'Node Health',

  // Phase 6 — Achievement System UI
  achievements: 'Achievements',
  achievementUnlocked: 'Achievement Unlocked',
  allAchievements: 'All Achievements',
  locked: 'Locked',

  // Phase 6 — Team System
  teams: 'Teams',
  allTeams: 'All Teams',
  teamMembers: 'Members',
  filterByTeam: 'Filter by Team',

  // Phase 6 — Layout Sharing
  shareLayout: 'Share Layout',
  copyToClipboard: 'Copy to Clipboard',
  pasteFromClipboard: 'Paste from Clipboard',
  copied: 'Copied',

  // Phase 6 — Language & Theme
  language: 'Language',
  theme: 'Theme',
  darkTheme: 'Dark',
  lightTheme: 'Light',

  // Phase 6 — Furniture count
  furnitureCount: (n: number) => `${n} assets`,

  // Phase 2 — Floor permissions
  permissionDenied: 'Insufficient permissions',
  cannotEditOthersFloor: "Cannot edit another user's floor",
  floorNameAlreadyExists: 'Floor name already exists',
  personalFloor: 'Personal Floor',
  publicFloor: 'Public Floor',
}

// ── Locale 管理 ──────────────────────────────────────────────────

type Locale = 'zh-TW' | 'en-US'

const LOCALE_STORAGE_KEY = 'pixel-agents-locale'

const localeMap: Record<Locale, LocaleStrings> = {
  'zh-TW': zh_TW,
  'en-US': en_US,
}

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'en-US': 'English',
}

const AVAILABLE_LOCALES: Locale[] = ['zh-TW', 'en-US']

let currentLocale: Locale = (() => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && stored in localeMap) return stored as Locale
  } catch { /* ignore */ }
  return 'zh-TW'
})()

/** 動態代理物件：依照當前語言回傳對應字串 */
export const t: LocaleStrings = new Proxy(zh_TW, {
  get(_target, prop: string) {
    const strings = localeMap[currentLocale]
    return (strings as Record<string, unknown>)[prop]
  },
}) as LocaleStrings

export function getLocale(): Locale {
  return currentLocale
}

export function setLocale(locale: Locale): void {
  currentLocale = locale
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch { /* ignore */ }
}

export { AVAILABLE_LOCALES, LOCALE_LABELS }
export type { Locale }
