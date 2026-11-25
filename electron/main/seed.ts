// 首启种子导入:考纲树 + 知识卡入 SQLite 并建 FTS 索引(仅空库时执行一次)
// 考纲树为嵌套 JSON,父子关系由 insertSyllabusNodes 递归补齐
import seedCards from '../../knowledge/seed-cards.json'
import syllabusTree from '../../knowledge/hebei-syllabus.json'
import { initDb } from '../../server/db'
import { cardBody, ftsUpsert, insertCard, insertSyllabusNodes, nodePath, syllabusCount, type SeedCard, type SeedNode } from '../../server/db/study'
import { tokenize } from '../../server/rag/tokenize'

export function ensureSeeded(): void {
  if (syllabusCount() > 0) return
  // P2-6:播种整体包单事务——中途被杀则全部回滚,下次重启重新播种,不会永久缺卡
  const tx = initDb().transaction(() => {
    insertSyllabusNodes(syllabusTree as SeedNode[])
    for (const c of seedCards as SeedCard[]) {
      const id = insertCard(c)
      // FTS 标题含考纲路径(章/节/点),让"心脏""呼吸"这类章级词也能命中
      const pathTitles = nodePath(c.node).map((n) => n.title).join(' ')
      ftsUpsert(id, tokenize(`${pathTitles} ${c.title}`), tokenize(cardBody({
        id,
        nodeId: c.node,
        title: c.title,
        definition: c.definition,
        points: c.points,
        confusion: c.confusion ?? '',
        mnemonic: c.mnemonic ?? '',
        source: 'seed',
        createdAt: 0
      })))
    }
  })
  tx()
}
