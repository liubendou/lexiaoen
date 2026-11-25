// DeepSeek 流式客户端(OpenAI 兼容协议,规格核实于 2026-10 API 文档):
// - thinking: { type: 'enabled'|'disabled', reasoning_effort }
// - SSE,终止于 data: [DONE];usage 附着在最后一个内容 chunk
// - delta.reasoning_content 仅思考模式出现
// - usage.prompt_cache_hit_tokens / prompt_cache_miss_tokens 为缓存命中率观测点

export type DeepSeekErrorKind = 'key' | 'rate' | 'network' | 'bad_request' | 'server' | 'abort'

export class DeepSeekError extends Error {
  constructor(
    public kind: DeepSeekErrorKind,
    message: string,
    public status?: number,
    /** P1-1:流中途已吐增量后的网络错误标记为不可重试(重试会拼出「半截+全文」脏数据) */
    public noRetry = false
  ) {
    super(message)
    this.name = 'DeepSeekError'
  }
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ThinkingParam {
  type: 'enabled' | 'disabled'
  reasoning_effort?: 'low' | 'high' | 'max'
}

export interface StreamChatArgs {
  apiKey: string
  baseUrl: string
  model: string
  thinking: ThinkingParam
  messages: LlmMessage[]
  signal: AbortSignal
  /** JSON Output(《详细方案》4.4:出题等结构化生成用) */
  responseFormat?: { type: 'json_object' }
  onReasoning?: (delta: string) => void
  onDelta?: (delta: string) => void
  onRetry?: (attempt: number, total: number, waitMs: number) => void
}

export interface LlmUsage {
  promptTokens: number
  completionTokens: number
  cacheHit: number
  cacheMiss: number
}

export interface StreamChatResult {
  content: string
  reasoning: string
  ttftMs: number
  totalMs: number
  usage: LlmUsage | null
}

export const MAX_ATTEMPTS = 3

/** SSE 事件解析:容忍任意字节切分,\r\n 与多 data 行(可独立单测) */
export class SseParser {
  private buf = ''
  private done = false
  /** P2-5:行尾悬挂 \r 推迟一个字节处理,防跨 chunk 的 CRLF 分裂把两个事件并成一块静默丢弃 */
  private heldCR = false

  constructor(private onEvent: (data: string) => void) {}

  push(chunk: string): void {
    if (this.done) return
    let data = chunk.replace(/\r\n/g, '\n')
    if (this.heldCR) {
      this.heldCR = false
      // 悬挂 \r 与本次开头的 \n 相遇即完整 CRLF(丢弃);否则是孤立 \r,保留(SSE 允许 CR 换行)
      if (!data.startsWith('\n')) data = '\r' + data
    }
    if (data.endsWith('\r')) {
      data = data.slice(0, -1)
      this.heldCR = true
    }
    this.buf += data
    let idx: number
    while ((idx = this.buf.indexOf('\n\n')) !== -1) {
      const block = this.buf.slice(0, idx)
      this.buf = this.buf.slice(idx + 2)
      this.emit(block)
    }
  }

  /** 流结束时处理无尾随空行的残余块 */
  finish(): void {
    if (this.heldCR) {
      this.heldCR = false
      this.buf += '\r'
    }
    if (this.buf.trim()) this.emit(this.buf)
    this.done = true
  }

  private emit(block: string): void {
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n')
    if (data === '[DONE]') {
      this.done = true
      return
    }
    if (data) this.onEvent(data)
  }
}

interface RawChunk {
  choices?: { delta?: { content?: string | null; reasoning_content?: string | null }; finish_reason?: string | null }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_cache_hit_tokens?: number
    prompt_cache_miss_tokens?: number
  } | null
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    const onAbort = (): void => {
      clearTimeout(t)
      reject(new DeepSeekError('abort', 'aborted'))
    }
    if (signal.aborted) return onAbort()
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function attemptOnce(args: StreamChatArgs, started: number, firstRef: { ttft: number }): Promise<StreamChatResult> {
  let res: Response
  try {
    res = await fetch(`${args.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        stream: true,
        stream_options: { include_usage: true },
        thinking: args.thinking,
        ...(args.responseFormat ? { response_format: args.responseFormat } : {})
      }),
      signal: args.signal
    })
  } catch (e) {
    if (args.signal.aborted) throw new DeepSeekError('abort', 'aborted')
    throw new DeepSeekError('network', String(e))
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 402) throw new DeepSeekError('key', text || 'key invalid', res.status)
    if (res.status === 429) throw new DeepSeekError('rate', text || 'rate limited', res.status)
    if (res.status >= 500) throw new DeepSeekError('server', text || 'server error', res.status)
    throw new DeepSeekError('bad_request', text || `status ${res.status}`, res.status)
  }

  const content: string[] = []
  const reasoning: string[] = []
  let usage: LlmUsage | null = null

  const parser = new SseParser((data) => {
    let chunk: RawChunk
    try {
      chunk = JSON.parse(data) as RawChunk
    } catch {
      return
    }
    const delta = chunk.choices?.[0]?.delta
    if (delta?.reasoning_content) {
      firstRef.ttft = performance.now() - started
      reasoning.push(delta.reasoning_content)
      args.onReasoning?.(delta.reasoning_content)
    }
    if (delta?.content) {
      firstRef.ttft = performance.now() - started
      content.push(delta.content)
      args.onDelta?.(delta.content)
    }
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens ?? 0,
        completionTokens: chunk.usage.completion_tokens ?? 0,
        cacheHit: chunk.usage.prompt_cache_hit_tokens ?? 0,
        cacheMiss: chunk.usage.prompt_cache_miss_tokens ?? 0
      }
    }
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      if (args.signal.aborted) throw new DeepSeekError('abort', 'aborted')
      const { done, value } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.finish()
  } catch (e) {
    if (args.signal.aborted) throw new DeepSeekError('abort', 'aborted')
    // P1-1:已吐出增量后流中断则 fail-fast,保留已生成部分;若重试会从头再吐拼出脏数据
    if (firstRef.ttft > 0) throw new DeepSeekError('network', String(e), undefined, true)
    throw new DeepSeekError('network', String(e))
  } finally {
    void reader.cancel().catch(() => {})
  }

  return {
    content: content.join(''),
    reasoning: reasoning.join(''),
    ttftMs: firstRef.ttft,
    totalMs: performance.now() - started,
    usage
  }
}

/** 带限流退避重试的流式对话;429/5xx/网络错误重试,401/402/4xx 不重试 */
export async function streamChat(args: StreamChatArgs): Promise<StreamChatResult> {
  const started = performance.now()
  const firstRef = { ttft: 0 }
  let attempt = 0
  for (;;) {
    try {
      return await attemptOnce(args, started, firstRef)
    } catch (e) {
      const retryable =
        e instanceof DeepSeekError && !e.noRetry && (e.kind === 'rate' || e.kind === 'server' || e.kind === 'network')
      if (!retryable) throw e
      attempt += 1
      if (attempt >= MAX_ATTEMPTS) throw e
      const waitMs = 1000 * 2 ** (attempt - 1)
      args.onRetry?.(attempt, MAX_ATTEMPTS, waitMs)
      await delay(waitMs, args.signal)
    }
  }
}
