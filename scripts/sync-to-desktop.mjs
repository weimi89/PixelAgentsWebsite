#!/usr/bin/env node
/**
 * sync-to-desktop — 將本 repo 的 shared 權威版本推送至 PixelAgentsDesktop
 *
 * Web 是 shared 協議的權威來源。修改 web/shared/src/{protocol,formatToolStatus}.ts
 * 後執行此腳本，會把最新內容複製到 Desktop 的 shared/，並自動加上
 * "Standalone copy" 檔頭註解。
 *
 * 用法：
 *   node scripts/sync-to-desktop.mjs [--desktop <path>] [--dry-run]
 *
 * 選項：
 *   --desktop <path>  Desktop repo 路徑（預設 ../PixelAgentsDesktop）
 *   --dry-run         只顯示會做什麼，不實際寫檔
 *
 * 執行後仍需手動在 Desktop repo commit + push。
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(__dirname, '..')

// ── argv ─────────────────────────────────────────────────
const args = process.argv.slice(2)
let desktopPath = process.env.PIXEL_AGENTS_DESKTOP_PATH ?? resolve(WEB_ROOT, '..', 'PixelAgentsDesktop')
let dryRun = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--desktop') desktopPath = args[++i]
  else if (args[i] === '--dry-run') dryRun = true
  else if (args[i] === '-h' || args[i] === '--help') { printHelp(); process.exit(0) }
}

if (!existsSync(desktopPath)) {
  console.error(`❌ PixelAgentsDesktop not found at: ${desktopPath}`)
  console.error('   Set PIXEL_AGENTS_DESKTOP_PATH or pass --desktop <path>')
  process.exit(1)
}

// ── 要同步的檔案 + 對應的 Desktop 註解 ─────────────────
const SYNCED_FILES = [
  {
    web: 'web/shared/src/protocol.ts',
    desktop: 'shared/protocol.ts',
    header: [
      '// ── Protocol types: Agent Node ↔ Server ──',
      '// Standalone copy for pixel-agents-desktop (same structure as web/shared/src/protocol.ts)',
      '',
    ].join('\n'),
  },
  {
    web: 'web/shared/src/formatToolStatus.ts',
    desktop: 'shared/formatToolStatus.ts',
    header: [
      '// ── Format tool status utility ──',
      '// Standalone copy for pixel-agents-desktop (same as web/shared/src/formatToolStatus.ts)',
      '',
    ].join('\n'),
  },
]

function printHelp() {
  console.log(`
sync-to-desktop — Copy web/shared/src authoritative sources to PixelAgentsDesktop/shared

Usage:
  node scripts/sync-to-desktop.mjs [options]

Options:
  --desktop <path>   Path to PixelAgentsDesktop repo
                     (default: ../PixelAgentsDesktop, or $PIXEL_AGENTS_DESKTOP_PATH)
  --dry-run          Preview without writing
  -h, --help         Show this help

After running, commit + push the Desktop repo separately.
`)
}

/** 正規化：去除頂部 // 註解以便比對是否真的需要更新 */
function stripHeader(text) {
  const lines = text.split('\n')
  let start = 0
  while (start < Math.min(5, lines.length) && lines[start].trim().startsWith('//')) {
    start++
  }
  while (start < lines.length && lines[start].trim() === '') {
    start++
  }
  return lines.slice(start).join('\n').trimEnd()
}

// ── 執行 ─────────────────────────────────────────────────
console.log(`\n📦 Sync web/shared → desktop/shared`)
console.log(`   Source: ${WEB_ROOT}`)
console.log(`   Target: ${desktopPath}`)
if (dryRun) console.log('   Mode:   DRY RUN (no files written)')
console.log()

let updated = 0
let unchanged = 0

for (const { web, desktop, header } of SYNCED_FILES) {
  const webPath = resolve(WEB_ROOT, web)
  const desktopAbsPath = resolve(desktopPath, desktop)

  if (!existsSync(webPath)) {
    console.log(`  ⚠  SKIP (source missing): ${web}`)
    continue
  }

  const webContent = await readFile(webPath, 'utf-8')
  const body = stripHeader(webContent)
  const newContent = header + body + '\n'

  const existingContent = existsSync(desktopAbsPath)
    ? await readFile(desktopAbsPath, 'utf-8')
    : null

  // 比對邏輯：以 body 是否一致判斷「已同步」(與 check-desktop-sync 行為對齊)。
  // 即使 header 格式略有差異（例如手動編輯過），只要 body 一致就視為不必更新，
  // 避免每次執行都顯示 "would update" 的雜訊。
  if (existingContent !== null && stripHeader(existingContent) === body) {
    console.log(`  ✅ ${basename(desktop)}  already in sync`)
    unchanged++
    continue
  }

  if (dryRun) {
    console.log(`  📝 ${basename(desktop)}  would update`)
  } else {
    await writeFile(desktopAbsPath, newContent, 'utf-8')
    console.log(`  📝 ${basename(desktop)}  updated`)
  }
  updated++
}

console.log(`\n${dryRun ? '[dry-run] ' : ''}Summary: ${updated} updated, ${unchanged} unchanged\n`)

if (updated > 0 && !dryRun) {
  console.log('Next steps in the Desktop repo:')
  console.log('  cd ' + desktopPath)
  console.log('  git add shared/')
  console.log('  git commit -m "sync: pull latest shared/ from PixelAgentsWebsite"')
  console.log('  git push')
}
