// 对话编排:五层组装 → DeepSeek/Mock 流 → 双通道粗平滑 → 落库 → 终态事件
// key 只存在于主进程(《详细方案》4.6):渲染层只拿得到 source 状态,拿不到明文

import type { ChatSendAck, KeyStatus, ModeId, SessionRow, SourceRef } from '../../shared/ipc'
import { getSetting } from '../db'
import {
  createSession,
  insertAssistantMessage,
  insertUserMessage,
  getMessages,
  getSession,
  renameSession,
  touchSession,
  type AssistantInsert
} from '../db/chat'
import { assembleMessages, buildLearnerSnapshot } from './assembler'
import { buildRagContext } from '../rag/search'
import { DeepSeekError, streamChat, type LlmMessage, type ThinkingParam } from './deepseek'
import { mockStream } from './mock'
import { StreamBridge, type BridgeWin } from './stream-bridge'

const BASE_URL = import.meta.env.MAIN_VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const MODEL_FAST = import.meta.env.MAIN_VITE_DEEPSEEK_MODEL_FAST || 'deepseek-flash'
const MODEL_PRO = import.meta.env.MAIN_VITE_DEEPSEEK_MODEL_PRO || 'deepseek-v4-pro'

/** 三模式模型路由(《详细方案》4.4) */
export function routeFor(mode: ModeId): { model: string; thinking: ThinkingParam } {
  if (mode === 'fast') return { model: MODEL_FAST, thinking: { type: 'disabled' } }
  if (mode === 'standard') return { model: MODEL_FAST, thinking: { type: 'enabled', reasoning_effort: 'high' } }
  return { model: MODEL_PRO, thinking: { type: 'enabled', reasoning_effort: 'high' } }
}

export function builtinConfigured(): boolean {
  return Boolean(import.meta.env.MAIN_VITE_DEEPSEEK_KEY?.trim())
}

export function mockActive(): boolean {
  return process.env.LEXIAOEN_MOCK_LLM === '1'
}

export function resolveApiKey(): { key: string | null; source: 'builtin' | 'override' | 'none' } {
  const override = getSetting('api_key_override')
  if (override && override.trim()) return { key: override.trim(), source: 'override' }
  const builtin = import.meta.env.MAIN_VITE_DEEPSEEK_KEY?.trim()
  if (builtin) return { key: builtin, source: 'builtin' }
  return { key: null, source: 'none' }
}

export function keyStatusPayload(): KeyStatus {
  return { builtinConfigured: builtinConfigured(), source: resolveApiKey().source, mock: mockActive() }
}

export function createSessionWithSnapshot(mode: ModeId): SessionRow {
  return createSession(mode, buildLearnerSnapshot())
}

function errorCopy(kind: DeepSeekError['kind'], err: unknown): string {
  switch (kind) {
    case 'key':
      return 'API Key 无效或额度已用尽。可在设置中填入自己的 Key'
    case 'rate':
      return '请求过于频繁,已自动重试仍失败,请稍后再试'
    case 'network':
      return '连接中断,已生成的内容已保留'
    case 'bad_request':
      return `请求异常(${(err as DeepSeekError).status ?? ''}),请稍后再试`
    default:
      return `服务异常(${(err as DeepSeekError).status ?? ''}),请稍后再试`
  }
}

const streams = new Map<string, { controller: AbortController }>()
/** 会话级在途生成表(P1-3):同一会话同时只允许一条生成流 */
const busySessions = new Map<string, string>()

export function handleAbort(reqId: string): void {
  streams.get(reqId)?.controller.abort()
}

/** 是否有活跃生成流(P2-14 关窗确认用) */
export function hasActiveStreams(): boolean {
  return busySessions.size > 0
}

/** 窗口代理(P1-2):销毁检测 + 异常吞掉,窗口关闭后一切事件发送静默丢弃 */
function guardedWin(win: BridgeWin): BridgeWin {
  return {
    webContents: {
      send: (ch: string, payload: unknown): void => {
        try {
          const wc = win.webContents as { isDestroyed?: () => boolean }
          if (typeof wc.isDestroyed === 'function' && wc.isDestroyed()) return
          win.webContents.send(ch, payload)
        } catch {
          // 窗口已销毁:静默
        }
      }
    }
  }
}

