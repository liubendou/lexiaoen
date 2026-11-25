// 知识库检索入口:query → jieba 分词 → FTS5 BM25 → 知识卡 + 考纲路径
// M4:buildRagContext 组装对话 L4 层(知识卡 + 教材命中,《详细方案》4.3)
import type { SourceRef } from '../../shared/ipc'
import { searchCards, type SearchHit } from '../db/study'
import { searchChunks } from '../db/textbook'
import { toMatchQuery, tokenize } from './tokenize'

export function searchKnowledge(query: string, limit = 8): SearchHit[] {
  const tokens = tokenize(query)
  if (!tokens) return []
  return searchCards(toMatchQuery(tokens), limit)
}

export interface RagContext {
  /** 拼进本轮最后一条 user 消息的参考块;空串 = 无命中 */
  block: string
  sources: SourceRef[]
}

/** 对话 L4 检索:知识卡 top2 + 教材 top4;输出顺序 = 知识卡在前、教材按 chunk id(缓存纪律) */
export function buildRagContext(question: string): RagContext {
  const tokens = tokenize(question)
  if (!tokens) return { block: '', sources: [] }
  const match = toMatchQuery(tokens)
  const cards = searchCards(match, 2)
  const chunks = searchChunks(match, 4)
  if (cards.length === 0 && chunks.length === 0) return { block: '', sources: [] }

  const parts: string[] = []
  const sources: SourceRef[] = []
  for (const c of cards) {
    parts.push(`[知识卡] ${c.path.join(' > ')} · ${c.card.title}\n${c.card.definition}`)
    sources.push({ kind: 'card', title: c.card.title, locator: c.path.join(' > ') })
  }
  for (const t of chunks) {
    parts.push(`[教材]《${t.docTitle}》第 ${t.page} 页\n${t.body}`)
    sources.push({ kind: 'textbook', title: t.docTitle, locator: `p.${t.page}` })
  }
  const block =
    `[教学参考资料]以下内容来自本地知识库与用户导入的教材,与问题相关时可作为依据,并自然标注出处:\n\n` +
    `${parts.join('\n\n')}\n\n[参考资料结束]\n\n`
  return { block, sources }
}
