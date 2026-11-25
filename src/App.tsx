import { useEffect, useRef, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import LeftRail from './components/LeftRail'
import RightPanel from './components/RightPanel'
import TitleBar from './components/TitleBar'
import { PanelRightIcon } from './components/icons'
import ErrorBoundary from './components/ErrorBoundary'
import { modeById } from './data/modes'
import { TooltipProvider } from './components/ui/tooltip'
import ChatPage from './features/chat/ChatPage'
import { useChatStore } from './features/chat/chat-store'
import OnboardingPage from './features/onboarding/OnboardingPage'
import ReviewPage from './features/study/ReviewPage'
import QuizPage from './features/study/QuizPage'
import DashboardPage from './features/dashboard/DashboardPage'
import TextbookPage from './features/textbook/TextbookPage'
import SettingsPage from './features/settings/SettingsPage'
import { SPRING } from './styles/motion-tokens'
import { useUiStore, type PageId } from './stores/ui'

const PAGES: Record<PageId, ComponentType> = {
  chat: ChatPage,
  quiz: QuizPage,
  review: ReviewPage,
  dashboard: DashboardPage,
  textbook: TextbookPage,
  settings: SettingsPage
}

const PAGE_LABELS: Record<PageId, string> = {
  chat: '对话页',
  quiz: '测验页',
  review: '复习页',
  dashboard: '仪表盘',
  textbook: '教材库',
  settings: '设置页'
}

export default function App() {
  const hydrate = useUiStore((s) => s.hydrate)
  const page = useUiStore((s) => s.page)
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const toggleLeft = useUiStore((s) => s.toggleLeft)
  const toggleRight = useUiStore((s) => s.toggleRight)
  const userRightOpen = useUiStore((s) => s.userRightOpen)
  const hydrated = useUiStore((s) => s.hydrated)
  const onboardingDone = useUiStore((s) => s.onboardingDone)
  const completeOnboarding = useUiStore((s) => s.completeOnboarding)
  const animate = useUiStore((s) => s.motionLevel !== 'minimal')

  const [width, setWidth] = useState(window.innerWidth)
  const [switchInfo, setSwitchInfo] = useState<{ label: string; desc: string } | null>(null)
  const prevMode = useRef(mode)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 全局快捷键(UI方案 3.3):Esc 中断生成;Ctrl+1/2/3 切模式;Ctrl+N 新会话;Ctrl+B/U 折叠左/右栏
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // P2-10:弹窗/菜单/下拉打开时 Esc 交给 Radix 关浮层,不连带中断生成
        if (e.defaultPrevented) return
        if (
          document.querySelector(
            '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[role="menu"][data-state="open"],[role="listbox"][data-state="open"]'
          )
        )
          return
        const st = useChatStore.getState()
        if (st.streaming) {
          st.abort()
          e.preventDefault()
        }
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === '1') {
        setMode('fast')
        e.preventDefault()
      } else if (k === '2') {
        setMode('standard')
        e.preventDefault()
      } else if (k === '3') {
        setMode('quality')
        e.preventDefault()
      } else if (k === 'n') {
        void useChatStore.getState().newSession(useUiStore.getState().mode)
        e.preventDefault()
      } else if (k === 'b') {
        toggleLeft()
        e.preventDefault()
      } else if (k === 'u') {
        toggleRight()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMode, toggleLeft, toggleRight])

  // 切模式提示行:中央区顶部出现,3 秒后淡出(UI方案 4.2)
  useEffect(() => {
    if (prevMode.current === mode) return
    prevMode.current = mode
    const def = modeById(mode)
    setSwitchInfo({ label: def.label, desc: def.methods.join(' + ') })
    const t = window.setTimeout(() => setSwitchInfo(null), 3000)
    return () => window.clearTimeout(t)
  }, [mode])

  // 响应式降级(3.2):≥1440 三段全开;1280–1440 右栏收起;仪表盘/设置页右栏自动收起
  const rightOpen = userRightOpen && width >= 1440 && page !== 'dashboard' && page !== 'settings'
  // 首启引导:hydrate 完成且未做过引导时接管主区(hydrate 前不渲染,防老用户闪现)
  const showOnboarding = hydrated && !onboardingDone
  const Page = PAGES[page]
  const wide = page === 'dashboard'
  const chat = page === 'chat'

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      <div className="flex h-screen flex-col overflow-hidden bg-paper-base text-ink-primary">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          {showOnboarding ? (
            <main className="min-w-0 flex-1 overflow-hidden">
              <OnboardingPage onComplete={completeOnboarding} />
            </main>
          ) : (
            <>
              <LeftRail />
              <main className="relative min-w-0 flex-1 overflow-y-auto">
            {/* 对话页自管通栏(会话头 52px + 消息列 760 居中,样张基准);其余页沿用内容容器 */}
            {chat ? (
              <ErrorBoundary key={page} label={PAGE_LABELS[page]}>
                <Page />
              </ErrorBoundary>
            ) : (
              <div className={`mx-auto w-full px-6 py-6 ${wide ? 'max-w-none' : 'max-w-[760px]'}`}>
                <AnimatePresence>
                  {switchInfo && (
                    <motion.div
                      key="mode-switch-info"
                      initial={animate ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="mb-2 text-center text-[13px] text-ink-secondary"
                    >
                      已切换为「{switchInfo.label}」——{switchInfo.desc}
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* 页面切换(《详细方案》7.2):旧页上移淡出、新页 spring 进入;popLayout 让旧页脱离文档流交接 */}
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={page}
                    initial={animate ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={animate ? { opacity: 0, y: -6 } : undefined}
                    transition={animate ? SPRING.default : { duration: 0.15 }}
                  >
                    <ErrorBoundary label={PAGE_LABELS[page]}>
                      <Page />
                    </ErrorBoundary>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
            <button
              onClick={toggleRight}
              title={`${rightOpen ? '收起' : '展开'}上下文面板(Ctrl+U)`}
              className={`absolute right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-ink-tertiary transition-colors duration-[120ms] ease-out hover:bg-paper-sunken hover:text-ink-primary ${chat ? 'top-[60px]' : 'top-3'}`}
            >
              <PanelRightIcon size={16} />
            </button>
          </main>
              {rightOpen && <RightPanel />}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
