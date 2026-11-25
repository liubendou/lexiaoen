// M3 学习数据层:考纲树 / 知识卡 / FTS 检索 / 测验题 / FSRS 复习卡
// 复习卡调度状态由 server/fsrs 序列化,这里只管存取与队列查询

import { initDb } from './index'

// ---------- 类型 ----------

export interface SyllabusNodeRow {
  id: string
  parentId: string | null
  subject: 'anatomy' | 'physiology'
  level: 1 | 2 | 3
  title: string
  /** 掌握/理解/了解(仅知识点级) */
  requirement: string | null
  /** 记忆/理解/应用/分析(仅知识点级) */
  bloom: string | null
  sort: number
}

export interface KnowledgeCardRow {
  id: number
  nodeId: string
  title: string
  definition: string
  points: string[]
  confusion: string
  mnemonic: string
  source: 'seed' | 'ai' | 'user'
  createdAt: number
}

export interface QuizOption {
  key: string
  text: string
}

export type QuizQType = 'single' | 'multiple' | 'blank' | 'term' | 'short' | 'essay' | 'case'

export interface QuizQuestionRow {
  id: number
  nodeId: string | null
  qtype: QuizQType
  bloom: string
  stem: string
  options: QuizOption[]
  answer: string
  explanation: string
  createdAt: number
}

export interface ReviewCardRow {
  id: number
  kind: 'wrong' | 'knowledge'
  questionId: number | null
  cardId: number | null
  dueMs: number
  fsrs: string
  createdAt: number
}

export interface ReviewStats {
  total: number
  due: number
  todayReviewed: number
}

// ---------- 考纲树 ----------

export interface SeedNode {
  id: string
  subject?: 'anatomy' | 'physiology'
  level: 1 | 2 | 3
  title: string
  requirement?: string
  bloom?: string
  sort?: number
  children?: SeedNode[]
}

/** 插入考纲树(嵌套结构,递归补 parent_id 与 subject 继承;sort 按文档顺序递增) */
export function insertSyllabusNodes(rows: SeedNode[]): void {
  const stmt = initDb().prepare(
    'INSERT INTO syllabus_nodes (id, parent_id, subject, level, title, requirement, bloom, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const tx = initDb().transaction(() => {
    let counter = 0
    const walk = (list: SeedNode[], parent: string | null, subj: 'anatomy' | 'physiology'): void => {
      for (const n of list) {
        const subject = n.subject ?? subj
        stmt.run(n.id, parent, subject, n.level, n.title, n.requirement ?? null, n.bloom ?? null, counter++)
        if (n.children) walk(n.children, n.id, subject)
      }
    }
    walk(rows, null, 'anatomy')
  })
  tx()
}

export function syllabusCount(): number {
  return (initDb().prepare('SELECT COUNT(*) AS c FROM syllabus_nodes').get() as { c: number }).c
}

export function listSyllabus(): SyllabusNodeRow[] {
  return (initDb()
    .prepare('SELECT id, parent_id, subject, level, title, requirement, bloom, sort FROM syllabus_nodes ORDER BY sort, id')
    .all() as Record<string, unknown>[]).map(hydrateNode)
}

