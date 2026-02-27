// 集中管理的 UI 字串 — 繁體中文本地化
export const t = {
  // 底部工具列
  addAgent: '+ 代理',
  layout: '佈局',
  editOfficeLayout: '編輯辦公室佈局',
  settings: '設定',

  // 縮放控制
  zoomIn: '放大 (Ctrl+滾輪)',
  zoomOut: '縮小 (Ctrl+滾輪)',

  // 設定面板
  exportLayout: '匯出佈局',
  importLayout: '匯入佈局',
  soundNotifications: '音效通知',
  debugView: '除錯檢視',

  // 代理
  agent: (id: number) => `代理 #${id}`,
  closeAgent: '關閉代理',

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
} as const
