import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookArt } from '../../components/illustrations'
import EmptyState from '../../components/EmptyState'
import { ChevronDownIcon, MoreIcon, PlayIcon, PlusIcon, PencilIcon, StopIcon, TrashIcon } from '../../components/icons'
import { ModeIcon } from '../../components/ModeSwitcher'
import { Button } from '../../components/ui/button'
import { LexDialog, LexAlertDialog } from '../../components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuSeparator } from '../../components/ui/menu'
import { LexToast, ToastProvider, ToastViewport } from '../../components/ui/toast'
import { LexTooltip } from '../../components/ui/tooltip'
import { MODES, modeById } from '../../data/modes'
import { useUiStore } from '../../stores/ui'
import { useChatStore } from './chat-store'
import { SPRING } from '../../styles/motion-tokens'
import { AiMessage, SourcesRow, UserBubble } from './MessageView'
import { StreamedMarkdown } from './MarkdownView'
import ThinkingBlock from './ThinkingBlock'
import { useStreamedText } from './streamed-text'

export default function ChatPage() {
  const uiMode = useUiStore((s) => s.mode)
  const minimal = useUiStore((s) => s.motionLevel === 'minimal')
  const setPage = useUiStore((s) => s.setPage)
  const sessions = useChatStore((s) => s.sessions)
  const currentId = useChatStore((s) => s.currentId)
  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const ephem = useChatStore((s) => s.ephem)
  const keyStatus = useChatStore((s) => s.keyStatus)
  const sendError = useChatStore((s) => s.sendError)
  const send = useChatStore((s) => s.send)
  const abort = useChatStore((s) => s.abort)
  const clearSendError = useChatStore((s) => s.clearSendError)
  const renameSession = useChatStore((s) => s.renameSession)
  const newSession = useChatStore((s) => s.newSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const selectSession = useChatStore((s) => s.selectSession)

  const current = sessions.find((s) => s.id === currentId) ?? null
  const mode = current?.mode ?? uiMode

  const [input, setInput] = useState('')
  const [pinned, setPinned] = useState(true)
  const pinnedRef = useRef(true)
  pinnedRef.current = pinned
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // 浮层三态:菜单 / 重命名 / 删除确认(R1 清单 1/2/3,全 Radix 行为层)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  // 错误提示升级为底部 Toast(R3 清单 9)
  const [toastOpen, setToastOpen] = useState(false)
  useEffect(() => {
    if (sendError) setToastOpen(true)
  }, [sendError])

  // 停止生成即时反馈:点击后按钮变「正在停止…」,流清空后自动复位
  const [stopping, setStopping] = useState(false)
  useEffect(() => {
    if (!streaming) setStopping(false)
  }, [streaming])

  // 生成中切换会话被拦截时的可见提示(此前是静默忽略,用户以为按钮坏了)
  const [busyHint, setBusyHint] = useState(false)

  useEffect(() => {
    void useChatStore.getState().hydrate()
  }, [])

  // 滚动贴底:容差 24px;流式期间 instant(UI方案 5.2 / 丝滑方案 3.3)
  const scrollBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
  }, [])
  useEffect(() => {
    if (pinned) scrollBottom()
  }, [messages.length, streaming?.reqId, streaming?.phase, scrollBottom])
  useEffect(() => {
    if (!ephem) return
    return ephem.text.subscribe(() => {
      if (pinnedRef.current) scrollBottom()
    })
  }, [ephem, scrollBottom])
  const onScroll = (): void => {
    const el = scrollRef.current
    if (!el) return
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 24)
  }

  // 输入框自适应高度,上限 8 行(UI方案 四 Input/Textarea)
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 8 * 26)}px`
  }, [input])

  const submit = (): void => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    void send(text, uiMode)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== 'Enter') return
    if (e.nativeEvent.isComposing) return
    if (!e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault()
      submit()
    }
  }

  const openRename = (): void => {
    if (!current) return
    setTitleDraft(current.title)
    setRenameOpen(true)
  }
  const commitRename = (): void => {
    if (current && titleDraft.trim()) void renameSession(current.id, titleDraft.trim().slice(0, 40))
    setRenameOpen(false)
  }

  const empty = !streaming && messages.length === 0
  const def = modeById(mode)

  return (
    <ToastProvider>
      <div className="flex h-full min-h-0 flex-col">
        {/* 会话头(通栏 52px,样张基准) */}
        <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-rule-hair px-4">
          <div className="flex min-w-0 items-center gap-2">
            <ModeIcon id={def.id} color={def.color} />
            <span className="shrink-0 text-[12px] text-ink-tertiary">{def.label}模式</span>
            <span className="text-[12px] text-ink-tertiary">·</span>
            <span className="min-w-0 truncate text-[15px] font-medium text-ink-primary">{current?.title ?? '新对话'}</span>
            {keyStatus?.mock && (
              <span className="shrink-0 rounded-xs bg-ochre-100 px-1.5 py-px text-[11px] text-ochre-500">Mock 流(测试)</span>
            )}
          </div>

          {/* M5 会话管理显性化:新对话直给按钮;历史会话独立下拉(不再藏在 More 菜单里) */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Menu.Root>
              <Menu.Trigger asChild>
                <button
                  aria-label="历史会话"
                  className="flex h-8 cursor-pointer items-center gap-1 rounded-sm border border-rule-strong bg-paper-raised px-2.5 text-[12.5px] text-ink-secondary transition-colors duration-[120ms] ease-out hover:bg-paper-sunken hover:text-ink-primary"
                >
                  <ChevronDownIcon size={13} />
                  历史
                </button>
              </Menu.Trigger>
              <MenuContent align="end" className="w-72">
                {sessions.length === 0 && <div className="px-2.5 py-2 text-[12px] text-ink-tertiary">暂无历史会话</div>}
                <div className="max-h-72 overflow-y-auto">
                  {sessions.map((s) => {
                    const md = modeById(s.mode)
                    const isCur = s.id === currentId
                    return (
                      <MenuItem key={s.id} className={isCur ? 'bg-indigo-50 font-medium' : undefined} onSelect={() => (streaming ? setBusyHint(true) : void selectSession(s.id))}>
                        <ModeIcon id={md.id} color={md.color} />
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-tertiary">
                          {new Date(s.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </MenuItem>
                    )
                  })}
                </div>
              </MenuContent>
            </Menu.Root>
            <motion.button
              whileTap={streaming ? undefined : { scale: 0.97 }}
              transition={SPRING.snappy}
              onClick={() => (streaming ? setBusyHint(true) : void newSession(uiMode))}
              aria-label="新对话"
              className="flex h-8 cursor-pointer items-center gap-1 rounded-sm bg-indigo-500 px-2.5 text-[12.5px] font-medium text-ink-inverse transition-colors duration-[120ms] ease-out hover:bg-indigo-600 active:bg-indigo-700"
            >
              <PlusIcon size={14} />
              新对话
            </motion.button>
          </div>

          {/* 会话菜单:Radix DropdownMenu(键盘/焦点/Esc/原点缩放) */}
          <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Menu.Trigger asChild>
              <button
                aria-label="会话菜单"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-tertiary transition-colors duration-[120ms] hover:bg-paper-sunken hover:text-ink-primary"
              >
                <MoreIcon size={16} />
              </button>
            </Menu.Trigger>
            <MenuContent
              align="end"
              className="w-60"
              onKeyDown={(e) => {
                // 菜单内 Delete 直达删除确认(与样张快捷键标注一致)
                if (e.key === 'Delete' && current) {
                  e.preventDefault()
                  setMenuOpen(false)
                  setDeleteOpen(true)
                }
              }}
            >
              <MenuItem
                shortcut="Ctrl+N"
                icon={<PlusIcon size={14} />}
                onSelect={() => (streaming ? setBusyHint(true) : void newSession(uiMode))}
              >
                新会话
              </MenuItem>
              <MenuItem
                icon={<PencilIcon size={14} />}
                disabled={!current}
                onSelect={openRename}
              >
                重命名会话
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                danger
                icon={<TrashIcon size={14} />}
                disabled={!current}
                onSelect={() => (streaming ? setBusyHint(true) : setDeleteOpen(true))}
              >
                删除会话
              </MenuItem>
              <MenuSeparator />
              <div className="max-h-56 overflow-y-auto">
                {sessions.length === 0 && <div className="px-2.5 py-2 text-[12px] text-ink-tertiary">暂无历史会话</div>}
                {sessions.map((s) => {
                  const md = modeById(s.mode)
                  const isCur = s.id === currentId
                  return (
                    <MenuItem
                      key={s.id}
                      className={isCur ? 'bg-indigo-50 font-medium' : undefined}
                      onSelect={() => (streaming ? setBusyHint(true) : void selectSession(s.id))}
                    >
                      <ModeIcon id={md.id} color={md.color} />
                      <span className="truncate">{s.title}</span>
                    </MenuItem>
                  )
                })}
              </div>
            </MenuContent>
          </Menu.Root>
        </div>

        {/* 消息流 */}
        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          {empty ? (
            <EmptyState art={<BookArt />} title="开始第一个问题" desc="直接提问,或从左侧考纲树里挑一个知识点" />
          ) : (
            <div className="mx-auto max-w-[792px] px-4 pt-4">
              {messages.map((row, i) => (
                <div key={row.id}>
                  {row.role === 'user' ? (
                    <div className="mb-5">
                      {i > 0 && messages[i - 1].role !== 'user' && (
                        <div className="mb-3 font-mono text-[12px] tabular-nums text-ink-tertiary">
                          {new Date(row.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      <UserBubble text={row.content} />
                    </div>
                  ) : (
                    <AiMessage
                      row={row}
                      isLast={i === messages.length - 1 && !streaming}
                      streaming={!!streaming}
                      showTime={i > 0 && messages[i - 1].role !== 'assistant'}
                    />
                  )}
                </div>
              ))}
              {streaming && ephem && <StreamingBubble mode={mode} />}
            </div>
          )}
        </div>

        {/* 回到底部 */}
        <AnimatePresence>
          {!pinned && (messages.length > 0 || streaming) && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                setPinned(true)
                scrollBottom()
              }}
              className="absolute bottom-32 right-8 z-[10] rounded-full border border-rule-hair bg-paper-raised px-3 py-1.5 text-[12px] text-ink-secondary shadow-1 hover:text-ink-primary"
            >
              回到底部
            </motion.button>
          )}
        </AnimatePresence>

        {/* 输入区(通栏,sticky 底部;顶部渐隐遮罩是唯一允许的渐变) */}
        <div className="relative shrink-0 px-4 pb-4 pt-2">
          <div
            className="pointer-events-none absolute -top-7 left-0 right-0 h-7"
            style={{ background: 'linear-gradient(to bottom, rgba(250,248,244,0), #FAF8F4)' }}
          />
          <div className="rounded-md border border-rule-hair bg-paper-raised p-3">
            <textarea
              ref={taRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="输入问题,Enter 发送;先想一想再问,效果更好"
              className="w-full resize-none bg-transparent text-[16px] leading-[1.75] text-ink-primary outline-none placeholder:text-ink-disabled selectable"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-0.5 rounded-sm bg-paper-sunken p-0.5">
              {MODES.map((m) => {
                const on = m.id === uiMode
                return (
                  <LexTooltip key={m.id} content={`切换为${m.label}模式(将用于新会话)`} side="top">
                    <button
                      onClick={() => useUiStore.getState().setMode(m.id)}
                      className="relative flex cursor-pointer items-center rounded-xs px-2 py-1 text-[12px]"
                    >
                      {/* Tab Pill Glide(kinetics):选中指示 pill 测量目标宽度后滑动(layoutId 共享元素) */}
                      {on && !minimal && (
                        <motion.span layoutId="mode-pill" transition={SPRING.snappy} className="absolute inset-0 rounded-xs bg-paper-raised shadow-1" />
                      )}
                      {on && minimal && <span className="absolute inset-0 rounded-xs bg-paper-raised" />}
                      <span className="relative z-[1] flex items-center gap-1.5">
                        <ModeIcon id={m.id} color={m.color} size={12} />
                        <span className={on ? 'font-medium text-ink-primary' : 'text-ink-tertiary'}>{m.label}</span>
                      </span>
                    </button>
                  </LexTooltip>
                )
              })}
            </div>
              {streaming ? (
                <Button variant="secondary" disabled={stopping} onClick={() => { setStopping(true); abort() }}>
                  <StopIcon size={14} />
                  {stopping ? '正在停止…' : '停止生成'}
                </Button>
              ) : (
                <Button variant="primary" onClick={submit} disabled={!input.trim()}>
                  <PlayIcon size={13} />
                  发送
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 重命名弹窗:输入自动聚焦全选,Enter 确认 / Esc 取消 */}
      <LexDialog open={renameOpen} onOpenChange={setRenameOpen} title="重命名会话">
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
          maxLength={40}
          className="mt-3 h-8 w-full rounded-sm border border-indigo-500 bg-paper-raised px-2.5 text-[14px] text-ink-primary outline-none"
        />
        <div className="mt-2 text-[12px] text-ink-tertiary">Enter 确认,Esc 取消</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRenameOpen(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={!titleDraft.trim()} onClick={commitRename}>
            确认
          </Button>
        </div>
      </LexDialog>

      {/* 删除确认:AlertDialog 语义(外点不关),焦点落取消,失焦恢复 */}
      <LexAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除会话"
        description={`「${current?.title ?? ''}」及其全部消息将被永久删除,此操作不可恢复。`}
        actionLabel="删除"
        onAction={() => {
          if (current) void deleteSession(current.id)
        }}
      />

      {/* 错误 Toast:底部右下浮出,带「去设置」动作 */}
      <ToastViewport />
      <LexToast
        open={toastOpen}
        onOpenChange={(v) => {
          setToastOpen(v)
          if (!v) clearSendError()
        }}
        title="发送失败"
        description={sendError ?? undefined}
        actionLabel="去设置"
        onAction={() => setPage('settings')}
      />

      {/* 生成中切换会话的提示:此前静默忽略,用户以为按钮失灵 */}
      <LexToast
        open={busyHint}
        onOpenChange={setBusyHint}
        title="回答生成中"
        description="可点「停止生成」中断当前回答,再切换会话"
      />
    </ToastProvider>
  )
}

/** 流式气泡:乐观 user 气泡 + 思考三态 + 匀速吐字正文(订阅独立 store,不牵动历史列表) */
function StreamingBubble({ mode }: { mode: 'fast' | 'standard' | 'quality' }) {
  const streaming = useChatStore((s) => s.streaming)!
  const ephem = useChatStore((s) => s.ephem)!
  const retryNote = useChatStore((s) => s.retryNote)
  const text = useStreamedText(ephem.text)

  return (
    <>
      {streaming.optimisticUser && <UserBubble text={streaming.userText} />}
      <div className="mb-6 border-l-[3px] border-indigo-500 pl-4">
        <ThinkingBlock
          phase={streaming.phase === 'waiting' ? 'waiting' : streaming.phase === 'thinking' ? 'thinking' : 'done'}
          modeText={mode === 'fast' ? null : '正在组织讲解思路…'}
          reasonStore={ephem.reason}
          retryNote={retryNote}
          canExpand={streaming.phase !== 'thinking'}
        />
        {text && <StreamedMarkdown text={text} />}
        {streaming.phase === 'text' && <span className="cursor-blink" aria-hidden="true" />}
        {streaming.sources && streaming.sources.length > 0 && <SourcesRow sources={streaming.sources} />}
      </div>
    </>
  )
}
