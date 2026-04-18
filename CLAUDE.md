# OnlinePixelAgents — 壓縮參考文件

Web 應用程式（Express + Socket.IO），從 [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents) VS Code 擴充套件改造而來。像素藝術辦公室，AI 代理（Claude Code 會話）在瀏覽器中以動畫角色呈現。

## 架構

**主要開發在 `web/` 目錄。** 原始 VS Code 擴充套件程式碼保留在 `src/` + `webview-ui/` 供參考。

```
web/
  shared/                     — 共享型別與純函式（server + agent-node 共用）
    src/
      index.ts                — 統一匯出
      protocol.ts             — Agent Node ↔ Server 協議型別（AgentNodeEvent, ServerNodeMessage）
      formatToolStatus.ts     — 工具狀態格式化純函式 + 權限豁免清單

  server/                     — Express + Socket.IO 後端（Node.js）
    src/
      index.ts                — 入口：Express 靜態檔案 + Socket.IO 連線處理 + auth 路由 + Agent Node namespace
      config.ts               — 所有環境變數集中讀取（PORT、TRUST_PROXY、REDIS_URL 等）
      agentManager.ts         — 代理生命週期：自動偵測、會話恢復、清理（含子進程 listener cleanup）
      agentNodeHandler.ts     — Agent Node namespace：JWT、遠端代理、30s 斷線 grace 無縫重連
      fileWatcher.ts          — fs.watch + 2s 輪詢、JSONL 增量讀取、自動收養；Gemini 尾部讀取
      transcriptParser.ts     — JSONL 解析：tool_use/tool_result → Socket.IO 訊息
      auth/
        userStore.ts          — 使用者帳號（SQLite 優先，JSON 備援）；bcrypt r=12；API Key AES-256-GCM 加密 + timing-safe 比對
        jwt.ts                — JWT 簽發與驗證（access + refresh token）
        routes.ts             — /api/auth/ register、login、login-key、refresh、change-password、invites、users
        socketAuth.ts         — Socket.IO 認證中介（匿名連線每 IP 限制 + TRUST_PROXY 控制的 x-forwarded-for 解析）
        inviteStore.ts        — 邀請碼管理（invite 註冊策略用）
        messageFilter.ts      — 敏感訊息類型過濾（非 admin 看不到）
      atomicWrite.ts          — JSON 原子寫入（.tmp + fsync + rename）
      pathSecurity.ts         — 路徑遍歷與符號連結逃逸防護（realpath 檢查）
      rateLimit.ts            — API 速率限制（FIFO LRU 上限防偽造 IP 填爆）
      auditLog.ts             — 稽核日誌（SQLite + JSONL 備援，自動遮蔽 password/token/key）
      backup.ts               — 自動備份（預設 6h 一次，保留 5 份）
      cluster.ts              — 叢集心跳（有 REDIS_URL 時啟用）
      db/
        database.ts           — better-sqlite3 封裝 + schema migration（users、audit_log、floors 等）
        redis.ts              — ioredis 封裝（Socket.IO adapter + JWT/agent 快取）
        jsonMigration.ts      — JSON → SQLite 首次遷移
      logger.ts               — 結構化日誌（LOG_LEVEL 控制）
      assetLoader.ts          — PNG 解析、精靈圖轉換、家具目錄建構、預設佈局載入
      layoutPersistence.ts    — ~/.pixel-agents/layout.json 讀寫（舊版單層佈局，保留供備用）
      buildingPersistence.ts  — 建築物配置 + 樓層佈局持久化（~/.pixel-agents/building.json + floors/*.json）
      floorAssignment.ts      — 專案→樓層映射持久化（~/.pixel-agents/project-floor-map.json）
      projectNameStore.ts     — 自訂專案名稱映射 + 專案排除清單持久化
      teamNameStore.ts        — 代理團隊名稱映射
      behaviorSettingsStore.ts — 行為參數持久化（閒置節奏、漫遊機率等）
      sessionScanner.ts       — 工作階段掃描（瀏覽過去會話）
      timerManager.ts         — 等待/權限計時器邏輯
      tmuxManager.ts          — tmux 會話管理（spawnSync 安全呼叫）與健康檢查
      terminalManager.ts      — 本地 PTY（node-pty）管理與追蹤
      lanDiscovery.ts         — UDP 區網自動發現（多伺服器實例互見）
      dashboardStats.ts       — 儀表板統計聚合
      growthSystem.ts         — 代理成長（XP / 等級 / 成就）
      stressTest.ts           — 壓力測試代理生成器（--stress N）
      demoMode.ts             — 演示模式：模擬代理行為序列（--demo 旗標）
      cliAdapters/            — 多 CLI 支援（claudeAdapter、codexAdapter、geminiAdapter）
      colorUtils.ts           — 伺服器端色彩工具
      constants.ts            — 伺服器常數（計時、端口 13001、bcrypt rounds、grace 時間等）
      types.ts                — 共享介面（AgentState, MessageSender, ClientMessage, AgentContext, FloorConfig, BuildingConfig）

  client/                     — React + TypeScript（Vite）
    src/
      App.tsx                 — 組合根：hooks + components + EditActionBar
      socketApi.ts            — Socket.IO ↔ vscode.postMessage() 相容層
      i18n.ts                 — 繁體中文本地化字串
      constants.ts            — 網格/動畫/渲染/相機/縮放/編輯器/遊戲邏輯常數
      notificationSound.ts   — Web Audio API 回合完成提示音
      hooks/
        useExtensionMessages.ts — Socket.IO 訊息 → officeState 同步
        useEditorActions.ts     — 編輯器狀態 + 回呼
        useEditorKeyboard.ts    — 快捷鍵綁定
        useRenderTick.ts        — 渲染節拍 hook
      components/
        BottomToolbar.tsx      — 工作階段、佈局切換、設定按鈕
        SessionPicker.tsx      — 工作階段瀏覽器 + 專案資料夾管理 UI
        SettingsModal.tsx      — 設定、匯出/匯入佈局、音效切換、除錯切換
        ZoomControls.tsx       — +/- 縮放（右上角）
        DebugView.tsx          — 除錯覆蓋層
        AgentLabels.tsx        — 代理名稱標籤（可雙擊改名）
        FloorSelector.tsx      — 樓層切換按鈕列（嵌入 BottomToolbar）
        ErrorBoundary.tsx      — React 錯誤邊界
      office/                 — 遊戲引擎（結構同 webview-ui/src/office/）
        types.ts              — 遊戲型別（EmoteType, CharacterState, EditTool 等）
        toolUtils.ts          — 工具名稱解析、顏色編碼
        colorize.ts           — 著色/調整模組
        floorTiles.ts, wallTiles.ts
        sprites/              — spriteData.ts, spriteCache.ts
        editor/               — editorActions.ts, editorState.ts, EditorToolbar.tsx
        layout/               — furnitureCatalog.ts, layoutSerializer.ts, tileMap.ts
        engine/               — characters.ts, officeState.ts, gameLoop.ts, renderer.ts, matrixEffect.ts
        components/           — OfficeCanvas.tsx, ToolOverlay.tsx

  agent-node/                 — Agent Node CLI 套件（遠端機器連線至中央伺服器）
    src/
      cli.ts                  — CLI 入口：login / start 子命令
      scanner.ts              — JSONL 掃描器（偵測活躍的 Claude 會話）
      parser.ts               — 簡化版轉錄解析器（JSONL → AgentNodeEvent）
      agentTracker.ts         — 代理追蹤器（fs.watch + 輪詢、增量讀取）
      connection.ts           — Socket.IO 連線管理（/agent-node namespace）
      index.ts                — 程式庫匯出

src/                          — 原始 VS Code 擴充套件後端（僅供參考）
webview-ui/                   — 原始 VS Code webview 前端（僅供參考）

scripts/                      — 7 階段素材擷取管線
  0-import-tileset.ts         — 互動式 CLI 包裝器
  1-detect-assets.ts          — 洪水填充素材偵測
  2-asset-editor.html         — 瀏覽器 UI：位置/邊界編輯
  3-vision-inspect.ts         — Claude 視覺自動元資料
  4-review-metadata.html      — 瀏覽器 UI：元資料審查
  5-export-assets.ts          — 匯出 PNG + furniture-catalog.json
  asset-manager.html          — 統一編輯器（階段 2+4 合併）
  generate-walls.js           — 生成 walls.png（4×4 格 16×32 自動拼接磚塊）
  wall-tile-editor.html       — 瀏覽器 UI：牆磚外觀編輯
```

