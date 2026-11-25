// 测验页(M3):考纲点选题 → 生成(快速路由 JSON)→ 逐题作答即判 → 错题自动入 FSRS 队列
// 流程纪律:检索练习先答后讲——文字题必须先自己写,再显示参考答案,最后自评
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { QuizQuestion, SyllabusNode } from '../../../shared/ipc'
import { QTYPE_LABELS } from './labels'
import { useSyllabusStore } from './syllabus-store'
import { DURATION, SPRING } from '../../styles/motion-tokens'
import DotsLoader from '../../components/ui/dots'
import { useUiStore } from '../../stores/ui'

const COUNTS = [3, 5, 8]

const selectCls =
  'h-8 cursor-pointer rounded-sm border border-rule-strong bg-paper-raised px-2 text-[13px] text-ink-primary outline-none transition-colors duration-[120ms] ease-out focus:border-indigo-400'

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={SPRING.snappy}
      className="inline-flex h-8 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm bg-indigo-500 px-4 text-[13.5px] text-ink-inverse transition-colors duration-[120ms] ease-out hover:bg-indigo-600 active:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-100 disabled:text-ink-disabled"
    >
      {children}
    </motion.button>
  )
}

/** Success Check(kinetics):圆环与对勾依次描边,与掌握度环同一 stroke 语言 */
function SuccessTick({ minimal }: { minimal: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 18 18"
      className="h-[15px] w-[15px] shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <motion.circle
        cx="9"
        cy="9"
        r="7.25"
        stroke="currentColor"
        strokeWidth="1.5"
        initial={minimal ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: minimal ? 0 : DURATION.base / 1000, ease: 'easeOut' }}
      />
      <motion.path
        d="M5.6 9.3 L8 11.6 L12.6 6.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={minimal ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: minimal ? 0 : DURATION.base / 1000, ease: 'easeOut', delay: minimal ? 0 : 0.16 }}
      />
    </motion.svg>
  )
}

