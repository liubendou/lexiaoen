// 学习仪表盘(M4):streak/复习/答题统计 + 章掌握度热力图 + 7 天到期预测 + token/缓存
// 动效(《详细方案》7.2):数字滚动计数、掌握度环 SVG 描边、热力图逐格 stagger 20ms 波浪浮现
import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { ChapterMastery, DashboardStats } from '../../../shared/ipc'
import NumberRoll from '../../components/NumberRoll'
import EmptyState from '../../components/EmptyState'
import { ChartArt } from '../../components/illustrations'
import { DURATION } from '../../styles/motion-tokens'
import { useUiStore } from '../../stores/ui'

const DAY_LABELS = ['今', '明', '后', '+3', '+4', '+5', '+6']
const SUBJECT_TITLES = { anatomy: '人体解剖学', physiology: '生理学' } as const

/** 苔绿四阶(单一色相,《详细方案》7.1):无数据=灰,<50/50-79/80+ */
function heatCls(pct: number | null): { box: string; text: string } {
  if (pct == null) return { box: 'border-rule-hair bg-paper-sunken', text: 'text-ink-disabled' }
  if (pct < 50) return { box: 'border-moss-200 bg-moss-100', text: 'text-moss-600' }
  if (pct < 80) return { box: 'border-moss-300 bg-moss-200', text: 'text-moss-700' }
  return { box: 'border-moss-400 bg-moss-300', text: 'text-moss-800' }
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    // Hover Lift(kinetics):悬停浮起 + 阴影加深(minimal 档静止)
    <div className="flex-1 rounded-md border border-rule-hair bg-paper-raised px-4 py-3 shadow-1 transition-[transform,box-shadow] duration-[160ms] ease-out hover:-translate-y-0.5 hover:shadow-menu motion-reduce:hover:translate-y-0">
      <div className="font-serif text-[26px] font-semibold leading-none text-ink-primary">{children}</div>
      <div className="mt-1.5 text-[12px] text-ink-tertiary">{label}</div>
    </div>
  )
}

function HeatCell({ ch, i, minimal }: { ch: ChapterMastery; i: number; minimal: boolean }) {
  const { box, text } = heatCls(ch.pct)
  return (
    <motion.div
      initial={minimal ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.02, duration: 0.25, ease: 'easeOut' }}
      title={`${ch.title}:${ch.pct == null ? '暂无数据' : `正确率 ${ch.pct}%(${ch.correct}/${ch.total})`}`}
      className={`flex aspect-square cursor-default flex-col justify-between rounded-xs border p-1.5 ${box}`}
    >
      <span className={`line-clamp-2 text-[11.5px] leading-[1.3] ${ch.pct == null ? 'text-ink-disabled' : 'text-ink-primary'}`}>
        {ch.title.slice(0, 4)}
      </span>
      <span className={`text-right font-mono text-[11px] tabular-nums ${text}`}>{ch.pct == null ? '—' : `${ch.pct}%`}</span>
    </motion.div>
  )
}

