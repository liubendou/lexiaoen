declare module '*.md?raw' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  /** DeepSeek API key:构建时经 .env.local 注入主进程,永不进入渲染进程(《详细方案》4.6) */
  readonly MAIN_VITE_DEEPSEEK_KEY?: string
  readonly MAIN_VITE_DEEPSEEK_BASE_URL?: string
  readonly MAIN_VITE_DEEPSEEK_MODEL_FAST?: string
  readonly MAIN_VITE_DEEPSEEK_MODEL_PRO?: string
}
