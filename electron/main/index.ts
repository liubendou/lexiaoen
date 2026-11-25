import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeDb, getSetting, pingDb, setSetting } from '../../server/db'
import { registerChatIpc } from './chat-ipc'
import { ensureSeeded } from './seed'
import { registerStudyIpc } from './study-ipc'
import { registerTextbookIpc } from './textbook-ipc'
import { hasActiveStreams } from '../../server/llm/chat'
import { runLlmSelfCheck } from './selfcheck-llm'

const isSelfCheck = process.argv.includes('--self-check')
const isLlmSelfCheck = process.argv.includes('--self-check-llm')

// P1-6:自检临时库 env 必须先于任何 DB 访问设置——模块顶层 ensureSeeded 会开库,
// 迟设 env 会让自检把测试数据写进真实用户库
if (isLlmSelfCheck) {
  process.env.LEXIAOEN_MOCK_LLM = '1'
  process.env.LEXIAOEN_DB_PATH = join(tmpdir(), `lexiaoen-llm-selfcheck-${Date.now()}.db`)
}

let mainWindow: BrowserWindow | null = null

// 单实例锁:重复启动聚焦已有窗口(UI方案 八);自检入口需绕过锁
const gotLock = isSelfCheck || isLlmSelfCheck || app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.setAppUserModelId('app.lexiaoen.tutor')

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    if (isLlmSelfCheck) {
      void runLlmSelfCheck().then((code) => app.exit(code))
      return
    }
    if (isSelfCheck) {
      runSelfCheck()
      return
    }
    createWindow()
  })

  app.on('window-all-closed', () => {
    if (!isSelfCheck) app.quit()
  })

  app.on('will-quit', () => closeDb())
}

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized: boolean
}

function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1440, height: 900, maximized: false }
  try {
    const raw = getSetting('window_state')
    if (raw) return { ...fallback, ...(JSON.parse(raw) as Partial<WindowState>) }
  } catch {
    // 状态损坏时用默认值
  }
  return fallback
}

function saveWindowState(): void {
  if (!mainWindow) return
  const b = mainWindow.getNormalBounds()
  const state: WindowState = { width: b.width, height: b.height, x: b.x, y: b.y, maximized: mainWindow.isMaximized() }
  try {
    setSetting('window_state', JSON.stringify(state))
  } catch (e) {
    console.error('[main] 保存窗口状态失败:', e)
  }
}

/** P2-8:恢复前校验存储坐标仍与某块屏幕可视区相交,防换显示器/改分辨率后窗口开在屏外 */
function sanitizedBounds(state: WindowState): WindowState {
  if (state.x === undefined || state.y === undefined) return state
  try {
    const wa = screen.getDisplayMatching({ x: state.x, y: state.y, width: state.width, height: state.height }).workArea
    const overlaps =
      state.x < wa.x + wa.width &&
      state.x + state.width > wa.x &&
      state.y < wa.y + wa.height &&
      state.y + state.height > wa.y
    if (!overlaps) return { ...state, x: undefined, y: undefined }
  } catch {
    return { ...state, x: undefined, y: undefined }
  }
  return state
}

function createWindow(): void {
  const state = sanitizedBounds(loadWindowState())

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1280,
    minHeight: 720,
    show: false, // ready-to-show 再显示,避免白屏闪烁(《输出丝滑方案》3.4)
    frame: false, // 自定义标题栏 32px(UI方案 3.1)
    backgroundColor: '#FAF8F4',
    title: '乐小恩',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (state.maximized) mainWindow.maximize()

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  // P2-14:流式生成中关窗先确认(frameless 窗口无系统确认),防未落库内容静默丢失
  let closeConfirmed = false
  mainWindow.on('close', (e) => {
    saveWindowState()
    if (closeConfirmed || !hasActiveStreams()) return
    e.preventDefault()
    const win = mainWindow
    if (!win) return
    void dialog
      .showMessageBox(win, {
        type: 'question',
        title: '退出确认',
        message: '回答还在生成中',
        detail: '现在退出会中断生成,未完成的部分不会保存。',
        buttons: ['停止并退出', '继续生成'],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      })
      .then(({ response }) => {
        if (response === 0) {
          closeConfirmed = true
          win.close()
        }
      })
  })
  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false))
  // 外链一律走系统浏览器,不在应用内开新窗
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    abi: process.versions.modules,
    platform: process.platform
  }))
  ipcMain.handle('db:ping', () => pingDb())
  ipcMain.handle('settings:get', (_e, key: string) => (key === 'api_key_override' ? null : getSetting(key)))
  ipcMain.handle('settings:set', (_e, key: string, value: string) => setSetting(key, value))
  ipcMain.on('win:minimize', () => mainWindow?.minimize())
  ipcMain.on('win:toggle-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('win:close', () => mainWindow?.close())
  ipcMain.handle('win:is-maximized', () => mainWindow?.isMaximized() ?? false)
}

registerIpc()
registerChatIpc()
registerStudyIpc()
registerTextbookIpc()

/** 首启种子导入:考纲树 + 知识卡(空库时执行,主进程代码内置,不走文件系统) */
try {
  ensureSeeded()
} catch (e) {
  console.error('[main] 种子导入失败:', e)
}

/** 打包冒烟自检:验证 better-sqlite3 能否在当前 ABI 下加载并执行 SQL */
function runSelfCheck(): void {
  const ping = pingDb()
  const result = {
    ok: ping.ok,
    electron: process.versions.electron,
    node: process.versions.node,
    abi: process.versions.modules,
    sqlite: ping.sqlite,
    userVersion: ping.userVersion,
    dbPath: ping.path,
    error: ping.error
  }
  console.log('[self-check]', JSON.stringify(result))
  try {
    writeFileSync(join(app.getPath('temp'), 'lexiaoen-self-check.json'), JSON.stringify(result, null, 2))
  } catch {
    // 写文件失败不影响退出码
  }
  closeDb()
  app.exit(ping.ok ? 0 : 1)
}
