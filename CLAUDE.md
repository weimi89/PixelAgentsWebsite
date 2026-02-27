# OnlinePixelAgents — 壓縮參考文件

Web 應用程式（Express + Socket.IO），從 [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents) VS Code 擴充套件改造而來。像素藝術辦公室，AI 代理（Claude Code 會話）在瀏覽器中以動畫角色呈現。

## 架構

**主要開發在 `web/` 目錄。** 原始 VS Code 擴充套件程式碼保留在 `src/` + `webview-ui/` 供參考。

```
web/
  server/                     — Express + Socket.IO 後端（Node.js）
    src/
      index.ts                — 入口：Express 靜態檔案 + Socket.IO 連線處理
      agentManager.ts         — 代理生命週期：生成 Claude 進程、自動偵測、清理
      fileWatcher.ts          — fs.watch + 2s 輪詢、JSONL 增量讀取、自動收養
      transcriptParser.ts     — JSONL 解析：tool_use/tool_result → Socket.IO 訊息
      assetLoader.ts          — PNG 解析、精靈圖轉換、家具目錄建構、預設佈局載入
      layoutPersistence.ts    — ~/.pixel-agents/layout.json 讀寫
      timerManager.ts         — 等待/權限計時器邏輯
      demoMode.ts             — 演示模式：模擬代理行為序列（--demo 旗標）
      constants.ts            — 伺服器常數（計時、截斷、解析、端口 3000）
      types.ts                — 共享介面（AgentState, MessageSender）

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
      components/
        BottomToolbar.tsx      — + 代理、佈局切換、設定按鈕
        ZoomControls.tsx       — +/- 縮放（右上角）
        SettingsModal.tsx      — 設定、匯出/匯入佈局、音效切換、除錯切換
        DebugView.tsx          — 除錯覆蓋層
        AgentLabels.tsx        — 代理名稱標籤
      office/                 — 遊戲引擎（結構同 webview-ui/src/office/）
        types.ts, toolUtils.ts, colorize.ts, floorTiles.ts, wallTiles.ts
        sprites/              — spriteData.ts, spriteCache.ts
        editor/               — editorActions.ts, editorState.ts, EditorToolbar.tsx
        layout/               — furnitureCatalog.ts, layoutSerializer.ts, tileMap.ts
        engine/               — characters.ts, officeState.ts, gameLoop.ts, renderer.ts, matrixEffect.ts
        components/           — OfficeCanvas.tsx, ToolOverlay.tsx

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
| **進程管理** | VS Code Terminal API | `spawn('claude', ...)` 子進程 |
| **通訊** | `vscode.postMessage()` | Socket.IO（透過 `socketApi.ts` 相同介面） |
| **代理發現** | 終端收養 | JSONL 自動掃描 `~/.claude/projects/` |
| **資源服務** | esbuild 複製到 dist/ | Express 靜態檔案 + Vite 開發伺服器 |
| **佈局持久化** | `~/.pixel-agents/layout.json` | 同上 |
| **演示模式** | 無 | `--demo` 旗標或 `DEMO=1` 環境變數 |
| **國際化** | 無 | 內建繁體中文（`i18n.ts`） |

**socketApi.ts 相容層**：暴露 `vscode.postMessage()` 介面，底層由 Socket.IO 驅動，現有客戶端程式碼無需修改。

**自動偵測流程**：`ensureProjectScan()` 每 1s 執行 → 掃描 `~/.claude/projects/*/` 下的 `.jsonl` 檔案 → 30s 內修改的為「活躍」→ 自動建立代理（外部會話 process=null，帶 `projectName`）→ 超過 `STALE_AGENT_TIMEOUT_MS`（600s / 10 分鐘，容忍 extended thinking）無更新的陳舊代理自動移除。`IGNORED_PROJECT_DIR_PATTERNS`（`['observer-sessions']`）過濾掃描目錄，避免將 claude-mem 等觀察者會話當作代理。

**演示模式**：`--demo` 旗標或 `DEMO=1` → 生成 N 個模擬代理（預設 3），循環執行工具序列（Read→Edit→Bash、Glob→Read→Grep→Edit 等），包含子任務模擬。

## 核心概念

**術語**：Session = `~/.claude/projects/<hash>/` 下的 JSONL 對話檔案。Agent = 與會話 1:1 綁定的動畫角色。VS Code 版中：Terminal = 執行 Claude 的 VS Code 終端。

**伺服器 ↔ 客戶端**（Web）：Socket.IO 雙向 `emit('message', msg)`。`socketApi.ts` 包裝為 `vscode.postMessage()` 以維持客戶端相容性。主要訊息類型：`openClaude`、`agentCreated/Closed`、`focusAgent`、`agentToolStart/Done/Clear`、`agentStatus`、`existingAgents`、`layoutLoaded`、`furnitureAssetsLoaded`、`floorTilesLoaded`、`wallTilesLoaded`、`saveLayout`、`saveAgentSeats`、`settingsLoaded`、`setSoundEnabled`、`characterSpritesLoaded`、`subagentToolStart/Done`、`subagentClear`、`agentToolPermission/PermissionClear`、`subagentToolPermission`、`agentModel`、`agentDetached`、`agentThinking`、`agentEmote`、`sessionsList`、`exportLayoutData`。

**代理建立**（Web）：兩種路徑 — (1) 手動：點擊「+ 代理」→ `spawn('claude', ['--session-id', uuid])` → 1s 輪詢 JSONL → 啟動檔案監視。(2) 自動偵測：`ensureProjectScan()` 發現活躍 JSONL → 建立 process=null 的代理。外部專案代理（非本專案的 JSONL）帶 `isExternal` 標記和 `projectName`（從目錄路徑提取），`agentCreated` 訊息包含 `projectName` 供標籤顯示。

**擴充 ↔ Webview**（VS Code）：`postMessage` 協議，訊息類型同上。

**一代理一會話**：每個 Claude 會話對應一個角色。VS Code 中：一個終端 = 一個代理。

**自動偵測**（僅 Web）：每 1s 掃描所有 `~/.claude/projects/*/` 目錄（排除 `IGNORED_PROJECT_DIR_PATTERNS` 中的目錄），尋找 30s 內修改的 `.jsonl` 檔案。新檔案 → 自動建立代理（附帶 `projectName`）。超過 `STALE_AGENT_TIMEOUT_MS`（600s）無更新的陳舊代理 → 自動移除。

## 代理狀態追蹤

JSONL 轉錄檔位於 `~/.claude/projects/<project-hash>/<session-id>.jsonl`。專案雜湊 = 工作區路徑中的 `:`/`\`/`/` → `-`。

**JSONL 記錄類型**：`assistant`（tool_use 區塊、thinking 區塊或 image 區塊）、`user`（tool_result 或文字提示）、`system` 帶 `subtype`：`"turn_duration"`（可靠的回合結束訊號）、`"compact_boundary"`（上下文壓縮 → compress 表情）。`progress` 帶 `data.type`：`agent_progress`（子代理 tool_use/tool_result 轉發至 webview，非豁免工具觸發權限計時器）、`bash_progress`（長時間執行的 Bash 輸出 — 重啟權限計時器以確認工具正在執行）、`mcp_progress`（MCP 工具狀態 — 相同的計時器重啟邏輯）、`waiting_for_task`（父代理等待子任務 → eye 表情）。assistant 記錄中的 `thinking` 區塊觸發 `agentThinking` 訊息（角色踱步動畫），`image` 區塊觸發 `agentEmote: camera`（相機表情）。已觀察但未追蹤：`file-history-snapshot`、`queue-operation`。

**檔案監視**：混合 `fs.watch` + 2s 輪詢備份。部分行緩衝處理寫入中途的讀取。工具完成訊息延遲 300ms 以防止閃爍。

**每個代理的擴充狀態**：`id, terminalRef, projectDir, jsonlFile, fileOffset, lineBuffer, activeToolIds, activeToolStatuses, activeToolNames, activeSubagentToolIds, activeSubagentToolNames, isWaiting, hadToolsInTurn, permissionSent, model, isExternal, projectName`。

**持久化**：代理持久化至 `workspaceState` 鍵 `'pixel-agents.agents'`（包含 palette/hueShift/seatId）。**佈局持久化至 `~/.pixel-agents/layout.json`**（使用者層級，跨所有 VS Code 視窗/工作區共享）。`layoutPersistence.ts` 處理所有檔案 I/O：`readLayoutFromFile()`、`writeLayoutToFile()`（透過 `.tmp` + rename 的原子操作）、`migrateAndLoadLayout()`（檢查檔案 → 遷移舊的工作區狀態 → 回退至捆綁預設值）、`watchLayoutFile()`（混合 `fs.watch` + 2s 輪詢以實現跨視窗同步）。儲存時，`markOwnWrite()` 防止監視器重新讀取自己的寫入。外部變更推送 `layoutLoaded` 至 webview；若編輯器有未儲存的變更則跳過（最後儲存者優先）。Webview 就緒時：`restoreAgents()` 將持久化條目與活躍終端配對。`nextAgentId`/`nextTerminalIndex` 推進至超過已恢復的值。**預設佈局**：當無已儲存的佈局檔案且無工作區狀態可遷移時，從 `assets/` 載入捆綁的 `default-layout.json` 並寫入檔案。若也不存在，`createDefaultLayout()` 生成基礎辦公室。更新預設值：從命令面板執行「Pixel Agents: Export Layout as Default」（將當前佈局寫入 `webview-ui/public/assets/default-layout.json`），然後重新建置。**匯出/匯入**：設定面板提供匯出佈局（儲存對話框 → JSON 檔案）和匯入佈局（開啟對話框 → 驗證 `version: 1` + `tiles` 陣列 → 寫入佈局檔案 + 推送 `layoutLoaded` 至 webview）。

## 辦公室 UI

**渲染**：遊戲狀態在命令式 `OfficeState` 類別中（非 React state）。像素完美：zoom = 整數裝置像素/精靈像素（1x–10x）。不使用 `ctx.scale(dpr)`。預設縮放 = `Math.round(2 * devicePixelRatio)`。所有實體按 Y 軸 Z 排序。透過滑鼠中鍵拖曳平移（`panRef`）。**鏡頭追蹤**：`cameraFollowId`（與 `selectedAgentId` 分離）平滑地將鏡頭置中於被追蹤的代理；點擊代理時設定，取消選取或手動平移時清除。

**UI 風格**：像素藝術美學 — 所有覆蓋層使用銳角（`borderRadius: 0`）、實心背景（`#1e1e2e`）、`2px solid` 邊框、硬偏移陰影（`2px 2px 0px #0a0a14`，無模糊）。CSS 變數定義在 `index.css` `:root`（`--pixel-bg`、`--pixel-border`、`--pixel-accent` 等）。像素字型：FS Pixel Sans（`webview-ui/src/fonts/`），透過 `@font-face` 在 `index.css` 中載入，全域套用。