## Web 版與 VS Code 擴充的主要差異

| 面向 | VS Code 擴充 | Web 版 |
|------|-------------|--------|
| **進程管理** | VS Code Terminal API | `spawn('claude', ...)` 子進程（tmux 或直接） |
| **通訊** | `vscode.postMessage()` | Socket.IO（透過 `socketApi.ts` 相同介面） |
| **代理發現** | 終端收養 | JSONL 自動掃描 `~/.claude/projects/`（純被動偵測） |
| **資源服務** | esbuild 複製到 dist/ | Express 靜態檔案 + Vite 開發伺服器 |
| **佈局持久化** | `~/.pixel-agents/layout.json` | 同上 |
| **演示模式** | 無 | `--demo` 旗標或 `DEMO=1` 環境變數 |
| **國際化** | 無 | 內建繁體中文（`i18n.ts`） |

**socketApi.ts 相容層**：暴露 `vscode.postMessage()` 介面，底層由 Socket.IO 驅動，現有客戶端程式碼無需修改。

**自動偵測流程**：`ensureProjectScan()` 每 1s 執行 → 掃描 `~/.claude/projects/*/` 下的 `.jsonl` 檔案（排除 `IGNORED_PROJECT_DIR_PATTERNS` 中的目錄及使用者排除的專案）→ 30s 內修改的為「活躍」→ 自動建立代理（外部會話 process=null，帶 `projectName`）→ 超過 `STALE_AGENT_TIMEOUT_MS`（600s / 10 分鐘，容忍 extended thinking）無更新的陳舊代理自動移除。

**專案排除**：持久化於 `~/.pixel-agents/excluded-projects.json`（目錄 basename 陣列）。排除的專案不會被自動偵測掃描，其工作階段也不會出現在工作階段清單中。透過 SessionPicker 底部的「專案資料夾」區域管理（隱藏/顯示切換）。`projectNameStore.ts` 提供 `readExcludedProjects()`、`addExcludedProject()`、`removeExcludedProject()`、`isProjectExcluded()` 函式。

**演示模式**：`--demo` 旗標或 `DEMO=1` → 生成 N 個模擬代理（預設 3），循環執行工具序列（Read→Edit→Bash、Glob→Read→Grep→Edit 等），包含子任務模擬。

## 核心概念

**術語**：Session = `~/.claude/projects/<hash>/` 下的 JSONL 對話檔案。Agent = 與會話 1:1 綁定的動畫角色。Floor = 獨立的辦公室佈局空間，代理依專案分配至不同樓層。

**多樓層系統**：虛擬辦公室大樓，每層有獨立佈局。`BuildingConfig`（`building.json`）管理樓層清單。每個代理攜帶 `floorId`。Socket.IO 使用 `floor:<id>` Room 隔離廣播 — 代理狀態變更只推送至同樓層的客戶端。`ctx.floorSender(floorId)` 取代舊的全域 `ctx.sender` 用於代理相關訊息。全域訊息（`projectNameUpdated`、`excludedProjectsUpdated`、`buildingConfig`）仍用 `ctx.sender` 廣播。客戶端切換樓層時發送 `switchFloor` → 伺服器 leave/join Room → 回傳新樓層佈局和代理。首次啟動自動遷移 `layout.json` → `floors/1F.json`。`floorAssignment.ts` 持久化專案→樓層映射（`project-floor-map.json`），自動偵測時查詢映射決定代理樓層。

