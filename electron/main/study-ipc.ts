// study:*/review:* IPC(M3 学习层):考纲树、检索、测验生成、FSRS 复习队列
import { ipcMain } from 'electron'
import type { ReviewItem, SyllabusNode } from '../../shared/ipc'
import { cardById, insertQuizAttempt, listQuizQuestions, listSyllabus, reviewQueue, reviewStats } from '../../server/db/study'
import { dashboardStats } from '../../server/db/dashboard'
import { clearChatHistory, clearStudyRecords } from '../../server/db/chat'
import { buildLearnerSnapshot } from '../../server/llm/assembler'
import { addWrongCard, gradeCard } from '../../server/fsrs/service'
import { searchKnowledge } from '../../server/rag/search'
import { QuizError, generateQuiz } from '../../server/quiz/generate'

/** 复习行 → 渲染层 ReviewItem(联表取内容) */
function toReviewItem(row: { id: number; kind: 'wrong' | 'knowledge'; questionId: number | null; cardId: number | null; dueMs: number; fsrs: string }): ReviewItem {
  let reps = 0
  try {
    reps = (JSON.parse(row.fsrs) as { reps?: number }).reps ?? 0
  } catch {
    reps = 0
  }
  if (row.kind === 'wrong' && row.questionId != null) {
    const q = listQuizQuestions(500).find((x) => x.id === row.questionId) ?? null
    return { rowId: row.id, kind: row.kind, dueMs: row.dueMs, reps, question: q, knowledge: null }
  }
  if (row.kind === 'knowledge' && row.cardId != null) {
    const c = cardById(row.cardId)
    return {
      rowId: row.id,
      kind: row.kind,
      dueMs: row.dueMs,
      reps,
      question: null,
      knowledge: c
        ? { id: c.id, title: c.title, definition: c.definition, points: c.points, confusion: c.confusion, mnemonic: c.mnemonic, path: [] }
        : null
    }
  }
  return { rowId: row.id, kind: row.kind, dueMs: row.dueMs, reps, question: null, knowledge: null }
}

export function registerStudyIpc(): void {
  ipcMain.handle('study:syllabus', (): SyllabusNode[] => listSyllabus())

  ipcMain.handle('study:search', (_e, query: string, limit?: number) =>
    searchKnowledge(String(query ?? ''), Math.min(limit ?? 8, 20)).map((h) => ({
      cardId: h.card.id,
      title: h.card.title,
      definition: h.card.definition,
      points: h.card.points,
      path: h.path,
      rank: h.rank
    }))
  )

  ipcMain.handle('study:generate-quiz', async (_e, nodeId: string, count: number) => {
    try {
      return await generateQuiz({ nodeId, count })
    } catch (err) {
      const msg = err instanceof QuizError ? err.message : '生成失败,请重试'
      throw new Error(msg)
    }
  })

  ipcMain.handle('study:list-quiz', (_e, limit?: number) => listQuizQuestions(Math.min(limit ?? 50, 200)))

  ipcMain.handle('review:queue', (_e, limit?: number) =>
    reviewQueue(Math.min(limit ?? 40, 100)).map((r) =>
      toReviewItem({ id: r.id, kind: r.kind, questionId: r.questionId, cardId: r.cardId, dueMs: r.dueMs, fsrs: r.fsrs })
    )
  )

  ipcMain.handle('review:stats', () => reviewStats())

  ipcMain.handle('review:add-wrong', (_e, questionId: number) => addWrongCard(Number(questionId)))

  ipcMain.handle('review:grade', (_e, rowId: number, grade: 1 | 2 | 3 | 4) => gradeCard(Number(rowId), grade))

  ipcMain.handle('study:log-attempt', (_e, nodeId: string | null, qtype: string, bloom: string, correct: boolean) => {
    insertQuizAttempt(nodeId ?? null, String(qtype ?? ''), String(bloom ?? ''), Boolean(correct))
  })

  ipcMain.handle('dashboard:stats', () => dashboardStats())

  // M5 记忆管理:画像实时聚合展示;'chat' 清对话,'study' 清学习记录(答题/复习/卡池)
  ipcMain.handle('learner:snapshot', () => buildLearnerSnapshot())
  ipcMain.handle('learner:clear', (_e, scope: 'chat' | 'study') => {
    if (scope === 'chat') clearChatHistory()
    else clearStudyRecords()
  })
}