**角色**：10 種 FSM 狀態 — IDLE（站立等待）、WALK（尋路移動）、TYPE（坐在座位打字）、CHAT（與鄰近角色面對面聊天）、INTERACT（與家具互動）、STAND_WORK（站在白板前工作）、THINK（來回踱步，由伺服器 `agentThinking` 觸發）、STRETCH（久坐後伸展）、USE_WALL（面對牆壁物件互動）、SLEEP（長時間閒置後打瞌睡）。活躍代理尋路至座位，依工具類型播放打字/閱讀動畫；閒置代理以加權隨機選擇行為（`wanderLimit` 次漫遊後返回座位）。**加權漫遊**：6 類行為以權重選取 — IDLE_LOOK 站著轉方向(30)、隨機漫遊(30)、家具互動(15)、聊天(10)、牆壁互動(10)、返回座位(5)。漫遊半徑限制 3 格、路徑最長 5 步。STRETCH 由 `sitTimer > 180s` 觸發，SLEEP 由 `sleepTimer > 300s` 觸發。4 方向精靈圖，左 = 翻轉右。工具動畫：打字（Write/Edit/Bash/Task）vs 閱讀（Read/Grep/Glob/WebFetch）。坐姿偏移：角色在 TYPE 狀態時向下移動 6px 以視覺上坐在椅子上。Z 排序使用 `ch.y + TILE_SIZE/2 + 0.5` 使角色渲染在同行家具（椅子）前方，但在低行家具（書桌、書架）後方。椅子 Z 排序：非背面椅子使用 `zY = (row+1)*TILE_SIZE`（限制至第一行）使角色在任何座位格渲染在前方；背面椅子使用 `zY = (row+1)*TILE_SIZE + 1` 使椅背渲染在角色前方。椅子格對所有角色封鎖，除了其自身指定的座位（透過 `withOwnSeatUnblocked` 的每角色尋路）。**多元調色盤分配**：`pickDiversePalette()` 計算當前非子代理角色的調色盤使用數量；從最少使用的調色盤中隨機選取。前 6 個代理各得到唯一外觀；超過 6 個後，外觀重複並套用隨機色相偏移（45–315°），透過 `adjustSprite()`。角色儲存 `palette`（0-5）+ `hueShift`（角度）。精靈圖快取以 `"palette:hueShift"` 為鍵。

