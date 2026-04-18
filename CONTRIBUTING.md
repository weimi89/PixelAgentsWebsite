# 貢獻指南

歡迎！這個專案希望**持續成長**，任何大小貢獻都有價值 — 修 typo、補測試、提新想法都歡迎。

## 🚀 快速開始

```bash
git clone https://github.com/weimi89/PixelAgentsWebsite.git
cd PixelAgentsWebsite/web
npm install        # 自動設定 pre-commit hook
npm run dev        # 啟動 Vite + server
```

開啟 http://localhost:5173 即可看到界面。預設帳號 `admin:admin`（首次登入會強制變更）。

## 🏗 架構速覽

```
web/
  shared/      — TypeScript 型別 + 純函式（server 與 agent-node 共用）
  server/      — Express + Socket.IO + SQLite
  client/      — React 19 + Canvas 2D + Socket.IO Client
  agent-node/  — 遠端機器 CLI（將本機 Claude 會話推送至伺服器）
```

完整架構請讀 [`CLAUDE.md`](CLAUDE.md) 和 [`docs/ROADMAP.md`](docs/ROADMAP.md)。

## 💬 貢獻流程

### 🐛 發現 bug

1. 先用 [Issue 搜尋](../../issues?q=is%3Aissue) 確認是否已被回報
2. 若無，以 `bug-report` 範本開新 issue
3. 附上：重現步驟、預期行為、實際行為、環境資訊
4. **嚴重安全漏洞請走 [`SECURITY.md`](SECURITY.md) 私下管道**

### ✨ 提議新功能

1. 先看 [`ROADMAP.md`](ROADMAP.md) 確認方向
2. 以 `feature-request` 範本開 issue 描述**使用情境**（為什麼需要）
3. 較大型功能建議先討論設計，**避免寫完才發現方向不對**

### 🔧 送 PR

1. Fork → 建立 feature branch（名稱如 `feat/xxx`、`fix/xxx`、`docs/xxx`）
2. 保持每個 PR **專注於單一目標**（重構 + 新功能混一起很難 review）
3. 提交前：
   ```bash
   cd web
   npm run typecheck   # TypeScript 必須過
   npm run lint        # 0 errors
   npm test            # 所有測試通過
   npm run build       # 建置成功
   ```
   （pre-commit hook 會自動跑 typecheck + test）
4. 填寫 PR 範本所有欄位
5. 若動到公開介面，更新 [`CHANGELOG.md`](CHANGELOG.md) 的 `[Unreleased]` 段

## 📏 程式風格

- **TypeScript strict mode**：不使用 `any`，`as unknown as T` 視為最後手段
- **禁用 enum**（`erasableSyntaxOnly`）— 使用 `as const` 物件
- **常數集中**：所有魔術數字放在 `constants.ts`（`client/src/constants.ts`、`server/src/constants.ts`）
- **不為假想需求寫程式碼** — YAGNI。有需要時再加
- **沒 API 變動就別改 public 介面** — 向下相容優先
- **註解寫 WHY 不寫 WHAT**：well-named 的程式碼本身就是 what

## 🧪 測試

- **server/shared 純邏輯** → `web/server/tests/*.test.ts`（vitest）
- **新增 bug 修復** → 請同時加測試防止未來回歸
- **避免 mock 資料庫** — 用 `:memory:` SQLite 能抓到更多真問題

## 🔒 安全貢獻

請先讀 [`SECURITY.md`](SECURITY.md)。任何涉及認證/密碼/API Key 的改動都需要：

- 不引入 timing attack（用 `crypto.timingSafeEqual`）
- 不洩漏敏感資訊到日誌（`auditLog` 已自動遮罩，但仍應小心 `console.log`）
- bcrypt rounds 常數（`BCRYPT_SALT_ROUNDS = 12`）不可降低
- 新 API 端點必須考慮是否需要 auth middleware

## 🎨 素材與資產

- **辦公室家具**：原始 tileset 來自 [Donarg 的付費素材](https://donarg.itch.io/officetileset)，不在版控。見 [README](README.md) 素材導入章節
- **字型**：`FSPixelSansUnicode-Regular.ttf` 授權為開源字型
- **角色精靈**：專案專用，可自由使用於本專案

## 📜 授權

貢獻即同意作品以 [MIT License](LICENSE) 釋出。

## 🙋 其他

- 有問題？開 issue 用 `question` 範本
- 想長期參與？ROADMAP 中有 `good first issue` 標籤的項目可起手
- **請遵守 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)**
