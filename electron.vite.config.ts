import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// 目录结构遵循《详细方案》第八章：electron/ 主进程、src/ 渲染进程、server/ 本地服务层
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve('electron/main/index.ts') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve('electron/preload/index.ts') }
    }
  },
  renderer: {
    root: 'src',
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve('src') } },
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve('src/index.html') }
    }
  }
})
