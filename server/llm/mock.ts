// Mock 流:无 key 时的端到端测试通道(LEXIAOEN_MOCK_LLM=1 激活,或 --self-check-llm)
// 模拟思考流 + 正文流的真实节奏(随机抖动、可中止、返回 usage),用于验证双层平滑与 UI 三段替换

import { DeepSeekError, type StreamChatResult } from './deepseek'

const REASONING = '学生在问膝关节的构成。按标准模式:先抛检索性问题让学生回忆股骨下端的结构,再讲三块构成骨与腓骨的辨析,最后收在自测问题。注意控制篇幅,先问后讲。'
const CONTENT = (q: string) => `好的,关于「${q}」——先不急着看答案。

## 先自测

股骨下端的两个骨性膨大,分别叫什么?

## 膝关节的构成

膝关节由 **股骨下端**、**胫骨上端** 和 **髌骨** 构成。腓骨不参与构成关节面,只在外侧构成胫腓关节,这是高频考点。

| 结构 | 参与构成关节面 | 说明 |
| --- | --- | --- |
| 股骨内、外侧髁 | 是 | 与胫骨上端相关节 |
| 髌骨 | 是 | 人体最大的籽骨 |
| 腓骨头 | 否 | 仅构成胫腓关节 |

▸ 自测:为什么腓骨不在膝关节里?提示:从关节面的对应关系想。

## 代码示例(打包态高亮自检)

\`\`\`typescript
// 股骨远端两侧髁示意(验证 shiki 高亮在 file:// 打包态可用)
const condyles: string[] = ['内侧髁', '外侧髁']
const label = '股骨下端: ' + condyles.join('、')
console.log(label)
\`\`\``

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DeepSeekError('abort', 'aborted'))
      },
      { once: true }
    )
  })
}

export interface MockArgs {
  question: string
  signal: AbortSignal
  onReasoning: (d: string) => void
  onDelta: (d: string) => void
}

export async function mockStream(args: MockArgs): Promise<StreamChatResult> {
  const started = performance.now()
  // 模拟网络首字延迟:首块前先等一段,否则 ttft 取整后为 0(自检断言 ttftMs>0 会失败),
  // 且 Mock GUI 也能真实演示「等待占位」阶段
  await wait(120 + Math.random() * 140, args.signal)
  const ttft = performance.now() - started

  // 思考流:随机 3-6 字一组,6-14ms 抖动
  for (let i = 0; i < REASONING.length; ) {
    const n = 3 + Math.floor(Math.random() * 4)
    const d = REASONING.slice(i, i + n)
    i += n
    args.onReasoning(d)
    await wait(6 + Math.random() * 8, args.signal)
  }

  const full = CONTENT(args.question.slice(0, 30))
  // 正文流:2-5 字一组,4-16ms 抖动
  for (let i = 0; i < full.length; ) {
    const n = 2 + Math.floor(Math.random() * 4)
    const d = full.slice(i, i + n)
    i += n
    args.onDelta(d)
    await wait(4 + Math.random() * 12, args.signal)
  }

  const promptTokens = 1024 + args.question.length
  return {
    content: full,
    reasoning: REASONING,
    ttftMs: ttft,
    totalMs: performance.now() - started,
    usage: {
      promptTokens,
      completionTokens: 520,
      cacheHit: Math.round(promptTokens * 0.94),
      cacheMiss: promptTokens - Math.round(promptTokens * 0.94)
    }
  }
}