**多機器連線**：遠端機器執行 `pixel-agents-node`（Agent Node CLI），掃描本地 `~/.claude/projects/` 下的活躍 JSONL 並將預處理事件推送至中央伺服器。Socket.IO `/agent-node` namespace 處理遠端連線（JWT 認證）。伺服器將遠端代理放入同一個 `agents` Map（`isRemote: true, owner: username`），複用現有訊息流。`remoteAgentMap`（`Map<sessionId, agentId>`）用於快速查找。Agent Node 解析 JSONL → 產生 `AgentNodeEvent`（定義在 `pixel-agents-shared` 中）→ 伺服器轉換為標準 Socket.IO 訊息廣播至瀏覽器。認證系統：JWT + 簡易用戶管理（`bcryptjs` 雜湊密碼，預設 `admin:admin`），token 有效期 30 天。瀏覽器端遠端代理以橘色光暈標示（`REMOTE_AGENT_GLOW_COLOR`），工具覆蓋層顯示 `@owner` 前綴。遠端代理不可被瀏覽器關閉。斷線時自動清除該 socket 的所有遠端代理。

**伺服器 ↔ 客戶端**（Web）：Socket.IO 雙向 `emit('message', msg)`。`socketApi.ts` 包裝為 `vscode.postMessage()` 以維持客戶端相容性。主要訊息類型：`agentCreated/Closed`、`focusAgent`、`agentToolStart/Done/Clear`、`agentStatus`、`existingAgents`、`layoutLoaded`、`furnitureAssetsLoaded`、`floorTilesLoaded`、`wallTilesLoaded`、`saveLayout`、`saveAgentSeats`、`settingsLoaded`、`setSoundEnabled`、`characterSpritesLoaded`、`subagentToolStart/Done`、`subagentClear`、`agentToolPermission/PermissionClear`、`subagentToolPermission`、`agentModel`、`agentDetached`、`agentThinking`、`agentEmote`、`agentTranscript`、`sessionsList`、`exportLayoutData`、`projectNameUpdated`、`excludedProjectsUpdated`、`projectDirsList`、`buildingConfig`、`floorSwitched`、`switchFloor`、`addFloor`、`removeFloor`、`renameFloor`。

**代理建立**（Web）：三種路徑 — (1) 自動偵測：`ensureProjectScan()` 發現活躍 JSONL → 建立 process=null 的代理。(2) 會話恢復：使用者從 SessionPicker 選取過去的會話 → `resumeSession()` → `spawn('claude', ['--resume', sessionId])`。(3) 遠端 Agent Node：Agent Node 推送 `agentStarted` 事件 → 伺服器建立 `isRemote: true` 的代理（process=null, jsonlFile=''）。外部專案代理帶 `projectName`（從目錄路徑提取或自訂名稱），`agentCreated` 訊息包含 `projectName`、`isRemote`、`owner` 供標籤和視覺標記顯示。

**一代理一會話**：每個 Claude 會話對應一個角色。

**自動偵測**：每 1s 掃描所有 `~/.claude/projects/*/` 目錄（排除 `IGNORED_PROJECT_DIR_PATTERNS` 及使用者排除清單），尋找 30s 內修改的 `.jsonl` 檔案。新檔案 → 自動建立代理（附帶 `projectName`）。超過 `STALE_AGENT_TIMEOUT_MS`（600s）無更新的陳舊代理 → 自動移除。

**自訂專案名稱**：持久化於 `~/.pixel-agents/project-names.json`（`{ dirBasename: displayName }` 映射）。使用者可雙擊 AgentLabels 中的專案名稱直接編輯。`projectNameStore.ts` 提供 `getCustomName()`、`setCustomName()` 函式。

## 代理狀態追蹤

