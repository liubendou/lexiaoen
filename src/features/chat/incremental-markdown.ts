// 渐进 Markdown:已定稿块缓存,只解析尾部活动块(《输出丝滑方案》2.5)
// 冻结块一旦产生永不重解析 → 整体 O(N),破解长回答「越到后面越卡」

export interface MdSplit {
  /** 已冻结的块(每块只在产生时解析一次) */
  blocks: string[]
  /** 尾部活动块 */
  tail: string
  /** 全文围栏是否未配平(最后一个代码块处于未闭合中间态) */
  unbalanced: boolean
}

const FENCE_RE = /^[ \t]{0,3}```/gm

export class IncrementalMarkdown {
  private blocks: string[] = []
  private lastCut = 0

  update(full: string): MdSplit {
    const cut = this.findBoundary(full)
    if (cut > this.lastCut) {
      this.blocks.push(full.slice(this.lastCut, cut))
      this.lastCut = cut
    }
    return { blocks: this.blocks, tail: full.slice(this.lastCut), unbalanced: fencesUnbalanced(full) }
  }

  /** 返回安全切点:围栏配平且落在段落边界(\n\n) */
  private findBoundary(s: string): number {
    if (fencesUnbalanced(s)) {
      // 有未闭合围栏 → 退回到最后一个 ``` 之前
      const i = s.lastIndexOf('\n```')
      return i === -1 ? 0 : i
    }
    const i = s.lastIndexOf('\n\n')
    return i === -1 ? 0 : i + 2
  }
}

export function fencesUnbalanced(s: string): boolean {
  const n = s.match(FENCE_RE)?.length ?? 0
  return n % 2 !== 0
}
