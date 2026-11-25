import { create } from 'zustand'
import type { ModeId } from '../data/modes'
import type { MotionLevel } from '../styles/motion-tokens'

export type PageId = 'chat' | 'quiz' | 'review' | 'dashboard' | 'textbook' | 'settings'

interface UiState {
  page: PageId
  mode: ModeId
  motionLevel: MotionLevel
  /** 系统开了 prefers-reduced-motion 时强制 minimal 且不可改(UI方案 7.4) */
  systemReduced: boolean
  userRightOpen: boolean
  leftCollapsed: boolean
  hydrated: boolean
  /** 首启引导是否已完成(完成时写 settings.onboarding,不随 ui 持久化) */
  onboardingDone: boolean
  /** 左栏考纲节点点击 → 测验页预选(一次性消费,不持久化) */
  quizPreset: string | null
  setPage: (page: PageId) => void
  setQuizPreset: (nodeId: string | null) => void
  setMode: (mode: ModeId) => void
  setMotionLevel: (level: MotionLevel) => void
  toggleRight: () => void
  toggleLeft: () => void
  hydrate: () => Promise<void>
  completeOnboarding: (mode: ModeId) => void
}

interface PersistShape {
  page: PageId
  mode: ModeId
  motionLevel: MotionLevel
  userRightOpen: boolean
  leftCollapsed: boolean
}

// 动效默认 reduced(《输出丝滑方案》3.3 风险表:老板电脑性能未知)
const DEFAULTS: PersistShape = {
  page: 'chat',
  mode: 'standard',
  motionLevel: 'reduced',
  userRightOpen: true,
  leftCollapsed: false
}

let saveTimer: number | undefined

function scheduleSave(s: UiState): void {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const data: PersistShape = {
      page: s.page,
      mode: s.mode,
      motionLevel: s.motionLevel,
      userRightOpen: s.userRightOpen,
      leftCollapsed: s.leftCollapsed
    }
    void window.lexiaoen?.setSetting('ui', JSON.stringify(data))
  }, 400)
}

export const useUiStore = create<UiState>((set, get) => ({
  ...DEFAULTS,
  systemReduced: false,
  hydrated: false,
  onboardingDone: false,
  quizPreset: null,
  setPage: (page) => {
    set({ page })
    scheduleSave(get())
  },
  setQuizPreset: (quizPreset) => {
    set({ quizPreset })
  },
  setMode: (mode) => {
    set({ mode })
    scheduleSave(get())
  },
  setMotionLevel: (motionLevel) => {
    if (get().systemReduced) return
    set({ motionLevel })
    scheduleSave(get())
  },
  toggleRight: () => {
    set({ userRightOpen: !get().userRightOpen })
    scheduleSave(get())
  },
  toggleLeft: () => {
    set({ leftCollapsed: !get().leftCollapsed })
    scheduleSave(get())
  },
  completeOnboarding: (mode) => {
    set({ mode, onboardingDone: true })
    scheduleSave(get())
    void window.lexiaoen?.setSetting('onboarding', '1')
  },
  hydrate: async () => {
    try {
      const raw = await window.lexiaoen?.getSetting('ui')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistShape>
        // page 不恢复:启动固定回对话页(恢复上次页面会让用户误以为「自动跳转」)
        set({ ...DEFAULTS, ...parsed, page: 'chat' })
      }
      // 首启引导:写过 onboarding=1,或已有 ui 持久化(老用户升级),都不再弹
      const ob = await window.lexiaoen?.getSetting('onboarding')
      set({ onboardingDone: ob === '1' || !!raw })
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) set({ motionLevel: 'minimal', systemReduced: true })
    } catch {
      // 读取失败保持默认值
    } finally {
      set({ hydrated: true })
    }
  }
}))
