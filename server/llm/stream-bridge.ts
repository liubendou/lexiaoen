// 【粗平滑】主进程侧按 16ms 帧窗口聚合 token,把 IPC 消息数降低 10-50 倍
// 《输出丝滑方案》2.2:首帧立即 flush(保护 TTFT);end() 前必须 flush(否则丢尾字)

const FRAME_MS = 16

export type BridgeType = 'reasoning' | 'delta'

export interface BridgeWin {
  webContents: { send(channel: string, payload: unknown): void }
}

export class StreamBridge {
  private acc = ''
  private timer: NodeJS.Timeout | null = null
  private firstSent = false

  constructor(
    private win: BridgeWin,
    private reqId: string,
    private type: BridgeType,
    private channel = 'chat:event'
  ) {}

  push(chunk: string): void {
    this.acc += chunk
    if (!this.firstSent) {
      this.firstSent = true
      this.flush()
      return
    }
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, FRAME_MS)
  }

  /** 终态前调用:清空计时器并发出残余增量 */
  end(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.flush()
  }

  /** 仅清理计时器,不再发送(已 end 过的场合) */
  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private flush(): void {
    if (!this.acc) return
    const text = this.acc
    this.acc = ''
    this.win.webContents.send(this.channel, { reqId: this.reqId, type: this.type, text })
  }
}
