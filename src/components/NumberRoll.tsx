import { useEffect, useRef } from 'react'
import { DURATION, type MotionLevel } from '../styles/motion-tokens'

// 数字滚动计数:rAF 直改 textContent,不 setState(UI方案 4.4)
export default function NumberRoll({ value, playKey, level }: { value: number; playKey: number; level: MotionLevel }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (level === 'minimal') {
      el.textContent = String(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number): void => {
      const p = Math.min(1, (t - t0) / DURATION.draw)
      const e = 1 - Math.pow(1 - p, 3)
      el.textContent = String(Math.round(value * e))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playKey, level, value])

  return (
    <span ref={ref} className="inline-block min-w-[3ch] font-mono tabular-nums">
      0
    </span>
  )
}
