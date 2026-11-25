// 会话与流式状态:Zustand 只存「历史/会话/相位」这些低频状态
// 流式正文与思考流走 ephemeral store + StreamScheduler,绝不进全局 store(《输出丝滑方案》2.4)

import { create } from 'zustand'
import type { ChatEvent, KeyStatus, MessageRow, ModeId, SessionRow, SourceRef } from '../../../shared/ipc'
import { createStreamedTextStore, type StreamedTextStore } from './streamed-text'
import { StreamScheduler } from './stream-scheduler'

export interface Ephemeral {
  reqId: string
  text: StreamedTextStore
  reason: StreamedTextStore
  scheduler: StreamScheduler
  rscheduler: StreamScheduler
}

/** 三模式 TAU(《输出丝滑方案》2.9) */
export const TAU_BY_MODE: Record<ModeId, number> = { fast: 0.18, standard: 0.25, quality: 0.35 }

interface StreamingState {
  reqId: string
  userText: string
  /** 新发时 true(乐观气泡);重试时 false(原 user 行已在列表里) */
  optimisticUser: boolean
  phase: 'waiting' | 'thinking' | 'text'
  /** 本轮 L4 检索引用(ack 随带,回答气泡下方展示) */
  sources?: SourceRef[]
}

interface ChatState {
  sessions: SessionRow[]
  currentId: string | null
  messages: MessageRow[]
  streaming: StreamingState | null
  ephem: Ephemeral | null
  keyStatus: KeyStatus | null
  retryNote: string | null
  /** send 层错误(如未配置 key),显示在输入区上方 */
  sendError: string | null
  hydrated: boolean
  hydrate: () => Promise<void>
  /** P1-5:整体复位(设置页清空对话历史后调用),UI 与库保持同步 */
  reset: () => void
  selectSession: (id: string) => Promise<void>
  newSession: (mode: ModeId) => Promise<SessionRow | null>
  renameSession: (id: string, title: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  updateSessionMode: (id: string, mode: ModeId) => Promise<void>
  send: (text: string, mode: ModeId) => Promise<void>
  retry: (userMessageId: number, mode: ModeId) => Promise<void>
  abort: () => void
  onEvent: (e: ChatEvent) => void
  /** 积压吐完后由调度器回调:拉取落库终稿并退出流式态 */
  finalize: () => Promise<void>
  clearSendError: () => void
  refreshKeyStatus: () => Promise<void>
}

let ephem: Ephemeral | null = null

function startEphemeral(reqId: string, mode: ModeId): Ephemeral {
  const text = createStreamedTextStore()
  const reason = createStreamedTextStore()
  const tau = TAU_BY_MODE[mode]
  const rscheduler = new StreamScheduler({ tau, onEmit: (d) => reason.emit(d) })
  const scheduler = new StreamScheduler({ tau, onEmit: (d) => text.emit(d), onDone: () => void useChatStore.getState().finalize() })
  ephem = { reqId, text, reason, scheduler, rscheduler }
  return ephem
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentId: null,
  messages: [],
  streaming: null,
  ephem: null,
  keyStatus: null,
  retryNote: null,
  sendError: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const [sessions, keyStatus] = await Promise.all([window.lexiaoen.chat.listSessions(), window.lexiaoen.chat.keyStatus()])
      set({ sessions, keyStatus, hydrated: true })
      if (sessions.length) await get().selectSession(sessions[0].id)
    } catch {
      set({ hydrated: true })
    }
  },

  selectSession: async (id) => {
    if (get().streaming) return
    const messages = await window.lexiaoen.chat.getMessages(id)
    // P2-13:await 期间该会话可能已被删除,resolve 后校验再落状态,防「复活」已删会话
    if (!get().sessions.some((s) => s.id === id)) return
    set({ currentId: id, messages })
  },

  newSession: async (mode) => {
    if (get().streaming) return null
    const s = await window.lexiaoen.chat.createSession(mode)
    set({ sessions: [s, ...get().sessions], currentId: s.id, messages: [] })
    return s
  },

  renameSession: async (id, title) => {
    await window.lexiaoen.chat.renameSession(id, title)
    set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, title } : s)) })
  },

  deleteSession: async (id) => {
    // P1-2:流式中的当前会话不可删——主进程生成流程会撞外键异常;其他会话可正常删
    if (get().streaming && get().currentId === id) return
    await window.lexiaoen.chat.deleteSession(id)
    const rest = get().sessions.filter((s) => s.id !== id)
    set({ sessions: rest })
    if (get().currentId === id) {
      if (rest.length) await get().selectSession(rest[0].id)
      else set({ currentId: null, messages: [] })
    }
  },

  updateSessionMode: async (id, mode) => {
    await window.lexiaoen.chat.setSessionMode(id, mode)
    set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, mode } : s)) })
  },

  send: async (text, mode) => {
    const st = get()
    if (st.streaming || !text.trim()) return
    set({ sendError: null, retryNote: null })
    let sid = st.currentId
    if (!sid) {
      const s = await get().newSession(mode)
      if (!s) return
      sid = s.id
    }
    const reqId = crypto.randomUUID()
    set({ streaming: { reqId, userText: text.trim(), optimisticUser: true, phase: 'waiting' }, ephem: startEphemeral(reqId, mode) })
    const ack = await window.lexiaoen.chat.send(sid, reqId, text)
    if (!ack.ok) set({ streaming: null, ephem: null, sendError: ack.error })
    // 竞态防御:Mock/快速流可能在 ack 前已 finalize(streaming=null),此时 sources 已随消息落库,不能再复活 streaming
    else if (ack.sources?.length && get().streaming) set({ streaming: { ...get().streaming!, sources: ack.sources } })
  },

  retry: async (userMessageId, mode) => {
    const st = get()
    if (st.streaming || !st.currentId) return
    const sid = st.currentId
    set({ sendError: null, retryNote: null })
    const reqId = crypto.randomUUID()
    set({ streaming: { reqId, userText: '', optimisticUser: false, phase: 'waiting' }, ephem: startEphemeral(reqId, mode) })
    const ack = await window.lexiaoen.chat.retry(sid, reqId, userMessageId)
    if (!ack.ok) set({ streaming: null, ephem: null, sendError: ack.error })
    else if (ack.sources?.length && get().streaming) set({ streaming: { ...get().streaming!, sources: ack.sources } })
  },

  abort: () => {
    const st = get()
    if (st.streaming) void window.lexiaoen.chat.abort(st.streaming.reqId)
  },

  onEvent: (e) => {
    const st = get()
    if (!st.streaming || e.reqId !== st.streaming.reqId) return
    if (e.type === 'reasoning') {
      if (st.streaming.phase === 'waiting') set({ streaming: { ...st.streaming, phase: 'thinking' } })
      ephem?.rscheduler.push(e.text)
    } else if (e.type === 'delta') {
      if (st.streaming.phase !== 'text') set({ streaming: { ...st.streaming, phase: 'text' } })
      ephem?.scheduler.push(e.text)
    } else if (e.type === 'retry') {
      set({ retryNote: e.message })
    } else if (e.type === 'end') {
      set({ retryNote: null })
      const ep = ephem
      if (ep) {
        // 让调度器把积压吐完(丝滑收尾),onDone 再 finalize
        ep.scheduler.end()
        ep.rscheduler.end()
      } else {
        void get().finalize()
      }
    }
  },

  finalize: async () => {
    const st = get()
    if (!st.streaming || !st.currentId) return
    const sid = st.currentId
    try {
      const [messages, sessions] = await Promise.all([window.lexiaoen.chat.getMessages(sid), window.lexiaoen.chat.listSessions()])
      ephem = null
      set({ messages, sessions, streaming: null, ephem: null })
    } catch {
      // P2-12:重试一次;仍失败则把流式内容固化为静态消息,避免「回答看起来丢了」
      try {
        await new Promise((r) => setTimeout(r, 400))
        const [messages, sessions] = await Promise.all([window.lexiaoen.chat.getMessages(sid), window.lexiaoen.chat.listSessions()])
        ephem = null
        set({ messages, sessions, streaming: null, ephem: null })
      } catch {
        const ep = ephem
        ephem = null
        const s = get().streaming
        const text = ep ? ep.text.get() : ''
        const reason = ep ? ep.reason.get() : ''
        const now = Date.now()
        const blank = { sessionId: sid, status: 0 as const, model: null, promptTokens: null, completionTokens: null, cacheHit: null, cacheMiss: null, ttftMs: null, totalMs: null }
        const extra: MessageRow[] = []
        if (s?.optimisticUser) extra.push({ ...blank, id: -now, role: 'user', content: s.userText, reasoning: '', sources: null, createdAt: now - 1 })
        if (text || reason) extra.push({ ...blank, id: -now - 1, role: 'assistant', content: text, reasoning: reason, sources: s?.sources ?? null, createdAt: now })
        set({ messages: [...get().messages, ...extra], streaming: null, ephem: null })
      }
    }
  },

  reset: () => {
    const ep = ephem
    ephem = null
    set({ sessions: [], currentId: null, messages: [], streaming: null, ephem: null, retryNote: null, sendError: null, hydrated: false })
    // 调度器收尾放在 set 之后:finalize 读到 streaming=null 直接返回,不会拉回脏状态
    if (ep) {
      try {
        ep.rscheduler.end()
      } catch {
        // 忽略
      }
      try {
        ep.scheduler.end()
      } catch {
        // 忽略
      }
    }
  },

  clearSendError: () => set({ sendError: null }),
  refreshKeyStatus: async () => {
    try {
      set({ keyStatus: await window.lexiaoen.chat.keyStatus() })
    } catch {
      // 忽略
    }
  }
}))

// 全局事件接线:preload 的 onEvent 只允许被调用一次
if (typeof window !== 'undefined' && window.lexiaoen) {
  window.lexiaoen.chat.onEvent((e) => useChatStore.getState().onEvent(e))
}

/** 当前会话缓存命中率(状态条与仪表盘观测点) */
export function selectHitPct(state: Pick<ChatState, 'messages'>): number | null {
  let hit = 0
  let miss = 0
  for (const m of state.messages) {
    if (m.cacheHit != null) hit += m.cacheHit
    if (m.cacheMiss != null) miss += m.cacheMiss
  }
  return hit + miss > 0 ? Math.round((hit / (hit + miss)) * 1000) / 10 : null
}
