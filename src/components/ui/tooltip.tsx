import type { ReactNode } from 'react'
import { Tooltip } from 'radix-ui'
import { cx } from './cx'

// Radix Tooltip 包装(UI方案 R1 清单 4):无箭头纯圆角浮块
// 皮:ink-primary 底 + 反白 12px + 圆角 6 + shadow-1;进出动画走 .lex-tip keyframes
export const TooltipProvider = Tooltip.Provider

export function LexTooltip({
  content,
  children,
  side = 'bottom',
  className
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className={cx(
            'lex-tip z-[300] max-w-[280px] rounded-sm bg-ink-primary px-2.5 py-1.5 text-[12px] leading-[1.5] text-ink-inverse shadow-1',
            className
          )}
        >
          {content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
