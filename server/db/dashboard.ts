// M4 仪表盘聚合:掌握度按节点聚合到章(《详细方案》5.3/六-4)、连续打卡 streak、
// 未来 7 天到期分布(FSRS 遗忘曲线预测的离散视图)、token 成本与缓存命中率
// 数据量级(个人学习)很小,全部 JS 内存聚合,避免递归 SQL

import { initDb } from '.'

export interface ChapterMastery {
  chapterId: string
  title: string
  subject: 'anatomy' | 'physiology'
  total: number
  correct: number
  /** null = 该章尚无答题数据 */
  pct: number | null
}

export interface DashboardStats {
  streak: number
  attempts: number
  correct: number
  review: { total: number; due: number; todayReviewed: number }
  mastery: ChapterMastery[]
  /** dayOffset 0=今天,共 7 桶 */
  forecast: { dayOffset: number; count: number }[]
  usage: { promptTokens: number; completionTokens: number; cacheHit: number; cacheMiss: number; sessions: number }
}

function dayStr(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function dashboardStats(): DashboardStats {
  const db = initDb()

  // ---- 答题 + 章(建 知识点→章 映射) ----
  const attempts = db.prepare('SELECT node_id, correct FROM quiz_attempts').all() as { node_id: string | null; correct: number }[]
  const nodes = db
    .prepare('SELECT id, parent_id, level, title, subject, sort FROM syllabus_nodes ORDER BY sort, id')
    .all() as { id: string; parent_id: string | null; level: number; title: string; subject: 'anatomy' | 'physiology'; sort: number }[]
  const chapterOf = new Map<string, string>()
  // P2-7:任意层级 nodeId 归一到所属章——此前只归集 level-3,选「节」出题的作答不计入章掌握度
  for (const n of nodes) {
    if (n.level === 1) chapterOf.set(n.id, n.id)
    else if (n.level === 2 && n.parent_id) chapterOf.set(n.id, n.parent_id)
    else if (n.level === 3 && n.parent_id) {
      const sec = nodes.find((x) => x.id === n.parent_id)
      if (sec?.parent_id) chapterOf.set(n.id, sec.parent_id)
    }
  }
  const byChapter = new Map<string, { total: number; correct: number }>()
  let total = 0
  let correct = 0
  for (const a of attempts) {
    total += 1
    correct += a.correct
    if (!a.node_id) continue
    const chId = chapterOf.get(a.node_id)
    if (!chId) continue
    const agg = byChapter.get(chId) ?? { total: 0, correct: 0 }
    agg.total += 1
    agg.correct += a.correct
    byChapter.set(chId, agg)
  }
  const mastery: ChapterMastery[] = nodes
    .filter((n) => n.level === 1)
    .map((ch) => {
      const agg = byChapter.get(ch.id)
      return {
        chapterId: ch.id,
        title: ch.title,
        subject: ch.subject,
        total: agg?.total ?? 0,
        correct: agg?.correct ?? 0,
        pct: agg && agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : null
      }
    })

  // ---- streak:答题 + 复习的本地日期并集,自今天(或昨天)回溯 ----
  const days = new Set<string>()
  for (const r of db.prepare('SELECT reviewed_at FROM review_logs').all() as { reviewed_at: number }[]) days.add(dayStr(r.reviewed_at))
  for (const r of db.prepare('SELECT created_at FROM quiz_attempts').all() as { created_at: number }[]) days.add(dayStr(r.created_at))
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  let streak = 0
  if (days.has(dayStr(today.getTime())) || days.has(dayStr(today.getTime() - 86400000))) {
    let cursor = days.has(dayStr(today.getTime())) ? today.getTime() : today.getTime() - 86400000
    while (days.has(dayStr(cursor))) {
      streak += 1
      cursor -= 86400000
    }
  }

  // ---- 未来 7 天到期分布 ----
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const forecast = Array.from({ length: 7 }, (_, dayOffset) => ({ dayOffset, count: 0 }))
  const dues = db.prepare('SELECT due_ms FROM review_cards').all() as { due_ms: number }[]
  for (const r of dues) {
    const offset = Math.floor((r.due_ms - dayStart.getTime()) / 86400000)
    if (offset <= 0) forecast[0].count += 1
    else if (offset < 7) forecast[offset].count += 1
  }

  // ---- 复习统计(复用口径) ----
  const todayReviewed = (db.prepare('SELECT COUNT(*) AS c FROM review_logs WHERE reviewed_at >= ?').get(dayStart.getTime()) as { c: number }).c
  const due = (db.prepare('SELECT COUNT(*) AS c FROM review_cards WHERE due_ms <= ?').get(Date.now()) as { c: number }).c

  // ---- token / 缓存(全量消息聚合) ----
  const u = db
    .prepare(
      `SELECT COALESCE(SUM(prompt_tokens),0) AS p, COALESCE(SUM(completion_tokens),0) AS c,
              COALESCE(SUM(cache_hit),0) AS h, COALESCE(SUM(cache_miss),0) AS m
       FROM messages`
    )
    .get() as { p: number; c: number; h: number; m: number }
  const sessions = (db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n

  return {
    streak,
    attempts: total,
    correct,
    review: { total: dues.length, due, todayReviewed },
    mastery,
    forecast,
    usage: { promptTokens: u.p, completionTokens: u.c, cacheHit: u.h, cacheMiss: u.m, sessions }
  }
}