JSONL 轉錄檔位於 `~/.claude/projects/<project-hash>/<session-id>.jsonl`。專案雜湊 = 工作區路徑中的 `:`/`\`/`/` → `-`。

**JSONL 記錄類型**：`assistant`（tool_use 區塊、thinking 區塊或 image 區塊）、`user`（tool_result 或文字提示）、`system` 帶 `subtype`：`"turn_duration"`（可靠的回合結束訊號）、`"compact_boundary"`（上下文壓縮 → compress 表情）。`progress` 帶 `data.type`：`agent_progress`（子代理 tool_use/tool_result 轉發至 webview，非豁免工具觸發權限計時器）、`bash_progress`（長時間執行的 Bash 輸出 — 重啟權限計時器以確認工具正在執行）、`mcp_progress`（MCP 工具狀態 — 相同的計時器重啟邏輯）、`waiting_for_task`（父代理等待子任務 → eye 表情）。assistant 記錄中的 `thinking` 區塊觸發 `agentThinking` 訊息（角色踱步動畫），`image` 區塊觸發 `agentEmote: camera`（相機表情）。已觀察但未追蹤：`file-history-snapshot`、`queue-operation`。

**檔案監視**：混合 `fs.watch` + 2s 輪詢備份。部分行緩衝處理寫入中途的讀取。工具完成訊息延遲 300ms 以防止閃爍。JSONL 輪詢帶超時機制（`JSONL_POLL_MAX_FAILURES`），檔案不存在超過閾值後自動清理計時器。

**每個代理的伺服器狀態**：`id, process, projectDir, jsonlFile, fileOffset, lineBuffer, activeToolIds, activeToolStatuses, activeToolNames, activeSubagentToolIds, activeSubagentToolNames, isWaiting, hadToolsInTurn, permissionSent, model, tmuxSessionName, isDetached, transcriptLog, floorId, isRemote, owner, remoteSessionId`。

**持久化**：代理持久化至 `~/.pixel-agents/persisted-agents.json`（包含 palette/hueShift/seatId/tmuxSessionName）。**佈局持久化至 `~/.pixel-agents/layout.json`**（使用者層級，跨所有視窗共享）。`layoutPersistence.ts` 處理所有檔案 I/O：`readLayoutFromFile()`、`writeLayoutToFile()`（透過 `.tmp` + rename 的原子操作）。**預設佈局**：當無已儲存的佈局檔案時，從 `assets/` 載入捆綁的 `default-layout.json` 並寫入檔案。若也不存在，`createDefaultLayout()` 生成基礎辦公室。**匯出/匯入**：設定面板提供匯出佈局（下載 JSON 檔案）和匯入佈局（選擇 JSON 檔案 → 驗證 `version: 1` + `tiles` 陣列 → 寫入佈局檔案 + 推送 `layoutLoaded`）。

## 辦公室 UI

**渲染**：遊戲狀態在命令式 `OfficeState` 類別中（非 React state）。像素完美：zoom = 整數裝置像素/精靈像素（1x–10x）。不使用 `ctx.scale(dpr)`。預設縮放 = `Math.round(2 * devicePixelRatio)`。所有實體按 Y 軸 Z 排序。透過滑鼠中鍵拖曳平移（`panRef`）。**鏡頭追蹤**：`cameraFollowId`（與 `selectedAgentId` 分離）平滑地將鏡頭置中於被追蹤的代理；點擊代理時設定，取消選取或手動平移時清除。

**UI 風格**：像素藝術美學 — 所有覆蓋層使用銳角（`borderRadius: 0`）、實心背景（`#1e1e2e`）、`2px solid` 邊框、硬偏移陰影（`2px 2px 0px #0a0a14`，無模糊）。CSS 變數定義在 `index.css` `:root`（`--pixel-bg`、`--pixel-border`、`--pixel-accent` 等）。像素字型：FS Pixel Sans（`webview-ui/src/fonts/`），透過 `@font-face` 在 `index.css` 中載入，全域套用。

**角色**：10 種 FSM 狀態 — IDLE（站立等待）、WALK（尋路移動）、TYPE（坐在座位打字）、CHAT（與鄰近角色面對面聊天）、INTERACT（與家具互動）、STAND_WORK（站在白板前工作）、THINK（來回踱步，由伺服器 `agentThinking` 觸發）、STRETCH（久坐後伸展）、USE_WALL（面對牆壁物件互動）、SLEEP（長時間閒置後打瞌睡）。活躍代理尋路至座位，依工具類型播放打字/閱讀動畫；閒置代理以加權隨機選擇行為（`wanderLimit` 次漫遊後返回座位）。**加權漫遊**：6 類行為以權重選取 — IDLE_LOOK 站著轉方向(30)、隨機漫遊(30)、家具互動(15)、聊天(10)、牆壁互動(10)、返回座位(5)。漫遊半徑限制 3 格、路徑最長 5 步。STRETCH 由 `sitTimer > 180s` 觸發，SLEEP 由 `sleepTimer > 300s` 觸發。4 方向精靈圖，左 = 翻轉右。工具動畫：打字（Write/Edit/Bash/Task）vs 閱讀（Read/Grep/Glob/WebFetch）。坐姿偏移：角色在 TYPE 狀態時向下移動 6px 以視覺上坐在椅子上。Z 排序使用 `ch.y + TILE_SIZE/2 + 0.5` 使角色渲染在同行家具（椅子）前方，但在低行家具（書桌、書架）後方。椅子 Z 排序：非背面椅子使用 `zY = (row+1)*TILE_SIZE`（限制至第一行）使角色在任何座位格渲染在前方；背面椅子使用 `zY = (row+1)*TILE_SIZE + 1` 使椅背渲染在角色前方。椅子格對所有角色封鎖，除了其自身指定的座位（透過 `withOwnSeatUnblocked` 的每角色尋路）。**多元調色盤分配**：`pickDiversePalette()` 計算當前非子代理角色的調色盤使用數量；從最少使用的調色盤中隨機選取。前 6 個代理各得到唯一外觀；超過 6 個後，外觀重複並套用隨機色相偏移（45–315°），透過 `adjustSprite()`。角色儲存 `palette`（0-5）+ `hueShift`（角度）。精靈圖快取以 `"palette:hueShift"` 為鍵。

**生成/消散特效**：Matrix 風格數位雨動畫（0.3s）。16 個垂直欄由上至下掃過，帶交錯時序（每欄隨機種子）。生成：綠色雨幕後方顯現角色像素。消散：角色像素被綠色雨尾吞噬。角色上的 `matrixEffect` 欄位（`'spawn'`/`'despawn'`/`null`）。特效期間正常 FSM 暫停。消散中的角色跳過碰撞檢測。已恢復的代理（`existingAgents`）使用 `skipSpawnEffect: true` 立即出現。`matrixEffect.ts` 包含 `renderMatrixEffect()`（逐像素渲染），從渲染器中取代快取精靈圖繪製。

**子代理**：負數 ID（從 -1 遞減）。在 `agentToolStart` 時以 "Subtask:" 前綴建立。與父代理相同的 palette + hueShift，外加光暈特效（`isSubagent` 標記 → 渲染器在角色周圍繪製柔和光暈）。點擊聚焦父終端。不持久化。在距離父代理最近的空閒座位生成（曼哈頓距離）；備選：最近的可行走格。子代理標籤帶類型前綴和編號以區分同類子代理（如「Explore #1」、「Plan #2」）。**子代理權限偵測**：當子代理執行非豁免工具時，`startPermissionTimer` 在父代理上觸發；若 5s 內無資料，權限氣泡同時出現在父代理和子代理角色上。`activeSubagentToolNames`（parentToolId → subToolId → toolName）追蹤哪些子工具為活躍狀態以進行豁免檢查。資料恢復或 Task 完成時清除。

