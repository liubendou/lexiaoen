// 高亮客户端:主线程只投递/接收,等 HTML(《输出丝滑方案》3.2 预算表「高亮=0ms 主线程」)
// 结果按 code+lang 缓存,重复渲染/重发不重复高亮

import ShikiWorker from './shiki-worker?worker&inline'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, (html: string | null) => void>()
const cache = new Map<string, string | null>()
const CACHE_MAX = 200

function getWorker(): Worker {
  if (!worker) {
    worker = new ShikiWorker()
    worker.onmessage = (e: MessageEvent<{ id: number; html: string | null }>) => {
      const { id, html } = e.data
      const resolve = pending.get(id)
      pending.delete(id)
      resolve?.(html)
    }
  }
  return worker
}

export function highlight(code: string, lang: string): Promise<string | null> {
  const key = `${lang}\u0000${code}`
  const hit = cache.get(key)
  if (hit !== undefined) return Promise.resolve(hit)
  return new Promise((resolve) => {
    const id = ++seq
    pending.set(id, (html) => {
      if (cache.size >= CACHE_MAX) cache.clear()
      cache.set(key, html)
      resolve(html)
    })
    getWorker().postMessage({ id, code, lang })
  })
}
