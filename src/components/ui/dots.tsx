// Submit States 三态按钮的「进行中」点阵(kinetics: Submit States)
// 三点相位弹跳;无障碍 minimal 档降级为静态点
import { motion, useReducedMotion } from 'motion/react'

export default function DotsLoader({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion()
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="status" aria-label="进行中">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-current"
          animate={reduced ? { opacity: [0.35, 0.9, 0.35] } : { y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={reduced ? { duration: 1, repeat: Infinity } : { duration: 0.7, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}
