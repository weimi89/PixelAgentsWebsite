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

  // P5.3 — API Key 遮罩
  apiKeyMasked: (key: string) => `${key.slice(0, 3)}${'*'.repeat(Math.max(0, key.length - 7))}${key.slice(-4)}`,
  showFullApiKey: '顯示完整 Key',
  hideFullApiKey: '隱藏 Key',

  // P5.4 — 權限不足友善提示
  permissionMessages: {
    saveLayout: '需要管理員權限才能編輯佈局',
    closeAgent: '只能關閉自己的代理',
    addFloor: '只有管理員可以新增樓層',
    removeFloor: '只有管理員可以移除樓層',
    renameFloor: '只有管理員可以重新命名樓層',
    editLayout: '需要登入才能編輯佈局',
    moveAgent: '只能移動自己的代理',
    setTeam: '只能設定自己代理的團隊',
    default: '權限不足',
  } as Record<string, string>,

  // P5.5 — 新手引導提示
  guideBannerMessage: '登入以編輯佈局和管理代理',

  // 邀請碼管理
  inviteCode: '邀請碼',
  generateInvite: '生成邀請碼',
  revokeInvite: '撤銷',
  inviteExpired: '已過期',
  inviteUsed: '已使用',
  inviteActive: '有效',
  noInvites: '尚無邀請碼',
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

  // P5.3 — API Key masking
  apiKeyMasked: (key: string) => `${key.slice(0, 3)}${'*'.repeat(Math.max(0, key.length - 7))}${key.slice(-4)}`,
  showFullApiKey: 'Show Full Key',
  hideFullApiKey: 'Hide Key',

  // P5.4 — Permission denied toast
  permissionMessages: {
    saveLayout: 'Admin permission required to edit layout',
    closeAgent: 'Can only close your own agents',
    addFloor: 'Only admins can add floors',
    removeFloor: 'Only admins can remove floors',
    renameFloor: 'Only admins can rename floors',
    editLayout: 'Login required to edit layout',
    moveAgent: 'Can only move your own agents',
    setTeam: 'Can only set team for your own agents',
    default: 'Insufficient permissions',
  } as Record<string, string>,

  // P5.5 — Guide banner
  guideBannerMessage: 'Login to edit layouts and manage agents',

  // Invite code management
  inviteCode: 'Invite Codes',
  generateInvite: 'Generate',
  revokeInvite: 'Revoke',
  inviteExpired: 'Expired',
  inviteUsed: 'Used',
  inviteActive: 'Active',
  noInvites: 'No invite codes',
}

