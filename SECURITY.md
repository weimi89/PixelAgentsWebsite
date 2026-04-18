# 資安政策

## 支援版本

此專案為開源展示與個人/小團隊使用，僅主動維護 `main` 分支。建議固定使用最新 commit 作為部署來源。

## 漏洞回報

若你發現可能的資安漏洞，**請不要**直接開 public issue。請透過以下管道私下回報：

- 在 GitHub 對 repo 建立 **Security Advisory**（Security 分頁 → Report a vulnerability）
- 或以私訊聯繫維護者

請盡量在回報中提供：

1. 影響版本或 commit hash
2. 重現步驟或 PoC
3. 受影響的端點 / 檔案 / 流程
4. 建議的修復方向（若有）

**預期回應時間**：7 天內初步確認、30 天內 mitigation 或正式修復。

## 已實施的安全機制

- **密碼**：bcrypt rounds = 12；長度 ≥ 8 + 大小寫 + 數字；可選特殊字元 (`REQUIRE_PASSWORD_SPECIAL_CHAR=1`)
- **API Key**：AES-256-GCM 加密存放；`crypto.timingSafeEqual` 比對；`/api/auth/users` 回傳遮罩 (`pa_****xxxx`)
- **JWT**：Access + Refresh token 分離；secret 自動生成並以檔案權限保護；缺失時拒啟動而非 fallback 至硬編碼
- **路徑安全**：`pathSecurity.ts` 驗證 `..`、null byte、符號連結 (`realpathSync`) 逃逸
- **速率限制**：固定視窗算法 + FIFO LRU 驅逐（預設 10000 鍵）
- **原子寫入**：`atomicWriteJson` = `.tmp` → `fsync` → `rename`
- **CSP**：production 嚴格、development 放寬供 Vite HMR
- **Socket.IO**：
  - `x-forwarded-for` 僅在 `TRUST_PROXY` 環境變數設定後才信任
  - 匿名連線每 IP 最多 5 條
  - JWT 認證（`/agent-node` namespace）
- **稽核日誌**：寫入前自動遮蔽 `password`/`token`/`key`/`secret` 等敏感關鍵字
- **Agent Node 斷線**：30 秒 grace period，防止短暫抖動造成代理資料遺失
- **npm audit**：CI 持續監控依賴漏洞

## 已知限制

- **預設帳號 `admin:admin`**：首次啟動自動建立，並以 `mustChangePassword` 強制首次登入變更。**生產部署前務必變更**。
- **自簽 HTTPS**：`--https` 旗標生成的自簽憑證僅供本機/內網，正式部署請使用反向代理 + 正式憑證。
- **SQLite 同步寫**：`better-sqlite3` 在極高併發下會阻塞 event loop。若部署規模大需考慮遷移至獨立 DB 或 worker thread。

## 建議部署配置

生產環境建議啟用以下環境變數：

```bash
NODE_ENV=production
TRUST_PROXY=1                            # 若部署於 nginx/Cloudflare 後方
ALLOWED_ORIGINS=https://your.domain
API_KEY_ENCRYPTION_KEY=<32+ bytes random>
REGISTRATION_POLICY=invite               # 或 closed
REQUIRE_PASSWORD_SPECIAL_CHAR=1
LOG_LEVEL=info
```