/** 生成异常冲出编排层时的兜底:补发 end 事件,防渲染层永久 pending(P1-2) */
function sendEndFallback(win: BridgeWin, reqId: string): void {
  try {
    const wc = win.webContents as { isDestroyed?: () => boolean }
    if (typeof wc.isDestroyed === 'function' && wc.isDestroyed()) return
    win.webContents.send('chat:event', { reqId, type: 'end', reason: 'error', error: '生成异常,请稍后再试' })
  } catch {
    // 忽略
  }
}

interface GenerateArgs {
  win: BridgeWin
  session: SessionRow
  reqId: string
  /** 生成内容对应的最后一条 user 消息 id(重试时指向既有行) */
  uptoUserId: number
  /** 新发时的问题原文(mock 引用与首条标题用) */
  question: string
  /** L4 检索块(空串=无命中);只拼进本轮最后一条 user 消息,历史保持库中原文 */
  ragBlock: string
  /** L4 引用出处,随回答落库供气泡持久展示 */
  sources?: SourceRef[]
  mock: boolean
  apiKey: string | null
}

async function runGeneration(args: GenerateArgs): Promise<void> {
  const { win: rawWin, session, reqId, uptoUserId, question, ragBlock, sources, mock, apiKey } = args
  const win = guardedWin(rawWin)
  const controller = new AbortController()
  streams.set(reqId, { controller })
  busySessions.set(session.id, reqId)
  const rb = new StreamBridge(win, reqId, 'reasoning')
  const dbb = new StreamBridge(win, reqId, 'delta')
  let contentAcc = ''
  let reasonAcc = ''
  const started = performance.now()
  let ttft = 0

  const sendEvent = (payload: unknown): void => win.webContents.send('chat:event', payload)

  /** 终态落库(P1-2):会话已被删除则跳过;落库自身失败也不外抛(防异常冲出 catch) */
  const persistTerminal = (row: AssistantInsert): void => {
    try {
      if (!getSession(session.id)) return
      insertAssistantMessage(session.id, row)
      touchSession(session.id)
    } catch (e) {
      console.error('[chat] 终态落库失败(会话可能已删除):', e)
    }
  }

  try {
    const rows = getMessages(session.id).filter((m) => m.id <= uptoUserId)
    // P2-1:空内容的失败/占位 assistant 行不进历史
    // L4 RAG:检索块只附加在本轮最后一条 user 消息上(《详细方案》4.3,L3 历史逐字节不变)
    const history = rows
      .filter((m) => !(m.role === 'assistant' && !m.content.trim()))
      .map((m, i, arr) => {
        const isLastUser = ragBlock && i === arr.length - 1 && m.role === 'user'
        return { role: m.role, content: isLastUser ? ragBlock + m.content : m.content }
      })
    const messages: LlmMessage[] = assembleMessages({
      mode: session.mode,
      learnerSnapshot: session.learnerSnapshot || buildLearnerSnapshot(),
      history
    })
    const { model, thinking } = routeFor(session.mode)

    const onReasoning = (d: string): void => {
      if (!ttft) ttft = performance.now() - started
      reasonAcc += d
      rb.push(d)
    }
    const onDelta = (d: string): void => {
      if (!ttft) ttft = performance.now() - started
      contentAcc += d
      dbb.push(d)
    }
    const onRetry = (attempt: number, total: number): void => {
      sendEvent({ reqId, type: 'retry', attempt, total, message: `请求过于频繁,正在自动重试(${attempt}/${total})` })
    }

    const result = mock
      ? await mockStream({ question, signal: controller.signal, onReasoning, onDelta })
      : await streamChat({
          apiKey: apiKey!,
          baseUrl: BASE_URL,
          model,
          thinking,
          messages,
          signal: controller.signal,
          onReasoning,
          onDelta,
          onRetry
        })

    // 终态前先 flush 双通道残余,再发 end——顺序颠倒会丢尾字
    rb.end()
    dbb.end()
    persistTerminal({
      content: result.content || contentAcc,
      reasoning: result.reasoning || reasonAcc,
      status: 0,
      model,
      usage: result.usage,
      ttftMs: Math.round(ttft),
      totalMs: Math.round(performance.now() - started),
      sources
    })
    sendEvent({ reqId, type: 'end', reason: 'done' })
  } catch (err) {
    rb.end()
    dbb.end()
    const kind = err instanceof DeepSeekError ? err.kind : 'server'
    const partial = { content: contentAcc, reasoning: reasonAcc, model: routeFor(session.mode).model, usage: null, ttftMs: Math.round(ttft), totalMs: Math.round(performance.now() - started), sources }
    if (kind === 'abort') {
      persistTerminal({ ...partial, status: 2 })
      sendEvent({ reqId, type: 'end', reason: 'abort' })
    } else {
      persistTerminal({ ...partial, status: 1 })
      sendEvent({ reqId, type: 'end', reason: 'error', error: errorCopy(kind, err) })
    }
  } finally {
    rb.dispose()
    dbb.dispose()
    streams.delete(reqId)
    busySessions.delete(session.id)
  }
}

