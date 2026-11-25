// 复习编排:错题/知识卡入池 → FSRS 队列 → 四档评分回写
import { addReviewCard, insertReviewLog, reviewCardById, updateReviewCard, type ReviewCardRow } from '../db/study'
import { deserializeCard, newCard, schedule, serializeCard, type FsrsGrade } from './scheduler'

export function addWrongCard(questionId: number): number {
  const c = newCard()
  return addReviewCard('wrong', questionId, serializeCard(c), c.due.getTime())
}

export function addKnowledgeCard(cardId: number): number {
  const c = newCard()
  return addReviewCard('knowledge', cardId, serializeCard(c), c.due.getTime())
}

export interface GradeResult {
  id: number
  dueMs: number
  scheduledDays: number
}

export function gradeCard(rowId: number, grade: FsrsGrade): GradeResult {
  const row = reviewCardById(rowId)
  if (!row) throw new Error('复习卡不存在')
  const next = schedule(deserializeCard(row.fsrs), grade)
  updateReviewCard(rowId, serializeCard(next), next.due.getTime())
  insertReviewLog(rowId, grade)
  return { id: rowId, dueMs: next.due.getTime(), scheduledDays: next.scheduled_days }
}

export type { ReviewCardRow }
