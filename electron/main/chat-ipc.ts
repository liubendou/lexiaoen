import { ipcMain } from 'electron'
import type { ChatEvent, ModeId } from '../../shared/ipc'
import { deleteSetting, setSetting } from '../../server/db'
import { deleteSession, getMessages, listSessions, renameSession, setSessionMode } from '../../server/db/chat'
import { createSessionWithSnapshot, handleAbort, handleRetry, handleSend, keyStatusPayload, testKey } from '../../server/llm/chat'

function bridgeOf(sender: Electron.WebContents) {
  return {
    webContents: {
      send: (ch: string, payload: unknown) => {
        // P1-2:窗口销毁后 sender.send 会抛「Object has been destroyed」,这里静默丢弃
        try {
          if (sender.isDestroyed()) return
          sender.send(ch, payload as ChatEvent)
        } catch {
          // 忽略
        }
      }
    }
  }
}

/** 注册 chat:* IPC 与 chat:event 事件通道(settings:* 仍由 main/index.ts 统一管理) */
export function registerChatIpc(): void {
  ipcMain.handle('chat:list-sessions', () => listSessions())
  ipcMain.handle('chat:create-session', (_e, mode: ModeId) => createSessionWithSnapshot(mode))
  ipcMain.handle('chat:rename-session', (_e, id: string, title: string) => renameSession(id, title))
  ipcMain.handle('chat:delete-session', (_e, id: string) => deleteSession(id))
  ipcMain.handle('chat:set-session-mode', (_e, id: string, mode: ModeId) => setSessionMode(id, mode))
  ipcMain.handle('chat:get-messages', (_e, sessionId: string) => getMessages(sessionId))
  ipcMain.handle('chat:send', (e, sessionId: string, reqId: string, text: string) => handleSend(bridgeOf(e.sender), sessionId, reqId, text))
  ipcMain.handle('chat:retry', (e, sessionId: string, reqId: string, userMessageId: number) => handleRetry(bridgeOf(e.sender), sessionId, reqId, userMessageId))
  ipcMain.on('chat:abort', (_e, reqId: string) => handleAbort(reqId))
  ipcMain.handle('chat:key-status', () => keyStatusPayload())
  ipcMain.handle('chat:set-override-key', (_e, key: string | null) => {
    // 明文只落 app_settings,渲染层永远读不到(settings:get 对该键返回 null)
    if (key && key.trim()) setSetting('api_key_override', key.trim())
    else deleteSetting('api_key_override')
  })
  ipcMain.handle('chat:test-key', (_e, key: string) => testKey(key))
}
