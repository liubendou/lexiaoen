// 首启引导(轻量两步):欢迎 → 选默认模式;完成写 settings.onboarding,此后不再出现
// 老用户判定:settings 已有 'ui' 持久化即视为老用户,自动跳过(ui.ts hydrate)
import { useState } from 'react'
import { motion } from 'motion/react'
import { MODES, type ModeId } from '../../data/modes'
import { ModeIcon } from '../../components/ModeSwitcher'
import { Button } from '../../components/ui/button'
import { useUiStore } from '../../stores/ui'

export default function OnboardingPage({ onComplete }: { onComplete: (mode: ModeId) => void }) {
  const [step, setStep] = useState<0 | 1>(0)
  const [picked, setPicked] = useState<ModeId>('standard')
  const animate = useUiStore((s) => s.motionLevel !== 'minimal')
  const systemReduced = useUiStore((s) => s.systemReduced)

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-6">
      <div className="w-full max-w-[520px] py-10">
        {step === 0 ? (
          <motion.div
            key="ob-welcome"
            initial={animate ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="flex flex-col items-center text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-vermilion-500 font-serif text-[30px] font-bold text-ink-inverse shadow-1">
              乐
            </div>
            <h1 className="mt-5 font-serif text-[26px] font-bold text-ink-primary">乐小恩</h1>
            <p className="mt-1.5 text-[14px] text-ink-secondary">河北医学专升本 · 智能导师</p>
            <div className="mt-7 space-y-2.5 text-left text-[13.5px] leading-relaxed text-ink-secondary">
              <p>· 对话式教学:追问、病例、图示,像老师一样带你过考纲</p>
              <p>· 检索练习与间隔复习:记住才算了过,不是划过</p>
              <p>· 错题自动排期:该复习哪张卡,应用替你算好</p>
            </div>
            <Button variant="primary" className="mt-8 h-9 w-[160px] text-[14px]" onClick={() => setStep(1)}>
              开始
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="ob-mode"
            initial={animate ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <h1 className="font-serif text-[22px] font-bold text-ink-primary">选择你的学习节奏</h1>
            <p className="mt-1.5 text-[13px] text-ink-tertiary">
              决定新会话的讲解方式,随时可在左上角切换{systemReduced ? '' : ';不动也可以,默认「标准」'}
            </p>
            <div className="mt-5 space-y-3">
              {MODES.map((m) => {
                const active = picked === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPicked(m.id)}
                    className={`w-full cursor-pointer rounded-md border p-4 text-left transition-colors duration-[120ms] ease-out ${
                      active ? 'border-indigo-500 bg-indigo-50/60' : 'border-rule-hair bg-paper-raised hover:bg-paper-raised'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ModeIcon id={m.id} color={m.color} size={14} />
                      <span className="text-[15px] font-semibold text-ink-primary">{m.label}模式</span>
                      <span
                        className={`ml-auto flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] ${active ? 'border-indigo-500' : 'border-rule-strong'}`}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
                      </span>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-secondary">{m.methods.join(' · ')}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-7 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                上一步
              </Button>
              <Button variant="primary" className="h-9 w-[160px] text-[14px]" onClick={() => onComplete(picked)}>
                就绪,开始学习
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
