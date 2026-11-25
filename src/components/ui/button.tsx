import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { SPRING } from '../../styles/motion-tokens'
import { cx } from './cx'

// 统一 Button 基件(UI方案 R1 清单 10):次要描边/主要靛蓝/危险朱砂/幽灵链接
// 三态配色出自设置页控件样张;按压 scale 0.97 + 快交互 spring(iOS 手感)
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: ButtonVariant
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-500 font-medium text-ink-inverse hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-indigo-100 disabled:text-ink-disabled',
  secondary:
    'border border-rule-strong bg-paper-raised text-ink-secondary hover:bg-paper-sunken disabled:border-rule-hair disabled:text-ink-disabled disabled:hover:bg-paper-raised',
  danger:
    'bg-vermilion-500 font-medium text-ink-inverse hover:bg-vermilion-600 active:bg-vermilion-600 disabled:bg-vermilion-100 disabled:text-ink-disabled',
  ghost: 'bg-transparent text-ink-tertiary hover:text-ink-secondary disabled:text-ink-disabled'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className, disabled, ...rest },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={SPRING.snappy}
      className={cx(
        'inline-flex h-8 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3.5 text-[13px]',
        VARIANT[variant],
        className
      )}
      {...rest}
    />
  )
})
