import { motion } from 'motion/react'
import { MODES, type ModeDef, type ModeId } from '../data/modes'
import { useUiStore } from '../stores/ui'
import { SPRING } from '../styles/motion-tokens'
import { GaugeIcon, GemIcon, ZapIcon } from './icons'
import { LexTooltip } from './ui/tooltip'

// 模式标识图标(D 方案裁决 2026-10-11):快速=闪电、标准=仪表、高质量=宝石
// 12px、stroke 1.5(icons.tsx 统一 1.5)、颜色仍取三模式标识色
export function ModeIcon({ id, color, size = 12, className }: { id: ModeId; color: string; size?: number; className?: string }) {
  const Cmp = id === 'fast' ? ZapIcon : id === 'standard' ? GaugeIcon : GemIcon
  return (
    <span className={className} style={{ color, display: 'inline-flex', flex: 'none' }}>
      <Cmp size={size} />
    </span>
  )
}

export function ModeIconOf(def: ModeDef, size = 12): ReturnType<typeof ModeIcon> {
  return <ModeIcon id={def.id} color={def.color} size={size} />
}

const modeTip = (m: ModeDef): string => `切换为${m.label}模式(将用于新会话)`

// M1 验收组件:选中底块用 layoutId 共享元素滑动(UI方案 4.2)
// R1:滑块换快交互 spring 380/30 + 按压 scale 0.97 + Radix Tooltip
export default function ModeSwitcher({ compact = false }: { compact?: boolean }) {
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')

  if (compact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2.5" role="radiogroup" aria-label="教学模式">
        {MODES.map((m) => {
          const active = mode === m.id
          return (
            <LexTooltip key={m.id} content={modeTip(m)} side="right">
              <motion.button
                role="radio"
                aria-checked={active}
                onClick={() => setMode(m.id as ModeId)}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
                className="flex h-8 w-8 items-center justify-center rounded-sm"
                style={{ background: active ? 'var(--indigo-50)' : undefined }}
              >
                <ModeIcon id={m.id} color={m.color} />
              </motion.button>
            </LexTooltip>
          )
        })}
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label="教学模式" className="flex h-full items-stretch gap-1">
      {MODES.map((m) => {
        const active = mode === m.id
        return (
          <LexTooltip key={m.id} content={modeTip(m)} side="bottom">
            <motion.button
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m.id)}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
              className="relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-1"
            >
              {active &&
                (minimal ? (
                  // minimal 档:共享元素转场关闭,直接切换(UI方案 7.4 白名单)
                  <span className="absolute inset-0 rounded-sm border border-indigo-300 bg-indigo-50" />
                ) : (
                  <motion.span
                    layoutId="mode-pill-rail"
                    transition={SPRING.snappy}
                    className="absolute inset-0 rounded-sm border border-indigo-300 bg-indigo-50"
                  />
                ))}
              <span className="relative z-10 flex items-center gap-1.5">
                <ModeIcon id={m.id} color={m.color} />
                <span className={`text-[13px] ${active ? 'font-semibold text-ink-primary' : 'text-ink-secondary'}`}>
                  {m.label}
                </span>
              </span>
            </motion.button>
          </LexTooltip>
        )
      })}
    </div>
  )
}