const zh_CN: LocaleStrings = {
  // 底部工具栏
  layout: '布局',
  editOfficeLayout: '编辑办公室布局',
  settings: '设置',

  // 缩放控制
  zoomIn: '放大 (Ctrl+滚轮)',
  zoomOut: '缩小 (Ctrl+滚轮)',
  zoomLevel: (n: number) => `${n}x`,

  // 设置面板
  exportLayout: '导出布局',
  importLayout: '导入布局',
  soundNotifications: '声音通知',
  soundWaiting: '等待提示音',
  soundPermission: '权限请求音',
  soundTurnComplete: '回合完成音',
  debugView: '调试视图',

  // 代理
  agent: (id: number) => `代理 #${id}`,
  closeAgent: '关闭代理',

  // Git 分支
  gitBranch: '分支',

  // 右键菜单
  contextGoToSeat: '回到座位',
  contextFollowCamera: '镜头跟随',
  contextMoveFloor: '移动到其他楼层',
  contextFocusParent: '聚焦父代理',

  // 状态
  needsApproval: '需要审批',
  idle: '空闲中',
  mightBeWaiting: '可能正在等待输入',

  // 编辑器工具栏
  floor: '地板',
  paintFloorTiles: '绘制地板方块',
  wall: '墙壁',
  paintWalls: '绘制墙壁（点击切换）',
  erase: '清除',
  eraseTilesToVoid: '清除方块为空白',
  furniture: '家具',
  placeFurniture: '放置家具',
  color: '颜色',
  adjustFloorColor: '调整地板颜色',
  adjustWallColor: '调整墙壁颜色',
  adjustFurnitureColor: '调整所选家具颜色',
  pick: '吸管',
  pickFloorPattern: '从现有方块取色',
  pickFurnitureType: '从已放置的家具取样',
  clearColor: '清除',
  removeColor: '移除颜色（恢复原始）',
  colorize: '着色',
  floorPattern: (index: number) => `地板 ${index}`,

  // 编辑操作栏
  undo: '撤销',
  undoShortcut: '撤销 (Ctrl+Z)',
  redo: '重做',
  redoShortcut: '重做 (Ctrl+Y)',
  save: '保存',
  saveLayout: '保存布局',
  reset: '重置',
  resetToLastSaved: '重置为上次保存的布局',
  resetConfirm: '确定重置？',
  yes: '是',
  no: '否',

  // 错误边界
  errorOccurred: '发生错误',
  retry: '重试',

  // 加载中
  loading: '加载中...',

  // 提示
  pressRToRotate: '按 <b>R</b> 旋转',

  // 模型
  unknownModel: '未知模型',

  // 已断开 (tmux)
  detached: '已断开',

  // 会话选择器
  sessions: '会话',
  browseSessions: '浏览过去的会话',
  noSessions: '未找到会话',
  resumeSession: '恢复',
  activeSession: '进行中',
  loadingSessions: '加载中...',
  sessionProject: '项目',
  searchSessions: '搜索会话...',
  noMatchingSessions: '没有符合的会话',

  // 项目排除
  hideProject: '隐藏',
  showProject: '显示',
  excludedProjects: '已隐藏的项目',
  noExcludedProjects: '无隐藏的项目',
  projectFolders: '项目文件夹',
  projectFoldersCount: (n: number) => `项目文件夹 (${n})`,

  // 连接状态
  disconnected: '已断开，重连中...',

  // 子任务
  subtask: '子任务',

  // 时间格式
  timeAgoSeconds: (n: number) => `${n} 秒前`,
  timeAgoMinutes: (n: number) => `${n} 分钟前`,
  timeAgoHours: (n: number) => `${n} 小时前`,
  timeAgoDays: (n: number) => `${n} 天前`,
  timeAgoMonths: (n: number) => `${n} 个月前`,

  // 布局模板
  layoutTemplates: '空间',
  loadTemplate: '应用',
  templateClassicOffice: '经典办公室',
  templateOpenPlan: '开放空间',
  templateCoworking: '共享工作室',
  templateMinimal: '简约小室',
  templateLShapeStudio: 'L 型工作室',
  templateConferenceCenter: '会议中心',
  templateMazeHall: '迷宫大厅',
  templateTwinWing: '双翼大楼',
  templateRingOffice: '环形办公室',
  templateCubicleFarm: '格子间',
  templateTerraced: '阶梯式',
  templateGrandPlaza: '大厅广场',
  templateConfirmLoad: '确定应用？布局将被覆盖。',
  templateTargetFloor: '应用到：',

  // 布局导入验证
  invalidLayoutFile: '无效的布局文件',
  parseLayoutFailed: '解析布局文件失败',

  // 楼层
  lobby: '大厅',
  addFloor: '新增楼层',
  removeFloor: '移除楼层',
  renameFloor: '重命名',

  // 远程代理
  remoteAgent: '远程',
  owner: '所有者',

  // 大楼面板
  building: '大楼',
  buildingPanel: '大楼面板',
  floorAgentCount: (n: number) => `${n} 个代理`,
  newFloorName: '新楼层',
  deleteFloorConfirm: '确定移除此楼层？',
  cannotDeleteLastFloor: '无法移除唯一的楼层',
  // 昼夜循环
  dayNightCycle: '昼夜循环',
  useRealTime: '使用真实时间',
  timeOverride: '时间覆盖',

  // 聊天
  chatPlaceholder: '输入消息...',
  chatSend: '发送',
  chat: '聊天',
  chatNickname: '昵称',

  // 会议
  meeting: '会议中',

  // 跨楼层
  elevator: '电梯',
  movingFloor: '移动楼层中',

  // 仪表板
  dashboard: '仪表板',
  officeView: '办公室',
  openDashboard: '在新标签页打开仪表板',
  totalAgents: '总代理数',
  activeAgents: '活跃代理',
  totalToolCalls: '工具调用数',
  toolDistribution: '工具使用分布',
  floorOverview: '楼层总览',
  agentList: '代理列表',
  project: '项目',
  status: '状态',
  tool: '工具',
  model: '模型',
  active: '活跃',
  inactive: '空闲',
  remote: '远程',
  noAgentsYet: '暂无代理',
  noToolData: '暂无工具数据',

  // 状态历史
  statusHistory: '状态历史',

  // 代理详情面板
  agentDetail: '代理详情',
  loginToSeeDetails: '请登录以查看详细信息',
  agentDetailInfo: '基本信息',
  agentDetailTools: '工具活动',
  agentDetailHistory: '状态历史',
  agentDetailClose: '关闭面板',
  agentDetailTimeline: '时间轴',
  agentDetailTranscript: '对话记录',
  workStartTime: '开始工作',
  workDuration: '工作时长',
  noTranscript: '暂无对话记录',
  noHistory: '暂无历史记录',

  // UI 缩放
  uiScale: 'UI 缩放',

  // 像素文本
  pixelText: '像素文本',
  pixelTextPlaceholder: '输入文本...',
  pixelTextLabel: '文本',
  // 团队
  team: '团队',
  setTeam: '设置团队',
  noTeam: '无团队',
  teamName: '团队名称',

  // CLI 类型
  cliType: 'CLI 类型',
  cliClaude: 'Claude',
  cliCodex: 'Codex',
  cliGemini: 'Gemini',

  // 局域网发现
  lanDiscovery: '局域网发现',
  lanDiscoveryEnabled: '启用局域网发现',
  lanPeerName: '显示名称',
  lanPeers: '局域网同伴',
  lanNoPeers: '尚未发现其他实例',
  lanAgentCount: '个代理',

  // 终端
  terminal: '终端',
  openTerminal: '打开终端',
  terminalCloseTab: '关闭此标签',
  terminalClosePanel: '关闭终端面板',
  terminalSelectTab: '选择一个标签',
  terminalError: '终端错误',
  terminalConnectionError: '终端连接失败',
  terminalDisconnected: '终端已断开',
  terminalExited: '终端已结束',
  terminalNoTmux: '此代理没有 tmux 会话',

  // 移动设备
  touchEditHint: '单指绘制/放置 | 双指缩放平移',
  doubleTapZoom: '双击缩放',

  // 行为编辑器
  behavior: '行为',
  behaviorEditor: '行为参数编辑',
  behaviorWeights: '漫游行为权重',
  behaviorTiming: '时间参数',
  behaviorWeightIdleLook: '站着看看',
  behaviorWeightRandom: '随机漫游',
  behaviorWeightFurniture: '家具互动',
  behaviorWeightChat: '聊天',
  behaviorWeightWall: '墙壁互动',
  behaviorWeightMeeting: '会议',
  behaviorWeightReturnSeat: '回座位',
  behaviorWanderPause: '漫游暂停',
  behaviorSeatRest: '座位休息',
  behaviorSleepTrigger: '睡眠触发',
  behaviorStretchTrigger: '伸展触发',
  behaviorChatDuration: '聊天时长',
  behaviorFurnitureCooldown: '家具冷却',
  behaviorWeightTotal: (n: number) => `权重总和：${n}`,
  behaviorResetDefaults: '恢复默认',
  behaviorSeconds: (n: number) => `${n}s`,
  behaviorMinMax: (label: string) => `${label}（最小/最大）`,

  // 成长系统
  growthLevel: (n: number) => `Lv.${n}`,
  growthXp: (n: number) => `${n} XP`,
  growthSection: '成长',
  achievementNames: {
    first_tool: '首次调用',
    ten_tools: '十次调用',
    hundred_tools: '百次调用',
    thousand_tools: '千次调用',
    level_5: '等级 5',
    level_10: '等级 10',
    level_25: '等级 25',
    level_50: '等级 50',
    five_sessions: '老手',
    bash_user: '命令行高手',
  } as Record<string, string>,

  // 录制/回放
  recording: '录制',
  stopRecording: '停止录制',
  recordingList: '录制列表',
  noRecordings: '没有录制',
  playRecording: '播放',
  deleteRecording: '删除',
  exportRecording: '导出',
  importRecording: '导入',
  recordingDuration: (n: number) => `${n.toFixed(1)}s`,
  recordingFrames: (n: number) => `${n} 帧`,
  playback: '回放中',
  stopPlayback: '停止',
  recordingName: '名称',
  importRecordingFailed: '导入录制失败',

  // 认证 / 密码
  login: '登录',
  logout: '登出',
  register: '注册',
  username: '账号',
  password: '密码',
  apiKeyLogin: 'API Key 登录',
  accountLogin: '账号登录',
  loginFailed: '登录失败',
  registerFailed: '注册失败',
  noAccountYet: '还没有账号？',
  firstTimeHint: '首次使用？默认管理员账号 admin，密码 admin',
  apiKeyLabel: 'API Key',
  apiKeyCopied: '已复制',
  apiKeyRegenerate: '重新生成',
  apiKeyRegenerateConfirm: '重新生成后旧的 API Key 将立即失效，确定吗？',
  apiKeyShowOnce: '请保存您的 API Key，此界面关闭后无法再次显示',
  viewApiKey: '查看 API Key',
  pasteApiKey: '粘贴您的 API Key',
  changePassword: '更改密码',
  currentPassword: '当前密码',
  newPassword: '新密码',
  confirmPassword: '确认密码',
  passwordChanged: '密码已更改',
  passwordMismatch: '密码不一致',
  passwordRequirements: '至少 8 字符，含大小写字母及数字',
  forceChangePassword: '请先更改默认密码',

  // 角色 / 用户管理
  roleAdmin: '管理员',
  roleViewer: '观察者',
  roleMember: '成员',
  userManagement: '用户管理',
  noPermission: '权限不足',
  deleteUser: '删除用户',
  changeRole: '更改角色',

  // 用户管理
  userManagementPanel: '用户管理',
  userListTitle: '用户列表',
  userUsername: '用户名',
  userRole: '角色',
  userCreatedAt: '创建时间',
  userActions: '操作',
  userDeleteConfirm: (name: string) => `确定要删除用户「${name}」吗？其专属楼层将转为公共楼层。`,
  userRoleUpdated: '角色已更新',
  userDeleted: '用户已删除',
  userLoadFailed: '无法加载用户列表',
  noUsers: '没有用户',
  resetApiKey: '重置 API Key',
  resetApiKeyConfirm: (name: string) => `确定要重置「${name}」的 API Key 吗？旧的 Key 将立即失效。`,
  resetApiKeySuccess: 'API Key 已重置',
  showApiKey: '显示',
  hideApiKey: '隐藏',
  userApiKey: 'API Key',

  // 远程节点健康
  remoteNodes: '远程节点',
  nodeLatency: '延迟',
  nodeConnectedTime: '连接时间',
  nodeActiveSessions: '活跃代理',
  noRemoteNodes: '目前没有连接的远程节点',
  latencyGood: '良好',
  latencyFair: '普通',
  latencyPoor: '较差',
  nodeHealth: '节点状态',

  // 成就系统 UI
  achievements: '成就',
  achievementUnlocked: '解锁成就',
  allAchievements: '所有成就',
  locked: '未解锁',

  // 团队系统
  teams: '团队',
  allTeams: '所有团队',
  teamMembers: '成员',
  filterByTeam: '按团队筛选',

  // 布局分享
  shareLayout: '分享布局',
  copyToClipboard: '复制到剪贴板',
  pasteFromClipboard: '从剪贴板粘贴',
  copied: '已复制',

  // 多语言 & 主题
  language: '语言',
  theme: '主题',
  darkTheme: '深色',
  lightTheme: '浅色',

  // 家具计数
  furnitureCount: (n: number) => `${n} 个素材`,

  // 楼层权限
  permissionDenied: '权限不足',
  cannotEditOthersFloor: '无法编辑他人的楼层',
  floorNameAlreadyExists: '楼层名称已被使用',
  personalFloor: '个人楼层',
  publicFloor: '公共楼层',

  // API Key 遮罩
  apiKeyMasked: (key: string) => `${key.slice(0, 3)}${'*'.repeat(Math.max(0, key.length - 7))}${key.slice(-4)}`,
  showFullApiKey: '显示完整 Key',
  hideFullApiKey: '隐藏 Key',

  // 权限不足友善提示
  permissionMessages: {
    saveLayout: '需要管理员权限才能编辑布局',
    closeAgent: '只能关闭自己的代理',
    addFloor: '只有管理员可以新增楼层',
    removeFloor: '只有管理员可以移除楼层',
    renameFloor: '只有管理员可以重命名楼层',
    editLayout: '需要登录才能编辑布局',
    moveAgent: '只能移动自己的代理',
    setTeam: '只能设置自己代理的团队',
    default: '权限不足',
  } as Record<string, string>,

  // 新手引导提示
  guideBannerMessage: '登录以编辑布局和管理代理',

  // 邀请码管理
  inviteCode: '邀请码',
  generateInvite: '生成邀请码',
  revokeInvite: '撤销',
  inviteExpired: '已过期',
  inviteUsed: '已使用',
  inviteActive: '有效',
  noInvites: '暂无邀请码',
}

