# ROADMAP

此檔案列出專案的演進方向。詳細架構請見 [`docs/ROADMAP.md`](docs/ROADMAP.md)；歷史變更請見 [`CHANGELOG.md`](CHANGELOG.md)。

> 專案維持「可觀察、可測試、可逐步擴充」三原則。每個里程碑都應：
> 1. 有可驗證的完成條件
> 2. 有自動化守門（CI / test）
> 3. 不讓既有功能退化

---

## 🎯 現況（截至最新 commit）

- ✅ 70 → **139 tests** 通過、lint 0 errors
- ✅ Bundle 首載 **-40%**（921KB → 569KB）
- ✅ 16 項安全稽核項目全數修復
- ✅ CI（GitHub Actions）+ pre-commit hook 雙重守門
- ✅ Prometheus 指標端點
- ✅ Agent Node 斷線 30s grace 無縫重連

---

## 🚧 進行中 / 即將處理

### 品質基礎設施
- [ ] Client 單元測試環境（目前 test 全集中在 server；client hook / component 無覆蓋）
- [ ] E2E 測試擴展（現僅 `tests/e2e-smoke.ts` 一檔）
- [ ] CI bundle size diff 評論（防止 bundle 偷偷膨脹）
- [ ] Lighthouse CI（Performance budget）

### 已識別但尚未處理
- [ ] 字型 subset（1MB → ~400KB，見 [`scripts/subset-font.md`](scripts/subset-font.md)）
- [ ] `index.ts` 繼續拆分（目前 1754 行，建議 → 多個 router/setup 檔）
- [ ] `useExtensionMessages.ts` 840 行按訊息類別分檔
- [ ] Client 端 `== null` warnings 整理（目前 16 個，多為刻意雙檢）

---

## 📍 短期（下一版）

> 目標：**讓單一開發者/小團隊更容易自架**

- [ ] Docker / Compose 一鍵啟動範例（含 Redis）
- [ ] 首次設定精靈（UI 引導建立 admin、匯入佈局）
- [ ] `--help` CLI 參數文件（目前只能看 `config.ts`）
- [ ] i18n 英文版（結構已統一於 `i18n.ts`，複製一份即可）
- [ ] AuthPanel a11y 修正（label / id / form 標籤）

## 📍 中期

> 目標：**支援更大使用場景**

- [ ] 代理分群/標籤系統（按專案類型、團隊、客戶自訂分組）
- [ ] 對話記錄全文搜尋（SQLite FTS5）
- [ ] 統計儀表板增強（按日/週/月趨勢、Tool 熱度）
- [ ] WebRTC 語音連線（佈局見 `docs/dev-notes/webrtc-voice-plan.md`）
- [ ] P2P 直連模式（減輕中央伺服器負擔）

## 📍 長期

> 目標：**演化為平台**

- [ ] 插件系統（使用者可寫行為腳本 / 自訂家具）
- [ ] 自訂角色精靈圖（匯入使用者上傳的 PNG）
- [ ] 跨樓層視覺化（電梯/樓梯 UI 動畫）
- [ ] SaaS 託管版（多租戶、帳單）
- [ ] 開放 API（讓其他工具推送自訂事件）

---

## 🔒 不做的事（scope out）

明確劃界可以避免精力稀釋：

- **不追求取代 Claude Code CLI 本身** — 本專案是視覺化層，不該重製其功能
- **不追求即時協同編輯** — 佈局編輯器設計為單人使用，多人同步成本過高
- **不追求 mobile native app** — Web 版響應式已足夠覆蓋；原生 app 維護成本無意義
- **不追求 server-side rendering** — 應用主體是動畫遊戲，SSR 收益為零

---

## 💬 如何提議新方向

1. 有想法先開 issue（`feature-request` 範本），描述使用情境
2. 若動到既有介面，**先提 PR 描述** 再寫 code
3. 大型重構：拆成多個 PR，每個可獨立 revert

---

## 📊 成長指標

我們以下述指標追蹤健康度（每次 release 時更新 CHANGELOG）：

| 指標 | 當前 | 目標 |
|---|---|---|
| 測試總數 | 139 | 持續增加 |
| Lint errors | 0 | 0 |
| npm audit（moderate+） | 0 | 0 |
| Bundle 首載 (gzip) | 154KB | < 200KB |
| TypeScript strict | ✅ | ✅ |

**判斷方式**：任一指標退化都會在 CI 看到，PR 不該讓指標變差（除非有明確理由並於 description 註記）。
