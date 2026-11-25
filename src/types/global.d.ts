import type { LexiaoenApi } from '../../shared/ipc'

declare global {
  interface Window {
    lexiaoen: LexiaoenApi
  }
}

export {}