export function handleSend(win: BridgeWin, sessionId: string, reqId: string, text: string): ChatSendAck {
  const session = getSession(sessionId)
  if (!session) return { ok: false, kind: 'not_found', error: '会话不存在' }
  // P1-3:会话级防重——上一条回答还在生成时拒绝并发
  if (busySessions.has(sessionId)) return { ok: false, kind: 'busy', error: '当前会话正在生成回答,请等它完成或先停止' }
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, kind: 'bad_request', error: '内容为空' }
  const mock = mockActive()
  const keyInfo = resolveApiKey()
  if (!keyInfo.key && !mock) return { ok: false, kind: 'no_key', error: '需要配置 API Key 才能对话' }

  const userRow = insertUserMessage(sessionId, trimmed)
  if (session.title === '新对话') {
    renameSession(sessionId, trimmed.slice(0, 24).replace(/\n/g, ' '))
  }
  // L4 检索(better-sqlite3 同步,毫秒级);sources 随 ack 回渲染层并随回答落库
  const rag = buildRagContext(trimmed)
  void runGeneration({ win, session, reqId, uptoUserId: userRow.id, question: trimmed, ragBlock: rag.block, sources: rag.block ? rag.sources : undefined, mock, apiKey: keyInfo.key }).catch(
    (e) => {
      // P1-2:兜底防 unhandled rejection,并补发 end 防渲染层永久 pending
      console.error('[chat] 生成流程异常:', e)
      sendEndFallback(win, reqId)
    }
  )
  return { ok: true, reqId, sources: rag.block ? rag.sources : undefined }
}

export function handleRetry(win: BridgeWin, sessionId: string, reqId: string, userMessageId: number): ChatSendAck {
  const session = getSession(sessionId)
  if (!session) return { ok: false, kind: 'not_found', error: '会话不存在' }
  // P1-3:会话级防重(与 handleSend 同口径)
  if (busySessions.has(sessionId)) return { ok: false, kind: 'busy', error: '当前会话正在生成回答,请等它完成或先停止' }
  const userRow = getMessages(sessionId).find((m) => m.id === userMessageId && m.role === 'user')
  if (!userRow) return { ok: false, kind: 'not_found', error: '未找到原问题' }
  const mock = mockActive()
  const keyInfo = resolveApiKey()
  if (!keyInfo.key && !mock) return { ok: false, kind: 'no_key', error: '需要配置 API Key 才能对话' }
  const rag = buildRagContext(userRow.content)
  void runGeneration({ win, session, reqId, uptoUserId: userRow.id, question: userRow.content, ragBlock: rag.block, sources: rag.block ? rag.sources : undefined, mock, apiKey: keyInfo.key }).catch(
    (e) => {
      console.error('[chat] 生成流程异常:', e)
      sendEndFallback(win, reqId)
    }
  )
  return { ok: true, reqId, sources: rag.block ? rag.sources : undefined }
}

export async function testKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000)
    })
    if (res.ok) return { ok: true, message: 'Key 有效' }
    if (res.status === 401) return { ok: false, message: 'Key 无效' }
    return { ok: false, message: `服务返回 ${res.status}` }
  } catch (e) {
    return { ok: false, message: `无法连接 DeepSeek(${String(e).slice(0, 60)})` }
  }
}
