// 流式文本的轻量通道:绕开 Zustand 全局订阅(《输出丝滑方案》2.4)
// 调度器每帧 emit 只唤醒订阅该 store 的组件

import { useSyncExternalStore } from 'react'

export interface StreamedTextStore {
  get: () => string
  emit: (delta: string) => void
  reset: () => void
  subscribe: (l: () => void) => () => void
}

export function createStreamedTextStore(): StreamedTextStore {
  let text = ''
  const listeners = new Set<() => void>()
  return {
    get: () => text,
    emit: (delta) => {
      text += delta
      listeners.forEach((l) => l())
    },
    reset: () => {
      text = ''
      listeners.forEach((l) => l())
    },
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    }
  }
}

export const useStreamedText = (store: StreamedTextStore): string => useSyncExternalStore(store.subscribe, store.get, store.get)
