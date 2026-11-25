import { motion } from 'motion/react'
import { modeById } from '../data/modes'
import { useUiStore } from '../stores/ui'

// 右栏 336px:模式方法论 + 本轮来源;顶部 2px 模式色细线是唯一的"氛围"提示(UI方案 4.2)
export default function RightPanel() {
  const mode = useUiStore((s) => s.mode)
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')
  const def = modeById(mode)

  return (
    <aside className="flex h-full w-[336px] shrink-0 flex-col border-l border-rule-hair bg-paper-base">
      {minimal ? (
        <div className="h-0.5 w-full" style={{ background: def.color }} />
      ) : (
        <motion.div
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-0.5 w-full"
          style={{ background: def.color }}
        />
      )}

      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="font-serif text-[17px] font-semibold text-ink-primary">当前模式方法论</h3>
        <p className="mt-1 text-[12px] text-ink-tertiary">{def.label}模式 · 切换模式即切换教学法引擎</p>
        <ul className="mt-4 space-y-2">
          {def.methods.map((m) => (
            <li key={m} className="flex items-start gap-2 text-[13px] text-ink-secondary">
              <span className="mt-[7px] text-ink-tertiary">▸</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>

        <div className="my-5 h-px bg-rule-hair" />

        <h3 className="font-serif text-[17px] font-semibold text-ink-primary">本轮来源</h3>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-tertiary">
          对话开始后,这里会显示引用的考纲章节与教材片段。
        </p>
      </div>
    </aside>
  )
}
