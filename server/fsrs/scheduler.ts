// FSRS 调度封装(《详细方案》3.4):调度器用 ts-fsrs 开源库,不自研
// 卡片状态序列化进 SQLite review_cards.fsrs 列,due_ms 冗余列供队列索引
import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from 'ts-fsrs'

/** 四档评分:1=重来 2=困难 3=良好 4=容易(与 UI 文案一一对应) */
export type FsrsGrade = 1 | 2 | 3 | 4

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))

export function newCard(now = new Date()): Card {
  return createEmptyCard(now)
}

export function serializeCard(c: Card): string {
  return JSON.stringify({
    ...c,
    due: c.due.getTime(),
    last_review: c.last_review ? c.last_review.getTime() : null
  })
}

export function deserializeCard(json: string): Card {
  const raw = JSON.parse(json) as { due: number; last_review: number | null } & Record<string, unknown>
  return {
    ...raw,
    due: new Date(raw.due),
    last_review: raw.last_review ? new Date(raw.last_review) : null
  } as unknown as Card
}

/** 评分一次,返回新调度状态 */
export function schedule(card: Card, grade: FsrsGrade, now = new Date()): Card {
  return scheduler.next(card, now, grade as Grade).card
}

/** 下次到期与现在的间隔(毫秒),供 UI 展示"X 天后再见" */
export function intervalDays(card: Card): number {
  return card.scheduled_days
}