**生成/消散特效**：Matrix 風格數位雨動畫（0.3s）。16 個垂直欄由上至下掃過，帶交錯時序（每欄隨機種子）。生成：綠色雨幕後方顯現角色像素。消散：角色像素被綠色雨尾吞噬。角色上的 `matrixEffect` 欄位（`'spawn'`/`'despawn'`/`null`）。特效期間正常 FSM 暫停。消散中的角色跳過碰撞檢測。已恢復的代理（`existingAgents`）使用 `skipSpawnEffect: true` 立即出現。`matrixEffect.ts` 包含 `renderMatrixEffect()`（逐像素渲染），從渲染器中取代快取精靈圖繪製。

**子代理**：負數 ID（從 -1 遞減）。在 `agentToolStart` 時以 "Subtask:" 前綴建立。與父代理相同的 palette + hueShift。點擊聚焦父終端。不持久化。在距離父代理最近的空閒座位生成（曼哈頓距離）；備選：最近的可行走格。**子代理權限偵測**：當子代理執行非豁免工具時，`startPermissionTimer` 在父代理上觸發；若 5s 內無資料，權限氣泡同時出現在父代理和子代理角色上。`activeSubagentToolNames`（parentToolId → subToolId → toolName）追蹤哪些子工具為活躍狀態以進行豁免檢查。資料恢復或 Task 完成時清除。

