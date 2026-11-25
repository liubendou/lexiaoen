import { Collapsible } from 'radix-ui'
import { cx } from './cx'

// Radix Collapsible 包装(UI方案 R1 清单 6):保留「原地高度展开」的动画精神
// 高度 0↔auto 用 Radix 实测高度变量 + .lex-collapse keyframes(见 global.css)
export const LexCollapsible = {
  Root: Collapsible.Root,
  Trigger: Collapsible.Trigger
}

export function LexCollapsibleContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Collapsible.Content className={cx('lex-collapse overflow-hidden', className)}>{children}</Collapsible.Content>
  )
}
