export type ModeId = 'fast' | 'standard' | 'quality'

export interface AppInfo {
  app: string
  electron: string
  chrome: string
  node: string
  abi: string
  platform: string
}

export interface DbPing {
  ok: boolean
  sqlite: string
  userVersion: number
  path: string
  error: string | null
}

export interface WindowApi {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  onMaximizedChange(cb: (maximized: boolean) => void): () => void
}

export interface SessionRow {
  id: string
  title: string
  mode: ModeId
  /** L2 学习者画像快照(会话内固定);渲染层不使用,组装器使用 */
  learnerSnapshot: string
  createdAt: number
  updatedAt: number
}

/** status: 0=完成 1=错误(已保留部分) 2=用户中止 */
export interface MessageRow {
  id: number
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  reasoning: string
  status: 0 | 1 | 2
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  cacheHit: number | null
  cacheMiss: number | null
  ttftMs: number | null
  totalMs: number | null
  /** 本轮 L4 检索引用(知识卡/教材出处);user 消息与无命中时为 null */
  sources?: SourceRef[] | null
  createdAt: number
}

export interface UsageInfo {
  promptTokens: number
  completionTokens: number
  cacheHit: number
  cacheMiss: number
}

export interface KeyStatus {
  /** 构建时是否注入了内置 key */
  builtinConfigured: boolean
  source: 'builtin' | 'override' | 'none'
  /** Mock 流(无 key 的端到端测试)是否激活 */
  mock: boolean
}

export type ChatEndReason = 'done' | 'abort' | 'error'

export type ChatEvent =
  | { reqId: string; type: 'reasoning'; text: string }
  | { reqId: string; type: 'delta'; text: string }
  | { reqId: string; type: 'retry'; attempt: number; total: number; message: string }
  | { reqId: string; type: 'end'; reason: ChatEndReason; error?: string }

/** ack.sources:本轮 L4 检索命中的引用(渲染层在回答下方展示) */
export type ChatSendAck = { ok: true; reqId: string; sources?: SourceRef[] } | { ok: false; kind: 'no_key' | 'busy' | 'not_found' | 'bad_request'; error: string }

// ---------- M3 学习层 ----------

export interface SyllabusNode {
  id: string
  parentId: string | null
  subject: 'anatomy' | 'physiology'
  level: 1 | 2 | 3
  title: string
  requirement: string | null
  bloom: string | null
  sort: number
}

export interface QuizOption {
  key: string
  text: string
}

export type QuizQType = 'single' | 'multiple' | 'blank' | 'term' | 'short' | 'essay' | 'case'

export interface QuizQuestion {
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

/** 复习队列项:调度字段来自 FSRS,内容由 question(错题)或 knowledge(知识卡)承载 */
export interface ReviewItem {
  rowId: number
  kind: 'wrong' | 'knowledge'
  dueMs: number
  reps: number
  question: QuizQuestion | null
  knowledge: { id: number; title: string; definition: string; points: string[]; confusion: string; mnemonic: string; path: string[] } | null
}

export interface ReviewStats {
  total: number
  due: number
  todayReviewed: number
}

export interface KbSearchHit {
  cardId: number
  title: string
  definition: string
  points: string[]
  path: string[]
  rank: number
}

export interface StudyApi {
  syllabus(): Promise<SyllabusNode[]>
  searchKb(query: string, limit?: number): Promise<KbSearchHit[]>
  generateQuiz(nodeId: string, count: number): Promise<QuizQuestion[]>
  listQuiz(limit?: number): Promise<QuizQuestion[]>
  reviewQueue(limit?: number): Promise<ReviewItem[]>
  reviewStats(): Promise<ReviewStats>
  addWrongCard(questionId: number): Promise<number>
  gradeCard(rowId: number, grade: 1 | 2 | 3 | 4): Promise<{ dueMs: number; scheduledDays: number }>
  /** 每题判分后落一条答题记录(仪表盘掌握度数据源) */
  logAttempt(nodeId: string | null, qtype: string, bloom: string, correct: boolean): Promise<void>
  /** M5 记忆管理:当前学习者画像文本(实时聚合) */
  learnerSnapshot(): Promise<string>
  /** M5 记忆管理:清除记忆,'chat'=对话历史,'study'=学习记录(答题/复习/卡池) */
  clearMemory(scope: 'chat' | 'study'): Promise<void>
}

// ---------- M4 仪表盘 ----------

export interface ChapterMastery {
  chapterId: string
  title: string
  subject: 'anatomy' | 'physiology'
  total: number
  correct: number
  pct: number | null
}

export interface DashboardStats {
  streak: number
  attempts: number
  correct: number
  review: { total: number; due: number; todayReviewed: number }
  mastery: ChapterMastery[]
  forecast: { dayOffset: number; count: number }[]
  usage: { promptTokens: number; completionTokens: number; cacheHit: number; cacheMiss: number; sessions: number }
}

export interface DashboardApi {
  stats(): Promise<DashboardStats>
}

// ---------- M4 教材导入 ----------

export interface TextbookDocRow {
  id: number
  title: string
  pages: number
  chunks: number
  createdAt: number
}

export interface TextbookApi {
  list(): Promise<TextbookDocRow[]>
  /** 打开系统文件选择框;取消返回 null,导入完成返回新文档行 */
  import(): Promise<TextbookDocRow | null>
  remove(id: number): Promise<void>
}

/** 对话回答的引用来源(L4 RAG 检索块) */
export interface SourceRef {
  kind: 'card' | 'textbook'
  /** 知识卡标题 或 文件名 */
  title: string
  /** 知识卡=考纲路径;教材=文件名 p.页码 */
  locator: string
}

export interface ChatApi {
  listSessions(): Promise<SessionRow[]>
  createSession(mode: ModeId): Promise<SessionRow>
  renameSession(id: string, title: string): Promise<void>
  deleteSession(id: string): Promise<void>
  setSessionMode(id: string, mode: ModeId): Promise<void>
  getMessages(sessionId: string): Promise<MessageRow[]>
  send(sessionId: string, reqId: string, text: string): Promise<ChatSendAck>
  retry(sessionId: string, reqId: string, userMessageId: number): Promise<ChatSendAck>
  abort(reqId: string): void
  keyStatus(): Promise<KeyStatus>
  setOverrideKey(key: string | null): Promise<void>
  testKey(key: string): Promise<{ ok: boolean; message: string }>
  onEvent(cb: (e: ChatEvent) => void): () => void
}

/** 渲染进程经 contextBridge 拿到的全部能力;key 永不出主进程(《详细方案》4.6) */
export interface LexiaoenApi {
  appInfo(): Promise<AppInfo>
  dbPing(): Promise<DbPing>
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  window: WindowApi
  chat: ChatApi
  study: StudyApi
  dashboard: DashboardApi
  textbook: TextbookApi
}