/** 掌握度环:SVG 描边动画(DURATION.slow) */
function MasteryRing({ pct, level }: { pct: number; level: ReturnType<typeof useUiStore.getState>['motionLevel'] }) {
  const r = 30
  const circ = 2 * Math.PI * r
  return (
    <div className="relative h-[88px] w-[88px]">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-rule-hair" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          className="stroke-moss-500"
          initial={level === 'minimal' ? false : { strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct / 100) }}
          transition={{ duration: DURATION.slow / 1000, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <NumberRoll value={pct} playKey={pct} level={level} />
        <span className="ml-0.5 mt-2 text-[12px] text-ink-tertiary">%</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const setPage = useUiStore((s) => s.setPage)
  const motionLevel = useUiStore((s) => s.motionLevel)
  const minimal = motionLevel === 'minimal'
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    void window.lexiaoen.dashboard.stats().then(setStats).catch(() => setStats(null))
  }, [])

  if (!stats) return null

  const totalAttempts = stats.attempts
  const accPct = totalAttempts > 0 ? Math.round((stats.correct / totalAttempts) * 100) : 0
  const empty = totalAttempts === 0 && stats.review.total === 0 && stats.usage.sessions === 0
  if (empty) {
    return (
      <EmptyState
        art={<ChartArt />}
        title="还没有学习数据"
        desc="完成一次测验后,这里会显示你的掌握度与复习预测"
        action={
          <button
            onClick={() => setPage('quiz')}
            className="h-[34px] cursor-pointer rounded-sm bg-indigo-500 px-4 text-[14px] text-ink-inverse transition-colors duration-[120ms] ease-out hover:bg-indigo-600 active:bg-indigo-700"
          >
            去做一组题
          </button>
        }
      />
    )
  }

  const maxForecast = Math.max(...stats.forecast.map((f) => f.count), 1)
  const hitPct =
    stats.usage.cacheHit + stats.usage.cacheMiss > 0
      ? Math.round((stats.usage.cacheHit / (stats.usage.cacheHit + stats.usage.cacheMiss)) * 100)
      : null

  return (
    <div className="space-y-4">
      {/* 顶部统计:数字滚动计数 */}
      <div className="flex gap-3">
        <StatCard label="连续打卡(天)">
          <NumberRoll value={stats.streak} playKey={stats.streak} level={motionLevel} />
        </StatCard>
        <StatCard label="今日已复习(张)">
          <NumberRoll value={stats.review.todayReviewed} playKey={stats.review.todayReviewed} level={motionLevel} />
        </StatCard>
        <StatCard label="到期待复习(张)">
          <NumberRoll value={stats.review.due} playKey={stats.review.due} level={motionLevel} />
        </StatCard>
        <StatCard label={`累计答题 ${totalAttempts} 道 · 正确率`}>
          <NumberRoll value={accPct} playKey={accPct} level={motionLevel} />
          <span className="ml-0.5 text-[14px] text-ink-secondary">%</span>
        </StatCard>
      </div>

      <div className="flex gap-4">
        {/* 掌握度热力图(苔绿四阶,stagger 20ms) */}
        <div className="min-w-0 flex-1 rounded-md border border-rule-hair bg-paper-raised p-4 shadow-1">
          <p className="mb-3 font-serif text-[14.5px] font-semibold text-ink-primary">章掌握度热力图</p>
          {(['anatomy', 'physiology'] as const).map((subj) => (
            <div key={subj} className="mb-3 last:mb-0">
              <p className="mb-1.5 text-[12px] text-ink-tertiary">{SUBJECT_TITLES[subj]}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {stats.mastery
                  .filter((m) => m.subject === subj)
                  .map((ch, i) => (
                    <HeatCell key={ch.chapterId} ch={ch} i={i} minimal={minimal} />
                  ))}
              </div>
            </div>
          ))}
          {totalAttempts === 0 && (
            <p className="text-[12.5px] text-ink-tertiary">答题后按章聚合正确率(苔绿越深掌握越牢)</p>
          )}
        </div>

        {/* 总体掌握度环 + 7 天到期预测 */}
        <div className="flex w-[260px] shrink-0 flex-col gap-4">
          <div className="flex items-center gap-4 rounded-md border border-rule-hair bg-paper-raised p-4 shadow-1">
            <MasteryRing pct={accPct} level={motionLevel} />
            <div className="min-w-0">
              <p className="font-serif text-[14.5px] font-semibold text-ink-primary">总体掌握度</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-tertiary">
                按答题正确率聚合
                <br />
                {stats.correct} / {totalAttempts} 道
              </p>
            </div>
          </div>
          <div className="flex-1 rounded-md border border-rule-hair bg-paper-raised p-4 shadow-1">
            <p className="mb-3 font-serif text-[14.5px] font-semibold text-ink-primary">未来 7 天到期(FSRS)</p>
            <div className="flex h-[72px] items-end gap-2">
              {stats.forecast.map((f, i) => (
                <div key={f.dayOffset} className="flex flex-1 flex-col items-center gap-1">
                  <motion.div
                    initial={minimal ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: i * 0.04, duration: DURATION.base / 1000, ease: 'easeOut' }}
                    style={{ height: `${Math.max((f.count / maxForecast) * 56, 2)}px`, transformOrigin: 'bottom' }}
                    className={`w-full rounded-xs ${f.count > 0 ? (i === 0 ? 'bg-indigo-500' : 'bg-moss-300') : 'bg-rule-hair'}`}
                    title={`${f.count} 张`}
                  />
                  <span className="text-[11px] text-ink-tertiary">{DAY_LABELS[i]}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-tertiary">今天到期 {stats.forecast[0].count} 张,卡池共 {stats.review.total} 张</p>
          </div>
        </div>
      </div>

      {/* token 成本与缓存命中率(《详细方案》4.4) */}
      <div
        className="flex items-center gap-6 rounded-md border border-rule-hair bg-paper-raised px-4 py-3 shadow-1"
        title="prompt_tokens 走上下文硬盘缓存,命中部分按 1/10 计价"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[20px] font-medium tabular-nums text-ink-primary">{hitPct == null ? '—' : `${hitPct}%`}</span>
          <span className="text-[12px] text-ink-tertiary">缓存命中率(累计)</span>
        </div>
        <div className="h-6 w-px bg-rule-hair" />
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[20px] font-medium tabular-nums text-ink-primary">{stats.usage.promptTokens.toLocaleString()}</span>
          <span className="text-[12px] text-ink-tertiary">prompt tokens</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[20px] font-medium tabular-nums text-ink-primary">{stats.usage.completionTokens.toLocaleString()}</span>
          <span className="text-[12px] text-ink-tertiary">completion tokens</span>
        </div>
        <div className="ml-auto text-[12px] text-ink-tertiary">{stats.usage.sessions} 个会话</div>
      </div>
    </div>
  )
}
