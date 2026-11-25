import { useEffect, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useUiStore, type PageId } from '../stores/ui'
import { useSyllabusStore } from '../features/study/syllabus-store'
import ModeSwitcher from './ModeSwitcher'
import { selectHitPct, useChatStore } from '../features/chat/chat-store'
import { LexTooltip } from './ui/tooltip'
import { SPRING } from '../styles/motion-tokens'
import {
  ChatIcon,
  ChevronDownIcon,
  DashboardIcon,
  QuizIcon,
  ReviewIcon,
  SettingsIcon,
  TextbookIcon
} from './icons'

interface NavItem {
  id: PageId
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
}

const NAV: NavItem[] = [
  { id: 'chat', label: '对话教学', icon: ChatIcon },
  { id: 'quiz', label: '测验', icon: QuizIcon },
  { id: 'review', label: '复习', icon: ReviewIcon },
  { id: 'dashboard', label: '仪表盘', icon: DashboardIcon },
  { id: 'textbook', label: '教材', icon: TextbookIcon },
  { id: 'settings', label: '设置', icon: SettingsIcon }
]

const SUBJECTS: { subject: 'anatomy' | 'physiology'; title: string }[] = [
  { subject: 'anatomy', title: '人体解剖学' },
  { subject: 'physiology', title: '生理学' }
]

