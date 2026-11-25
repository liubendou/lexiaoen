// LLM 链路自检(--self-check-llm):不依赖真实 key,验证
// ① SSE 解析器容忍任意字节切分 ② Mock 生成全链路(五层组装→粗平滑→落库→事件序)
// 结果打印到 stdout 并写入临时 JSON,退出码 0/1

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SseParser, type LlmUsage } from '../../server/llm/deepseek'
import { handleSend } from '../../server/llm/chat'
import { closeDb } from '../../server/db'
import { createSessionWithSnapshot } from '../../server/llm/chat'
import { deleteSession, getMessages } from '../../server/db/chat'
import type { ChatEvent } from '../../shared/ipc'

interface Check {
  name: string
  pass: boolean
  detail: string
}

interface RawUsage {
  prompt_tokens?: number
  completion_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

function sseParserCheck(): Check {
  const events: { content: string; reasoning: string }[] = []
  const usageBox: { v: LlmUsage | null } = { v: null }
  const parser = new SseParser((data) => {
    const c = JSON.parse(data) as { choices?: { delta?: { content?: string; reasoning_content?: string } }[]; usage?: RawUsage | null }
    const d = c.choices?.[0]?.delta
    events.push({ content: d?.content ?? '', reasoning: d?.reasoning_content ?? '' })
    if (c.usage) {
      usageBox.v = {
        promptTokens: c.usage.prompt_tokens ?? 0,
        completionTokens: c.usage.completion_tokens ?? 0,
        cacheHit: c.usage.prompt_cache_hit_tokens ?? 0,
        cacheMiss: c.usage.prompt_cache_miss_tokens ?? 0
      }
    }
  })
  const canned =
    'data: {"choices":[{"delta":{"reasoning_content":"思考A"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"好"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"prompt_cache_hit_tokens":8,"prompt_cache_miss_tokens":2}}\n\n' +
    'data: [DONE]\n\n'
  // 逐字符喂入,压力测试跨块缓冲
  for (const ch of canned) parser.push(ch)
  parser.finish()
  const content = events.map((e) => e.content).join('')
  const reasoning = events.map((e) => e.reasoning).join('')
  const usage = usageBox.v
  const pass = content === '你好' && reasoning === '思考A' && usage !== null && usage.promptTokens === 10 && usage.cacheHit === 8
  return { name: 'SSE 解析器(逐字节切分)', pass, detail: `content="${content}" reasoning="${reasoning}" usage=${usage ? 'ok' : 'null'}` }
}

interface FakeWin {
  webContents: { send(channel: string, payload: unknown): void }
}

async function mockPipelineCheck(): Promise<{ check: Check; events: ChatEvent[] }> {
  const events: ChatEvent[] = []
  const win: FakeWin = { webContents: { send: (_ch, payload) => events.push(payload as ChatEvent) } }
  const session = createSessionWithSnapshot('standard')
  const ack = handleSend(win, session.id, 'req-selfcheck', '膝关节由哪些骨构成?')

  if (!ack.ok) return { check: { name: 'Mock 全链路', pass: false, detail: `send 失败:${ack.error}` }, events }

  // 等待 end 事件(mock 全程约 3-6s,上限 20s)
  const t0 = Date.now()
  while (!events.some((e) => e.type === 'end') && Date.now() - t0 < 20000) {
    await new Promise((r) => setTimeout(r, 50))
  }
  const endIdx = events.findIndex((e) => e.type === 'end')
  const firstReasoningIdx = events.findIndex((e) => e.type === 'reasoning')
  const firstDeltaIdx = events.findIndex((e) => e.type === 'delta')

  if (endIdx === -1) return { check: { name: 'Mock 全链路', pass: false, detail: '20s 内未收到 end 事件' }, events }

  const rows = getMessages(session.id)
  const assistant = rows.find((r) => r.role === 'assistant')
  const streamedDelta = events
    .filter((e) => e.type === 'delta')
    .map((e) => (e as { text: string }).text)
    .join('')
  const streamedReasoning = events
    .filter((e) => e.type === 'reasoning')
    .map((e) => (e as { text: string }).text)
    .join('')

  const checks: [string, boolean, string][] = [
    ['思考流先于正文流', firstReasoningIdx !== -1 && firstDeltaIdx !== -1 && firstReasoningIdx < firstDeltaIdx, `reasoning@${firstReasoningIdx} delta@${firstDeltaIdx}`],
    ['end 在所有增量之后', endIdx === events.length - 1, `end@${endIdx}/${events.length - 1}`],
    ['流式增量与落库正文一致', assistant !== undefined && streamedDelta === assistant.content, `len ${streamedDelta.length}/${assistant?.content.length ?? -1}`],
    ['思考流落库', assistant !== undefined && streamedReasoning === assistant.reasoning, `len ${streamedReasoning.length}/${assistant?.reasoning.length ?? -1}`],
    ['缓存观测字段落库', (assistant?.cacheHit ?? 0) > 0, `hit=${assistant?.cacheHit ?? 'null'}`],
    ['TTFT 记录', (assistant?.ttftMs ?? 0) > 0, `ttft=${assistant?.ttftMs ?? 'null'}ms`],
    ['粗平滑生效(IPC 次数远小于字符数)', events.filter((e) => e.type === 'delta').length < streamedDelta.length / 2, `ipc=${events.filter((e) => e.type === 'delta').length} chars=${streamedDelta.length}`],
    ['用户消息落库', rows.some((r) => r.role === 'user' && r.content === '膝关节由哪些骨构成?'), 'ok']
  ]
  const failed = checks.filter(([, p]) => !p)
  deleteSession(session.id)
  return {
    check: {
      name: 'Mock 全链路(组装→桥接→落库→事件)',
      pass: failed.length === 0,
      detail: failed.length === 0 ? `${checks.length} 项全过` : failed.map(([n, , d]) => `${n}: ${d}`).join('; ')
    },
    events
  }
}

export async function runLlmSelfCheck(): Promise<number> {
  process.env.LEXIAOEN_MOCK_LLM = '1'
  process.env.LEXIAOEN_DB_PATH = join(tmpdir(), `lexiaoen-llm-selfcheck-${Date.now()}.db`)

  const checks: Check[] = [sseParserCheck()]
  try {
    const { check } = await mockPipelineCheck()
    checks.push(check)
  } catch (e) {
    checks.push({ name: 'Mock 全链路', pass: false, detail: String(e) })
  } finally {
    closeDb()
  }

  const ok = checks.every((c) => c.pass)
  console.log('[llm-self-check]', JSON.stringify({ ok, checks }))
  return ok ? 0 : 1
}
