import type { MessageRow, ModeId, SessionRow } from '../../shared/ipc'
import { initDb } from '.'

function mapSession(r: Record<string, unknown>): SessionRow {
  return {
    id: r.id as string,
    title: r.title as string,
    mode: r.mode as ModeId,
    learnerSnapshot: (r.learner_snapshot as string) ?? '',
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number
  }
}

function mapMessage(r: Record<string, unknown>): MessageRow {
  return {
    id: r.id as number,
    sessionId: r.session_id as string,
    role: r.role as 'user' | 'assistant',
    content: r.content as string,
    reasoning: r.reasoning as string,
    status: r.status as 0 | 1 | 2,
    model: (r.model as string | null) ?? null,
    promptTokens: (r.prompt_tokens as number | null) ?? null,
    completionTokens: (r.completion_tokens as number | null) ?? null,
    cacheHit: (r.cache_hit as number | null) ?? null,
    cacheMiss: (r.cache_miss as number | null) ?? null,
    ttftMs: (r.ttft_ms as number | null) ?? null,
    totalMs: (r.total_ms as number | null) ?? null,
    sources: r.sources ? (JSON.parse(r.sources as string) as MessageRow['sources']) : null,
    createdAt: r.created_at as number
  }
}

export function createSession(mode: ModeId, learnerSnapshot: string): SessionRow {
  const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  initDb()
    .prepare('INSERT INTO sessions (id, title, mode, learner_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, '新对话', mode, learnerSnapshot, now, now)
  return { id, title: '新对话', mode, learnerSnapshot, createdAt: now, updatedAt: now }
}

export function listSessions(): SessionRow[] {
  return (initDb().prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Record<string, unknown>[]).map(mapSession)
}

export function getSession(id: string): SessionRow | null {
  const r = initDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return r ? mapSession(r) : null
}

export function renameSession(id: string, title: string): void {
  initDb().prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, id)
}

export function setSessionMode(id: string, mode: ModeId): void {
  // L1 模式 skill 会话内固定:仅允许在会话尚无消息时修改
  const n = initDb().prepare('SELECT COUNT(*) AS n FROM messages WHERE session_id = ?').get(id) as { n: number }
  if (n.n === 0) initDb().prepare('UPDATE sessions SET mode = ? WHERE id = ?').run(mode, id)
}

export function touchSession(id: string): void {
  initDb().prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), id)
}

export function deleteSession(id: string): void {
  initDb().prepare('DELETE FROM messages WHERE session_id = ?').run(id)
  initDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

export function insertUserMessage(sessionId: string, content: string): MessageRow {
  const db = initDb()
  const info = db
    .prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)')
    .run(sessionId, 'user', content, Date.now())
  return getMessage(Number(info.lastInsertRowid))!
}

export interface AssistantInsert {
  content: string
  reasoning: string
  status: 0 | 1 | 2
  model: string
  usage: { promptTokens: number; completionTokens: number; cacheHit: number; cacheMiss: number } | null
  ttftMs: number | null
  totalMs: number
  /** 本轮 L4 检索引用(知识卡/教材出处),随消息落库供气泡持久展示 */
  sources?: unknown[]
}

export function insertAssistantMessage(sessionId: string, d: AssistantInsert): MessageRow {
  const db = initDb()
  const info = db
    .prepare(
      `INSERT INTO messages
        (session_id, role, content, reasoning, status, model, prompt_tokens, completion_tokens, cache_hit, cache_miss, ttft_ms, total_ms, sources, created_at)
       VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sessionId,
      d.content,
      d.reasoning,
      d.status,
      d.model,
      d.usage?.promptTokens ?? null,
      d.usage?.completionTokens ?? null,
      d.usage?.cacheHit ?? null,
      d.usage?.cacheMiss ?? null,
      d.ttftMs ?? null,
      d.totalMs,
      d.sources?.length ? JSON.stringify(d.sources) : null,
      Date.now()
    )
  return getMessage(Number(info.lastInsertRowid))!
}

export function getMessage(id: number): MessageRow | null {
  const r = initDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return r ? mapMessage(r) : null
}

export function getMessages(sessionId: string): MessageRow[] {
  return (initDb().prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC').all(sessionId) as Record<string, unknown>[]).map(mapMessage)
}

/** 清空全部对话历史(M5 记忆管理):所有会话与其消息一并删除 */
export function clearChatHistory(): void {
  const db = initDb()
  db.prepare('DELETE FROM messages').run()
  db.prepare('DELETE FROM sessions').run()
}

/** 清空全部学习记录(M5 记忆管理):答题记录、复习日志与卡池一并删除;知识卡内容保留 */
export function clearStudyRecords(): void {
  const db = initDb()
  db.prepare('DELETE FROM quiz_attempts').run()
  db.prepare('DELETE FROM review_logs').run()
  db.prepare('DELETE FROM review_cards').run()
}
