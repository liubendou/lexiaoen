// 测验生成(《详细方案》4.4:flash 非思考 + JSON Output;Mock 模式确定性出题供端到端回归)
import type { QuizOption, QuizQType } from '../db/study'
import {
  cardBody,
  cardsByNode,
  getNode,
  insertQuizQuestion,
  nodePath,
  searchCards,
  type QuizQuestionRow
} from '../db/study'
import { mockActive, resolveApiKey, routeFor } from '../llm/chat'
import { DeepSeekError, streamChat, type LlmMessage } from '../llm/deepseek'
import { tokenize, toMatchQuery } from '../rag/tokenize'

const BASE_URL = import.meta.env.MAIN_VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const QTYPE_SET = new Set<QuizQType>(['single', 'multiple', 'blank', 'term', 'short', 'essay', 'case'])
const BLOOM_SET = new Set(['记忆', '理解', '应用', '分析', '评价'])

export interface GenerateQuizArgs {
  nodeId: string
  count?: number
}

export class QuizError extends Error {
  constructor(
    public kind: 'no_key' | 'bad_request' | 'generate' | 'empty',
    message: string
  ) {
    super(message)
  }
}

function materialFor(nodeId: string): { path: string[]; requirement: string | null; cards: { title: string; body: string }[] } {
  const node = getNode(nodeId)
  if (!node) throw new QuizError('bad_request', '考纲知识点不存在')
  const path = nodePath(nodeId).map((n) => n.title)
  let cards = cardsByNode(nodeId).map((c) => ({ title: c.title, body: cardBody(c) }))
  if (cards.length === 0) {
    // 节点无卡时按标题检索兜底(检索练习的取材通道)
    // P2-2:searchCards 契约要求已分词的 MATCH 表达式,原始标题含特殊字符会直接抛 SqliteError
    cards = searchCards(toMatchQuery(tokenize(node.title)), 4).map((h) => ({ title: h.card.title, body: cardBody(h.card) }))
  }
  return { path, requirement: node.requirement, cards }
}

function mockQuiz(nodeId: string, count: number): QuizQuestionRow[] {
  const { path, requirement, cards } = materialFor(nodeId)
  const topic = path[path.length - 1] ?? '未命名知识点'
  const first = cards[0]
  const rows: { q: Omit<QuizQuestionRow, 'id' | 'createdAt'> }[] = []

  if (first) {
    const pts = first.body.split('\n').filter(Boolean)
    const correct = pts[0] ?? first.title
    const distract = pts.slice(1, 3)
    const options: QuizOption[] = [
      { key: 'A', text: correct },
      { key: 'B', text: distract[0] ?? '与该知识点无关的描述(干扰项)' },
      { key: 'C', text: distract[1] ?? '仅在某些病理状态下成立的描述(干扰项)' },
      { key: 'D', text: '以上均不正确(干扰项)' }
    ]
    rows.push({
      q: {
        nodeId,
        qtype: 'single',
        bloom: '记忆',
        stem: `【${requirement ?? '掌握'}·${topic}】下列关于「${first.title}」的叙述,正确的是:`,
        options,
        answer: 'A',
        explanation: `A 正确:${correct} 其余选项为干扰项。${distract.length ? `易混点:${distract.join(';')}` : ''}`
      }
    })
  }
  rows.push({
    q: {
      nodeId,
      qtype: 'term',
      bloom: '记忆',
      stem: `【${topic}】名词解释:${first?.title ?? topic}`,
      options: [],
      answer: first ? `${first.title}:${first.body.split('\n')[0] || '参见知识卡要点'}` : `${topic}:参见对应章节知识卡。`,
      explanation: '答题要点:定义 + 关键构成 + 临床意义(阅卷按点给分)。'
    }
  })
  rows.push({
    q: {
      nodeId,
      qtype: 'short',
      bloom: '理解',
      stem: `【${topic}】简述${topic}的核心要点及其意义。`,
      options: [],
      answer: first ? first.body : '参见知识卡。',
      explanation: '评分要点:要点完整、层次清晰、术语准确。'
    }
  })
  const out = rows.slice(0, Math.max(1, Math.min(count, 10)))
  return out.map(({ q }) => {
    const id = insertQuizQuestion(q)
    return { ...q, id, createdAt: Date.now() }
  })
}

function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (m ? m[1] : text).trim()
}

interface LlmQuestion {
  qtype?: string
  bloom?: string
  stem?: string
  options?: { key?: string; text?: string }[]
  answer?: string
  explanation?: string
}

const QTYPE_LABEL: Record<QuizQType, string> = {
  single: '单选题(4 个选项 A-D,答案 1 个字母)',
  multiple: '多选题(4-5 个选项,答案为多个字母)',
  blank: '填空题',
  term: '名词解释',
  short: '简答题',
  essay: '论述题',
  case: '病例分析'
}