**表情系統**：10 種 EmoteType — 閒置行為觸發：COFFEE（咖啡機互動）、WATER（飲水機互動）、STAR（完成互動）、ZZZ（睡眠時循環）、IDEA（踱步思考）、HEART（聊天）、NOTE（白板互動）。伺服器 JSONL 偵測觸發：CAMERA（`image` 區塊，代理處理圖片）、EYE（`waiting_for_task` 進度，父代理等待子任務）、COMPRESS（`compact_boundary` 系統記錄，上下文壓縮）。每個表情為 7×7 像素精靈圖，定義在 `spriteData.ts` 的 `EMOTE_SPRITES` 查找表中。顯示機制：`ch.emoteType` + `ch.emoteTimer`（倒數 `EMOTE_DISPLAY_DURATION_SEC = 2s`），由 `officeState.update()` 每幀遞減。伺服器觸發透過 `agentEmote` 訊息 → `officeState.showEmote()` 設定。防覆蓋邏輯：若現有表情剩餘時間 > 1s 則不替換。

**工具覆蓋層（ToolOverlay）**：顯示代理正在使用的工具名稱和耗時。工具名稱顯示精簡化（去除前綴如 `mcp__plugin_`）。**工具顏色編碼**：依工具類型自動著色（檔案操作 = 藍、搜尋 = 青、執行 = 綠、網路 = 紫、MCP = 品紅、代理 = 金）。**工具耗時追蹤**：`ToolActivity` 型別包含 `startedAt` 時間戳，ToolOverlay 即時計算並顯示 `Xs` 格式的執行時間。選取的代理額外顯示最近完成的 3 個工具歷史。

**對話氣泡**：權限（"..." 琥珀色圓點）保持直到點擊/清除。等待（綠色勾號）2s 自動淡出。斷線（`detached`）持續顯示直到重新連線。精靈圖在 `spriteData.ts` 中。Space 鍵可快速關閉選取代理的氣泡。

**音效通知**：上行雙音提示音（E5 → E6），透過 Web Audio API 在等待氣泡出現時播放（`agentStatus: 'waiting'`）。`notificationSound.ts` 管理 AudioContext 生命週期；`unlockAudio()` 在畫布 mousedown 時呼叫以確保 context 已恢復。透過設定面板中的「音效通知」核取方塊切換。

**座位**：衍生自椅子家具。`layoutToSeats()` 在每張椅子的每個佔地格建立座位。多格椅子（如 2 格沙發）產生多個座位，鍵為 `uid` / `uid:1` / `uid:2`。面向方向優先順序：1) 椅子 `orientation`（目錄中的 front→DOWN、back→UP、left→LEFT、right→RIGHT），2) 相鄰書桌方向，3) 前方（DOWN）。點擊角色 → 選取（白色輪廓）→ 點擊可用座位 → 重新指定。

**連線狀態**：斷線時右上角顯示「已斷線，重連中...」指示器，Socket.IO 自動重連。`socketApi.ts` 追蹤連線狀態並透過 `onConnectionChange` 回呼通知 UI。

## 佈局編輯器

透過「佈局」按鈕切換。工具：SELECT（預設）、地板繪製、牆壁繪製、擦除（設定格為 VOID）、家具放置、家具拾取（家具類型吸管）、吸管（地板）。

**地板**：`floors.png` 中 7 種花紋（灰階 16×16），可透過 HSBC 滑桿著色（Photoshop 著色模式）。顏色在繪製時烘焙至每格。吸管拾取花紋+顏色。

**牆壁**：獨立的牆壁繪製工具。點擊/拖曳新增牆壁；點擊/拖曳現有牆壁移除（切換方向由拖曳首格決定，透過 `wallDragAdding` 追蹤）。HSBC 色彩滑桿（著色模式）一次套用至所有牆磚。在牆磚上使用吸管會拾取其顏色並切換至牆壁工具。家具不能放在牆磚上，但背景行（前 N 個 `backgroundTiles` 行）可與牆壁重疊。

**家具**：幽靈預覽（綠色/紅色有效性）。R 鍵旋轉，F 鍵水平翻轉，V 鍵垂直翻轉，T 鍵切換開/關狀態。SELECT 中拖曳移動。選取項目上的刪除按鈕（紅色 X）+ 旋轉按鈕（藍色箭頭）。任何選取的家具顯示 HSBC 色彩滑桿（色彩切換 + 清除按鈕）；顏色儲存在每項目的 `PlacedFurniture.color?`。每次色彩編輯會話一個撤銷條目（透過 `colorEditUidRef` 追蹤）。拾取工具複製已放置項目的類型+顏色。堆疊家具點擊時優先選取表面項目。

**撤銷/重做**：50 層，Ctrl+Z/Y。EditActionBar（編輯未儲存時在頂部中央）：撤銷、重做、儲存、重設。

**多階段 Esc**：退出家具拾取 → 取消選取目錄 → 關閉工具分頁 → 取消選取家具 → 關閉編輯器。

**擦除工具**：設定格為 `TileType.VOID`（透明、不可行走、無家具）。地板/牆壁/擦除工具中右鍵也擦除為 VOID（支援拖曳擦除）。編輯模式中抑制右鍵選單。

**網格擴展**：地板/牆壁/擦除工具中，在網格外 1 格顯示幽靈邊框（虛線輪廓）。點擊幽靈格呼叫 `expandLayout()` 向該方向（左/右/上/下）擴展網格 1 格。新格為 VOID。向左/上擴展時，家具位置和角色位置跟隨移動。最大網格尺寸：`MAX_COLS`×`MAX_ROWS`（64×64）。預設：`DEFAULT_COLS`×`DEFAULT_ROWS`（20×11）。調整後超出邊界的角色重新定位至隨機可行走格。

