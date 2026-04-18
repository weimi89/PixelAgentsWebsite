# 字型 Subset 指南

`web/client/src/fonts/FSPixelSansUnicode-Regular.ttf` 為 1MB 的完整 Unicode 像素字型。實際 UI 僅用到繁體中文常用字 + 英數字 + 標點，subset 後可壓至 300–500KB，直接降低首載 500KB+。

## 建議流程（pyftsubset）

需要 Python 3 與 `fonttools`：

```bash
pip install fonttools brotli
```

1. **收集 UI 用到的字元集合**

   執行 Node 腳本抓取 `i18n.ts` 所有字串中出現的 codepoint：

   ```bash
   cd web/client
   node -e "
   const fs = require('fs');
   const src = fs.readFileSync('src/i18n.ts', 'utf-8');
   const chars = new Set();
   for (const ch of src) chars.add(ch.codePointAt(0));
   // 加入基本 ASCII（0x20–0x7E）、CJK 標點（0x3000–0x303F）、全形標點（0xFF00–0xFFEF）
   for (let i = 0x20; i <= 0x7E; i++) chars.add(i);
   for (let i = 0x3000; i <= 0x303F; i++) chars.add(i);
   for (let i = 0xFF00; i <= 0xFFEF; i++) chars.add(i);
   const unicodes = [...chars].sort((a,b)=>a-b).map(c => 'U+' + c.toString(16).toUpperCase()).join(',');
   fs.writeFileSync('/tmp/pixel-agents-unicodes.txt', unicodes);
   console.log('Wrote', chars.size, 'codepoints');
   "
   ```

2. **Subset 字型**

   ```bash
   pyftsubset src/fonts/FSPixelSansUnicode-Regular.ttf \
     --unicodes-file=/tmp/pixel-agents-unicodes.txt \
     --output-file=src/fonts/FSPixelSansUnicode-Regular.subset.ttf \
     --flavor=woff2 \
     --no-hinting \
     --desubroutinize
   ```

3. **更新 `src/index.css`** 的 `@font-face`，將字型檔名改為 `.subset.woff2`（或 `.ttf`）。

4. **重新 build** 觀察檔案大小。

## 注意

- 若新增語系或新字元，需要 **重新執行** subset 流程
- 保留原始完整字型 `.ttf` 於版控（或 backups/）以便隨時可復原
- 若需動態載入其他字符（如使用者自訂名稱），可考慮 Google Fonts 風格的分片載入或 fallback system font

## 為何不直接自動化

此流程依賴 Python 工具鏈，CI 需額外安裝；且 subset 結果取決於當下的字元集，自動化反而容易在字串變動時漏字。以指引方式保留手動控制更安全。
