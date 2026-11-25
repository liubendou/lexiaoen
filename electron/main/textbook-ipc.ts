// textbook:* IPC(M4 教材导入):选 PDF → pdfjs 提取文本 → 按页分块 → jieba 分词 → FTS5 索引
// 内容只进本地 SQLite,不上传(《详细方案》5.2 合规:用户自担内容用途)
// 首版取舍:解析在主进程同步执行(几百页教材秒级),导入期间渲染层按钮置 loading
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { insertChunks, insertDoc, listDocs, removeDoc, type TextbookDocRow } from '../../server/db/textbook'
import { tokenize } from '../../server/rag/tokenize'

/** 页文本 → ~500 字块(页级边界保留,引用可定位到 p.X);近乎空白的页丢弃 */
function chunkPage(page: number, text: string): { page: number; body: string }[] {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 30) return []
  const SIZE = 500
  const out: { page: number; body: string }[] = []
  for (let i = 0; i < t.length; i += SIZE) out.push({ page, body: t.slice(i, i + SIZE) })
  return out
}

interface PdfTextItem {
  str?: string
  hasEOL?: boolean
}
interface PdfDocumentProxy {
  numPages: number
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: PdfTextItem[] }> }>
  destroy(): Promise<void>
}

export function registerTextbookIpc(): void {
  ipcMain.handle('textbook:list', (): TextbookDocRow[] => listDocs())

  ipcMain.handle('textbook:remove', (_e, id: number) => removeDoc(Number(id)))

  ipcMain.handle('textbook:import', async (e): Promise<TextbookDocRow | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const pick = await dialog.showOpenDialog(win!, {
      title: '选择教材 PDF',
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (pick.canceled || !pick.filePaths[0]) return null
    const filePath = pick.filePaths[0]

    // pdfjs 懒加载:仅在首次导入时加载 legacy build(Node 无需 worker 配置)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = await readFile(filePath)
    const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise as PdfDocumentProxy
    const title = filePath.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') ?? '未命名教材'
    const maxPages = Math.min(doc.numPages, 500) // 首版上限:500 页,超出部分忽略

    const docId = insertDoc(title, doc.numPages)
    let batch: { page: number; body: string; tokenized: string }[] = []
    const flush = (): void => {
      if (batch.length) {
        insertChunks(docId, batch)
        batch = []
      }
    }
    try {
      for (let p = 1; p <= maxPages; p += 1) {
        const page = await doc.getPage(p)
        const tc = await page.getTextContent()
        const text = tc.items
          .map((it) => (it.str ?? '') + (it.hasEOL ? '\n' : ''))
          .join('')
        for (const c of chunkPage(p, text)) batch.push({ ...c, tokenized: tokenize(c.body) })
        if (batch.length >= 400) flush() // 分批落库,避免单事务过大
      }
      flush()
    } catch (e) {
      // P1-7:解析中途失败(损坏/加密 PDF)清理已插入的文档与分块,不留幽灵文档
      removeDoc(docId)
      throw e
    } finally {
      await doc.destroy().catch(() => {})
    }
    return listDocs().find((d) => d.id === docId) ?? null
  })
}