const ja_JP: LocaleStrings = {
  // ボトムツールバー
  layout: 'レイアウト',
  editOfficeLayout: 'オフィスレイアウト編集',
  settings: '設定',

  // ズーム
  zoomIn: 'ズームイン (Ctrl+ホイール)',
  zoomOut: 'ズームアウト (Ctrl+ホイール)',
  zoomLevel: (n: number) => `${n}x`,

  // 設定パネル
  exportLayout: 'レイアウトをエクスポート',
  importLayout: 'レイアウトをインポート',
  soundNotifications: '通知音',
  soundWaiting: '待機通知音',
  soundPermission: '権限要求音',
  soundTurnComplete: 'ターン完了音',
  debugView: 'デバッグビュー',

  // エージェント
  agent: (id: number) => `エージェント #${id}`,
  closeAgent: 'エージェントを閉じる',

  // Git ブランチ
  gitBranch: 'ブランチ',

  // コンテキストメニュー
  contextGoToSeat: '席に戻る',
  contextFollowCamera: 'カメラ追従',
  contextMoveFloor: '他のフロアへ移動',
  contextFocusParent: '親エージェントを表示',

  // 状態
  needsApproval: '承認待ち',
  idle: 'アイドル',
  mightBeWaiting: '入力待ちの可能性',

  // エディタツールバー
  floor: '床',
  paintFloorTiles: '床タイルを塗る',
  wall: '壁',
  paintWalls: '壁を塗る（クリックで切替）',
  erase: '消去',
  eraseTilesToVoid: 'タイルを空白に',
  furniture: '家具',
  placeFurniture: '家具を配置',
  color: '色',
  adjustFloorColor: '床の色を調整',
  adjustWallColor: '壁の色を調整',
  adjustFurnitureColor: '選択家具の色を調整',
  pick: 'スポイト',
  pickFloorPattern: '既存タイルから取色',
  pickFurnitureType: '配置済み家具から取得',
  clearColor: 'クリア',
  removeColor: '色を削除（元に戻す）',
  colorize: '着色',
  floorPattern: (index: number) => `床 ${index}`,

  // 編集アクション
  undo: '元に戻す',
  undoShortcut: '元に戻す (Ctrl+Z)',
  redo: 'やり直し',
  redoShortcut: 'やり直し (Ctrl+Y)',
  save: '保存',
  saveLayout: 'レイアウトを保存',
  reset: 'リセット',
  resetToLastSaved: '最終保存のレイアウトに戻す',
  resetConfirm: 'リセットしますか？',
  yes: 'はい',
  no: 'いいえ',

  // エラーバウンダリ
  errorOccurred: 'エラーが発生しました',
  retry: '再試行',

  // 読み込み
  loading: '読み込み中...',

  // ヒント
  pressRToRotate: '<b>R</b> で回転',

  // モデル
  unknownModel: '不明なモデル',

  // 切断 (tmux)
  detached: '切断済み',

  // セッションピッカー
  sessions: 'セッション',
  browseSessions: '過去のセッションを表示',
  noSessions: 'セッションが見つかりません',
  resumeSession: '再開',
  activeSession: 'アクティブ',
  loadingSessions: '読み込み中...',
  sessionProject: 'プロジェクト',
  searchSessions: 'セッション検索...',
  noMatchingSessions: '一致するセッションなし',

  // プロジェクト除外
  hideProject: '非表示',
  showProject: '表示',
  excludedProjects: '非表示プロジェクト',
  noExcludedProjects: '非表示プロジェクトなし',
  projectFolders: 'プロジェクトフォルダ',
  projectFoldersCount: (n: number) => `プロジェクトフォルダ (${n})`,

  // 接続状態
  disconnected: '切断。再接続中...',

  // サブタスク
  subtask: 'サブタスク',

  // 時間形式
  timeAgoSeconds: (n: number) => `${n}秒前`,
  timeAgoMinutes: (n: number) => `${n}分前`,
  timeAgoHours: (n: number) => `${n}時間前`,
  timeAgoDays: (n: number) => `${n}日前`,
  timeAgoMonths: (n: number) => `${n}ヶ月前`,

  // レイアウトテンプレート
  layoutTemplates: 'スペース',
  loadTemplate: '適用',
  templateClassicOffice: 'クラシックオフィス',
  templateOpenPlan: 'オープンスペース',
  templateCoworking: 'コワーキング',
  templateMinimal: 'ミニマル',
  templateLShapeStudio: 'L字スタジオ',
  templateConferenceCenter: '会議センター',
  templateMazeHall: '迷路ホール',
  templateTwinWing: 'ツインウィング',
  templateRingOffice: 'リング型オフィス',
  templateCubicleFarm: 'キュービクル',
  templateTerraced: '段々',
  templateGrandPlaza: 'グランドプラザ',
  templateConfirmLoad: '適用しますか？レイアウトは上書きされます。',
  templateTargetFloor: '適用先:',

  // レイアウトインポート検証
  invalidLayoutFile: '無効なレイアウトファイル',
  parseLayoutFailed: 'レイアウトファイルの解析失敗',

  // フロア
  lobby: 'ロビー',
  addFloor: 'フロア追加',
  removeFloor: 'フロア削除',
  renameFloor: '名前変更',

  // リモートエージェント
  remoteAgent: 'リモート',
  owner: '所有者',

  // ビルパネル
  building: 'ビル',
  buildingPanel: 'ビルパネル',
  floorAgentCount: (n: number) => `${n} エージェント`,
  newFloorName: '新しいフロア',
  deleteFloorConfirm: 'このフロアを削除しますか？',
  cannotDeleteLastFloor: '最後のフロアは削除できません',
  // 昼夜サイクル
  dayNightCycle: '昼夜サイクル',
  useRealTime: '実時間を使用',
  timeOverride: '時間上書き',

  // チャット
  chatPlaceholder: 'メッセージを入力...',
  chatSend: '送信',
  chat: 'チャット',
  chatNickname: 'ニックネーム',

  // 会議
  meeting: '会議中',

  // クロスフロア
  elevator: 'エレベーター',
  movingFloor: 'フロア移動中',

  // ダッシュボード
  dashboard: 'ダッシュボード',
  officeView: 'オフィス',
  openDashboard: '新しいタブでダッシュボードを開く',
  totalAgents: '総エージェント数',
  activeAgents: 'アクティブエージェント',
  totalToolCalls: 'ツール呼出数',
  toolDistribution: 'ツール使用分布',
  floorOverview: 'フロア概要',
  agentList: 'エージェント一覧',
  project: 'プロジェクト',
  status: '状態',
  tool: 'ツール',
  model: 'モデル',
  active: 'アクティブ',
  inactive: 'アイドル',
  remote: 'リモート',
  noAgentsYet: 'エージェントなし',
  noToolData: 'ツールデータなし',

  // 状態履歴
  statusHistory: '状態履歴',

  // エージェント詳細
  agentDetail: 'エージェント詳細',
  loginToSeeDetails: '詳細を見るにはログイン',
  agentDetailInfo: '基本情報',
  agentDetailTools: 'ツール活動',
  agentDetailHistory: '状態履歴',
  agentDetailClose: 'パネルを閉じる',
  agentDetailTimeline: 'タイムライン',
  agentDetailTranscript: 'トランスクリプト',
  workStartTime: '開始時刻',
  workDuration: '作業時間',
  noTranscript: 'トランスクリプトなし',
  noHistory: '履歴なし',

  // UI スケール
  uiScale: 'UI スケール',

  // ピクセル文字
  pixelText: 'ピクセル文字',
  pixelTextPlaceholder: '文字を入力...',
  pixelTextLabel: 'テキスト',
  // チーム
  team: 'チーム',
  setTeam: 'チーム設定',
  noTeam: 'チームなし',
  teamName: 'チーム名',

  // CLI タイプ
  cliType: 'CLI タイプ',
  cliClaude: 'Claude',
  cliCodex: 'Codex',
  cliGemini: 'Gemini',

  // LAN 検出
  lanDiscovery: 'LAN 検出',
  lanDiscoveryEnabled: 'LAN 検出を有効化',
  lanPeerName: '表示名',
  lanPeers: 'LAN ピア',
  lanNoPeers: '他のインスタンスが見つかりません',
  lanAgentCount: 'エージェント',

  // ターミナル
  terminal: 'ターミナル',
  openTerminal: 'ターミナルを開く',
  terminalCloseTab: 'このタブを閉じる',
  terminalClosePanel: 'ターミナルパネルを閉じる',
  terminalSelectTab: 'タブを選択',
  terminalError: 'ターミナルエラー',
  terminalConnectionError: 'ターミナル接続失敗',
  terminalDisconnected: 'ターミナル切断',
  terminalExited: 'ターミナル終了',
  terminalNoTmux: 'このエージェントに tmux セッションなし',

  // モバイル
  touchEditHint: '1本指: 描画/配置 | 2本指: ズーム/パン',
  doubleTapZoom: 'ダブルタップでズーム',

  // 動作エディタ
  behavior: '動作',
  behaviorEditor: '動作パラメータ編集',
  behaviorWeights: 'ウォンダー動作の重み',
  behaviorTiming: 'タイミング',
  behaviorWeightIdleLook: '立って眺める',
  behaviorWeightRandom: 'ランダム移動',
  behaviorWeightFurniture: '家具と対話',
  behaviorWeightChat: 'チャット',
  behaviorWeightWall: '壁と対話',
  behaviorWeightMeeting: '会議',
  behaviorWeightReturnSeat: '席に戻る',
  behaviorWanderPause: '移動間隔',
  behaviorSeatRest: '席で休憩',
  behaviorSleepTrigger: '睡眠トリガー',
  behaviorStretchTrigger: 'ストレッチトリガー',
  behaviorChatDuration: 'チャット時間',
  behaviorFurnitureCooldown: '家具クールダウン',
  behaviorWeightTotal: (n: number) => `重み合計: ${n}`,
  behaviorResetDefaults: 'デフォルトに戻す',
  behaviorSeconds: (n: number) => `${n}s`,
  behaviorMinMax: (label: string) => `${label} (最小/最大)`,

  // 成長システム
  growthLevel: (n: number) => `Lv.${n}`,
  growthXp: (n: number) => `${n} XP`,
  growthSection: '成長',
  achievementNames: {
    first_tool: '初回呼出',
    ten_tools: '10連呼出',
    hundred_tools: '100回呼出',
    thousand_tools: '1000回呼出',
    level_5: 'レベル 5',
    level_10: 'レベル 10',
    level_25: 'レベル 25',
    level_50: 'レベル 50',
    five_sessions: 'ベテラン',
    bash_user: 'CLIマスター',
  } as Record<string, string>,

  // 録画/再生
  recording: '録画',
  stopRecording: '録画停止',
  recordingList: '録画一覧',
  noRecordings: '録画なし',
  playRecording: '再生',
  deleteRecording: '削除',
  exportRecording: 'エクスポート',
  importRecording: 'インポート',
  recordingDuration: (n: number) => `${n.toFixed(1)}s`,
  recordingFrames: (n: number) => `${n} フレーム`,
  playback: '再生中',
  stopPlayback: '停止',
  recordingName: '名前',
  importRecordingFailed: '録画インポート失敗',

  // 認証 / パスワード
  login: 'ログイン',
  logout: 'ログアウト',
  register: '登録',
  username: 'アカウント',
  password: 'パスワード',
  apiKeyLogin: 'API Key ログイン',
  accountLogin: 'アカウントでログイン',
  loginFailed: 'ログイン失敗',
  registerFailed: '登録失敗',
  noAccountYet: 'アカウントがない？',
  firstTimeHint: '初回利用？初期管理者 admin、パスワード admin',
  apiKeyLabel: 'API Key',
  apiKeyCopied: 'コピー済み',
  apiKeyRegenerate: '再生成',
  apiKeyRegenerateConfirm: '再生成すると古い API Key は即時無効化されます。続行しますか？',
  apiKeyShowOnce: 'API Key を保存してください。この画面を閉じると再表示されません。',
  viewApiKey: 'API Key を表示',
  pasteApiKey: 'API Key を貼り付け',
  changePassword: 'パスワード変更',
  currentPassword: '現在のパスワード',
  newPassword: '新しいパスワード',
  confirmPassword: 'パスワード確認',
  passwordChanged: 'パスワードを変更しました',
  passwordMismatch: 'パスワードが一致しません',
  passwordRequirements: '8文字以上、大文字小文字と数字を含む',
  forceChangePassword: '初期パスワードの変更が必要です',

  // ロール / ユーザー管理
  roleAdmin: '管理者',
  roleViewer: 'オブザーバー',
  roleMember: 'メンバー',
  userManagement: 'ユーザー管理',
  noPermission: '権限不足',
  deleteUser: 'ユーザー削除',
  changeRole: 'ロール変更',

  // ユーザー管理
  userManagementPanel: 'ユーザー管理',
  userListTitle: 'ユーザー一覧',
  userUsername: 'ユーザー名',
  userRole: 'ロール',
  userCreatedAt: '作成日時',
  userActions: '操作',
  userDeleteConfirm: (name: string) => `ユーザー「${name}」を削除しますか？個人フロアは公開フロアになります。`,
  userRoleUpdated: 'ロールを更新しました',
  userDeleted: 'ユーザーを削除しました',
  userLoadFailed: 'ユーザー一覧を読み込めません',
  noUsers: 'ユーザーなし',
  resetApiKey: 'API Key リセット',
  resetApiKeyConfirm: (name: string) => `「${name}」の API Key をリセットしますか？古い Key は即時無効化されます。`,
  resetApiKeySuccess: 'API Key をリセットしました',
  showApiKey: '表示',
  hideApiKey: '非表示',
  userApiKey: 'API Key',

  // リモートノード
  remoteNodes: 'リモートノード',
  nodeLatency: 'レイテンシ',
  nodeConnectedTime: '接続時間',
  nodeActiveSessions: 'アクティブエージェント',
  noRemoteNodes: '接続中のリモートノードなし',
  latencyGood: '良好',
  latencyFair: '普通',
  latencyPoor: '不良',
  nodeHealth: 'ノード状態',

  // 実績
  achievements: '実績',
  achievementUnlocked: '実績解除',
  allAchievements: 'すべての実績',
  locked: 'ロック中',

  // チーム
  teams: 'チーム',
  allTeams: 'すべてのチーム',
  teamMembers: 'メンバー',
  filterByTeam: 'チームで絞り込み',

  // レイアウト共有
  shareLayout: 'レイアウト共有',
  copyToClipboard: 'クリップボードにコピー',
  pasteFromClipboard: 'クリップボードから貼付け',
  copied: 'コピー済み',

  // 言語 & テーマ
  language: '言語',
  theme: 'テーマ',
  darkTheme: 'ダーク',
  lightTheme: 'ライト',

  // 家具数
  furnitureCount: (n: number) => `${n} 個のアセット`,

  // フロア権限
  permissionDenied: '権限不足',
  cannotEditOthersFloor: '他のユーザーのフロアは編集不可',
  floorNameAlreadyExists: 'このフロア名は使用中',
  personalFloor: '個人フロア',
  publicFloor: '公開フロア',

  // API Key マスク
  apiKeyMasked: (key: string) => `${key.slice(0, 3)}${'*'.repeat(Math.max(0, key.length - 7))}${key.slice(-4)}`,
  showFullApiKey: '完全な Key を表示',
  hideFullApiKey: 'Key を非表示',

  // 権限不足
  permissionMessages: {
    saveLayout: 'レイアウト編集には管理者権限が必要',
    closeAgent: '自分のエージェントのみ閉じられます',
    addFloor: '管理者のみフロアを追加可能',
    removeFloor: '管理者のみフロアを削除可能',
    renameFloor: '管理者のみフロア名を変更可能',
    editLayout: 'レイアウト編集にはログインが必要',
    moveAgent: '自分のエージェントのみ移動可能',
    setTeam: '自分のエージェントのチームのみ設定可能',
    default: '権限不足',
  } as Record<string, string>,

  // ガイドバナー
  guideBannerMessage: 'ログインしてレイアウト編集とエージェント管理',

  // 招待コード
  inviteCode: '招待コード',
  generateInvite: '招待コード生成',
  revokeInvite: '取消',
  inviteExpired: '期限切れ',
  inviteUsed: '使用済み',
  inviteActive: '有効',
  noInvites: '招待コードなし',
}

