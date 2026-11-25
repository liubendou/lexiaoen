// 题型中文名(河北专升本题型口径)
import type { QuizQType } from '../../../shared/ipc'

export const QTYPE_LABELS: Record<QuizQType, string> = {
  single: '单选',
  multiple: '多选',
  blank: '填空',
  term: '名词解释',
  short: '简答',
  essay: '论述',
  case: '病例分析'
}

export const GRADE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '重来',
  2: '困难',
  3: '良好',
  4: '容易'
}