**表情系統**：10 種 EmoteType — 閒置行為觸發：COFFEE（咖啡機互動）、WATER（飲水機互動）、STAR（完成互動）、ZZZ（睡眠時循環）、IDEA（踱步思考）、HEART（聊天）、NOTE（白板互動）。伺服器 JSONL 偵測觸發：CAMERA（`image` 區塊，代理處理圖片）、EYE（`waiting_for_task` 進度，父代理等待子任務）、COMPRESS（`compact_boundary` 系統記錄，上下文壓縮）。每個表情為 7×7 像素精靈圖，定義在 `spriteData.ts` 的 `EMOTE_SPRITES` 查找表中。顯示機制：`ch.emoteType` + `ch.emoteTimer`（倒數 `EMOTE_DISPLAY_DURATION_SEC = 2s`），由 `officeState.update()` 每幀遞減。伺服器觸發透過 `agentEmote` 訊息 → `officeState.showEmote()` 設定。防覆蓋邏輯：若現有表情剩餘時間 > 1s 則不替換。

**對話氣泡**：權限（"..." 琥珀色圓點）保持直到點擊/清除。等待（綠色勾號）2s 自動淡出。斷線（`detached`）持續顯示直到重新連線。精靈圖在 `spriteData.ts` 中。

**音效通知**：上行雙音提示音（E5 → E6），透過 Web Audio API 在等待氣泡出現時播放（`agentStatus: 'waiting'`）。`notificationSound.ts` 管理 AudioContext 生命週期；`unlockAudio()` 在畫布 mousedown 時呼叫以確保 context 已恢復（webview 啟動時為暫停狀態）。透過設定面板中的「音效通知」核取方塊切換。預設啟用；持久化在擴充 `globalState` 鍵 `pixel-agents.soundEnabled`，啟動時以 `settingsLoaded` 發送至 webview。