**佈局模型**：`{ version: 1, cols, rows, tiles: TileType[], furniture: PlacedFurniture[], tileColors?: FloorColor[] }`。網格尺寸為動態（非固定常數）。透過防抖 saveLayout 訊息持久化 → `writeLayoutToFile()` → `~/.pixel-agents/layout.json`。

## 素材系統

**載入**：`esbuild.js` 複製 `webview-ui/public/assets/` → `dist/assets/`。載入器先檢查捆綁路徑，備選工作區根目錄。PNG → pngjs → SpriteData（2D hex 陣列，alpha≥128 = 不透明）。`loadDefaultLayout()` 讀取 `assets/default-layout.json`（JSON OfficeLayout）作為新工作區的備選值。

**目錄**：`furniture-catalog.json` 包含 id、name、label、category、footprint、isDesk、canPlaceOnWalls、groupId?、orientation?、state?、canPlaceOnSurfaces?、backgroundTiles?。字串型別系統（無 enum 限制）。分類：desks、chairs、storage、electronics、decor、wall、misc。可放置於牆上的項目（`canPlaceOnWalls: true`）使用 `wall` 分類，在編輯器中顯示於專用「牆面」分頁。素材命名慣例：`{BASE}[_{ORIENTATION}][_{STATE}]`（例如 `MONITOR_FRONT_OFF`、`CRT_MONITOR_BACK`）。`orientation` 儲存在 `FurnitureCatalogEntry` 上，用於椅子 Z 排序和座位面向方向。

**旋轉群組**：`buildDynamicCatalog()` 從共享 `groupId` 的素材建構 `rotationGroups` Map。彈性支援：2+ 方向（例如僅 front/back）。編輯器調色盤每群組顯示 1 個項目（優先 front 方向）。`getRotatedType()` 在可用方向間循環。

**狀態群組**：具有 `state: "on"` / `"off"` 且共享相同 `groupId` + `orientation` 的項目形成切換配對。`stateGroups` Map 啟用 `getToggledType()` 查找。編輯器調色盤隱藏開啟狀態變體，僅顯示關閉/預設版本。狀態群組在方向間映射（開啟狀態變體擁有自己的旋轉群組）。

**自動狀態**：`officeState.rebuildFurnitureInstances()` 在活躍代理面對書桌且附近有電子設備時，將其切換為 ON 精靈圖（面向方向 3 格深、兩側各 1 格）。在渲染時操作，不修改已儲存的佈局。

**背景格**：`FurnitureCatalogEntry` 上的 `backgroundTiles?: number` — 前 N 個佔地行允許其他家具放置其上，且角色可穿越。背景行上的項目透過 Z 排序渲染在宿主家具後方（較低 zY）。`getBlockedTiles()` 和 `getPlacementBlockedTiles()` 均跳過背景行；`canPlaceFurniture()` 也跳過新項目自身的背景行（對稱放置）。透過 asset-manager.html「Background Tiles」欄位設定。

**表面放置**：`FurnitureCatalogEntry` 上的 `canPlaceOnSurfaces?: boolean` — 筆電、螢幕、杯子等項目可與 `isDesk` 家具的所有格重疊。`canPlaceFurniture()` 建構書桌格集合，並將其排除在表面項目的碰撞檢查之外。Z 排序修正：`layoutToFurnitureInstances()` 預先計算每格的書桌 zY；表面項目取 `zY = max(spriteBottom, deskZY + 0.5)` 以渲染在書桌前方。透過 asset-manager.html「Can Place On Surfaces」核取方塊設定。經由 `5-export-assets.ts` → `furniture-catalog.json` 匯出。

**牆面放置**：`FurnitureCatalogEntry` 上的 `canPlaceOnWalls?: boolean` — 畫作、窗戶、時鐘等項目只能放在牆磚上（不能放在地板上）。`canPlaceFurniture()` 要求佔地的底行在牆磚上；上方行可延伸至地圖上方（負數行）或 VOID 格。`getWallPlacementRow()` 偏移放置使底行對齊滑鼠懸停的格。`PlacedFurniture` 中的項目可有負數 `row` 值。透過 asset-manager.html「Can Place On Walls」核取方塊設定。

**著色模組**：共用 `colorize.ts`，透過 `FloorColor.colorize?` 旗標選擇兩種模式。**著色模式**（Photoshop 風格）：灰階 → 明度 → 對比度 → 亮度 → 固定 HSL；地板磚一律使用。**調整模式**（家具和角色色相偏移的預設模式）：偏移原始像素 HSL — H 旋轉色相（±180）、S 偏移飽和度（±100）、B/C 偏移明度/對比度。`adjustSprite()` 匯出供重用（角色色相偏移）。工具列顯示「著色」核取方塊以切換模式。通用 `Map<string, SpriteData>` 快取以任意字串為鍵（包含著色旗標）。`layoutToFurnitureInstances()` 在 `PlacedFurniture.color` 設定時著色精靈圖。

**地板磚**：`floors.png`（112×16，7 種花紋）。以 (pattern, h, s, b, c) 為鍵快取。遷移：舊佈局自動對應至新花紋。

**牆磚**：`walls.png`（64×128，4×4 格 16×32 磚塊）。4 位元自動拼接位元遮罩（N=1, E=2, S=4, W=8）。精靈圖向上延伸 16px（3D 面）。由擴充載入 → `wallTilesLoaded` 訊息。`wallTiles.ts` 在渲染時計算位元遮罩。可透過 HSBC 滑桿著色（著色模式，儲存在 `tileColors` 中）。牆磚精靈圖與家具和角色一起 Z 排序（`getWallInstances()` 建構 `FurnitureInstance[]`，`zY = (row+1)*TILE_SIZE`）；磚塊渲染階段僅繪製平面底色。`generate-walls.js` 建立 PNG；`wall-tile-editor.html` 供視覺編輯。

