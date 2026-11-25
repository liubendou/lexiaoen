/// <reference lib="webworker" />
// Shiki 高亮 Worker(内联打包为 blob,规避 file:// 协议的资源路径问题)
// JS 正则引擎:无 WASM 资源;静态导入语言白名单,使 worker 打成单块以便内联

import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubLightDefault from '@shikijs/themes/github-light-default'
import bash from '@shikijs/langs/bash'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import python from '@shikijs/langs/python'
import sql from '@shikijs/langs/sql'
import typescript from '@shikijs/langs/typescript'

const THEME = 'github-light-default' // UI方案 0.1 冲突一裁决:暖白纸面配 light 主题
const LANGS = { typescript, javascript, json, bash, python, sql } as const
// 常见别名映射:shiki core 不自带别名,模型输出常写 ts/js/py/sh
const ALIASES: Record<string, string> = { ts: 'typescript', js: 'javascript', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash' }

let highlighterPromise: ReturnType<typeof createHighlighterCore> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [githubLightDefault],
      langs: [typescript, javascript, json, bash, python, sql],
      engine: createJavaScriptRegexEngine()
    })
  }
  return highlighterPromise
}

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = async (e: MessageEvent<{ id: number; code: string; lang: string }>) => {
  const { id, code, lang } = e.data
  try {
    const h = await getHighlighter()
    const resolved = lang in LANGS ? lang : ALIASES[lang] ?? 'text'
    const html = h.codeToHtml(code, { lang: resolved, theme: THEME })
    ctx.postMessage({ id, html })
  } catch {
    ctx.postMessage({ id, html: null })
  }
}