const ko_KR: LocaleStrings = {
  // 하단 툴바
  layout: '레이아웃',
  editOfficeLayout: '사무실 레이아웃 편집',
  settings: '설정',

  // 확대/축소
  zoomIn: '확대 (Ctrl+스크롤)',
  zoomOut: '축소 (Ctrl+스크롤)',
  zoomLevel: (n: number) => `${n}x`,

  // 설정 패널
  exportLayout: '레이아웃 내보내기',
  importLayout: '레이아웃 가져오기',
  soundNotifications: '알림음',
  soundWaiting: '대기 알림음',
  soundPermission: '권한 요청음',
  soundTurnComplete: '턴 완료음',
  debugView: '디버그 보기',

  // 에이전트
  agent: (id: number) => `에이전트 #${id}`,
  closeAgent: '에이전트 닫기',

  // Git 브랜치
  gitBranch: '브랜치',

  // 컨텍스트 메뉴
  contextGoToSeat: '자리로 이동',
  contextFollowCamera: '카메라 추적',
  contextMoveFloor: '다른 층으로 이동',
  contextFocusParent: '부모 에이전트에 포커스',

  // 상태
  needsApproval: '승인 필요',
  idle: '대기 중',
  mightBeWaiting: '입력 대기 중일 수 있음',

  // 에디터 툴바
  floor: '바닥',
  paintFloorTiles: '바닥 타일 그리기',
  wall: '벽',
  paintWalls: '벽 그리기 (클릭으로 전환)',
  erase: '지우기',
  eraseTilesToVoid: '타일을 빈 공간으로 지우기',
  furniture: '가구',
  placeFurniture: '가구 배치',
  color: '색상',
  adjustFloorColor: '바닥 색상 조정',
  adjustWallColor: '벽 색상 조정',
  adjustFurnitureColor: '선택 가구 색상 조정',
  pick: '스포이트',
  pickFloorPattern: '기존 타일에서 색상 가져오기',
  pickFurnitureType: '배치된 가구에서 가져오기',
  clearColor: '지우기',
  removeColor: '색상 제거 (원본 복원)',
  colorize: '색 입히기',
  floorPattern: (index: number) => `바닥 ${index}`,

  // 편집 액션바
  undo: '실행 취소',
  undoShortcut: '실행 취소 (Ctrl+Z)',
  redo: '다시 실행',
  redoShortcut: '다시 실행 (Ctrl+Y)',
  save: '저장',
  saveLayout: '레이아웃 저장',
  reset: '초기화',
  resetToLastSaved: '마지막 저장된 레이아웃으로 초기화',
  resetConfirm: '초기화하시겠습니까?',
  yes: '예',
  no: '아니오',

  // 에러 바운더리
  errorOccurred: '오류가 발생했습니다',
  retry: '다시 시도',

  // 로딩
  loading: '로딩 중...',

  // 힌트
  pressRToRotate: '<b>R</b> 키로 회전',

  // 모델
  unknownModel: '알 수 없는 모델',

  // 분리됨 (tmux)
  detached: '분리됨',

  // 세션 선택기
  sessions: '세션',
  browseSessions: '과거 세션 보기',
  noSessions: '세션을 찾을 수 없음',
  resumeSession: '재개',
  activeSession: '활성',
  loadingSessions: '로딩 중...',
  sessionProject: '프로젝트',
  searchSessions: '세션 검색...',
  noMatchingSessions: '일치하는 세션 없음',

  // 프로젝트 제외
  hideProject: '숨기기',
  showProject: '표시',
  excludedProjects: '숨겨진 프로젝트',
  noExcludedProjects: '숨겨진 프로젝트 없음',
  projectFolders: '프로젝트 폴더',
  projectFoldersCount: (n: number) => `프로젝트 폴더 (${n})`,

  // 연결 상태
  disconnected: '연결 끊김, 재연결 중...',

  // 하위 작업
  subtask: '하위 작업',

  // 시간 형식
  timeAgoSeconds: (n: number) => `${n}초 전`,
  timeAgoMinutes: (n: number) => `${n}분 전`,
  timeAgoHours: (n: number) => `${n}시간 전`,
  timeAgoDays: (n: number) => `${n}일 전`,
  timeAgoMonths: (n: number) => `${n}개월 전`,

  // 레이아웃 템플릿
  layoutTemplates: '스페이스',
  loadTemplate: '적용',
  templateClassicOffice: '클래식 오피스',
  templateOpenPlan: '오픈 플랜',
  templateCoworking: '공유 오피스',
  templateMinimal: '미니멀',
  templateLShapeStudio: 'L자 스튜디오',
  templateConferenceCenter: '컨퍼런스 센터',
  templateMazeHall: '미로 홀',
  templateTwinWing: '트윈 윙',
  templateRingOffice: '원형 오피스',
  templateCubicleFarm: '큐비클',
  templateTerraced: '계단식',
  templateGrandPlaza: '그랜드 플라자',
  templateConfirmLoad: '적용하시겠습니까? 레이아웃이 덮어쓰기됩니다.',
  templateTargetFloor: '적용 대상:',

  // 레이아웃 가져오기 검증
  invalidLayoutFile: '잘못된 레이아웃 파일',
  parseLayoutFailed: '레이아웃 파일 파싱 실패',

  // 층
  lobby: '로비',
  addFloor: '층 추가',
  removeFloor: '층 삭제',
  renameFloor: '이름 변경',

  // 원격 에이전트
  remoteAgent: '원격',
  owner: '소유자',

  // 빌딩 패널
  building: '빌딩',
  buildingPanel: '빌딩 패널',
  floorAgentCount: (n: number) => `${n}개 에이전트`,
  newFloorName: '새 층',
  deleteFloorConfirm: '이 층을 삭제하시겠습니까?',
  cannotDeleteLastFloor: '마지막 층은 삭제할 수 없음',
  // 주야 주기
  dayNightCycle: '주야 주기',
  useRealTime: '실시간 사용',
  timeOverride: '시간 재정의',

  // 채팅
  chatPlaceholder: '메시지 입력...',
  chatSend: '전송',
  chat: '채팅',
  chatNickname: '닉네임',

  // 회의
  meeting: '회의 중',

  // 층 간
  elevator: '엘리베이터',
  movingFloor: '층 이동 중',

  // 대시보드
  dashboard: '대시보드',
  officeView: '오피스',
  openDashboard: '새 탭에서 대시보드 열기',
  totalAgents: '전체 에이전트',
  activeAgents: '활성 에이전트',
  totalToolCalls: '도구 호출',
  toolDistribution: '도구 사용 분포',
  floorOverview: '층 개요',
  agentList: '에이전트 목록',
  project: '프로젝트',
  status: '상태',
  tool: '도구',
  model: '모델',
  active: '활성',
  inactive: '대기',
  remote: '원격',
  noAgentsYet: '에이전트 없음',
  noToolData: '도구 데이터 없음',

  // 상태 기록
  statusHistory: '상태 기록',

  // 에이전트 상세
  agentDetail: '에이전트 상세',
  loginToSeeDetails: '자세히 보려면 로그인',
  agentDetailInfo: '기본 정보',
  agentDetailTools: '도구 활동',
  agentDetailHistory: '상태 기록',
  agentDetailClose: '패널 닫기',
  agentDetailTimeline: '타임라인',
  agentDetailTranscript: '트랜스크립트',
  workStartTime: '시작 시각',
  workDuration: '작업 시간',
  noTranscript: '트랜스크립트 없음',
  noHistory: '기록 없음',

  // UI 크기
  uiScale: 'UI 크기',

  // 픽셀 텍스트
  pixelText: '픽셀 텍스트',
  pixelTextPlaceholder: '텍스트 입력...',
  pixelTextLabel: '텍스트',
  // 팀
  team: '팀',
  setTeam: '팀 설정',
  noTeam: '팀 없음',
  teamName: '팀 이름',

  // CLI 유형
  cliType: 'CLI 유형',
  cliClaude: 'Claude',
  cliCodex: 'Codex',
  cliGemini: 'Gemini',

  // LAN 검색
  lanDiscovery: 'LAN 검색',
  lanDiscoveryEnabled: 'LAN 검색 활성화',
  lanPeerName: '표시 이름',
  lanPeers: 'LAN 피어',
  lanNoPeers: '다른 인스턴스 없음',
  lanAgentCount: '에이전트',

  // 터미널
  terminal: '터미널',
  openTerminal: '터미널 열기',
  terminalCloseTab: '이 탭 닫기',
  terminalClosePanel: '터미널 패널 닫기',
  terminalSelectTab: '탭을 선택',
  terminalError: '터미널 오류',
  terminalConnectionError: '터미널 연결 실패',
  terminalDisconnected: '터미널 연결 끊김',
  terminalExited: '터미널 종료됨',
  terminalNoTmux: '이 에이전트에 tmux 세션 없음',

  // 모바일
  touchEditHint: '한 손가락: 그리기/배치 | 두 손가락: 줌/이동',
  doubleTapZoom: '더블 탭으로 줌',

  // 동작 편집기
  behavior: '동작',
  behaviorEditor: '동작 파라미터 편집',
  behaviorWeights: '방황 동작 가중치',
  behaviorTiming: '타이밍 파라미터',
  behaviorWeightIdleLook: '서서 보기',
  behaviorWeightRandom: '랜덤 이동',
  behaviorWeightFurniture: '가구 상호작용',
  behaviorWeightChat: '채팅',
  behaviorWeightWall: '벽 상호작용',
  behaviorWeightMeeting: '회의',
  behaviorWeightReturnSeat: '자리로 복귀',
  behaviorWanderPause: '방황 간격',
  behaviorSeatRest: '자리에서 휴식',
  behaviorSleepTrigger: '수면 트리거',
  behaviorStretchTrigger: '스트레칭 트리거',
  behaviorChatDuration: '채팅 시간',
  behaviorFurnitureCooldown: '가구 쿨다운',
  behaviorWeightTotal: (n: number) => `가중치 합계: ${n}`,
  behaviorResetDefaults: '기본값 복원',
  behaviorSeconds: (n: number) => `${n}s`,
  behaviorMinMax: (label: string) => `${label} (최소/최대)`,

  // 성장 시스템
  growthLevel: (n: number) => `Lv.${n}`,
  growthXp: (n: number) => `${n} XP`,
  growthSection: '성장',
  achievementNames: {
    first_tool: '첫 호출',
    ten_tools: '10회 호출',
    hundred_tools: '100회 호출',
    thousand_tools: '1000회 호출',
    level_5: '레벨 5',
    level_10: '레벨 10',
    level_25: '레벨 25',
    level_50: '레벨 50',
    five_sessions: '베테랑',
    bash_user: 'CLI 마스터',
  } as Record<string, string>,

  // 녹화/재생
  recording: '녹화',
  stopRecording: '녹화 중지',
  recordingList: '녹화 목록',
  noRecordings: '녹화 없음',
  playRecording: '재생',
  deleteRecording: '삭제',
  exportRecording: '내보내기',
  importRecording: '가져오기',
  recordingDuration: (n: number) => `${n.toFixed(1)}s`,
  recordingFrames: (n: number) => `${n} 프레임`,
  playback: '재생 중',
  stopPlayback: '중지',
  recordingName: '이름',
  importRecordingFailed: '녹화 가져오기 실패',

  // 인증 / 비밀번호
  login: '로그인',
  logout: '로그아웃',
  register: '가입',
  username: '계정',
  password: '비밀번호',
  apiKeyLogin: 'API Key 로그인',
  accountLogin: '계정 로그인',
  loginFailed: '로그인 실패',
  registerFailed: '가입 실패',
  noAccountYet: '계정이 없나요?',
  firstTimeHint: '첫 사용? 기본 관리자 계정 admin, 비밀번호 admin',
  apiKeyLabel: 'API Key',
  apiKeyCopied: '복사됨',
  apiKeyRegenerate: '재생성',
  apiKeyRegenerateConfirm: '재생성 시 기존 API Key는 즉시 무효화됩니다. 진행하시겠습니까?',
  apiKeyShowOnce: 'API Key를 저장하세요. 화면을 닫으면 다시 표시되지 않습니다.',
  viewApiKey: 'API Key 보기',
  pasteApiKey: 'API Key 붙여넣기',
  changePassword: '비밀번호 변경',
  currentPassword: '현재 비밀번호',
  newPassword: '새 비밀번호',
  confirmPassword: '비밀번호 확인',
  passwordChanged: '비밀번호가 변경되었습니다',
  passwordMismatch: '비밀번호가 일치하지 않습니다',
  passwordRequirements: '8자 이상, 대소문자와 숫자 포함',
  forceChangePassword: '기본 비밀번호를 먼저 변경하세요',

  // 역할 / 사용자 관리
  roleAdmin: '관리자',
  roleViewer: '관찰자',
  roleMember: '멤버',
  userManagement: '사용자 관리',
  noPermission: '권한 부족',
  deleteUser: '사용자 삭제',
  changeRole: '역할 변경',

  // 사용자 관리
  userManagementPanel: '사용자 관리',
  userListTitle: '사용자 목록',
  userUsername: '사용자명',
  userRole: '역할',
  userCreatedAt: '생성 시각',
  userActions: '작업',
  userDeleteConfirm: (name: string) => `사용자 "${name}"를 삭제하시겠습니까? 개인 층은 공용 층이 됩니다.`,
  userRoleUpdated: '역할이 업데이트됨',
  userDeleted: '사용자가 삭제됨',
  userLoadFailed: '사용자 목록을 불러올 수 없음',
  noUsers: '사용자 없음',
  resetApiKey: 'API Key 초기화',
  resetApiKeyConfirm: (name: string) => `"${name}"의 API Key를 초기화하시겠습니까? 기존 Key는 즉시 무효화됩니다.`,
  resetApiKeySuccess: 'API Key가 초기화됨',
  showApiKey: '표시',
  hideApiKey: '숨기기',
  userApiKey: 'API Key',

  // 원격 노드
  remoteNodes: '원격 노드',
  nodeLatency: '지연 시간',
  nodeConnectedTime: '연결 시각',
  nodeActiveSessions: '활성 에이전트',
  noRemoteNodes: '연결된 원격 노드 없음',
  latencyGood: '양호',
  latencyFair: '보통',
  latencyPoor: '나쁨',
  nodeHealth: '노드 상태',

  // 업적
  achievements: '업적',
  achievementUnlocked: '업적 달성',
  allAchievements: '모든 업적',
  locked: '잠김',

  // 팀
  teams: '팀',
  allTeams: '모든 팀',
  teamMembers: '멤버',
  filterByTeam: '팀으로 필터',

  // 레이아웃 공유
  shareLayout: '레이아웃 공유',
  copyToClipboard: '클립보드에 복사',
  pasteFromClipboard: '클립보드에서 붙여넣기',
  copied: '복사됨',

  // 언어 & 테마
  language: '언어',
  theme: '테마',
  darkTheme: '다크',
  lightTheme: '라이트',

  // 가구 수
  furnitureCount: (n: number) => `${n} 에셋`,

  // 층 권한
  permissionDenied: '권한 부족',
  cannotEditOthersFloor: '다른 사용자의 층을 편집할 수 없음',
  floorNameAlreadyExists: '이미 사용 중인 층 이름',
  personalFloor: '개인 층',
  publicFloor: '공용 층',

  // API Key 마스크
  apiKeyMasked: (key: string) => `${key.slice(0, 3)}${'*'.repeat(Math.max(0, key.length - 7))}${key.slice(-4)}`,
  showFullApiKey: '전체 Key 표시',
  hideFullApiKey: 'Key 숨김',

  // 권한 부족 메시지
  permissionMessages: {
    saveLayout: '레이아웃 편집에는 관리자 권한 필요',
    closeAgent: '본인의 에이전트만 닫을 수 있음',
    addFloor: '관리자만 층 추가 가능',
    removeFloor: '관리자만 층 삭제 가능',
    renameFloor: '관리자만 층 이름 변경 가능',
    editLayout: '레이아웃 편집에는 로그인 필요',
    moveAgent: '본인의 에이전트만 이동 가능',
    setTeam: '본인 에이전트의 팀만 설정 가능',
    default: '권한 부족',
  } as Record<string, string>,

  // 가이드 배너
  guideBannerMessage: '로그인하여 레이아웃 편집 및 에이전트 관리',

  // 초대 코드
  inviteCode: '초대 코드',
  generateInvite: '초대 코드 생성',
  revokeInvite: '취소',
  inviteExpired: '만료됨',
  inviteUsed: '사용됨',
  inviteActive: '유효',
  noInvites: '초대 코드 없음',
}

// ── Locale 管理 ──────────────────────────────────────────────────

type Locale = 'zh-TW' | 'en-US' | 'zh-CN' | 'ja-JP' | 'ko-KR'

const LOCALE_STORAGE_KEY = 'pixel-agents-locale'

const localeMap: Record<Locale, LocaleStrings> = {
  'zh-TW': zh_TW,
  'en-US': en_US,
  'zh-CN': zh_CN,
  'ja-JP': ja_JP,
  'ko-KR': ko_KR,
}

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'zh-CN': '简体中文',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
}

const AVAILABLE_LOCALES: Locale[] = ['zh-TW', 'en-US', 'zh-CN', 'ja-JP', 'ko-KR']

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
