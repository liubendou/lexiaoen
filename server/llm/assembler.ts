// 五层消息架构(《详细方案》4.3,缓存生命线):
// L0 core.md 逐字节固定 | L1 模式 skill 会话内固定 | L2 学习者画像会话快照
// L3 对话历史严格 append-only | L4 本轮 RAG(M3 接入)+ 新问题(已在 L3 尾部)
// 提示词经 ?raw 在构建期内联,运行时零 IO 且天然进打包产物

import coreMd from '../../prompts/core.md?raw'
import fastMd from '../../prompts/fast.md?raw'
import qualityMd from '../../prompts/quality.md?raw'
import standardMd from '../../prompts/standard.md?raw'
import type { ModeId } from '../../shared/ipc'
import type { LlmMessage } from './deepseek'
import { dashboardStats } from '../db/dashboard'
import { initDb } from '../db'

const SKILLS: Record<ModeId, string> = { fast: fastMd, standard: standardMd, quality: qualityMd }

/** M2 静态快照;M5 起由真实学习数据(答题/复习/对话)生成,仍是会话开始时定格 */
export function buildLearnerSnapshot(): string {
  try {
    const s = dashboardStats()
    const lines: string[] = ['学习者画像快照(会话内固定):']
    lines.push('- 启用科目:人体解剖学、生理学')
    lines.push(`- 连续学习 ${s.streak} 天;累计 ${s.usage.sessions} 次对话、${s.attempts} 次答题`)
    const anyData = s.mastery.some((m) => m.pct !== null)
    if (!anyData) lines.push('- 章掌握度:暂无答题数据')
    else {
      const weak = s.mastery
        .filter((m) => m.pct !== null && m.pct < 80)
        .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
        .slice(0, 3)
      lines.push(
        weak.length === 0
          ? '- 章掌握度:各章正确率均不低于80%,整体掌握良好'
          : `- 薄弱章:${weak.map((w) => `${w.title}(${w.pct}%)`).join('、')};涉及这些章的考点时先复述要点再展开,多给对比记忆`
      )
    }
    const wrongs = (
      initDb()
        .prepare(
          `SELECT COALESCE(n.title,'') AS t FROM quiz_attempts a LEFT JOIN syllabus_nodes n ON n.id = a.node_id
           WHERE a.correct = 0 ORDER BY a.created_at DESC LIMIT 12`
        )
        .all() as { t: string }[]
    )
      .map((w) => w.t)
      .filter(Boolean)
    const uniq = [...new Set(wrongs)].slice(0, 5)
    lines.push(uniq.length ? `- 近期错题:${uniq.join('、')};主动出题检验这些考点的掌握` : '- 近期错题:暂无')
    lines.push(`- 复习:卡池 ${s.review.total} 张,到期 ${s.review.due} 张,今日已复习 ${s.review.todayReviewed} 张`)
    return lines.join('\n')
  } catch {
    return '学习者画像快照(会话内固定):启用科目=人体解剖学、生理学;掌握度数据=暂无;近期错题=暂无。'
  }
}

/** P2-1:历史 token 预算(粗估 1 字符≈0.7 token);超出从最旧开始丢弃,防长会话超上下文必 400 */
const HISTORY_BUDGET_TOKENS = 24000

function estimateTokens(s: string): number {
  return Math.ceil(s.length * 0.7)
}

export function assembleMessages(opts: { mode: ModeId; learnerSnapshot: string; history: { role: 'user' | 'assistant'; content: string }[] }): LlmMessage[] {
  const system: LlmMessage[] = [
    { role: 'system', content: coreMd.trim() },
    { role: 'system', content: SKILLS[opts.mode].trim() },
    { role: 'system', content: opts.learnerSnapshot.trim() }
  ]
  const budget = Math.max(2000, HISTORY_BUDGET_TOKENS - system.reduce((n, m) => n + estimateTokens(m.content), 0))
  const kept: { role: 'user' | 'assistant'; content: string }[] = []
  let acc = 0
  for (let i = opts.history.length - 1; i >= 0; i -= 1) {
    const h = opts.history[i]
    const t = estimateTokens(h.content)
    // 最新一条始终保留(哪怕超预算),其余装不下即截断
    if (kept.length > 0 && acc + t > budget) break
    kept.unshift(h)
    acc += t
  }
  return [...system, ...kept.map((h) => ({ role: h.role, content: h.content }))]
}

/** 思考流仅本地展示与存库;组装下一轮请求时永不回传(《详细方案》4.3 / UI方案 4.2) */
export const REASONING_NOT_SENT_BACK = true
