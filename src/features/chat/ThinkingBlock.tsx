import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRightIcon } from '../../components/icons'
import { useUiStore } from '../../stores/ui'
import { createStreamedTextStore, useStreamedText, type StreamedTextStore } from './streamed-text'

const EMPTY_STORE = createStreamedTextStore()

interface Props {
  /** waiting=占位条;thinking=思考流入;done=思考结束(折叠项) */
  phase: 'waiting' | 'thinking' | 'done'
  /** 占位文案;null 表示该模式不显示占位(快速模式) */
  modeText: string | null
  /** 流式思考文本 store(实时) */
  reasonStore?: StreamedTextStore | null
  /** 静态思考文本(历史消息) */
  reasoningText?: string
  /** 429 自动重试提示 */
  retryNote?: string | null
  /** 流式思考进行中禁止展开(UI方案 0.1 冲突二) */
  canExpand: boolean
}

// 思考块三态(UI方案 6.5):占位 → 思考流(折叠计时) → 折叠项
export default function ThinkingBlock({ phase, modeText, reasonStore, reasoningText, retryNote, canExpand }: Props) {
  const [open, setOpen] = useState(false)
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')
  const liveText = useStreamedText(reasonStore ?? EMPTY_STORE)
  const text = reasoningText ?? liveText

  // 等待超时提示:thinking 模式首字可能要 30-60 秒,超过 8 秒明示「没卡住」
  const [slowWait, setSlowWait] = useState(false)
  useEffect(() => {
    if (phase !== 'waiting') return
    const t = window.setTimeout(() => setSlowWait(true), 8000)
    return () => {
      window.clearTimeout(t)
      setSlowWait(false)
    }
  }, [phase])

  // 思考计时:rAF 直改 textContent,不走 setState(UI方案 6.5 纪律)
  const timerRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (phase !== 'thinking') return
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number): void => {
      if (timerRef.current) timerRef.current.textContent = `· ${((t - t0) / 1000).toFixed(1)}s`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (timerRef.current) timerRef.current.textContent = ''
    }
  }, [phase])

  // 占位条:请求已发出、首字未到(快速模式无占位)
  if (phase === 'waiting') {
    if (!modeText) return null
    return (
      <div className="mb-3 flex items-center gap-2 border-l-2 border-ochre-500 bg-paper-quote px-3 py-2">
        <span className="text-[13px] text-ink-secondary">{modeText}</span>
        {slowWait && <span className="text-[12px] text-ink-tertiary">模型思考中,首次回答可能需要 30–60 秒</span>}
        {retryNote && <span className="text-[12px] text-ochre-500">{retryNote}</span>}
        <span className="cursor-blink ml-auto" style={{ height: 12 }} />
      </div>
    )
  }

  if (phase === 'thinking') {
    return (
      <div className="mb-3 flex h-8 items-center gap-2 border-l-2 border-ochre-500 bg-paper-quote px-3" title="思考内容不会回传给模型">
        <span className="cursor-blink" style={{ height: 12 }} />
        <span className="text-[12px] text-ink-tertiary">
          思考过程 <span ref={timerRef} className="font-mono tabular-nums" />
        </span>
        {retryNote && <span className="text-[12px] text-ochre-500">{retryNote}</span>}
      </div>
    )
  }

  // done:有思考内容才渲染折叠项
  if (!text) return null
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => canExpand && setOpen(!open)}
          aria-expanded={open}
          className={`flex items-center gap-1 text-[12px] text-ink-tertiary ${canExpand ? 'hover:text-ink-secondary' : 'cursor-default'}`}
        >
          <ChevronRightIcon size={12} className={open ? 'rotate-90 transition-transform duration-[120ms]' : 'transition-transform duration-[120ms]'} />
          思考过程
        </button>
        <span className="text-[11px] text-ink-tertiary">不会回传给模型</span>
      </div>
      {open && (
        <motion.div
          initial={minimal ? false : { clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
          animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-1.5 selectable whitespace-pre-wrap border-l-2 border-rule-strong bg-paper-quote px-3 py-2 text-[13px] leading-[1.7] text-ink-secondary"
        >
          {text}
        </motion.div>
      )}
    </div>
  )
}