export default function QuizPage() {
  const animate = useUiStore((s) => s.motionLevel !== 'minimal')
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')
  const quizPreset = useUiStore((s) => s.quizPreset)
  const setQuizPreset = useUiStore((s) => s.setQuizPreset)
  const storeRows = useSyllabusStore((s) => s.rows)
  const loadSyllabus = useSyllabusStore((s) => s.load)
  const [syllabus, setSyllabus] = useState<SyllabusNode[]>([])
  const [chapterId, setChapterId] = useState('')
  const [pointId, setPointId] = useState('')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [wrongCount, setWrongCount] = useState(0)

  useEffect(() => {
    void loadSyllabus()
  }, [loadSyllabus])
  useEffect(() => {
    if (storeRows.length) {
      setSyllabus(storeRows)
      setChapterId((c) => c || storeRows.find((r) => r.level === 1)?.id || '')
    }
  }, [storeRows])

  // 消费左栏预选(一次性):level2 → 定位其章并自动选第一个知识点;level3 → 直接定位
  useEffect(() => {
    if (!quizPreset || syllabus.length === 0) return
    setQuizPreset(null)
    const node = syllabus.find((n) => n.id === quizPreset)
    if (!node) return
    if (node.level === 1) {
      setChapterId(node.id)
    } else if (node.level === 2) {
      setChapterId(node.parentId ?? '')
    } else {
      const parent = syllabus.find((n) => n.id === node.parentId)
      setChapterId(parent?.parentId ?? '')
      setPointId(node.id)
    }
  }, [quizPreset, syllabus, setQuizPreset])

  const chapters = useMemo(() => syllabus.filter((n) => n.level === 1), [syllabus])
  const chapter = chapters.find((c) => c.id === chapterId)
  const points = useMemo(() => {
    if (!chapter) return []
    const secIds = new Set(syllabus.filter((n) => n.parentId === chapter.id).map((n) => n.id))
    return syllabus.filter((n) => n.level === 3 && n.parentId && secIds.has(n.parentId))
  }, [syllabus, chapter])
  const subjectLabel = chapter?.subject === 'physiology' ? '生理学' : '人体解剖学'

  useEffect(() => {
    if (points.length && !points.some((p) => p.id === pointId)) setPointId(points[0].id)
  }, [points, pointId])

  const cur = questions[idx]

  const generate = (): void => {
    if (!pointId) return
    setLoading(true)
    setError('')
    void window.lexiaoen.study
      .generateQuiz(pointId, count)
      .then((qs) => {
        setQuestions(qs)
        setIdx(0)
        setPicked([])
        setRevealed(false)
        setWasCorrect(null)
        setWrongCount(0)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  /** 记一次错误:入 FSRS 复习队列 */
  const registerWrong = (q: QuizQuestion): void => {
    setWrongCount((n) => n + 1)
    void window.lexiaoen.study.addWrongCard(q.id)
  }

  const judge = (): void => {
    if (!cur) return
    const correct =
      cur.qtype === 'multiple'
        ? picked.slice().sort().join('') === [...cur.answer].sort().join('')
        : picked[0] === cur.answer
    setWasCorrect(correct)
    setRevealed(true)
    void window.lexiaoen.study.logAttempt(cur.nodeId, cur.qtype, cur.bloom, correct)
    if (!correct) registerWrong(cur)
  }

  /** 文字题自评(参考答案已显示后) */
  const selfJudge = (correct: boolean): void => {
    if (!cur) return
    setWasCorrect(correct)
    void window.lexiaoen.study.logAttempt(cur.nodeId, cur.qtype, cur.bloom, correct)
    if (!correct) registerWrong(cur)
  }

  const advance = (): void => {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1)
      setPicked([])
      setRevealed(false)
      setWasCorrect(null)
    } else {
      setQuestions([]) // 回到选题态,顶部统计清零
    }
  }

  // ---------- 渲染 ----------

  if (syllabus.length === 0) {
    return (
      <div className="py-14 text-center">
        <p className="font-serif text-[17px] font-semibold text-ink-primary">考纲树尚未就绪</p>
        <p className="mt-1.5 text-[13.5px] text-ink-secondary">重启应用后重试;若仍未出现,请检查数据库状态</p>
      </div>
    )
  }

  if (cur) {
    const choice = cur.qtype === 'single' || cur.qtype === 'multiple'
    return (
      <div>
        <div className="mb-4 flex items-center gap-3 text-[12.5px] text-ink-tertiary">
          <span className="font-mono tabular-nums">
            {idx + 1} / {questions.length}
          </span>
          <span className="rounded-xs border border-rule-hair px-1.5 py-px">{QTYPE_LABELS[cur.qtype] ?? cur.qtype}</span>
          <span className="rounded-xs border border-rule-hair px-1.5 py-px">{cur.bloom}</span>
          {wrongCount > 0 && <span className="ml-auto text-vermilion-600">错题 {wrongCount} 道已入复习队列</span>}
        </div>
        {/* 题目切换(《详细方案》7.2):旧题上移淡出、新题从下方 spring 进入;popLayout 允许交接期并行 */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={cur.id}
            initial={animate ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={animate ? { opacity: 0, y: -10 } : undefined}
            transition={minimal ? { duration: 0.15 } : SPRING.default}
            className="rounded-md border border-rule-hair bg-paper-raised p-5 shadow-1"
          >
          {/* Error Shake(kinetics):答错时内容层衰减抖动,与外层切换动画互不干扰 */}
          <motion.div
            animate={wasCorrect === false && !minimal ? { x: [0, -9, 9, -6, 6, -2, 0] } : { x: 0 }}
            transition={wasCorrect === false && !minimal ? { duration: 0.42, ease: 'easeOut' } : { duration: 0.15 }}
          >
          <p className="text-[14.5px] font-medium leading-relaxed text-ink-primary">{cur.stem}</p>

          {choice && (
            <div className="mt-4 space-y-2">
              {cur.options.map((o) => {
                const on = picked.includes(o.key)
                const isAns = cur.answer.includes(o.key)
                let cls = 'border-rule-strong bg-paper-base hover:bg-paper-sunken'
                if (revealed && isAns) cls = 'border-moss-500 bg-moss-50'
                else if (revealed && on && !isAns) cls = 'border-vermilion-500 bg-vermilion-50'
                else if (on) cls = 'border-indigo-500 bg-indigo-50/60'
                return (
                  <button
                    key={o.key}
                    type="button"
                    disabled={revealed}
                    onClick={() =>
                      setPicked((prev) =>
                        cur.qtype === 'multiple'
                          ? prev.includes(o.key)
                            ? prev.filter((k) => k !== o.key)
                            : [...prev, o.key]
                          : [o.key]
                      )
                    }
                    className={`flex w-full cursor-pointer items-start gap-2.5 rounded-sm border px-3 py-2.5 text-left text-[13.5px] leading-relaxed text-ink-primary transition-colors duration-[120ms] ease-out disabled:cursor-default ${cls}`}
                  >
                    <span className="mt-px font-mono font-semibold">{o.key}.</span>
                    <span className="flex-1">{o.text}</span>
                    {cur.qtype === 'multiple' && !revealed && (
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border ${on ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-rule-strong'}`}
                      >
                        {on ? '✓' : ''}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {!choice && !revealed && (
            <div className="mt-4">
              <textarea
                placeholder="先自己写一遍要点,再对照参考答案(检索练习:提取比重读记得牢)"
                className="min-h-[88px] w-full resize-y rounded-sm border border-rule-strong bg-paper-base p-3 text-[13.5px] leading-relaxed text-ink-primary outline-none transition-colors duration-[120ms] ease-out focus:border-indigo-400"
              />
              <div className="mt-3 flex justify-end">
                <PrimaryButton onClick={() => setRevealed(true)}>显示参考答案</PrimaryButton>
              </div>
            </div>
          )}

          {revealed && (
            <motion.div
              initial={minimal ? false : { scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={minimal ? { duration: 0.15 } : SPRING.snappy}
              className="mt-4 space-y-2 border-t border-rule-hair pt-3"
            >
              <p className="text-[13.5px] leading-relaxed text-ink-primary">
                <span className="font-semibold">答案:{cur.answer}</span>
              </p>
              {cur.explanation && <p className="text-[13px] leading-relaxed text-ink-secondary">解析:{cur.explanation}</p>}
              {wasCorrect !== null && (
                <motion.p
                  initial={minimal ? false : { scale: 0.92 }}
                  animate={{ scale: 1 }}
                  transition={minimal ? { duration: 0.15 } : SPRING.snappy}
                  className={`flex items-center gap-1.5 text-[13px] font-medium ${wasCorrect ? 'text-moss-600' : 'text-vermilion-600'}`}
                >
                  {wasCorrect && <SuccessTick minimal={minimal} />}
                  {wasCorrect ? '答对了' : '答错了,已加入复习队列'}
                </motion.p>
              )}
            </motion.div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            {/* 选择题:未判定时出「校对答案」;判定后出「下一题/完成」 */}
            {!revealed && choice && (
              <PrimaryButton onClick={judge} disabled={picked.length === 0}>
                校对答案
              </PrimaryButton>
            )}
            {/* 文字题:答案已显示、尚未自评 → 自评二选一 */}
            {revealed && !choice && wasCorrect === null && (
              <>
                <button
                  onClick={() => selfJudge(false)}
                  className="h-8 cursor-pointer rounded-sm border border-vermilion-500 px-4 text-[13.5px] text-vermilion-600 transition-colors duration-[120ms] ease-out hover:bg-vermilion-50"
                >
                  没答上来
                </button>
                <PrimaryButton onClick={() => selfJudge(true)}>答对了</PrimaryButton>
              </>
            )}
            {(revealed && choice && wasCorrect !== null) || (revealed && !choice && wasCorrect !== null) ? (
              <PrimaryButton onClick={advance}>{idx + 1 < questions.length ? '下一题' : '完成本组'}</PrimaryButton>
            ) : null}
          </div>
          </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // 选题态
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-secondary">科目</span>
        <span className="text-[13px] font-medium text-ink-primary">{subjectLabel}</span>
        <select className={`${selectCls} ml-2 min-w-[130px]`} value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select className={`${selectCls} min-w-[210px]`} value={pointId} onChange={(e) => setPointId(e.target.value)}>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.requirement ? `(${p.requirement})` : ''}
            </option>
          ))}
        </select>
        {/* Choice Chips(kinetics):题数三档 chip,选中弹性 pop */}
        <div className="ml-1 flex items-center gap-1">
          {COUNTS.map((c) => {
            const on = c === count
            return (
              <motion.button
                key={c}
                type="button"
                onClick={() => setCount(c)}
                whileTap={{ scale: 0.94 }}
                animate={{ scale: on && !minimal ? [1, 1.12, 1] : 1 }}
                transition={minimal ? { duration: 0.15 } : SPRING.snappy}
                className={`h-8 cursor-pointer rounded-sm border px-3 text-[13px] transition-colors duration-[120ms] ease-out ${
                  on ? 'border-indigo-500 bg-indigo-500 font-medium text-ink-inverse' : 'border-rule-strong bg-paper-raised text-ink-secondary hover:border-indigo-300 hover:text-ink-primary'
                }`}
              >
                {c} 题
              </motion.button>
            )
          })}
        </div>
        <PrimaryButton onClick={generate} disabled={loading || !pointId}>
          {loading ? (
            <>
              出题中<DotsLoader />
            </>
          ) : (
            '生成测验'
          )}
        </PrimaryButton>
        {error && <span className="text-[12.5px] text-vermilion-600">{error}</span>}
      </div>
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <p className="font-serif text-[17px] font-semibold text-ink-primary">检索练习,先答后讲</p>
        <p className="mt-1.5 max-w-[360px] text-[13.5px] leading-relaxed text-ink-secondary">
          选一个考纲知识点生成一组题;答错的题自动排入复习队列,由 FSRS 计算下次最佳复习时间
        </p>
      </div>
    </div>
  )
}