export default function LeftRail() {
  const collapsed = useUiStore((s) => s.leftCollapsed)
  const page = useUiStore((s) => s.page)
  const setPage = useUiStore((s) => s.setPage)
  const setQuizPreset = useUiStore((s) => s.setQuizPreset)
  const hitPct = useChatStore(selectHitPct)
  const syllabusRows = useSyllabusStore((s) => s.rows)
  const loadSyllabus = useSyllabusStore((s) => s.load)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [todayReviewed, setTodayReviewed] = useState<number | null>(null)
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    void loadSyllabus()
  }, [loadSyllabus])

  // 底部状态条:进入复习页/测验页后刷新(评分与答题会改变计数)
  useEffect(() => {
    if (collapsed) return
    void window.lexiaoen.study
      .reviewStats()
      .then((s) => {
        setTodayReviewed(s.todayReviewed)
        setDueCount(s.due)
      })
      .catch(() => {})
  }, [collapsed, page])

  const toggleChapter = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** 点击考纲节 → 测验页预选该节下的知识点 */
  const openInQuiz = (sectionId: string): void => {
    setQuizPreset(sectionId)
    setPage('quiz')
  }

  const minimal = useUiStore((s) => s.motionLevel === 'minimal')

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-rule-hair bg-paper-sunken"
      style={{ width: collapsed ? 'var(--rail-w-collapsed)' : 'var(--rail-w)' }}
    >
      {/* 模式标识区 64px */}
      <div className="h-16 border-b border-rule-hair px-2 py-2">
        <ModeSwitcher compact={collapsed} />
      </div>

      {/* 科目树(M4:真实考纲,章可折叠/节点击跳测验) */}
      {!collapsed && (
        <nav className="flex-1 overflow-y-auto py-2" aria-label="科目树">
          {syllabusRows.length > 0 ? (
            SUBJECTS.map((subj) => {
              const chapters = syllabusRows.filter((n) => n.subject === subj.subject && n.level === 1)
              if (chapters.length === 0) return null
              return (
                <div key={subj.subject} className="mb-1">
                  <div className="flex h-7 items-center px-2 text-[12px] font-medium text-ink-tertiary">{subj.title}</div>
                  {chapters.map((ch) => {
                    const open = expanded.has(ch.id)
                    const sections = syllabusRows.filter((n) => n.parentId === ch.id && n.level === 2)
                    return (
                      <div key={ch.id}>
                        <button
                          type="button"
                          onClick={() => toggleChapter(ch.id)}
                          className="flex h-8 w-full items-center gap-1 rounded-sm px-2 text-[13px] text-ink-primary transition-colors duration-[120ms] ease-out hover:bg-paper-raised"
                        >
                          <motion.span
                            animate={{ rotate: open ? 90 : 0 }}
                            transition={minimal ? { duration: 0 } : SPRING.snappy}
                            className="flex shrink-0"
                          >
                            <ChevronDownIcon size={14} className="text-ink-tertiary" />
                          </motion.span>
                          <span className="flex-1 truncate text-left">{ch.title}</span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-tertiary">{sections.length}</span>
                        </button>
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              key="sec"
                              initial={minimal ? false : { height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={minimal ? undefined : { height: 0, opacity: 0 }}
                              transition={minimal ? { duration: 0 } : SPRING.soft}
                              className="overflow-hidden"
                            >
                              {sections.map((sec) => (
                                <button
                                  key={sec.id}
                                  type="button"
                                  onClick={() => openInQuiz(sec.id)}
                                  title={`${subj.title} · ${ch.title} · ${sec.title}`}
                                  className="ml-7 flex h-8 w-[calc(100%-1.75rem)] items-center gap-1.5 rounded-sm px-2 text-[13px] text-ink-secondary transition-colors duration-[120ms] ease-out hover:bg-paper-raised hover:text-ink-primary"
                                >
                                  <span className="flex-1 truncate text-left">{sec.title}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              )
            })
          ) : (
            <div className="px-2 py-3 text-[12.5px] leading-relaxed text-ink-tertiary">考纲树加载中…</div>
          )}
          {['病理学', '药理学', '诊断学'].map((name) => (
            <div
              key={name}
              title="扩展包,设置页可开启"
              className="flex h-8 items-center gap-1 rounded-sm px-2 pl-6 text-[13px] text-ink-disabled"
            >
              <span className="flex-1">{name}</span>
            </div>
          ))}
        </nav>
      )}

      {/* 主导航 */}
      <nav className="flex flex-col gap-px px-2 py-2" aria-label="主导航">
        {NAV.map((item) => {
          const active = page === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              title={item.label}
              className={`relative flex h-9 w-full items-center rounded-sm text-[13px] transition-colors duration-[120ms] ease-out ${
                collapsed ? 'justify-center' : 'gap-2.5 px-3'
              } ${
                active
                  ? 'bg-indigo-50 font-medium text-ink-primary'
                  : 'text-ink-secondary hover:bg-paper-raised hover:text-ink-primary'
              }`}
            >
              {active && <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-indigo-500" />}
              <Icon size={16} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* 底部状态条 40px */}
      <div
        className={`flex h-10 items-center justify-between border-t border-rule-hair px-3 text-[12px] text-ink-tertiary ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        {collapsed ? (
          <LexTooltip content={`到期 ${dueCount} 张`} side="top">
            <span className="relative flex cursor-default">
              {/* Pulse Badge(kinetics):有到期卡时呼吸扩散圈提醒(minimal 档静止) */}
              {dueCount > 0 && !minimal && (
                <span className="absolute inset-0 animate-ping rounded-full bg-vermilion-400/60" aria-hidden="true" />
              )}
              <span className={`relative ${dueCount > 0 ? 'text-vermilion-500' : ''}`}>{dueCount > 0 ? '●' : '○'}</span>
            </span>
          </LexTooltip>
        ) : (
          <>
            <LexTooltip content={dueCount > 0 ? `到期 ${dueCount} 张,点左侧「复习」开始` : `到期 ${dueCount} 张`} side="top">
              <span className="relative flex cursor-default items-center gap-1.5">
                {dueCount > 0 && !minimal && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-vermilion-400/70" aria-hidden="true" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-vermilion-500" aria-hidden="true" />
                  </span>
                )}
                <span className={dueCount > 0 ? 'text-ink-secondary' : ''}>今日复习 {todayReviewed ?? '—'}</span>
              </span>
            </LexTooltip>
            <LexTooltip
              content={
                hitPct == null
                  ? '缓存命中率(本会话)'
                  : hitPct < 90
                    ? `缓存命中率 ${hitPct}% 偏低,可能因提示词版本变更`
                    : `缓存命中率 ${hitPct}%`
              }
              side="top"
            >
              <span
                className={`cursor-default font-mono tabular-nums ${hitPct != null && hitPct < 90 ? 'text-ochre-500' : ''}`}
              >
                命中 {hitPct == null ? '—' : `${hitPct}%`}
              </span>
            </LexTooltip>
          </>
        )}
      </div>
    </aside>
  )
}
