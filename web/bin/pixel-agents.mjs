#!/usr/bin/env node
/**
 * pixel-agents CLI — 一鍵啟動像素辦公室伺服器。
 *
 * 流程：
 *   1. 解析 argv（--port / --demo / --no-open / --help / --data-dir）
 *   2. 設定環境變數指向打包的 client/dist 與 assets
 *   3. 啟動 server（以 child_process 執行 server/dist/index.js）
 *   4. 偵測到埠就緒後自動開瀏覽器
 *   5. 轉發 SIGINT / SIGTERM 給子進程以乾淨關閉
 *
 * 不依賴任何外部 npm 套件（純 Node built-in），便於打包發布。
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { platform } from 'node:os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── 解析 argv ─────────────────────────────────────────────
const args = process.argv.slice(2)
const flags = {
  port: undefined, // 預設由 server 處理（13001）
  demo: false,
  demoAgents: undefined,
  noOpen: false,
  help: false,
  version: false,
  dataDir: undefined,
}

for (let i = 0; i < args.length; i++) {
  const a = args[i]
  switch (a) {
    case '-h': case '--help': flags.help = true; break
    case '-v': case '--version': flags.version = true; break
    case '--demo': flags.demo = true; break
    case '--no-open': flags.noOpen = true; break
    case '--port':
    case '-p': flags.port = parseInt(args[++i], 10); break
    case '--demo-agents': flags.demoAgents = parseInt(args[++i], 10); break
    case '--data-dir': flags.dataDir = args[++i]; break
    default:
      if (a.startsWith('--port=')) flags.port = parseInt(a.slice(7), 10)
      else if (a.startsWith('--data-dir=')) flags.dataDir = a.slice(11)
      else {
        console.error(`Unknown argument: ${a}`)
        process.exit(1)
      }
  }
}

if (flags.help) {
  printHelp()
  process.exit(0)
}

if (flags.version) {
  // 讀取 package.json 的版本
  try {
    const pkg = await import(join(__dirname, '..', 'package.json'), { with: { type: 'json' } })
    console.log(pkg.default?.version || 'unknown')
  } catch {
    console.log('unknown')
  }
  process.exit(0)
}

// ── 解析路徑（支援打包後與 monorepo 開發兩種情境） ────────
const webRoot = resolve(__dirname, '..')
const serverEntry = join(webRoot, 'server', 'dist', 'index.js')
const clientDist = join(webRoot, 'client', 'dist')
const assetsRoot = clientDist // client/dist 也包含 assets/

if (!existsSync(serverEntry)) {
  console.error(`❌ Server build not found: ${serverEntry}`)
  console.error('   Run `npm run build` in the web/ directory first.')
  process.exit(1)
}

if (!existsSync(clientDist)) {
  console.error(`❌ Client build not found: ${clientDist}`)
  console.error('   Run `npm run build` in the web/ directory first.')
  process.exit(1)
}

// ── 準備環境變數 ────────────────────────────────────────
const env = {
  ...process.env,
  PIXEL_AGENTS_CLIENT_DIST: clientDist,
  PIXEL_AGENTS_ASSETS_ROOT: assetsRoot,
}
if (flags.port !== undefined) env.PORT = String(flags.port)
if (flags.demo) env.DEMO = '1'
if (flags.demoAgents !== undefined) env.DEMO_AGENTS = String(flags.demoAgents)
if (flags.dataDir) env.DATA_DIR = flags.dataDir

const port = flags.port ?? 13001

// ── 啟動 server ─────────────────────────────────────────
console.log('🚀 Pixel Agents starting...')
if (flags.demo) console.log(`   Demo mode (${flags.demoAgents ?? 3} agents)`)
console.log(`   Port: ${port}`)
if (flags.dataDir) console.log(`   Data dir: ${flags.dataDir}`)

const child = spawn(process.execPath, [serverEntry], {
  env,
  stdio: 'inherit',
})

// 轉發訊號讓 server 能乾淨關閉
const forwardSignals = ['SIGINT', 'SIGTERM', 'SIGHUP']
for (const sig of forwardSignals) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig)
  })
}

child.on('exit', (code, signal) => {
  if (signal) process.exit(0)
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error('❌ Failed to launch server:', err.message)
  process.exit(1)
})

// ── 偵測埠就緒後開瀏覽器 ──────────────────────────────────
if (!flags.noOpen) {
  waitForPort(port, 30_000)
    .then(() => openBrowser(`http://localhost:${port}`))
    .catch(() => {
      console.warn('⚠  Server did not become ready within 30s; skipping browser open.')
    })
}

// ── Helpers ──────────────────────────────────────────────

/** 等待指定 port 可連線（最多 timeoutMs 毫秒），用於偵測 server 就緒 */
function waitForPort(port, timeoutMs) {
  return new Promise((resolveP, rejectP) => {
    const start = Date.now()
    const tryConnect = () => {
      const socket = createConnection({ port, host: '127.0.0.1' })
      socket.once('connect', () => {
        socket.destroy()
        resolveP()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - start >= timeoutMs) {
          rejectP(new Error('timeout'))
        } else {
          setTimeout(tryConnect, 300)
        }
      })
    }
    tryConnect()
  })
}

/** 跨平台開啟預設瀏覽器 */
function openBrowser(url) {
  const plat = platform()
  const [cmd, openArgs] = plat === 'darwin' ? ['open', [url]]
    : plat === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : ['xdg-open', [url]]
  try {
    const p = spawn(cmd, openArgs, { stdio: 'ignore', detached: true })
    p.unref()
    p.on('error', () => { /* ignore — 瀏覽器開不了不致命 */ })
  } catch {
    // 忽略
  }
  console.log(`🌐 Opened ${url}`)
}

function printHelp() {
  console.log(`
pixel-agents — 像素辦公室視覺化你的 AI coding session

用法:
  pixel-agents [選項]

選項:
  -p, --port <n>        伺服器埠號 (預設: 13001)
      --demo            啟動演示模式（不需要實際 Claude 會話）
      --demo-agents <n> 演示模式的代理數量 (預設: 3)
      --data-dir <path> 自訂資料目錄 (預設: ~/.pixel-agents)
      --no-open         啟動後不自動開瀏覽器
  -h, --help            顯示此說明
  -v, --version         顯示版本

範例:
  pixel-agents                        # 預設啟動，自動開瀏覽器
  pixel-agents --demo                 # 演示模式（3 個假代理）
  pixel-agents --demo --demo-agents 8 # 演示 8 個代理
  pixel-agents -p 8080 --no-open      # 指定埠、不開瀏覽器

環境變數:
  PORT                  同 --port
  DEMO=1                同 --demo
  TRUST_PROXY           反向代理部署必須設定
  REDIS_URL             啟用叢集模式
  LOG_LEVEL             debug / info / warn / error

更多：https://github.com/weimi89/PixelAgentsWebsite
`)
}