**角色精靈圖**：6 張預著色 PNG（`assets/characters/char_0.png`–`char_5.png`），每個調色盤一張。每張 112×96：7 幀 × 16px 寬，3 方向行 × 32px 高（24px 精靈圖底部對齊，上方 8px 填充）。第 0 行 = 下，第 1 行 = 上，第 2 行 = 右。幀序：walk1、walk2、walk3、type1、type2、read1、read2。無專用閒置幀 — 閒置使用 walk2（站立姿勢）。左 = 執行時翻轉右。由 `scripts/export-characters.ts` 生成，將 `CHARACTER_PALETTES` 顏色烘焙至模板。由擴充載入 → `characterSpritesLoaded` 訊息（6 個角色精靈圖集陣列）。`spriteData.ts` 直接使用預著色資料（無調色盤交換）；PNG 未載入時使用硬編碼模板備選。當 `hueShift !== 0` 時，`hueShiftSprites()` 在快取前對所有幀套用 `adjustSprite()`（HSL 色相旋轉）。

**載入順序**：`characterSpritesLoaded` → `floorTilesLoaded` → `wallTilesLoaded` → `furnitureAssetsLoaded`（目錄同步建構）→ `layoutLoaded`。

## 經驗教訓

- `fs.watch` 在 Windows 上不可靠 — 務必搭配輪詢備份
- 部分行緩衝對追加寫入的檔案讀取至關重要（攜帶未終止的行）
- 延遲 `agentToolDone` 300ms 以防止 React 批次處理隱藏短暫的活躍狀態
- **閒置偵測**有兩個訊號：(1) `system` + `subtype: "turn_duration"` — 對使用工具的回合可靠（~98%），每完成回合發出一次，處理器清除所有工具狀態作為安全措施。(2) 文字閒置計時器（`TEXT_IDLE_DELAY_MS = 5s`）— 用於從未發出 `turn_duration` 的純文字回合。僅在 `hadToolsInTurn` 為 false 時啟動（本回合尚未使用任何工具）；若任何 tool_use 到達，`hadToolsInTurn` 變為 true，計時器在本回合剩餘時間被抑制。在新使用者提示或 `turn_duration` 時重設。被 `readNewLines` 中任何新 JSONL 資料的到達取消。僅在 5s 完全檔案靜默後觸發
- 使用者提示 `content` 可以是字串（文字）或陣列（tool_results）— 需處理兩者
- `/clear` 建立新的 JSONL 檔案（舊檔案停止更新）
- Hook 式 IPC 失敗（hooks 在啟動時捕獲，env vars 不會傳播）。JSONL 監視可行
- PNG→SpriteData：pngjs 處理 RGBA 緩衝區，alpha 閾值 128
- OfficeCanvas 選取變更是命令式的（`editorState.selectedFurnitureUid`）；必須呼叫 `onEditorSelectionChange()` 以觸發 React 重新渲染工具列
- tmux 命令使用 `spawnSync` 陣列參數（非 `execSync` 字串）以防止命令注入

## 建置與開發

### Web 版（主要）

```sh
cd web && npm install && npm run build && npm start
```

開發模式（熱重載）：`cd web && npm run dev` — 啟動 Vite（客戶端 :5173）+ tsx watch（伺服器 :3000）。

演示模式：`cd web/server && node dist/index.js --demo` 或 `DEMO_AGENTS=5 DEMO=1 node dist/index.js`。

### VS Code 擴充（參考用）

```sh
npm install && cd webview-ui && npm install && cd .. && npm run build
```
建置流程：type-check → lint → esbuild（擴充）→ vite（webview）。F5 啟動 Extension Dev Host。

## TypeScript 限制

- 禁用 `enum`（`erasableSyntaxOnly`）— 使用 `as const` 物件
- 型別匯入需使用 `import type`（`verbatimModuleSyntax`）
- `noUnusedLocals` / `noUnusedParameters`

## 常數管理

所有魔術數字和字串集中管理 — 永遠不要在原始碼中內嵌常數：

- **Web 伺服器**：`web/server/src/constants.ts` — 計時間隔、顯示截斷限制、PNG/素材解析值
- **Web 客戶端**：`web/client/src/constants.ts` — 網格/佈局尺寸、角色動畫速度、Matrix 特效參數、渲染偏移/顏色、相機、縮放、編輯器預設值、遊戲邏輯閾值
- **擴充後端**：`src/constants.ts` — 計時間隔、顯示截斷限制、PNG/素材解析值、VS Code 指令/鍵識別符
- **Webview**：`webview-ui/src/constants.ts` — 同 Web 客戶端
- **CSS 風格**：`web/client/src/index.css`（或 `webview-ui/src/index.css`）`:root` 區塊 — `--pixel-*` 自訂屬性用於 UI 顏色、背景、邊框、z-index
- **Canvas 覆蓋層顏色**（座位、網格、幽靈、按鈕的 rgba 字串）位於 webview 常數檔案中，因為它們用於 canvas 2D context 而非 CSS
- `webview-ui/src/office/types.ts` 從 `constants.ts` 重新匯出網格/佈局常數（`TILE_SIZE`、`DEFAULT_COLS` 等）以保持向後相容 — 可從任一位置匯入

## 持久化檔案

所有使用者資料存放於 `~/.pixel-agents/`：

