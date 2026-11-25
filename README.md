# 乐小恩

一个 Electron + TypeScript 桌面应用，包含主进程、渲染进程、本地服务与提示词配置。

## 开发

```bash
npm install
npm run dev
```

复制 `.env.local.example` 为 `.env.local`，填入自己的 `MAIN_VITE_DEEPSEEK_KEY`。真实密钥不会入库。

## 构建

```bash
npm run build
```

## 目录

- `electron/`：主进程与预加载
- `src/`：渲染层
- `server/` / `shared/`：本地服务与共享类型
- `prompts/` / `knowledge/`：提示词与知识库

## 许可

MIT
