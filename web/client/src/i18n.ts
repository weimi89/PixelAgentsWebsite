// 集中管理的 UI 字串 — 繁體中文本地化
export const t = {
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

  // 工作階段選擇器
  sessions: '工作階段',
  browseSessions: '瀏覽過去的工作階段',
  noSessions: '沒有找到工作階段',
  resumeSession: '恢復',
  activeSession: '進行中',
  loadingSessions: '載入中...',
  sessionProject: '專案',
  searchSessions: '搜尋工作階段...',
  noMatchingSessions: '沒有符合的工作階段',

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
  agentDetailInfo: '基本資訊',
  agentDetailTools: '工具活動',
  agentDetailHistory: '狀態歷史',
  agentDetailClose: '關閉面板',
  agentDetailTimeline: '時間軸',
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
  terminalNoTmux: '此代理沒有 tmux 工作階段',

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
} as const
