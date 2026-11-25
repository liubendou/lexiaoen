import type { ComponentPropsWithoutRef } from 'react'
import { Toast } from 'radix-ui'
import { CloseIcon } from '../icons'
import { cx } from './cx'

// Radix Toast 包装(R3 清单 9):错误/重试提示升级为底部浮出
// 右下角、paper-raised 卡片、左侧朱砂竖线表错误级;进出走 .lex-toast keyframes
export const ToastProvider = (props: ComponentPropsWithoutRef<typeof Toast.Provider>) => <Toast.Provider {...props} />

export const ToastViewport = () => (
  <Toast.Viewport className="fixed bottom-4 right-4 z-[400] flex w-[340px] flex-col gap-2 outline-none" />
)

export function LexToast({
  title,
  description,
  actionLabel,
  onAction,
  open,
  onOpenChange,
  tone = 'error'
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  open: boolean
  onOpenChange: (v: boolean) => void
  tone?: 'error' | 'info'
}) {
  return (
    <Toast.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={tone === 'error' ? 8000 : 4000}
      className={cx(
        'lex-toast flex items-start gap-2 rounded-md border border-rule-hair bg-paper-raised p-3 shadow-menu',
        tone === 'error' ? 'border-l-[3px] border-l-vermilion-500' : 'border-l-[3px] border-l-indigo-500'
      )}
    >
      <div className="min-w-0 flex-1">
        <Toast.Title className="text-[13px] font-medium text-ink-primary">{title}</Toast.Title>
        {description && <Toast.Description className="mt-0.5 text-[12px] leading-[1.5] text-ink-secondary">{description}</Toast.Description>}
      </div>
      {actionLabel && onAction && (
        <Toast.Action
          altText={actionLabel}
          asChild
          onClick={() => {
            onAction()
            onOpenChange(false)
          }}
        >
          <button className="shrink-0 text-[13px] font-medium text-indigo-600 hover:underline">{actionLabel}</button>
        </Toast.Action>
      )}
      <Toast.Close asChild>
        <button aria-label="关闭" className="shrink-0 p-0.5 text-ink-tertiary hover:text-ink-primary">
          <CloseIcon size={14} />
        </button>
      </Toast.Close>
    </Toast.Root>
  )
}
