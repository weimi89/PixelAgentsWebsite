#!/usr/bin/env node
/**
 * check-desktop-sync — 比對本 repo 與 PixelAgentsDesktop 的 shared/ 一致性
 *
 * Web 的 `web/shared/src/{protocol,formatToolStatus}.ts` 為 AgentNode ↔ Server
 * 協議的權威來源。Desktop 的 `shared/{protocol,formatToolStatus}.ts` 是該權威
 * 的複製品（sidecar 使用）。兩邊必須位元完全一致（除檔頭註解外）。
 *
 * 用法：
 *   node scripts/check-desktop-sync.mjs [--desktop <path>]
 *
 * 退出碼：
 *   0  一致
 *   1  不一致（輸出 diff）
 *   2  找不到 Desktop repo（不算錯誤，CI 用 --required 控制嚴格度）
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(__dirname, '..')

// ── argv ─────────────────────────────────────────────────
const args = process.argv.slice(2)
let desktopPath = process.env.PIXEL_AGENTS_DESKTOP_PATH ?? resolve(WEB_ROOT, '..', 'PixelAgentsDesktop')
let required = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--desktop') desktopPath = args[++i]
  else if (args[i] === '--required') required = true
  else if (args[i] === '-h' || args[i] === '--help') { printHelp(); process.exit(0) }
}

if (!existsSync(desktopPath)) {
  const msg = `PixelAgentsDesktop repo not found at: ${desktopPath}`
  if (required) {
    console.error(`❌ ${msg}`)
    console.error('   Set PIXEL_AGENTS_DESKTOP_PATH or pass --desktop <path>')
    process.exit(2)
  }
  console.log(`⏭  ${msg} — skipping drift check`)
  process.exit(0)
}

// ── 要比對的檔案（web path → desktop path） ─────────────
const SYNCED_FILES = [
  {
    web: 'web/shared/src/protocol.ts',
    desktop: 'shared/protocol.ts',
  },
  {
    web: 'web/shared/src/formatToolStatus.ts',
    desktop: 'shared/formatToolStatus.ts',
  },
]

// ── 比對邏輯 ─────────────────────────────────────────────

/** 正規化：去除頂部 "// Standalone copy for ..." 類註解，使兩邊可直接比對 */
function normalizeContent(text) {
  const lines = text.split('\n')
  // 跳過開頭連續的 // 註解行（最多前 5 行）
  let start = 0
  while (start < Math.min(5, lines.length) && lines[start].trim().startsWith('//')) {
    start++
  }
  // 再跳過空白行
  while (start < lines.length && lines[start].trim() === '') {
    start++
  }
  return lines.slice(start).join('\n').trimEnd()
}

function printHelp() {
  console.log(`
check-desktop-sync — Verify PixelAgentsDesktop/shared stays in sync with web/shared/src

Usage:
  node scripts/check-desktop-sync.mjs [options]

Options:
  --desktop <path>   Path to PixelAgentsDesktop repo
                     (default: ../PixelAgentsDesktop, or $PIXEL_AGENTS_DESKTOP_PATH)
  --required         Exit 2 if Desktop repo not found (for CI gate use)
  -h, --help         Show this help

Exit codes:
  0  all synced files match
  1  drift detected (diff printed)
  2  Desktop repo not found and --required was passed
`)
}

// ── 執行比對 ─────────────────────────────────────────────
let mismatches = 0
const results = []

for (const { web, desktop } of SYNCED_FILES) {
  const webPath = resolve(WEB_ROOT, web)
  const desktopAbsPath = resolve(desktopPath, desktop)

  if (!existsSync(webPath)) {
    results.push({ web, desktop, status: 'web-missing' })
    mismatches++
    continue
  }
  if (!existsSync(desktopAbsPath)) {
    results.push({ web, desktop, status: 'desktop-missing' })
    mismatches++
    continue
  }

  const webContent = await readFile(webPath, 'utf-8')
  const desktopContent = await readFile(desktopAbsPath, 'utf-8')

  if (normalizeContent(webContent) === normalizeContent(desktopContent)) {
    results.push({ web, desktop, status: 'match' })
  } else {
    results.push({ web, desktop, status: 'drift' })
    mismatches++
  }
}

// ── 報告 ─────────────────────────────────────────────────
console.log('\n📋 Shared code drift check')
console.log(`   Web:     ${WEB_ROOT}`)
console.log(`   Desktop: ${desktopPath}\n`)

for (const r of results) {
  const icon =
    r.status === 'match' ? '✅'
    : r.status === 'drift' ? '❌'
    : r.status === 'web-missing' ? '⚠️ '
    : '⚠️ '
  const label =
    r.status === 'match' ? 'in sync'
    : r.status === 'drift' ? 'DRIFT detected'
    : r.status === 'web-missing' ? `web file missing: ${r.web}`
    : `desktop file missing: ${r.desktop}`
  console.log(`  ${icon} ${r.web}\n     ↔ ${r.desktop}    ${label}`)
}

if (mismatches === 0) {
  console.log('\n✨ All synced files are in sync.')
  process.exit(0)
}

console.log(`\n❌ ${mismatches} file(s) out of sync.`)
console.log('\nTo resolve:')
console.log('  node scripts/sync-to-desktop.mjs       # Push web → desktop')
console.log('  OR manually copy the desktop side to web, then run this check again.')
process.exit(1)
