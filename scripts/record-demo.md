# Demo GIF 錄製指南

> **目標**：30 秒 GIF，放 README 置頂。**新訪客 3 秒決定要不要試，30 秒決定要不要 star**。

---

## 🎬 錄製前準備

### 1. 啟動乾淨的 demo 伺服器

```bash
cd web
# 清掉歷史資料，得到乾淨畫面
rm -rf ~/.pixel-agents/pixel-agents.db ~/.pixel-agents/floors

npm run build
# 啟動 5 個 demo 代理（足夠豐富但不擁擠）
DEMO=1 DEMO_AGENTS=5 PORT=13001 node server/dist/index.js
```

### 2. 瀏覽器設定（重要）

- 解析度設定為 **1440 × 900** 或 **1920 × 1080**（16:9 才好剪）
- **關閉書籤列 + 關閉擴充套件 icon**（Cmd+Shift+B）
- 使用 **無痕視窗**（避免通知、個人化干擾）
- 縮放設定 100%

### 3. 先把 admin 密碼改掉

首次啟動會要求改密碼 — **錄製前先完成這個流程**，避免出現在最終 GIF 裡。

---

## 🎞 30 秒劇本（建議分鏡）

| 秒數 | 畫面 | 操作 |
|---|---|---|
| 0-3 | **Hero shot**：辦公室全景，5 個代理各在工作 | 靜態 2 秒 → 輕微放大 1 秒 |
| 3-8 | **生成特效**：一個新代理 matrix 降下 | 等待自然發生 / 用 demo mode 觸發 |
| 8-13 | **代理工具輪替**：打字、閱讀、Bash 動畫 | 鏡頭跟隨一個代理 2-3 秒 |
| 13-18 | **權限氣泡 + 表情**：代理抬頭等待、咖啡 emote | 等代理漫遊到咖啡機 |
| 18-23 | **多樓層切換**：點 1F → 3F → 4F | 切換動畫展示規模 |
| 23-27 | **子代理光暈**：父代理觸發 Task，子代理出現 | demo 腳本會自然觸發 |
| 27-30 | **結尾**：縮放 zoom out 展示全景 + logo | 淡出 |

**核心原則**：**每 3 秒必須有一個「發生點」**（新事件、新畫面、新鏡頭）。靜止超過 3 秒觀眾就滑走了。

---

## 🛠 錄製工具

### macOS（推薦）

**選項 1：QuickTime（內建）**
- `File → New Screen Recording` → 選擇區域
- 優點：零設定
- 缺點：無法設定 framerate

**選項 2：[Kap](https://getkap.co/)**（強力推薦）
- 免費、開源、macOS 原生
- 可直接輸出 GIF、MP4、APNG
- 支援 fps 設定（建議 **30 fps**）

**選項 3：ScreenFlow / ScreenStudio**（付費專業）
- 有 zoom、轉場、滑鼠強調等後製
- 適合做 1 分鐘 YouTube demo 用

### Windows

- **[ShareX](https://getsharex.com/)**（免費）
- **Nvidia ShadowPlay**（有 N 卡）

### 錄製設定建議

| 項目 | 設定 |
|---|---|
| Framerate | 30 fps |
| 解析度 | 1280 × 720 輸出 / 1440p 原始 |
| 格式 | 錄 MP4、再轉 GIF |
| 時長 | **不超過 30 秒** |

---

## 🎨 MP4 → GIF 轉換

**GIF 是壓縮極差的格式**，直接錄 GIF 會過大 + 掉幀。**建議流程：錄 MP4 → 用工具轉 GIF**。

### 推薦工具：[gifski](https://gif.ski/)

```bash
brew install gifski

# 基本轉換：輸入 MP4、輸出 1080p 寬、20 fps、高品質
gifski -o demo.gif --width 960 --fps 20 --quality 100 demo.mp4

# 檢查大小，若 > 5MB 則調整：
gifski -o demo.gif --width 800 --fps 15 --quality 80 demo.mp4
```

### 替代：ffmpeg

```bash
# 兩階段：產 palette → 用 palette 轉 GIF
ffmpeg -i demo.mp4 -vf "fps=20,scale=960:-1:flags=lanczos,palettegen" palette.png
ffmpeg -i demo.mp4 -i palette.png -filter_complex "fps=20,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse" demo.gif
```

### 目標大小

| 用途 | 大小限制 |
|---|---|
| GitHub README | **< 5 MB**（超過會顯示慢、影響首載） |
| Twitter 推文 | < 15 MB |
| Product Hunt | < 3 MB 最好 |

---

## 🪄 後製檢查清單

錄完別急著上傳，檢查：

- [ ] **前 0.5 秒要抓眼**（直接進場景，不要空白淡入）
- [ ] **無任何文字錯誤**（權限 toast、錯誤訊息等）
- [ ] **無個人資訊**（使用者名稱、路徑、token）
- [ ] **結束畫面有「下一步動作」**（如 logo + GitHub URL）
- [ ] **檔案大小 < 5 MB**
- [ ] **在手機尺寸預覽**（GitHub 手機版也要好看）

---

## 📍 輸出放這裡

1. 把 GIF 放到 `web/client/public/demo.gif`（跟 screenshot 同資料夾）
2. 更新 `README.md` 第一張圖：

```markdown
<p align="center">
  <img src="web/client/public/demo.gif" alt="Pixel Agents demo" width="720">
</p>
```

3. 保留 MP4 原檔在 `scripts/demo-raw.mp4`（不進版控，放 `.gitignore`）— 未來想重剪或做 Twitter 影片時用

---

## 🎥 想做更長版本？

這份指南是「**30 秒 GIF for README**」。如果之後要：

- **1 分鐘 Demo 影片**（Product Hunt、YouTube）→ 擴充劇本、加旁白或字幕
- **5 秒 Social card**（Twitter/Bluesky 分享用）→ 挑最震撼的 5 秒單獨導出
- **直播錄製**（教學系列）→ 另寫 OBS 設定指南

---

## 🧪 示範鏡頭推薦（必錄）

每個都有強烈的「像素辦公室」識別性 — 錄好這些後即使 30 秒剪不下，**5 秒版本也能用**：

1. **Matrix 生成特效** — 任何其他工具沒有、最獨特
2. **多代理同時工作** — 展示「規模感」
3. **代理走動 + bob 彈跳** — 剛優化過的走路自然度
4. **10 種表情其中 3 個** — 咖啡、燈泡、愛心
5. **子代理光暈** — 父子代理一起工作是極獨特的視覺
6. **樓層切換** — 展示「這不只是單一畫面」