async function llmQuiz(nodeId: string, count: number): Promise<QuizQuestionRow[]> {
  const { path, requirement, cards } = materialFor(nodeId)
  const topic = path.join(' › ')
  const material = cards.length
    ? cards.map((c, i) => `【卡${i + 1}】${c.title}\n${c.body}`).join('\n\n')
    : `考纲点:${topic}(无种子知识卡,依你自有的学科知识命题,内容必须准确)`

  const system = `你是河北医学专升本《${path[0] ?? '医学'}》学科的资深命题人。你的命题特点:考点紧扣考纲要求层级,术语规范,干扰项来自真实易混点,解析直给得分点。只输出 JSON,不输出任何其他文字。`
  const user = `考纲知识点:${topic}${requirement ? `(要求层级:${requirement})` : ''}
命制 ${count} 道题,题型组合:第 1 题单选题,若 ${count} ≥ 2 最后 1-2 题为名词解释或简答题,其余为单选题。
认知层级:单选题在 记忆/理解/应用 内分布,简答/名词解释为 记忆/理解。

命题素材:
${material}

输出 JSON 格式:
{"questions":[{"qtype":"single","bloom":"记忆","stem":"题干(可含【】标注层级与考点)","options":[{"key":"A","text":"选项文本"}],"answer":"A","explanation":"解析:为何对、为何错"}]}
名词解释/简答题 options 为空数组 [],answer 为参考答案文本(150 字内,按点分号分隔)。`

  const keyInfo = resolveApiKey()
  if (!keyInfo.key) throw new QuizError('no_key', '需要配置 API Key 才能生成测验')
  const { model, thinking } = routeFor('fast')

  const messages: LlmMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
  const result = await streamChat({
    apiKey: keyInfo.key,
    baseUrl: BASE_URL,
    model,
    thinking,
    messages,
    // P2-3:120s 兜底超时——此前 signal 永不 abort,LLM 挂起时出题按钮永久 loading
    signal: AbortSignal.timeout(120_000),
    responseFormat: { type: 'json_object' }
  })

  let parsed: { questions?: LlmQuestion[] }
  try {
    parsed = JSON.parse(stripFences(result.content)) as { questions?: LlmQuestion[] }
  } catch {
    throw new QuizError('generate', `模型输出无法解析为 JSON(${result.content.slice(0, 80)}…)`)
  }
  const raw = parsed.questions
  if (!Array.isArray(raw) || raw.length === 0) throw new QuizError('empty', '模型未返回任何题目')

  const out: QuizQuestionRow[] = []
  for (const item of raw) {
    const qtype = (item.qtype ?? 'single') as QuizQType
    if (!QTYPE_SET.has(qtype)) continue
    const stem = (item.stem ?? '').trim()
    if (!stem) continue
    const options: QuizOption[] = (item.options ?? [])
      .filter((o) => o?.key && o?.text)
      .map((o) => ({ key: String(o.key).toUpperCase().slice(0, 1), text: String(o.text) }))
    let answer = (item.answer ?? '').trim()
    if (!answer) continue
    // P2-4:choice 类题型校验 answer 每个字母(大写化后)都指向存在的选项,否则丢题防脏题
    if (options.length > 0) {
      const keys = new Set(options.map((o) => o.key))
      const letters = [...answer.toUpperCase()].filter((c) => c >= 'A' && c <= 'Z')
      if (letters.length === 0 || letters.some((l) => !keys.has(l))) continue
      answer = letters.join('')
    }
    const q: Omit<QuizQuestionRow, 'id' | 'createdAt'> = {
      nodeId,
      qtype,
      bloom: item.bloom && BLOOM_SET.has(item.bloom) ? item.bloom : '记忆',
      stem,
      options,
      answer,
      explanation: (item.explanation ?? '').trim()
    }
    out.push({ ...q, id: insertQuizQuestion(q), createdAt: Date.now() })
  }
  if (out.length === 0) throw new QuizError('empty', '模型返回的题目均不完整')
  return out
}

export async function generateQuiz(args: GenerateQuizArgs): Promise<QuizQuestionRow[]> {
  const count = Math.max(1, Math.min(args.count ?? 5, 10))
  if (!getNode(args.nodeId)) throw new QuizError('bad_request', '考纲知识点不存在')
  // P2-2:mock 分支纳入统一异常处理,异常形态与真实路径一致
  try {
    if (mockActive()) return mockQuiz(args.nodeId, count)
    return await llmQuiz(args.nodeId, count)
  } catch (e) {
    if (e instanceof QuizError) throw e
    const kind = e instanceof DeepSeekError ? e.kind : 'generate'
    const copy: Record<string, string> = {
      key: 'API Key 无效或额度已用尽',
      rate: '请求过于频繁,请稍后再试',
      network: '网络中断,请稍后再试',
      bad_request: '请求异常,请稍后再试',
      server: '服务异常,请稍后再试',
      abort: '已取消',
      generate: '生成失败,请重试'
    }
    throw new QuizError('generate', copy[kind] ?? '生成失败,请重试')
  }
}

export const QTYPE_NAME: Record<QuizQType, string> = QTYPE_LABEL