export function getNode(id: string): SyllabusNodeRow | null {
  const row = initDb()
    .prepare('SELECT id, parent_id, subject, level, title, requirement, bloom, sort FROM syllabus_nodes WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined
  return row ? hydrateNode(row) : null
}

/** 自下而上的节点路径(知识点 → 节 → 章) */
export function nodePath(id: string): SyllabusNodeRow[] {
  const out: SyllabusNodeRow[] = []
  let cur = getNode(id)
  let guard = 0
  while (cur && guard < 5) {
    out.unshift(cur)
    cur = cur.parentId ? getNode(cur.parentId) : null
    guard += 1
  }
  return out
}

function hydrateNode(r: Record<string, unknown>): SyllabusNodeRow {
  return {
    id: r.id as string,
    parentId: (r.parent_id as string | null) ?? null,
    subject: r.subject as 'anatomy' | 'physiology',
    level: r.level as 1 | 2 | 3,
    title: r.title as string,
    requirement: (r.requirement as string | null) ?? null,
    bloom: (r.bloom as string | null) ?? null,
    sort: r.sort as number
  }
}

// ---------- 知识卡 + FTS ----------

export interface SeedCard {
  node: string
  title: string
  definition: string
  points: string[]
  confusion?: string
  mnemonic?: string
}

export function insertCard(c: SeedCard, source: 'seed' | 'ai' | 'user' = 'seed'): number {
  const r = initDb()
    .prepare('INSERT INTO knowledge_cards (node_id, title, definition, points, confusion, mnemonic, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(c.node, c.title, c.definition, JSON.stringify(c.points), c.confusion ?? '', c.mnemonic ?? '', source, Date.now())
  return Number(r.lastInsertRowid)
}

export function cardById(id: number): KnowledgeCardRow | null {
  const r = initDb().prepare('SELECT * FROM knowledge_cards WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return r ? hydrateCard(r) : null
}

export function cardsByNode(nodeId: string): KnowledgeCardRow[] {
  return (initDb().prepare('SELECT * FROM knowledge_cards WHERE node_id = ? ORDER BY id').all(nodeId) as Record<string, unknown>[]).map(hydrateCard)
}

/** FTS 行替换(检索文本 = 分词后的标题 + 正文;正文由调用方合成) */
export function ftsUpsert(cardId: number, title: string, body: string): void {
  const db = initDb()
  db.prepare('DELETE FROM knowledge_fts WHERE card_id = ?').run(cardId)
  db.prepare('INSERT INTO knowledge_fts (card_id, title, body) VALUES (?, ?, ?)').run(cardId, title, body)
}

export interface SearchHit {
  card: KnowledgeCardRow
  path: string[]
  rank: number
}

/** BM25 检索:查询词同样预分词,OR 组合保召回,bm25 排序保精度(注记 A) */
export function searchCards(matchQuery: string, limit = 8): SearchHit[] {
  if (!matchQuery.trim()) return []
  const rows = initDb()
    .prepare(
      `SELECT k.*, f.rank AS rank
       FROM knowledge_fts f
       JOIN knowledge_cards k ON k.id = f.card_id
       WHERE knowledge_fts MATCH ?
       ORDER BY f.rank
       LIMIT ?`
    )
    .all(matchQuery, limit) as (Record<string, unknown> & { rank: number })[]
  return rows.map((r) => ({
    card: hydrateCard(r),
    path: nodePath(r.node_id as string).map((n) => n.title),
    rank: r.rank
  }))
}

function hydrateCard(r: Record<string, unknown>): KnowledgeCardRow {
  let points: string[] = []
  try {
    points = JSON.parse(r.points as string) as string[]
  } catch {
    points = []
  }
  return {
    id: r.id as number,
    nodeId: r.node_id as string,
    title: r.title as string,
    definition: r.definition as string,
    points,
    confusion: r.confusion as string,
    mnemonic: r.mnemonic as string,
    source: r.source as 'seed' | 'ai' | 'user',
    createdAt: r.created_at as number
  }
}

/** 合成知识卡检索正文(索引与展示共用口径) */
export function cardBody(c: KnowledgeCardRow): string {
  return [c.definition, ...c.points, c.confusion, c.mnemonic].filter(Boolean).join('\n')
}

// ---------- 测验题 ----------

export interface NewQuizQuestion {
  nodeId: string | null
  qtype: QuizQType
  bloom: string
  stem: string
  options: QuizOption[]
  answer: string
  explanation: string
}

export function insertQuizQuestion(q: NewQuizQuestion): number {
  const r = initDb()
    .prepare('INSERT INTO quiz_questions (node_id, qtype, bloom, stem, options, answer, explanation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(q.nodeId, q.qtype, q.bloom, q.stem, JSON.stringify(q.options), q.answer, q.explanation, Date.now())
  return Number(r.lastInsertRowid)
}

export function quizQuestionById(id: number): QuizQuestionRow | null {
  const r = initDb().prepare('SELECT * FROM quiz_questions WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return r ? hydrateQuestion(r) : null
}

export function listQuizQuestions(limit = 50): QuizQuestionRow[] {
  return (initDb().prepare('SELECT * FROM quiz_questions ORDER BY id DESC LIMIT ?').all(limit) as Record<string, unknown>[]).map(hydrateQuestion)
}

function hydrateQuestion(r: Record<string, unknown>): QuizQuestionRow {
  let options: QuizOption[] = []
  try {
    options = JSON.parse(r.options as string) as QuizOption[]
  } catch {
    options = []
  }
  return {
    id: r.id as number,
    nodeId: (r.node_id as string | null) ?? null,
    qtype: r.qtype as QuizQType,
    bloom: r.bloom as string,
    stem: r.stem as string,
    options,
    answer: r.answer as string,
    explanation: r.explanation as string,
    createdAt: r.created_at as number
  }
}

// ---------- 答题记录(M4 仪表盘数据源) ----------

export function insertQuizAttempt(nodeId: string | null, qtype: string | null, bloom: string | null, correct: boolean): void {
  initDb()
    .prepare('INSERT INTO quiz_attempts (node_id, qtype, bloom, correct, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(nodeId, qtype, bloom, correct ? 1 : 0, Date.now())
}

// ---------- 复习卡(FSRS) ----------

/** 已存在(kind+ref 唯一)则返回既有 id,否则新建并返回新 id */
export function addReviewCard(kind: 'wrong' | 'knowledge', refId: number, fsrsJson: string, dueMs: number): number {
  const col = kind === 'wrong' ? 'question_id' : 'card_id'
  const existing = initDb()
    .prepare(`SELECT id FROM review_cards WHERE kind = ? AND ${col} = ?`)
    .get(kind, refId) as { id: number } | undefined
  if (existing) return existing.id
  const r = initDb()
    .prepare(`INSERT INTO review_cards (kind, question_id, card_id, due_ms, fsrs, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(kind, kind === 'wrong' ? refId : null, kind === 'knowledge' ? refId : null, dueMs, fsrsJson, Date.now())
  return Number(r.lastInsertRowid)
}

export function reviewCardById(id: number): ReviewCardRow | null {
  const r = initDb().prepare('SELECT * FROM review_cards WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return r ? hydrateReviewCard(r) : null
}

export function reviewQueue(limit = 40): ReviewCardRow[] {
  return (initDb()
    .prepare('SELECT * FROM review_cards WHERE due_ms <= ? ORDER BY due_ms LIMIT ?')
    .all(Date.now(), limit) as Record<string, unknown>[]).map(hydrateReviewCard)
}

export function updateReviewCard(id: number, fsrsJson: string, dueMs: number): void {
  initDb().prepare('UPDATE review_cards SET fsrs = ?, due_ms = ? WHERE id = ?').run(fsrsJson, dueMs, id)
}

export function insertReviewLog(reviewCardId: number, grade: 1 | 2 | 3 | 4): void {
  initDb().prepare('INSERT INTO review_logs (review_card_id, grade, reviewed_at) VALUES (?, ?, ?)').run(reviewCardId, grade, Date.now())
}

export function reviewStats(): ReviewStats {
  const db = initDb()
  const total = (db.prepare('SELECT COUNT(*) AS c FROM review_cards').get() as { c: number }).c
  const due = (db.prepare('SELECT COUNT(*) AS c FROM review_cards WHERE due_ms <= ?').get(Date.now()) as { c: number }).c
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const todayReviewed = (
    db.prepare('SELECT COUNT(*) AS c FROM review_logs WHERE reviewed_at >= ?').get(dayStart.getTime()) as { c: number }
  ).c
  return { total, due, todayReviewed }
}

function hydrateReviewCard(r: Record<string, unknown>): ReviewCardRow {
  return {
    id: r.id as number,
    kind: r.kind as 'wrong' | 'knowledge',
    questionId: (r.question_id as number | null) ?? null,
    cardId: (r.card_id as number | null) ?? null,
    dueMs: r.due_ms as number,
    fsrs: r.fsrs as string,
    createdAt: r.created_at as number
  }
}
