// 【细平滑】把主进程送来的成批文本,按帧匀速吐到 UI(《输出丝滑方案》2.3)
// 速率由积压量决定:积压多加速追、追平减速——这一行是「丝滑」与「一顿一停」的分界线

const TAU_DEFAULT = 0.25
const MIN_RATE = 20
const MAX_RATE = 800
const FORCE_FLUSH = 4096
const HIDDEN_FALLBACK = 50

const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' })
const toGraphemes = (s: string): string[] => Array.from(seg.segment(s), (x) => x.segment)

export interface SchedulerOptions {
  /** 期望消化积压的时间常数(秒);三模式:快速 0.18 / 标准 0.25 / 高质量 0.35 */
  tau?: number
  onEmit: (delta: string) => void
  onDone?: () => void
}

export class StreamScheduler {
  private backlog: string[] = []
  private budget = 0
  private last = 0
  private raf = 0
  private ending = false
  private fallback: ReturnType<typeof setInterval> | null = null
  private readonly tau: number

  constructor(private opts: SchedulerOptions) {
    this.tau = opts.tau ?? TAU_DEFAULT
  }

  push(text: string): void {
    this.backlog.push(...toGraphemes(text))
    this.start()
  }

  /** 调用于主进程 end 事件;积压消化完后触发 onDone */
  end(): void {
    this.ending = true
    this.start()
  }

  dispose(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.fallback) clearInterval(this.fallback)
    this.raf = 0
    this.fallback = null
  }

  private start(): void {
    // 只看 rAF:fallback 是长驻兜底,不能挡 rAF 重启(否则流中空窗后再 push 永远不吐)
    if (this.raf) return
    this.last = performance.now()

    const tick = (now: number): void => {
      // 钳制 dt:切回前台时 dt 可能是几秒,不钳制会一次性喷完积压
      const dt = Math.min((now - this.last) / 1000, 0.1)
      this.last = now
      this.drain(dt)
      if (this.backlog.length) {
        this.raf = requestAnimationFrame(tick)
        return
      }
      // 积压已空:ending 时收尾(dispose 清兜底定时器,允许下次 start);非 ending 时停 rAF 等 push
      this.raf = 0
      if (this.ending) {
        this.dispose()
        this.opts.onDone?.()
      }
    }
    this.raf = requestAnimationFrame(tick)

    // 后台/最小化时 rAF 暂停——低频定时器兜底保证流不断(只建一次,dispose 时清除)
    if (!this.fallback) {
      this.fallback = setInterval(() => {
        if (!this.raf || !document.hidden) return
        // hidden 页 setInterval 被 Chromium 钳到 ≥1s,必须按真实 elapsed 计 dt
        // (写死 0.05 会让 drain 慢 20 倍);钳 2s 防止极端节流下一次性喷完
        const now = performance.now()
        const dt = Math.min((now - this.last) / 1000, 2)
        this.last = now
        this.drain(dt)
        // rAF 挂起时 tick 永不执行,onDone 只能在兜底路径补发,否则后台完成永远卡在流式态
        if (this.ending && !this.backlog.length) {
          this.dispose()
          this.opts.onDone?.()
        }
      }, HIDDEN_FALLBACK)
    }
  }

  private drain(dt: number): void {
    const pending = this.backlog.length
    if (!pending) return
    const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, pending / this.tau))
    this.budget += rate * dt
    let n = Math.floor(this.budget)
    if (pending > FORCE_FLUSH) n = pending
    if (n <= 0) return
    this.budget -= n
    this.opts.onEmit(this.backlog.splice(0, n).join(''))
  }
}
