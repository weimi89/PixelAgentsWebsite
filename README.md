# OnlinePixelAgents

[![CI](https://github.com/weimi89/PixelAgentsWebsite/actions/workflows/ci.yml/badge.svg)](https://github.com/weimi89/PixelAgentsWebsite/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](#需求)
[![Tests](https://img.shields.io/badge/tests-139_passing-brightgreen.svg)](#測試)

像素藝術辦公室，讓你的 AI 程式代理在瀏覽器中變成動畫角色。

基於 [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)（VS Code 擴充套件）改造為獨立 Web 應用，透過 Express + Socket.IO 伺服器自動偵測本機執行中的 Claude Code 會話，無需 VS Code。

![Pixel Agents screenshot](webview-ui/public/Screenshot.jpg)

## 功能

- **一個代理，一個角色** — 每個 Claude Code 會話對應一個動畫像素角色
- **即時狀態追蹤** — 角色動畫反映代理實際操作（撰寫、閱讀、執行指令）
- **自動偵測** — 伺服器自動掃描 `~/.claude/projects/` 目錄，發現執行中的 Claude Code 會話
- **多樓層系統** — 虛擬辦公室大樓，每層有獨立佈局，代理依專案分配至不同樓層
- **多機器連線** — 遠端機器透過 Agent Node CLI 連線至中央伺服器，統一顯示所有代理
- **專案排除管理** — 可在工作階段選擇器中隱藏不想追蹤的專案資料夾
- **自訂專案名稱** — 雙擊代理標籤自訂顯示名稱，持久化於設定檔
- **工作階段瀏覽** — 搜尋、篩選、恢復過去的 Claude Code 會話
- **辦公室佈局編輯器** — 內建編輯器設計地板、牆壁和家具
- **家具旋轉與翻轉** — R 旋轉、F 水平翻轉、V 垂直翻轉、T 切換開/關狀態
- **對話氣泡** — 視覺提示：代理等待輸入或需要授權
- **10 種表情系統** — 閒置行為與 JSONL 偵測觸發的像素表情動畫
- **工具顏色編碼** — 依工具類型自動著色，一目了然
- **工具耗時追蹤** — 即時顯示每個工具的執行時間
- **音效通知** — 代理完成回合時的可選提示音
- **子代理視覺化** — Task 工具的子代理以獨立角色呈現，帶光暈特效
- **佈局持久化** — 辦公室設計儲存於 `~/.pixel-agents/floors/`
- **演示模式** — 無需實際 Claude 會話，使用 `--demo` 旗標測試 UI
- **繁體中文介面** — 內建 i18n 本地化支援
- **6 種多元角色** — 超過 6 個代理時自動套用色相偏移

<p align="center">
  <img src="webview-ui/public/characters.png" alt="Pixel Agents characters" width="320" height="72" style="image-rendering: pixelated;">
</p>

## 需求

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安裝並設定

## 快速開始

### Web 版本（推薦）

```bash
git clone https://github.com/RD-CAT/OnlinePixelAgents.git
cd OnlinePixelAgents/web
npm install
npm run build
npm start
```

瀏覽器開啟 `http://localhost:13001`（預設）。可用 `PORT` 環境變數調整。

### 開發模式

```bash
cd web
npm run dev
```

同時啟動 Vite 開發伺服器（客戶端熱重載）和 tsx watch（伺服器熱重載）。

### 演示模式

無需 Claude Code，純 UI 測試：

```bash
cd web/server
node dist/index.js --demo
# 或指定代理數量
DEMO_AGENTS=5 node dist/index.js --demo
```

### 使用方式

1. 啟動 Web 伺服器後開啟瀏覽器
2. 伺服器會自動掃描並偵測本機執行中的 Claude Code 會話
3. 偵測到的會話自動顯示為辦公室中的動畫角色
4. 點擊角色選取，再點擊座位重新指定位置
5. 點擊 **空間** 開啟辦公室編輯器自訂空間
6. 點擊 **工作階段** 瀏覽和恢復過去的會話
7. 在工作階段面板底部的「專案資料夾」管理要追蹤的專案
8. 使用底部樓層按鈕切換不同樓層

## 架構

```
web/
  shared/                     — 共享型別與純函式（server + agent-node 共用）
    src/
      protocol.ts             — Agent Node <-> Server 協議型別
      formatToolStatus.ts     — 工具狀態格式化 + 權限豁免清單

  server/                     — Express + Socket.IO 伺服器 (Node.js)
    src/
      index.ts                — 入口：Express 靜態檔案 + Socket.IO + auth 路由 + Agent Node namespace
      agentManager.ts         — 代理生命週期：自動偵測、會話恢復、清理
      agentNodeHandler.ts     — Agent Node namespace：JWT 認證、遠端代理管理、30s 重連 grace
      fileWatcher.ts          — fs.watch + 輪詢、JSONL 增量讀取、自動收養
      transcriptParser.ts     — JSONL 解析 -> Socket.IO 訊息
      auth/                   — JWT 認證、使用者管理（bcrypt r=12）、Socket.IO auth 中間件、邀請碼
      atomicWrite.ts          — JSON 原子寫入（.tmp + fsync + rename）
      pathSecurity.ts         — 路徑遍歷與符號連結逃逸防護
      rateLimit.ts            — API 速率限制（FIFO LRU 驅逐）
      auditLog.ts             — 稽核日誌（SQLite + JSONL 備援，自動遮蔽敏感欄位）
      backup.ts               — 自動備份（預設每 6h，保留 5 份）
      cluster.ts              — 叢集心跳（Redis 啟用時）
      db/                     — SQLite 資料庫、Redis 快取、JSON 遷移
      config.ts               — 環境變數集中讀取
      logger.ts               — 結構化 logger
      assetLoader.ts          — PNG 解析、精靈圖轉換、家具目錄載入
      buildingPersistence.ts  — 建築物配置 + 樓層佈局持久化
      floorAssignment.ts      — 專案 -> 樓層映射持久化
      layoutPersistence.ts    — 舊版單層佈局（保留供備用）
      projectNameStore.ts     — 自訂專案名稱 + 專案排除清單
      sessionScanner.ts       — 工作階段掃描（瀏覽過去會話）
      timerManager.ts         — 等待/權限計時器
      tmuxManager.ts          — tmux 會話管理與健康檢查
      terminalManager.ts      — 本地 PTY 管理（node-pty）
      lanDiscovery.ts         — UDP 區網自動發現
      demoMode.ts             — 演示模式：模擬代理行為序列
      stressTest.ts           — 壓力測試代理生成器
      constants.ts            — 伺服器常數（計時、截斷、解析、端口）
      types.ts                — 共享介面（AgentState, ClientMessage, FloorConfig, BuildingConfig）

  client/                     — React + TypeScript (Vite)
    src/
      App.tsx                 — 組合根：hooks + components + EditActionBar
      socketApi.ts            — Socket.IO <-> postMessage 相容層
      i18n.ts                 — 繁體中文本地化字串
      constants.ts            — 網格/動畫/渲染/相機/縮放/遊戲邏輯常數
      hooks/
        useExtensionMessages.ts — Socket.IO 訊息 -> officeState 同步
        useEditorActions.ts     — 編輯器狀態 + 回呼
        useEditorKeyboard.ts    — 快捷鍵綁定
      components/
        BottomToolbar.tsx      — 工作階段、空間切換、設定按鈕
        SessionPicker.tsx      — 工作階段瀏覽器 + 專案資料夾管理
        SettingsModal.tsx      — 設定、匯出/匯入佈局、音效切換
        AgentLabels.tsx        — 代理名稱標籤（可雙擊改名）
        FloorSelector.tsx      — 樓層切換按鈕列
        ZoomControls.tsx       — +/- 縮放（右上角）
        DebugView.tsx          — 除錯覆蓋層
        ErrorBoundary.tsx      — React 錯誤邊界
      office/                 — 遊戲引擎（渲染、角色 FSM、BFS 尋路）
        types.ts              — 遊戲型別定義（EmoteType, CharacterState 等）
        toolUtils.ts          — 工具名稱解析、顏色編碼
        colorize.ts           — 著色/調整模組
        sprites/              — spriteData.ts, spriteCache.ts
        editor/               — editorActions.ts, editorState.ts, EditorToolbar.tsx
        layout/               — furnitureCatalog.ts, layoutSerializer.ts, tileMap.ts
        engine/               — characters.ts, officeState.ts, gameLoop.ts, renderer.ts, matrixEffect.ts
        components/           — OfficeCanvas.tsx, ToolOverlay.tsx

  agent-node/                 — Agent Node CLI 套件（遠端機器連線至中央伺服器）
    src/
      cli.ts                  — CLI 入口：login / start 子命令
      scanner.ts              — JSONL 掃描器（偵測活躍的 Claude 會話）
      parser.ts               — 簡化版轉錄解析器（JSONL -> AgentNodeEvent）
      agentTracker.ts         — 代理追蹤器（fs.watch + 輪詢、增量讀取）
      connection.ts           — Socket.IO 連線管理（/agent-node namespace）
```

原始 VS Code 擴充套件程式碼保留於根目錄的 `src/` 和 `webview-ui/`。

## 佈局編輯器

內建編輯器支援：

- **地板** — 7 種花紋 + HSB 色彩控制
- **牆壁** — 自動拼接 + 色彩自訂
- **工具** — 選取、繪製、擦除、放置、吸管、拾取
- **家具操作** — R 旋轉、F 水平翻轉、V 垂直翻轉、T 切換狀態
- **撤銷/重做** — 50 層歷史 Ctrl+Z / Ctrl+Y
- **匯出/匯入** — 透過設定面板以 JSON 格式分享佈局

網格可擴展至 64x64 格。

## 環境變數

伺服器支援以下環境變數（全部選用）：

### 基本

| 變數 | 預設 | 說明 |
|------|------|------|
| `PORT` | `13001` | HTTP 伺服器監聽埠 |
| `HTTPS` | — | 設為 `1` 啟用 HTTPS（自簽憑證） |
| `DEMO` / `--demo` | — | 演示模式 |
| `DEMO_AGENTS` | `3` | 演示模式代理數量 |
| `DATA_DIR` | `~/.pixel-agents` | 使用者資料目錄 |
| `NODE_ENV` | `development` | `production` 啟用嚴格 CSP |

### 認證與安全

| 變數 | 預設 | 說明 |
|------|------|------|
| `REGISTRATION_POLICY` | `open` | 註冊策略：`open`、`invite`、`closed` |
| `REQUIRE_PASSWORD_SPECIAL_CHAR` | — | `1` 強制密碼含特殊字元 |
| `API_KEY_ENCRYPTION_KEY` | — | API Key 加密金鑰（未設定時使用 JWT secret） |
| `TRUST_PROXY` | — | 在反向代理後方部署時設為 `true`、`1` 或 CIDR，使 `req.ip` 正確反映原始客戶端 |
| `ALLOWED_ORIGINS` | — | 逗號分隔，額外允許的 Socket.IO/CORS 來源 |

### 叢集與擴展

| 變數 | 預設 | 說明 |
|------|------|------|
| `REDIS_URL` | — | Redis 連線 URL，啟用後自動開啟叢集模式 |
| `SERVER_ID` | 隨機 8 碼 | 叢集節點識別碼 |
| `LOG_LEVEL` | `info` | `debug`、`info`、`warn`、`error` |

> **生產部署提示**：若部署在 nginx/Cloudflare 等反向代理後，務必設 `TRUST_PROXY`，否則速率限制會將所有請求判為同一來源。

## 多機器連線

透過 Agent Node CLI，遠端機器可將其 Claude Code 會話推送至中央伺服器：

```bash
# 在遠端機器上
npx pixel-agents-node login --server http://your-server:3000
npx pixel-agents-node start
```

遠端代理在瀏覽器中以橘色光暈標示，並顯示擁有者名稱。

## 辦公室素材

辦公室圖磚使用 **[Office Interior Tileset (16x16)](https://donarg.itch.io/officetileset)** by **Donarg**（itch.io，$2 USD）。

此為專案中唯一非免費部分，圖磚未包含在倉庫中。購買後執行素材導入管線：

```bash
npm run import-tileset
```

無圖磚時仍可運作 — 會有預設角色和基礎佈局，但完整家具目錄需要導入的素材。

## 技術棧

- **Web 伺服器**: Node.js, Express 5, Socket.IO 4, TypeScript, pngjs, better-sqlite3, bcryptjs, ioredis（選用）
- **Web 客戶端**: React 19, TypeScript, Vite 7, Canvas 2D, Socket.IO Client, xterm.js
- **原始擴充**: TypeScript, VS Code Webview API, esbuild

## 部署考量

### 首載 bundle
前端採 lazy loading 分離：
- 主頁首載 ~569KB（gzip 154KB）— 含 React + Socket.IO + App
- `TerminalPanel`（xterm.js）延後至實際開終端才載入 336KB
- `Dashboard` 僅 hash `#/dashboard` 時執行

### 資料目錄
所有使用者資料儲存於 `~/.pixel-agents/`：
- `pixel-agents.db` — 主要 SQLite 資料庫
- `building.json` + `floors/*.json` — 樓層佈局
- `users.json` / `jwt-secret.key` — 認證（有 SQLite 後優先存 DB）
- `audit.jsonl` — 稽核日誌（備援）
- `backups/` — 自動備份

## 貢獻與成長

這個專案希望**持續演進**。無論是修 typo、補測試、提新想法都歡迎：

- 📜 [`ROADMAP.md`](ROADMAP.md) — 短 / 中 / 長期方向與明確劃界
- 🛠 [`CONTRIBUTING.md`](CONTRIBUTING.md) — 開發環境、風格、PR 流程
- 🔒 [`SECURITY.md`](SECURITY.md) — 漏洞回報與現行安全機制
- 📝 [`CHANGELOG.md`](CHANGELOG.md) — 所有累積變更

**快速貢獻**：

```bash
# 1. Fork + clone
cd web && npm install   # 自動設定 pre-commit hook（typecheck + test）
# 2. 建立 feature branch 並寫改動
# 3. 送 PR — CI 會跑 typecheck / lint / test / build / bundle size / audit
```

### 成長指標（最新）

| 指標 | 目前 |
|---|---|
| 測試數 | 139 passing |
| Lint errors | 0 |
| npm audit（moderate+） | 0 vulnerabilities |
| Bundle 首載 (gzip) | 154 KB |
| TypeScript | strict |

## 致謝

本專案基於 [pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)，以 MIT 授權條款釋出。感謝原作者 [Pablo De Lucca](https://github.com/pablodelucca) 的出色作品。

## 授權條款

本專案以 [MIT License](LICENSE) 授權。
