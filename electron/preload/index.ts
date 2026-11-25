import { contextBridge, ipcRenderer } from 'electron'
import type { ChatEvent, LexiaoenApi, ModeId } from '../../shared/ipc'

const api: LexiaoenApi = {
  appInfo: () => ipcRenderer.invoke('app:info'),
  dbPing: () => ipcRenderer.invoke('db:ping'),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  study: {
    syllabus: () => ipcRenderer.invoke('study:syllabus'),
    searchKb: (query, limit) => ipcRenderer.invoke('study:search', query, limit),
    generateQuiz: (nodeId, count) => ipcRenderer.invoke('study:generate-quiz', nodeId, count),
    listQuiz: (limit) => ipcRenderer.invoke('study:list-quiz', limit),
    reviewQueue: (limit) => ipcRenderer.invoke('review:queue', limit),
    reviewStats: () => ipcRenderer.invoke('review:stats'),
    addWrongCard: (questionId) => ipcRenderer.invoke('review:add-wrong', questionId),
    gradeCard: (rowId, grade) => ipcRenderer.invoke('review:grade', rowId, grade),
    logAttempt: (nodeId, qtype, bloom, correct) => ipcRenderer.invoke('study:log-attempt', nodeId, qtype, bloom, correct),
    learnerSnapshot: () => ipcRenderer.invoke('learner:snapshot'),
    clearMemory: (scope) => ipcRenderer.invoke('learner:clear', scope)
  },
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats')
  },
  textbook: {
    list: () => ipcRenderer.invoke('textbook:list'),
    import: () => ipcRenderer.invoke('textbook:import'),
    remove: (id) => ipcRenderer.invoke('textbook:remove', id)
  },
  window: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
    close: () => ipcRenderer.send('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
    onMaximizedChange: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, maximized: boolean): void => cb(maximized)
      ipcRenderer.on('win:maximized', listener)
      return () => ipcRenderer.removeListener('win:maximized', listener)
    }
  },
  chat: {
    listSessions: () => ipcRenderer.invoke('chat:list-sessions'),
    createSession: (mode: ModeId) => ipcRenderer.invoke('chat:create-session', mode),
    renameSession: (id, title) => ipcRenderer.invoke('chat:rename-session', id, title),
    deleteSession: (id) => ipcRenderer.invoke('chat:delete-session', id),
    setSessionMode: (id, mode) => ipcRenderer.invoke('chat:set-session-mode', id, mode),
    getMessages: (sessionId) => ipcRenderer.invoke('chat:get-messages', sessionId),
    send: (sessionId, reqId, text) => ipcRenderer.invoke('chat:send', sessionId, reqId, text),
    retry: (sessionId, reqId, userMessageId) => ipcRenderer.invoke('chat:retry', sessionId, reqId, userMessageId),
    abort: (reqId) => ipcRenderer.send('chat:abort', reqId),
    keyStatus: () => ipcRenderer.invoke('chat:key-status'),
    setOverrideKey: (key) => ipcRenderer.invoke('chat:set-override-key', key),
    testKey: (key) => ipcRenderer.invoke('chat:test-key', key),
    onEvent: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: ChatEvent): void => cb(payload)
      ipcRenderer.on('chat:event', listener)
      return () => ipcRenderer.removeListener('chat:event', listener)
    }
  }
}

contextBridge.exposeInMainWorld('lexiaoen', api)
