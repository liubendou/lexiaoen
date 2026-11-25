// 线性图标:1.5px 描边、24 网格、圆头端点(UI方案 2.4)
// 只用 16/20/24 三档尺寸

interface IconProps {
  size?: number
  className?: string
}

function Svg({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
)

export const MaximizeIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5.5" y="5.5" width="13" height="13" rx="1" />
  </Svg>
)

export const RestoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="5.5" width="10.5" height="10.5" rx="1" />
    <path d="M5.5 9v8.5a1 1 0 0 0 1 1H15" />
  </Svg>
)

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.4c-.5.4-1.3 0-1.3-.6V6.5Z" />
  </Svg>
)

export const QuizIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.4c-.5.4-1.3 0-1.3-.6V6.5Z" />
    <path d="M8 9h8M8 12.5h5" />
  </Svg>
)

export const ReviewIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="7" width="13" height="13" rx="2" />
    <path d="M7.5 4.5h10a3 3 0 0 1 3 3v10" />
  </Svg>
)

export const DashboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V8M17 20v-9" />
  </Svg>
)

export const TextbookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5V5.5Z" />
    <path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5" />
  </Svg>
)

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
  </Svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 9l7 7 7-7" />
  </Svg>
)

export const PanelRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M15 4.5v15" />
  </Svg>
)

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="0.9" fill="currentColor" />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    <circle cx="18.5" cy="12" r="0.9" fill="currentColor" />
  </Svg>
)

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
)

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4.8v14.4l12-7.2-12-7.2Z" />
  </Svg>
)

export const StopIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16.7 3.8a2.4 2.4 0 0 1 3.4 3.4L7.6 19.7 3 21l1.3-4.6L16.7 3.8Z" />
  </Svg>
)

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 6h17M8 6V4.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 4.5V6" />
    <path d="M18.8 6l-.9 13.2a2 2 0 0 1-2 1.8h-7.8a2 2 0 0 1-2-1.8L5.2 6" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Svg>
)

/* ===== 三模式语义图标(D 方案裁决 2026-10-11:闪电/仪表/宝石,12px、stroke 1.5) ===== */

export const ZapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2 3 14h7l-1 8 12-14h-8z" />
  </Svg>
)

export const GaugeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15l4-5" />
    <path d="M20.5 15a8.5 8.5 0 1 0-17 0" />
  </Svg>
)

export const GemIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12l4 6-10 13L2 9z" />
    <path d="M2 9h20" />
  </Svg>
)