| 檔案 | 用途 |
|------|------|
| `pixel-agents.db` | **主要 SQLite 資料庫**（users、audit_log、tool_stats、agent_history 等，優先於 JSON） |
| `layout.json` | 舊版辦公室佈局（保留供備用，已遷移至 floors/） |
| `building.json` | 建築物配置（樓層清單、預設樓層） |
| `floors/*.json` | 各樓層佈局（地板、牆壁、家具） |
| `project-floor-map.json` | 專案→樓層映射 |
| `persisted-agents.json` | 代理外觀與座位（palette/hueShift/seatId/floorId） |
| `project-names.json` | 自訂專案顯示名稱映射 |
| `excluded-projects.json` | 排除的專案資料夾清單 |
| `settings.json` | 音效通知等使用者設定 |
| `users.json` | 使用者帳號 JSON 備援（SQLite 啟用後不寫入此檔） |
| `jwt-secret.key` | JWT 簽名密鑰 + API Key 加密金鑰（首次啟動自動生成 256-bit） |
| `invites.json` | 邀請碼（invite 策略用） |
| `audit.jsonl` | 稽核日誌 JSONL 備援（SQLite 寫入失敗時回退） |
| `backups/` | 自動備份（預設 6h 一次、保留 5 份） |
| `node-config.json` | Agent Node CLI 配置（server URL + JWT token） |

## 環境變數

### 基本

| 變數 | 預設 | 說明 |
|------|------|------|
| `PORT` | `13001` | HTTP 伺服器監聽埠 |
| `HTTPS` / `--https` | — | 啟用 HTTPS（自簽憑證自動產生） |
| `DEMO` / `--demo` | — | 演示模式 |
| `DEMO_AGENTS` | `3` | 演示代理數量 |
| `STRESS_TEST` / `--stress N` | `0` | 壓力測試代理數 |
| `DATA_DIR` | `~/.pixel-agents` | 使用者資料目錄 |
| `NODE_ENV` | `development` | `production` 啟用嚴格 CSP |
| `LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |

### 認證與安全

| 變數 | 預設 | 說明 |
|------|------|------|
| `REGISTRATION_POLICY` | `open` | `open`、`invite`、`closed` |
| `REQUIRE_PASSWORD_SPECIAL_CHAR` | — | `1` 強制密碼含特殊字元 |
| `API_KEY_ENCRYPTION_KEY` | — | 自訂 API Key 加密金鑰；未設時退回 JWT secret（若也缺則拋錯） |
| `TRUST_PROXY` | — | 反向代理部署時必設（`true`、`1`、CIDR），否則 `x-forwarded-for` 不被信任 |
| `ALLOWED_ORIGINS` | — | 逗號分隔額外 CORS/Socket.IO 來源 |

### 叢集

| 變數 | 預設 | 說明 |
|------|------|------|
| `REDIS_URL` | — | Redis URL；設定即自動啟用叢集模式（Socket.IO Redis adapter + 心跳） |
| `SERVER_ID` | 隨機 8 碼 | 叢集節點識別碼 |

## 安全設計

- **路徑遍歷**：`pathSecurity.validatePathWithinRoot()` 逐層檢查 `..`、null byte、符號連結實際解析（`fs.realpathSync` 比對 root）
- **API Key 比對**：`crypto.timingSafeEqual` 防 timing attack；快取命中 O(1)，未命中以常數時間遍歷解密
- **密碼雜湊**：bcrypt rounds = 12（`BCRYPT_SALT_ROUNDS` 常數）
- **API Key 加密**：AES-256-GCM；金鑰缺失時拒啟動而非 fallback 預設值
- **原子寫入**：`atomicWriteJson` 使用 `.tmp` + `fsync` + `rename` 三段式確保斷電一致性
- **速率限制**：`rateLimit.ts` 使用 FIFO LRU 上限（預設 10000 鍵）防止偽造 IP 填爆 store
- **稽核日誌**：`auditLog.redactSensitive()` 自動遮蔽 `password`/`token`/`apikey`/`secret` 等關鍵字（正則匹配 `key=value` 與 JSON 格式）
- **CSP**：production 模式嚴格 `default-src 'self'`，dev 放寬 `unsafe-eval` 給 Vite HMR
- **Agent Node 斷線 grace**：預設 30s 寬限期，短暫抖動重連可恢復代理狀態（`AGENT_NODE_RECONNECT_GRACE_MS`）

## 關鍵決策

### Web 版
- Express + Socket.IO 用於即時通訊（取代 VS Code postMessage）
- `socketApi.ts` 相容層 — 從 VS Code 版本到客戶端的最小變更
- 透過 JSONL 掃描自動偵測（純被動模式，無手動啟動按鈕）
- `spawn()` 管理 Claude 進程（清理環境變數以避免巢狀偵測）
- 演示模式用於無 Claude Code 的 UI 測試
- 國際化透過 `i18n.ts` 中的集中式 `t` 物件（非框架）
- Monorepo workspaces：`web/shared` + `web/server` + `web/client` + `web/agent-node`
- tmux 作為進程管理備選（支援 detach/reattach）
- `ClientMessage` discriminated union 型別確保客戶端訊息安全
- **Bundle 分割**：`main.tsx` 以 React.lazy 切 `App` 與 `Dashboard`；`App.tsx` 內 `TerminalPanel`（xterm.js 336KB）也 lazy；Vite manualChunks 分離 react-vendor / socket-vendor 以利長期快取
- **SQLite 優先，JSON 備援**：`db/database.ts` 啟動後所有持久化優先走 SQLite；`db/jsonMigration.ts` 在首次啟動自動從舊 JSON 遷移
- **走動自然化**：`advanceWalk()` helper 以像素距離（非時間）推進動畫幀；抬腳幀身體上抬 1px 實現 bob；方向改變時 `turnPauseTimer` 短暫停頓模擬轉身

### VS Code 擴充（原始版本）
- `WebviewViewProvider`（非 `WebviewPanel`）— 位於面板區域，與終端並列
- 內嵌 esbuild 問題匹配器（無需額外擴充）
- Webview 是獨立的 Vite 專案，擁有自己的 `node_modules`/`tsconfig`
