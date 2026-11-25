import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertDialog, Dialog } from 'radix-ui'
import { SPRING } from '../../styles/motion-tokens'
import { cx } from './cx'

// Radix Dialog / AlertDialog 包装(UI方案 R1 清单 2/3)
// 行为(焦点锁定/失焦恢复/Esc)全交 Radix;进出用 motion spring(面板档 260/26)
// 受控模式 + forceMount + AnimatePresence:Radix 官方支持的动画接法

const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: 'easeOut' as const }
}

const contentMotion = {
  initial: { opacity: 0, scale: 0.96, x: '-50%', y: '-46%' },
  animate: { opacity: 1, scale: 1, x: '-50%', y: '-50%' },
  exit: { opacity: 0, scale: 0.97, x: '-50%', y: '-48%' },
  transition: SPRING.soft
}

/** 居中浮窗壳:遮罩 + 内容卡片(圆角 14 + dialog 阴影) */
function ModalShell({
  open,
  children,
  onClose
}: {
  open: boolean
  children: ReactNode
  onClose: (open: boolean) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div {...overlayMotion} className="fixed inset-0 z-[240] bg-paper-overlay" />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                {...contentMotion}
                className="fixed left-1/2 top-1/2 z-[250] w-[420px] rounded-lg border border-rule-hair bg-paper-raised p-5 shadow-dialog focus:outline-none"
              >
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/** 普通对话框(重命名用):标题 + 自由内容 */
export function LexDialog(props: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: ReactNode }) {
  return (
    <ModalShell open={props.open} onClose={props.onOpenChange}>
      <Dialog.Title className="font-serif text-[16px] font-semibold text-ink-primary">{props.title}</Dialog.Title>
      <Dialog.Description className="sr-only">{props.title}</Dialog.Description>
      {props.children}
    </ModalShell>
  )
}

/** 确认对话框(删除用):不可 Esc 误触关闭的是 AlertDialog 语义(外点不关) */
export function LexAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = '取消',
  actionLabel,
  danger = true,
  onAction
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: ReactNode
  cancelLabel?: string
  actionLabel: string
  danger?: boolean
  onAction: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal forceMount>
            <AlertDialog.Overlay asChild forceMount>
              <motion.div {...overlayMotion} className="fixed inset-0 z-[240] bg-paper-overlay" />
            </AlertDialog.Overlay>
            <AlertDialog.Content asChild forceMount>
              <motion.div
                {...contentMotion}
                className="fixed left-1/2 top-1/2 z-[250] w-[400px] rounded-lg border border-rule-hair bg-paper-raised p-5 shadow-dialog focus:outline-none"
              >
                <AlertDialog.Title className="font-serif text-[16px] font-semibold text-ink-primary">{title}</AlertDialog.Title>
                <AlertDialog.Description className="mt-1.5 text-[13px] leading-[1.6] text-ink-secondary">
                  {description}
                </AlertDialog.Description>
                <div className="mt-4 flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <button
                      autoFocus
                      className="inline-flex h-8 items-center justify-center rounded-sm border border-rule-strong bg-paper-raised px-3.5 text-[13px] text-ink-secondary hover:bg-paper-sunken"
                    >
                      {cancelLabel}
                    </button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <button
                      onClick={onAction}
                      className={cx(
                        'inline-flex h-8 items-center justify-center rounded-sm px-3.5 text-[13px] font-medium text-ink-inverse',
                        danger ? 'bg-vermilion-500 hover:bg-vermilion-600' : 'bg-indigo-500 hover:bg-indigo-600'
                      )}
                    >
                      {actionLabel}
                    </button>
                  </AlertDialog.Action>
                </div>
              </motion.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  )
}
