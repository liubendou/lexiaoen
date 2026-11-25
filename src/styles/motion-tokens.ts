// 全应用唯一动效常量来源(《输出丝滑方案》3.1 + 《UI方案》7.1)
// 禁止组件内散落魔法数字

export const SPRING = {
  /** 默认:位移/缩放/翻面。干脆但不弹过头 */
  default: { type: 'spring', stiffness: 260, damping: 30 },
  /** 轻柔:大面积面板、侧边栏、Modal、抽屉(R1 调档 260/26) */
  soft: { type: 'spring', stiffness: 260, damping: 26 },
  /** 果断:快交互控件(按钮按压/滑块/浮层小件,R1 定档 380/30) */
  snappy: { type: 'spring', stiffness: 380, damping: 30 }
} as const

/** 非 spring 的时长常量(opacity / clip-path / 描边这类无物理感的动画) */
export const DURATION = {
  micro: 120, // hover / 状态交叉淡入
  base: 200, // 淡入、折叠展开、按钮 loading 切换
  slow: 600, // 掌握度环描边、氛围细线
  draw: 800 // 遗忘曲线描边、数字滚动
} as const

export const MOTION_SCALE = { full: 1, reduced: 0.5, minimal: 0 } as const

export type MotionLevel = keyof typeof MOTION_SCALE
