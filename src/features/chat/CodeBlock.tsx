import { useEffect, useState } from 'react'
import { highlight } from './highlight-client'

// 代码块:围栏闭合后才交给 Shiki;闭合前朴素 pre/code(《输出丝滑方案》2.6)
// 「颜色乱跳」的唯一解药就是绝不在中间态上色
export default function CodeBlock({ code, lang, complete }: { code: string; lang: string; complete: boolean }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!complete) return
    let alive = true
    void highlight(code, lang).then((h) => {
      if (alive) setHtml(h)
    })
    return () => {
      alive = false
    }
  }, [code, lang, complete])

  return (
    <div className="my-3 overflow-hidden rounded-md border border-rule-hair bg-paper-sunken">
      <div className="flex items-center justify-between px-3 pt-1.5">
        <span className="font-mono text-[11px] text-ink-tertiary">{lang || 'text'}</span>
        {!complete && <span className="text-[11px] text-ink-tertiary">接收中…</span>}
      </div>
      {html ? (
        <div className="shiki-host selectable overflow-x-auto px-3 pb-2 text-[13px] leading-[1.6]" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="selectable overflow-x-auto px-3 pb-2 pt-0.5 text-[13px] leading-[1.6] text-ink-primary">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
