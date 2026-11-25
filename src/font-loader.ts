// 思源宋体 SC Bold 子集异步注入(UI方案 169 行字体加载纪律):
// 不进首屏关键路径——首帧渲染完成后 idle 时才发起下载;
// 未加载完成时由 tokens.css --font-title 回退链('Songti SC','SimSun')承担,
// font-serif 已统一 1.4 行高,字体切换前后行盒一致,不允许布局跳动
import fontUrl from './assets/fonts/source-han-serif-sc-bold-subset.woff2?url'

export function injectSerifFont(): void {
  const start = (): void => {
    const face = new FontFace('Source Han Serif SC', `url(${fontUrl})`, { weight: '700', display: 'swap' })
    face
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => {
        /* 字体加载失败静默回退宋体,不打断应用 */
      })
  }
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 3000 })
  else setTimeout(start, 300)
}
