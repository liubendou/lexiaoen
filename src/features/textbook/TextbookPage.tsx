// 教材页(M4):导入用户自有 PDF → 本地解析建索引 → 对话自动引用原文出处
// 内容只进本地 SQLite,不上传(《详细方案》5.2)
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { TextbookDocRow } from '../../../shared/ipc'
import EmptyState from '../../components/EmptyState'
import { BooksStackArt } from '../../components/illustrations'
import DotsLoader from '../../components/ui/dots'
import { CheckIcon } from '../../components/icons'
import { SPRING } from '../../styles/motion-tokens'
import { useUiStore } from '../../stores/ui'

function fmtDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TextbookPage() {
  const animate = useUiStore((s) => s.motionLevel !== 'minimal')
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')
  const [docs, setDocs] = useState<TextbookDocRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  // Notification Slide-in(kinetics):导入成功的顶部通知,3 秒自动退场
  const [toast, setToast] = useState<{ title: string; chunks: number } | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setDocs(await window.lexiaoen.textbook.list())
    } catch {
      setDocs([])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const doImport = (): void => {
    if (importing) return
    setImporting(true)
    setError('')
    void window.lexiaoen.textbook
      .import()
      .then((doc) => {
        if (doc) {
          void refresh()
          setToast({ title: doc.title, chunks: doc.chunks })
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setImporting(false))
  }

  const doRemove = (id: number): void => {
    void window.lexiaoen.textbook.remove(id).then(() => refresh())
  }

  if (docs && docs.length === 0 && !importing) {
    return (
      <EmptyState
        art={<BooksStackArt />}
        title="还没有教材"
        desc="导入你自己的 PDF,让回答能引用原文;内容只保存在本机,不会上传"
        action={
          <button
            onClick={doImport}
            className="h-[34px] cursor-pointer rounded-sm bg-indigo-500 px-4 text-[14px] text-ink-inverse transition-colors duration-[120ms] ease-out hover:bg-indigo-600 active:bg-indigo-700"
          >
            选择 PDF 文件
          </button>
        }
      />
    )
  }

  return (
    <div>
      {/* Notification Slide-in(kinetics):顶部滑入过冲后 settle,3 秒淡出 */}
      <AnimatePresence>
        {toast && (
          <div className="pointer-events-none fixed inset-x-0 top-10 z-50 flex justify-center">
            <motion.div
              key="tb-toast"
              initial={minimal ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.96 }}
              animate={minimal ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={minimal ? { duration: 0.15 } : SPRING.soft}
              className="flex items-center gap-2 rounded-sm border border-moss-500/60 bg-paper-raised px-3.5 py-2 text-[13px] text-ink-primary shadow-1"
            >
              <CheckIcon size={15} className="shrink-0 text-moss-500" />
              <span>
                《{toast.title}》已建立索引({toast.chunks} 块),对话时自动引用
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mb-4 flex items-center gap-3">
        <p className="font-serif text-[16px] font-semibold text-ink-primary">我的教材</p>
        <span className="text-[12.5px] text-ink-tertiary">对话提问时自动检索引用,标注页码</span>
        <motion.button
          onClick={doImport}
          disabled={importing}
          whileTap={importing ? undefined : { scale: 0.97 }}
          transition={SPRING.snappy}
          className="ml-auto inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-sm bg-indigo-500 px-4 text-[13.5px] text-ink-inverse transition-colors duration-[120ms] ease-out hover:bg-indigo-600 active:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-100 disabled:text-ink-disabled"
        >
          {importing ? (
            <>
              解析中<DotsLoader />
            </>
          ) : (
            '导入 PDF'
          )}
        </motion.button>
      </div>
      {error && <p className="mb-3 text-[12.5px] text-vermilion-600">{error}</p>}

      <div className="space-y-2">
        {(docs ?? []).map((d, i) => (
          <motion.div
            key={d.id}
            initial={animate ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.2, ease: 'easeOut' }}
            className="flex items-center gap-3 rounded-md border border-rule-hair bg-paper-raised px-4 py-3 shadow-1"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink-primary">{d.title}</p>
              <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-tertiary">
                {d.pages} 页 · {d.chunks} 个索引块 · {fmtDate(d.createdAt)}
              </p>
            </div>
            <button
              onClick={() => doRemove(d.id)}
              className="h-7 shrink-0 cursor-pointer rounded-sm border border-rule-strong px-2.5 text-[12.5px] text-ink-secondary transition-colors duration-[120ms] ease-out hover:border-vermilion-500 hover:text-vermilion-600"
            >
              删除
            </button>
          </motion.div>
        ))}
        {importing && (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-rule-strong px-4 py-3 text-[13.5px] text-ink-secondary">
            <span className="cursor-blink">▍</span> 正在提取文本并建立本地索引,大文件需要几秒…
          </div>
        )}
      </div>
    </div>
  )
}