**座位**：衍生自椅子家具。`layoutToSeats()` 在每張椅子的每個佔地格建立座位。多格椅子（如 2 格沙發）產生多個座位，鍵為 `uid` / `uid:1` / `uid:2`。面向方向優先順序：1) 椅子 `orientation`（目錄中的 front→DOWN、back→UP、left→LEFT、right→RIGHT），2) 相鄰書桌方向，3) 前方（DOWN）。點擊角色 → 選取（白色輪廓）→ 點擊可用座位 → 重新指定。

## 佈局編輯器

透過「佈局」按鈕切換。工具：SELECT（預設）、地板繪製、牆壁繪製、擦除（設定格為 VOID）、家具放置、家具拾取（家具類型吸管）、吸管（地板）。

**地板**：`floors.png` 中 7 種花紋（灰階 16×16），可透過 HSBC 滑桿著色（Photoshop 著色模式）。顏色在繪製時烘焙至每格。吸管拾取花紋+顏色。

**牆壁**：獨立的牆壁繪製工具。點擊/拖曳新增牆壁；點擊/拖曳現有牆壁移除（切換方向由拖曳首格決定，透過 `wallDragAdding` 追蹤）。HSBC 色彩滑桿（著色模式）一次套用至所有牆磚。在牆磚上使用吸管會拾取其顏色並切換至牆壁工具。家具不能放在牆磚上，但背景行（前 N 個 `backgroundTiles` 行）可與牆壁重疊。

**家具**：幽靈預覽（綠色/紅色有效性）。R 鍵旋轉，T 鍵切換開/關狀態。SELECT 中拖曳移動。選取項目上的刪除按鈕（紅色 X）+ 旋轉按鈕（藍色箭頭）。任何選取的家具顯示 HSBC 色彩滑桿（色彩切換 + 清除按鈕）；顏色儲存在每項目的 `PlacedFurniture.color?`。每次色彩編輯會話一個撤銷條目（透過 `colorEditUidRef` 追蹤）。拾取工具複製已放置項目的類型+顏色。堆疊家具點擊時優先選取表面項目。

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
- `--output-format stream-json` 需要非 TTY stdin — 無法與 VS Code 終端搭配使用
- Hook 式 IPC 失敗（hooks 在啟動時捕獲，env vars 不會傳播）。JSONL 監視可行
- PNG→SpriteData：pngjs 處理 RGBA 緩衝區，alpha 閾值 128
- OfficeCanvas 選取變更是命令式的（`editorState.selectedFurnitureUid`）；必須呼叫 `onEditorSelectionChange()` 以觸發 React 重新渲染工具列

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

## 關鍵模式

- `crypto.randomUUID()` 在 VS Code 擴充主機中可用
- Terminal `cwd` 選項在建立時設定工作目錄
- `/add-dir <path>` 授予會話對額外目錄的存取權限

## 關鍵決策

### Web 版
- Express + Socket.IO 用於即時通訊（取代 VS Code postMessage）
- `socketApi.ts` 相容層 — 從 VS Code 版本到客戶端的最小變更
- 透過 JSONL 掃描自動偵測（無需終端綁定）
- `spawn()` 管理 Claude 進程（清理環境變數以避免巢狀偵測）
- 演示模式用於無 Claude Code 的 UI 測試
- 國際化透過 `i18n.ts` 中的集中式 `t` 物件（非框架）
- Monorepo workspaces：`web/server` + `web/client`

### VS Code 擴充（原始版本）
- `WebviewViewProvider`（非 `WebviewPanel`）— 位於面板區域，與終端並列
- 內嵌 esbuild 問題匹配器（無需額外擴充）
- Webview 是獨立的 Vite 專案，擁有自己的 `node_modules`/`tsconfig`
