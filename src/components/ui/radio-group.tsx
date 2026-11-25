import { motion } from 'motion/react'
import { RadioGroup } from 'radix-ui'
import { cx } from './cx'

// Radix RadioGroup 包装(UI方案 R1 清单 5,出自设置页样张)
// 圈:16px,未选 1.5px rule-strong 描边;选中 2px 靛蓝 + 6px 实心点(弹簧缩放浮现)
export function LexRadioGroup({
  value,
  onValueChange,
  className,
  children
}: {
  value: string
  onValueChange: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <RadioGroup.Root value={value} onValueChange={onValueChange} className={cx('flex items-center gap-6', className)}>
      {children}
    </RadioGroup.Root>
  )
}

export function LexRadioItem({
  value,
  label,
  disabled = false
}: {
  value: string
  label: string
  disabled?: boolean
}) {
  return (
    <RadioGroup.Item
      value={value}
      disabled={disabled}
      className="group flex select-none items-center gap-2 outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={cx(
          'flex h-4 w-4 items-center justify-center rounded-full',
          'border-rule-strong border-[1.5px] group-data-[state=checked]:border-indigo-500 group-data-[state=checked]:border-[2px]'
        )}
      >
        <RadioGroup.Indicator asChild>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="block h-1.5 w-1.5 rounded-full bg-indigo-500"
          />
        </RadioGroup.Indicator>
      </span>
      <span className="text-[14px] leading-[1.4] text-ink-secondary group-data-[state=checked]:font-medium group-data-[state=checked]:text-ink-primary">
        {label}
      </span>
    </RadioGroup.Item>
  )
}
