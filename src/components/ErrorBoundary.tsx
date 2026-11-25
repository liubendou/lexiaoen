import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label: string
}

interface State {
  error: Error | null
}

/** 页面级错误边界(P2-11):渲染期异常不再整窗白屏——Electron 下没有刷新按钮可救 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error(`[${this.props.label}] 渲染异常:`, error)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="font-serif text-[16px] font-semibold text-ink-primary">{this.props.label}遇到了问题</p>
          <p className="max-w-[420px] text-[13px] leading-relaxed text-ink-secondary">
            页面渲染出错,但应用仍在运行。点击重试,或切换到其他页面再回来。
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="h-8 cursor-pointer rounded-sm bg-indigo-500 px-4 text-[13px] text-ink-inverse transition-colors duration-[120ms] ease-out hover:bg-indigo-600"
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
