import { motion } from 'motion/react'
import { Switch } from 'radix-ui'
import { SPRING } from '../../styles/motion-tokens'
import { cx } from './cx'

// iOS 式开关(UI方案 R1 清单 5,出自设置页样张):44×26 轨道 + 22 旋钮
// 旋钮位移走快交互 spring;轨道色变 120ms(CSS transition 唯一白名单)
export function LexSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  ariaLabel
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        'relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-[120ms] ease-out',
        checked ? 'bg-indigo-500' : 'bg-rule-strong',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      <Switch.Thumb asChild>
        <motion.span
          animate={{ x: checked ? 18 : 0 }}
          transition={SPRING.snappy}
          className="block h-[22px] w-[22px] rounded-full bg-paper-raised shadow-1"
        />
      </Switch.Thumb>
    </Switch.Root>
  )
}
