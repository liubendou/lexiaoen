import { useState } from 'react'
import type { MessageRow, SourceRef } from '../../../shared/ipc'
import { useChatStore } from './chat-store'
import { StaticMarkdown } from './MarkdownView'
import ThinkingBlock from './ThinkingBlock'
import { useUiStore } from '../../stores/ui'

/** L4 引用来源行:小胶囊标注知识卡/教材出处(流式气泡与历史回答气泡共用) */
export function SourcesRow({ sources }: { sources: SourceRef[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" title="本轮回答参考的本地知识来源">
      <span className="text-[11.5px] text-ink-tertiary">参考</span>
      {sources.map((s, i) => (
        <span
          key={`${s.kind}-${s.title}-${i}`}
          className="rounded-xs border border-rule-hair bg-paper-sunken px-1.5 py-px text-[11.5px] text-ink-secondary"
        >
          {s.kind === 'card' ? '卡' : '材'} · {s.title}
          {s.kind === 'textbook' ? ` ${s.locator}` : ''}
        </span>
      ))}
    </div>
  )
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="mb-5 flex justify-end">
      <div className="max-w-[75%] whitespace-pre-wrap rounded-md bg-indigo-50 px-4 py-2.5 text-[15px] leading-[1.7] text-ink-primary selectable">
        {text}
      </div>
    </div>
  )
}

const fmtTime = (ts: number): string => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

export function AiMessage({ row, isLast, streaming, showTime }: { row: MessageRow; isLast: boolean; streaming: boolean; showTime: boolean }) {
  const uiMode = useUiStore((s) => s.mode)
  const retry = useChatStore((s) => s.retry)
  const [copied, setCopied] = useState(false)

  const prevUserId = (): number | null => {
    const msgs = useChatStore.getState().messages
    const found = [...msgs].reverse().find((m) => m.role === 'user' && m.id < row.id)
    return found?.id ?? null
  }

  return (
    <div className="group mb-6">
      {showTime && <div className="mb-1 pl-4 text-[12px] tabular-nums text-ink-tertiary">{fmtTime(row.createdAt)}</div>}
      <div className="border-l-[3px] border-indigo-500 pl-4">
        {row.reasoning && <ThinkingBlock phase="done" modeText={null} reasoningText={row.reasoning} canExpand />}
        <StaticMarkdown text={row.content} />
        {row.sources && row.sources.length > 0 && <SourcesRow sources={row.sources} />}

        {row.status === 1 && (
          <div className="mb-2 flex items-center gap-3 border-l-2 border-vermilion-500 bg-vermilion-100 px-3 py-2 text-[13px] text-ink-primary">
            <span>回答中断,已保留前 {row.content.length} 字</span>
            {prevUserId() != null && (
              <button className="text-indigo-600 hover:underline" onClick={() => void retry(prevUserId()!, uiMode)}>
                重试
              </button>
            )}
          </div>
        )}
        {row.status === 2 && <div className="mb-2 text-[12px] text-ink-tertiary">已停止生成</div>}

        {!streaming && (
          <div className="mt-1 flex gap-4 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
            <button
              className="text-[12px] text-ink-tertiary hover:text-ink-primary"
              onClick={() => {
                void navigator.clipboard.writeText(row.content)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? '已复制' : '复制'}
            </button>
            {isLast && row.status === 0 && prevUserId() != null && (
              <button className="text-[12px] text-ink-tertiary hover:text-ink-primary" onClick={() => void retry(prevUserId()!, uiMode)}>
                重新生成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
