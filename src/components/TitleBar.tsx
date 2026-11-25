import { useEffect, useState } from 'react'
import { CloseIcon, MaximizeIcon, MinusIcon, RestoreIcon } from './icons'
import { LexTooltip } from './ui/tooltip'

// 自定义标题栏 32px(UI方案 3.1):左=应用名+科目,中=拖拽区,右=窗口控制
// R1:窗口按钮 tooltip 升级为 Radix(无箭头浮块)
export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.lexiaoen.window.isMaximized().then(setMaximized)
    return window.lexiaoen.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <header className="flex h-8 shrink-0 items-stretch border-b border-rule-hair bg-paper-base">
      <div className="app-drag flex items-center gap-2 pl-3 pr-2">
        <span className="font-serif text-[13px] font-semibold tracking-wide">乐小恩</span>
        <span className="text-[12px] text-ink-tertiary">· 人体解剖学</span>
      </div>
      <div className="app-drag flex-1" />
      <div className="app-no-drag flex items-stretch">
        <TitleButton label="最小化" onClick={() => window.lexiaoen.window.minimize()}>
          <MinusIcon size={14} />
        </TitleButton>
        <TitleButton label={maximized ? '还原' : '最大化'} onClick={() => window.lexiaoen.window.toggleMaximize()}>
          {maximized ? <RestoreIcon size={13} /> : <MaximizeIcon size={13} />}
        </TitleButton>
        <TitleButton label="关闭" danger onClick={() => window.lexiaoen.window.close()}>
          <CloseIcon size={14} />
        </TitleButton>
      </div>
    </header>
  )
}

function TitleButton({
  label,
  danger = false,
  onClick,
  children
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <LexTooltip content={label} side="bottom">
      <button
        aria-label={label}
        onClick={onClick}
        className={
          danger
            ? 'flex h-8 w-8 cursor-pointer items-center justify-center text-ink-secondary transition-colors duration-[120ms] ease-out hover:bg-vermilion-500 hover:text-ink-inverse'
            : 'flex h-8 w-8 cursor-pointer items-center justify-center text-ink-secondary transition-colors duration-[120ms] ease-out hover:bg-paper-sunken hover:text-ink-primary'
        }
      >
        {children}
      </button>
    </LexTooltip>
  )
}
