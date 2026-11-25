import { memo, useDeferredValue, useRef } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import { IncrementalMarkdown } from './incremental-markdown'

// 讲义级 Markdown 渲染(UI方案 2.2 排版纪律):宋体标题、三线表、朱砂引用、· 列表符
// 列表标记等由 global.css 的 .md-body 规则承担

function makeComponents(textLen: number, unbalanced: boolean): Components {
  return {
    h1: ({ children }) => <h1 className="mb-2 mt-6 font-serif text-[20px] font-semibold text-ink-primary">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 mt-6 font-serif text-[17px] font-semibold text-ink-primary">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1.5 mt-5 font-serif text-[15px] font-semibold text-ink-primary">{children}</h3>,
    p: ({ children }) => <p className="mb-4 text-[16px] leading-[1.75] text-ink-primary">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-ink-primary">{children}</strong>,
    em: ({ children }) => <em className="font-semibold not-italic">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-2 border-vermilion-500 bg-paper-quote py-2 pl-3 pr-2 [&>p]:mb-2 [&>p:last-child]:mb-0">{children}</blockquote>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer" className="text-indigo-500 underline underline-offset-2 hover:text-indigo-600">
        {children}
      </a>
    ),
    hr: () => <hr className="my-6 border-0 border-t border-rule-hair" />,
    ul: ({ children }) => <ul>{children}</ul>,
    ol: ({ children }) => <ol>{children}</ol>,
    li: ({ children }) => <li className="text-[15px] leading-[1.7] text-ink-primary">{children}</li>,
    table: ({ children }) => (
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse border-y border-rule-strong">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    th: ({ children }) => <th className="px-3 py-2 text-left text-[13px] font-semibold text-ink-primary">{children}</th>,
    td: ({ children }) => <td className="px-3 py-2 align-top text-[13px] leading-[1.6] text-ink-secondary">{children}</td>,
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children, node }) => {
      // 空内容的未闭合围栏(流式中刚开出 fence 的瞬态)children 为 undefined,不能 String() 成 "undefined"
      const text = children == null ? '' : String(children)
      const isBlock = /language-/.test(className ?? '') || text.includes('\n')
      if (!isBlock) {
        return <code className="rounded-xs border border-rule-hair bg-paper-sunken px-1 py-px font-mono text-[13px] text-ink-primary">{text}</code>
      }
      const lang = /language-(\S+)/.exec(className ?? '')?.[1] ?? ''
      const code = text.replace(/\n$/, '')
      // 未配平围栏时,只有位于文本末尾的代码块处于中间态
      const end = node?.position?.end?.offset ?? 0
      const complete = !unbalanced || end < textLen - 4
      return <CodeBlock code={code} lang={lang} complete={complete} />
    }
  }
}

function Rich({ text, unbalanced = false }: { text: string; unbalanced?: boolean }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={makeComponents(text.length, unbalanced)}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

/** 已冻结块:文本不变即永不重渲染 */
const FrozenChunk = memo(function FrozenChunk({ text }: { text: string }) {
  return <Rich text={text} />
})

/** 历史消息:整条一次性解析并缓存 */
export const StaticMarkdown = memo(function StaticMarkdown({ text }: { text: string }) {
  return <Rich text={text} />
})

/** 流式消息:冻结块 + 尾部活动块;useDeferredValue 让解析让路给动效(《输出丝滑方案》3.2) */
export function StreamedMarkdown({ text }: { text: string }) {
  const deferred = useDeferredValue(text)
  const ref = useRef<IncrementalMarkdown | null>(null)
  if (!ref.current) ref.current = new IncrementalMarkdown()
  const { blocks, tail, unbalanced } = ref.current.update(deferred)
  return (
    <>
      {blocks.map((b, i) => (
        <FrozenChunk key={i} text={b} />
      ))}
      {tail && <Rich text={tail} unbalanced={unbalanced} />}
    </>
  )
}
