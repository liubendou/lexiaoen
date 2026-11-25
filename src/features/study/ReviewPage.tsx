// 复习页(M3):FSRS 到期队列,四档评分(重来/困难/良好/容易),跨科目交错混排
// 动效(《详细方案》7.2):卡片 3D rotateY 弹簧翻面(perspective + preserve-3d),两面 grid 叠放保高度自适应
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { ReviewItem, ReviewStats } from '../../../shared/ipc'
import { QTYPE_LABELS } from './labels'
import { SPRING } from '../../styles/motion-tokens'
import { useUiStore } from '../../stores/ui'

const GRADE_STYLE: Record<1 | 2 | 3 | 4, string> = {
  1: 'border-vermilion-500 text-vermilion-600 hover:bg-vermilion-50',
  2: 'border-ochre-500 text-ochre-500 hover:bg-ochre-50',
  3: 'border-indigo-500 bg-indigo-500 text-ink-inverse hover:bg-indigo-600',
  4: 'border-moss-500 text-moss-600 hover:bg-moss-50'
}

export default function ReviewPage() {
  const animate = useUiStore((s) => s.motionLevel !== 'minimal')
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastInterval, setLastInterval] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  /** P1-4:评分在途锁——IPC 期间禁用四档按钮,防双击对同一张卡重复 FSRS 排期 */
  const [grading, setGrading] = useState(false)

  const refresh = (): void => {
    void window.lexiaoen.study.reviewStats().then(setStats)
    void window.lexiaoen.study
      .reviewQueue(40)
      .then((rows) => {
        setQueue(rows)
        setIdx(0)
        setRevealed(false)
      })
      .finally(() => setLoaded(true))
  }

  useEffect(refresh, [])

  const cur = queue[idx]

  const grade = (g: 1 | 2 | 3 | 4): void => {
    if (!cur || grading) return
    setGrading(true)
    void window.lexiaoen.study
      .gradeCard(cur.rowId, g)
      .then((r) => setLastInterval(r.scheduledDays))
      .finally(() => {
        setGrading(false)
        setQueue((q) => q.filter((x) => x.rowId !== cur.rowId))
        setRevealed(false)
        void window.lexiaoen.study.reviewStats().then(setStats)
      })
  }

  if (!loaded) return <div className="py-14 text-center text-[13.5px] text-ink-tertiary">载入中…</div>

  if (!cur) {
    return (
      <div className="py-14 text-center">
        <p className="font-serif text-[17px] font-semibold text-ink-primary">今日复习已清空</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
          {stats && stats.total > 0
            ? `卡池 ${stats.total} 张,今日已复习 ${stats.todayReviewed} 张;下一张到期时这里会提醒你`
            : '做完测验答错的题会自动变成复习卡,由 FSRS 排期,该复习哪张应用替你算好'}
        </p>
        {lastInterval !== null && (
          <p className="mt-3 text-[12.5px] text-moss-600">刚复习的那张:{lastInterval} 天后再见</p>
        )}
      </div>
    )
  }

  const q = cur.question
  const k = cur.knowledge

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-[12.5px] text-ink-tertiary">
        <span className="font-mono tabular-nums">剩余 {queue.length} 张</span>
        <span className="rounded-xs border border-rule-hair px-1.5 py-px">{cur.kind === 'wrong' ? '错题卡' : '知识卡'}</span>
        {q && <span className="rounded-xs border border-rule-hair px-1.5 py-px">{QTYPE_LABELS[q.qtype] ?? q.qtype}</span>}
        {stats && (
          <span className="ml-auto">
            今日已复习 <span className="font-mono tabular-nums">{stats.todayReviewed}</span> · 卡池{' '}
            <span className="font-mono tabular-nums">{stats.total}</span>
          </span>
        )}
      </div>

      {/* 3D 翻面容器:perspective 在外,旋转面 preserve-3d,正/背面 grid 叠放(高度自适应) */}
      <motion.div
        key={cur.rowId}
        initial={animate ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={minimal ? { duration: 0.15 } : SPRING.default}
        className="rounded-md border border-rule-hair bg-paper-raised shadow-1 [perspective:1200px]"
      >
        <motion.div
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={minimal ? { duration: 0 } : SPRING.default}
          className="grid [transform-style:preserve-3d]"
        >
          {/* 正面:题面 */}
          <div className="p-5 [backface-visibility:hidden] [grid-area:1/1]">
            {q ? (
              <>
                <p className="text-[14.5px] font-medium leading-relaxed text-ink-primary">{q.stem}</p>
                {q.options.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {q.options.map((o) => (
                      <p key={o.key} className="text-[13.5px] leading-relaxed text-ink-secondary">
                        <span className="font-mono font-semibold text-ink-primary">{o.key}.</span> {o.text}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : k ? (
              <>
                <p className="font-serif text-[16px] font-semibold text-ink-primary">{k.title}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">{k.definition}</p>
              </>
            ) : (
              <p className="text-[13.5px] text-ink-secondary">卡片内容已不存在</p>
            )}
            <div className="mt-5 flex items-center justify-end">
              <button
                onClick={() => setRevealed(true)}
                className="h-8 cursor-pointer rounded-sm bg-indigo-500 px-4 text-[13.5px] text-ink-inverse transition-colors duration-[120ms] ease-out hover:bg-indigo-600 active:bg-indigo-700"
              >
                显示答案
              </button>
            </div>
          </div>

          {/* 背面:答案 + 解析 + 四档评分(rotateY 180 抵消外层翻面;未翻面时阻断交互) */}
          <div
            className={`p-5 [backface-visibility:hidden] [grid-area:1/1] [transform:rotateY(180deg)] ${revealed ? '' : 'pointer-events-none'}`}
            aria-hidden={!revealed}
          >
            {q && (
              <p className="text-[13.5px] leading-relaxed text-ink-primary">
                <span className="font-semibold">答案:{q.answer}</span>
              </p>
            )}
            {q?.explanation && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">解析:{q.explanation}</p>}
            {k && (
              <div className="space-y-1.5">
                <p className="font-serif text-[16px] font-semibold text-ink-primary">{k.title}</p>
                {k.points.map((p, i) => (
                  <p key={i} className="text-[13px] leading-relaxed text-ink-secondary">
                    · {p}
                  </p>
                ))}
                {k.confusion && <p className="text-[13px] leading-relaxed text-ochre-500">易混:{k.confusion}</p>}
                {k.mnemonic && <p className="text-[13px] leading-relaxed text-indigo-500">口诀:{k.mnemonic}</p>}
              </div>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <span className="mr-auto text-[12px] text-ink-tertiary">这次想起来有多费劲?</span>
              {([1, 2, 3, 4] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => grade(g)}
                  disabled={grading}
                  className={`h-8 cursor-pointer rounded-sm border px-3.5 text-[13px] transition-colors duration-[120ms] ease-out disabled:cursor-default disabled:opacity-50 ${GRADE_STYLE[g]}`}
                >
                  {g === 1 ? '重来' : g === 2 ? '困难' : g === 3 ? '良好' : '容易'}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
