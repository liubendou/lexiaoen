import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useUiStore } from '../stores/ui'

// 统一空状态:物件线稿 + 宋体标题 + 说明 + 主操作;标题/说明依次 stagger 60ms(UI方案 6.1)
export default function EmptyState({
  art,
  title,
  desc,
  action
}: {
  art: ReactNode
  title: string
  desc: string
  action?: ReactNode
}) {
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <motion.div
        initial={minimal ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {art}
      </motion.div>
      <motion.h2
        initial={minimal ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.2, ease: 'easeOut' }}
        className="mt-4 font-serif text-[17px] font-semibold text-ink-primary"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={minimal ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.2, ease: 'easeOut' }}
        className="mt-1.5 max-w-[340px] text-[14px] leading-relaxed text-ink-secondary"
      >
        {desc}
      </motion.p>
      {action && (
        <motion.div
          initial={minimal ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.2, ease: 'easeOut' }}
          className="mt-5"
        >
          {action}
        </motion.div>
      )}
    </div>
  )
}
