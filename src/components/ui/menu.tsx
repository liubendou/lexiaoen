import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { cx } from './cx'

// Radix DropdownMenu 包装(UI方案 R1 清单 1):键盘/焦点/Esc/原点缩放全交给 Radix
// 皮出自浮层态视觉稿:paper-raised 底 + rule-hair 描边 + 圆角 10 + 阴影 menu 档
export const Menu = {
  Root: DropdownMenu.Root,
  Trigger: DropdownMenu.Trigger
}

export const MenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DropdownMenu.Content>>(
  function MenuContent({ className, sideOffset = 6, collisionPadding = 8, ...rest }, ref) {
    return (
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cx(
            'lex-pop z-[200] min-w-[220px] rounded-md border border-rule-hair bg-paper-raised p-1 shadow-menu',
            className
          )}
          {...rest}
        />
      </DropdownMenu.Portal>
    )
  }
)

export function MenuItem({
  danger = false,
  shortcut,
  icon,
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  danger?: boolean
  shortcut?: string
  icon?: ReactNode
}) {
  return (
    <DropdownMenu.Item
      className={cx(
        'flex h-8 select-none items-center gap-2 rounded-sm px-2.5 text-[13px] text-ink-primary outline-none data-[highlighted]:bg-indigo-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        danger && 'text-vermilion-500',
        className
      )}
      {...rest}
    >
      {icon && <span className="flex w-4 shrink-0 items-center justify-center text-ink-secondary">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="ml-2 font-mono text-[11px] text-ink-tertiary">{shortcut}</span>}
    </DropdownMenu.Item>
  )
}

export const MenuSeparator = () => <DropdownMenu.Separator className="mx-1 my-1 h-px bg-rule-hair" />
