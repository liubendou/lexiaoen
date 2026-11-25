// 考纲树共享缓存:左栏与测验页共用一次 IPC 拉取(M4 左栏真实考纲树接线)
import { create } from 'zustand'
import type { SyllabusNode } from '../../../shared/ipc'

interface SyllabusState {
  rows: SyllabusNode[]
  loaded: boolean
  /** 幂等拉取;失败时 loaded 仍置位,由调用方兜底提示 */
  load: () => Promise<void>
}

export const useSyllabusStore = create<SyllabusState>((set, get) => ({
  rows: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return
    set({ loaded: true })
    try {
      const rows = await window.lexiaoen.study.syllabus()
      set({ rows })
    } catch {
      // 拉取失败保持空数组,页面有自己的空态
    }
  }
}))
