# 變更紀錄

本檔案遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/) 與 [Semantic Versioning](https://semver.org/lang/zh-TW/) 風格。

## [Unreleased]

### 新增
- **CLI：`pixel-agents` 可執行命令**
  - `web/bin/pixel-agents.mjs` 零依賴 Node CLI
  - 自動偵測 server 就緒後開瀏覽器
  - 支援 `--port` / `--demo` / `--demo-agents` / `--data-dir` / `--no-open` / `--help` / `--version`
  - 跨平台（macOS `open` / Linux `xdg-open` / Windows `start`）
  - 環境變數 `PIXEL_AGENTS_CLIENT_DIST` / `PIXEL_AGENTS_ASSETS_ROOT` 可覆寫資源路徑（支援打包部署）
- `npm run cli` 與 `npm run demo` / `npm run demo:record` 便捷腳本

### 變更
- Server `findAssetsRoot()` 新增環境變數覆寫（檢查 0 優先級）
- Server `clientDistPath` 改為 `findClientDist()` 支援環境變數

---

## [之前的變更]

### 新增
- `/ready` 就緒檢查端點（考量 Redis 連線狀態）
- ErrorBoundary 支援 `fallback` 與 `name` props；OfficeCanvas 與 TerminalPanel 各自擁有錯誤邊界
- `gameLoop` 逐幀 try/catch（同類錯誤 60s 內僅記錄一次）
- 環境變數 `TRUST_PROXY`：控制 `x-forwarded-for` 是否被信任
- 環境變數 `REQUIRE_PASSWORD_SPECIAL_CHAR`：強制密碼含特殊字元
- 環境變數 `API_KEY_ENCRYPTION_KEY`：自訂 API Key 加密金鑰
- `AGENT_NODE_RECONNECT_GRACE_MS` 常數：Agent Node 斷線 30 秒 grace 期
- `/api/auth/users` 的 API Key 以 `pa_****xxxx` 遮罩回傳
- `maskApiKey()` 函式
- `pathSecurity.validatePathWithinRoot()` 新增 `realpath` 檢查防符號連結逃逸
- `auditLog.redactSensitive()` 自動遮蔽 `password`/`token`/`apikey`/`secret` 等關鍵字
- `rateLimit` 新增 `maxKeys` 參數（預設 10000），FIFO 驅逐防偽造 IP 填爆
- `Character.geminiLastSize` 與 `geminiMessageCount`：分離 Gemini 讀取游標語意
- `Character.turnPauseTimer`：轉向停頓
- 走動動畫：身體 bob (1px)、動畫幀依像素距離同步
- `notificationSound.closeAudio()`：頁面卸載時釋放 AudioContext
- `notificationSound` 在 master 關閉時自動 suspend AudioContext
- `fileWatcher.stopProjectScan()` 顯式停止介面
- GitHub Actions CI workflow（typecheck + lint + test + build + audit）
- Git pre-commit hook（`.githooks/pre-commit`，自動啟用）
- `SECURITY.md` 資安政策
- `CHANGELOG.md`（本檔案）

### 變更
- bcrypt rounds 從 10 提升至 12
- Socket.IO 連線狀態訂閱改為訂閱當下立即同步 socket.connected 狀態（解決 lazy App 載入後「已斷線」錯誤顯示）
- API Key 比對改為 `crypto.timingSafeEqual`，防止 timing attack
- JWT secret 缺失時拋錯，不再 fallback 至硬編碼 `'pixel-agents-default-key'`
- `atomicWriteJson` 加入 `fsync`，斷電不會留下半寫入正式檔
- 子進程、PTY、Socket.IO、fs.watch 等資源在 `removeAgent` / teardown 階段統一 `removeAllListeners`
- `reassignAgentToFile` 會重置 Gemini 相關游標
- 編輯快捷鍵 (Delete/Backspace/R/F/V/T) 加 `preventDefault` 避免瀏覽器副作用
- useTheme：`useEffect` 依賴 `theme` 以支援外部同步
- chatHistory 寫入改為不可變 slice
- AuthPanel 的 `resetForm` 宣告順序修正，避免 TDZ
- `saveAgentSeats` 加入權限拒絕靜默白名單（匿名訪客不顯示 toast）
- Bundle code splitting：Dashboard、App、TerminalPanel 各為獨立 chunk；react-vendor、socket-vendor 抽離
- 主頁首載從 921KB（gzip 242KB）降至 ~569KB（gzip 154KB），約 **-40%**

### 修復
- `/health` endpoint 重複註冊的 dead code 清除
- `npm audit` 高嚴重度 `flatted` 與中嚴重度 `brace-expansion` 漏洞
- Socket.IO lazy 載入後連線狀態永遠顯示「已斷線」的 race condition
- Gemini 會話檔案的 `lineBuffer`/`fileOffset` 欄位語意混用

### 安全
- 14 項安全稽核項目逐一修復（詳見 SECURITY.md）

---

## 資料格式說明

截至目前尚未發布正式版本；所有變更均累積於 `[Unreleased]`。
發布 v1.0.0 時此段將定版並加上日期。
