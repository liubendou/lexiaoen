// M4 教材导入数据层:文档/分块/FTS 索引(分词与知识卡同口径,注记 A)
// 《详细方案》4.3:RAG 分块按 chunk id 排序输出,不按相似度分数排,保证同轮检索逐字节一致(缓存生命线)

import { initDb } from '.'

export interface TextbookDocRow {
  id: number
  title: string
  pages: number
  chunks: number
  createdAt: number
}

export function insertDoc(title: string, pages: number): number {
  const r = initDb()
    .prepare('INSERT INTO textbook_docs (title, pages, chunks, created_at) VALUES (?, ?, 0, ?)')
    .run(title, pages, Date.now())
  return Number(r.lastInsertRowid)
}

export function listDocs(): TextbookDocRow[] {
  return (initDb()
    .prepare('SELECT id, title, pages, chunks, created_at FROM textbook_docs ORDER BY id DESC')
    .all() as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    title: r.title as string,
    pages: r.pages as number,
    chunks: r.chunks as number,
    createdAt: r.created_at as number
  }))
}

export function docCount(): number {
  return (initDb().prepare('SELECT COUNT(*) AS c FROM textbook_docs').get() as { c: number }).c
}

export function removeDoc(id: number): void {
  // FTS 行需显式删(虚拟表无 FK 级联)
  const db = initDb()
  const chunkIds = db.prepare('SELECT id FROM textbook_chunks WHERE doc_id = ?').all(id) as { id: number }[]
  const del = db.transaction(() => {
    for (const c of chunkIds) db.prepare('DELETE FROM textbook_fts WHERE chunk_id = ?').run(c.id)
    db.prepare('DELETE FROM textbook_docs WHERE id = ?').run(id)
  })
  del()
}

/** 批量写分块并更新文档块数;返回块数 */
export function insertChunks(docId: number, chunks: { page: number; body: string; tokenized: string }[]): number {
  const db = initDb()
  const tx = db.transaction(() => {
    const ins = db.prepare('INSERT INTO textbook_chunks (doc_id, page, body) VALUES (?, ?, ?)')
    const insFts = db.prepare('INSERT INTO textbook_fts (chunk_id, body) VALUES (?, ?)')
    for (const c of chunks) {
      const r = ins.run(docId, c.page, c.body)
      insFts.run(Number(r.lastInsertRowid), c.tokenized)
    }
    // P1-7:按真实累计数覆盖,而非当前批大小(分批 flush 曾把总块数覆盖成末批大小)
    db.prepare('UPDATE textbook_docs SET chunks = (SELECT COUNT(*) FROM textbook_chunks WHERE doc_id = ?) WHERE id = ?').run(docId)
  })
  tx()
  return chunks.length
}

export interface TextbookHit {
  chunkId: number
  docId: number
  docTitle: string
  page: number
  body: string
}

/** 教材检索:命中按 chunk id 升序输出(《详细方案》4.3 缓存纪律),limit 截断在排序后 */
export function searchChunks(matchQuery: string, limit = 4): TextbookHit[] {
  if (!matchQuery.trim()) return []
  const rows = initDb()
    .prepare(
      `SELECT c.id, c.doc_id, c.page, c.body, d.title AS doc_title
       FROM textbook_fts f
       JOIN textbook_chunks c ON c.id = f.chunk_id
       JOIN textbook_docs d ON d.id = c.doc_id
       WHERE textbook_fts MATCH ?
       ORDER BY f.rank
       LIMIT ?`
    )
    .all(matchQuery, limit * 3) as (Record<string, unknown> & { id: number })[]
  // rank 只用于粗筛召回,最终输出按 chunk id 排序(稳定字节序)
  return rows
    .sort((a, b) => a.id - b.id)
    .slice(0, limit)
    .map((r) => ({
      chunkId: r.id as number,
      docId: r.doc_id as number,
      docTitle: r.doc_title as string,
      page: r.page as number,
      body: r.body as string
    }))
}
