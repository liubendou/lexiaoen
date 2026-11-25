import { Fragment, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { AppInfo, KeyStatus } from '../../../shared/ipc'
import NumberRoll from '../../components/NumberRoll'
import { CheckIcon, CloseIcon } from '../../components/icons'
import { Button } from '../../components/ui/button'
import { LexAlertDialog } from '../../components/ui/dialog'
import { LexCollapsible, LexCollapsibleContent } from '../../components/ui/collapsible'
import { LexRadioGroup, LexRadioItem } from '../../components/ui/radio-group'
import { LexSwitch } from '../../components/ui/switch'
import { useUiStore } from '../../stores/ui'
import { useChatStore } from '../chat/chat-store'
import { SPRING, type MotionLevel } from '../../styles/motion-tokens'

const LEVEL_LABELS: Record<MotionLevel, string> = { full: '完整', reduced: '精简', minimal: '最少' }

function keyStatusLine(ks: KeyStatus | null): { ok: boolean; text: string } {
  if (!ks) return { ok: false, text: '正在读取 Key 状态…' }
  if (ks.mock) return { ok: true, text: 'Mock 演示模式(无 Key,输出为模拟内容)' }
  if (ks.source === 'builtin') return { ok: true, text: '内置 API Key 已就绪,无需设置' }
  if (ks.source === 'override') return { ok: true, text: '使用自定义 API Key' }
  return { ok: false, text: '未配置 API Key,对话功能不可用' }
}

export default function SettingsPage() {
  const motionLevel = useUiStore((s) => s.motionLevel)
  const setMotionLevel = useUiStore((s) => s.setMotionLevel)
  const systemReduced = useUiStore((s) => s.systemReduced)
  const minimal = motionLevel === 'minimal'
  const [playKey, setPlayKey] = useState(0)
  const [info, setInfo] = useState<AppInfo | null>(null)

  // API Key 区块(《详细方案》4.6):默认只显状态行,展开后输入+测试,测试通过才保存
  const keyStatus = useChatStore((s) => s.keyStatus)
  const refreshKeyStatus = useChatStore((s) => s.refreshKeyStatus)
  const [keyExpanded, setKeyExpanded] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [keyTesting, setKeyTesting] = useState(false)
  const [keyTest, setKeyTest] = useState<{ ok: boolean; message: string } | null>(null)

  const saveAndTest = async (): Promise<void> => {
    const key = keyInput.trim()
    if (!key || keyTesting) return
    setKeyTesting(true)
    setKeyTest(null)
    try {
      const r = await window.lexiaoen.chat.testKey(key)
      setKeyTest(r)
      if (!r.ok) return
    } catch {
      setKeyTest({ ok: false, message: '测试请求失败,请检查网络' })
      return
    } finally {
      setKeyTesting(false)
    }
    // P2-15:保存与测试拆开——测试已通过但保存失败时,不再误报「测试请求失败」
    try {
      await window.lexiaoen.chat.setOverrideKey(key)
      setKeyInput('')
      await refreshKeyStatus()
    } catch {
      setKeyTest({ ok: false, message: 'Key 已验证,但保存失败,请重试' })
    }
  }

  const revertToBuiltin = async (): Promise<void> => {
    // P2-15:失败不再静默成 unhandled rejection
    try {
      await window.lexiaoen.chat.setOverrideKey(null)
      await refreshKeyStatus()
    } catch {
      setKeyTest({ ok: false, message: '恢复内置 Key 失败,请重试' })
    }
  }

  // M5 记忆管理:学习者画像展示与清除(画像由学习数据实时聚合,清除后新会话从零开始)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState<'chat' | 'study' | null>(null)
  const loadSnapshot = (): void => {
    void window.lexiaoen.study.learnerSnapshot().then(setSnapshot).catch(() => setSnapshot('画像暂不可用'))
  }
  useEffect(loadSnapshot, [])
  const doClear = (): void => {
    if (!confirmClear) return
    const scope = confirmClear
    setConfirmClear(null)
    void window.lexiaoen.study
      .clearMemory(scope)
      .then(() => {
        loadSnapshot()
        // P1-5:清空对话历史后整体复位聊天 store,对话页与库立即同步(否则仍显示已删数据)
        if (scope === 'chat') useChatStore.getState().reset()
      })
      .catch(() => {
        // 清除失败:保持现状,画像刷新静默
      })
  }

  useEffect(() => {
    void window.lexiaoen.appInfo().then(setInfo)
  }, [])

  return (
    <div className="mx-auto max-w-[640px] space-y-8 pb-10">
      <h1 className="font-serif text-[24px] font-bold text-ink-primary">设置</h1>

      {/* 动效强度三档:RadioGroup(清单 5),选中即时预览(UI方案 5.7,本页最重要的交互) */}
      <section>
        <h2 className="border-b border-rule-hair pb-2 font-serif text-[17px] font-semibold text-ink-primary">动效强度</h2>
        <p className="mt-2 text-[13px] text-ink-tertiary">
          切换后全局即时生效,无需重启
          {systemReduced && ';系统已开启「减弱动态效果」,当前强制为最少'}
        </p>
        <LexRadioGroup
          value={motionLevel}
          onValueChange={(v) => setMotionLevel(v as MotionLevel)}
          className="mt-3"
        >
          {(['full', 'reduced', 'minimal'] as const).map((lv) => (
            <LexRadioItem
              key={lv}
              value={lv}
              label={LEVEL_LABELS[lv] + (systemReduced && lv === 'minimal' ? '(已跟随系统)' : '')}
              disabled={systemReduced}
            />
          ))}
        </LexRadioGroup>
        <div className="mt-4 flex items-center gap-6 rounded-md border border-rule-hair bg-paper-raised p-4">
          <FlipPreview level={motionLevel} playKey={playKey} />
          <div>
            <div className="text-[13px] text-ink-secondary">掌握度示例</div>
            <div className="mt-1 font-mono text-[36px] font-bold leading-none text-ink-primary">
              <NumberRoll value={100} playKey={playKey} level={motionLevel} />
              <span className="text-[20px]">%</span>
            </div>
          </div>
          <Button variant="secondary" className="ml-auto" onClick={() => setPlayKey((k) => k + 1)}>
            播放预览
          </Button>
        </div>
      </section>

      {/* 扩展包:样式实装、开关 M3+ 才生效(《详细方案》里程碑规划) */}
      <section>
        <h2 className="border-b border-rule-hair pb-2 font-serif text-[17px] font-semibold text-ink-primary">扩展包</h2>
        <p className="mt-2 text-[13px] text-ink-tertiary">按需启用扩展科目,启用后加入左侧科目树(M3+ 开放)</p>
        <div className="mt-1">
          {(
            [
              ['病理学', '包含题库与讲义,约 12MB'],
              ['药理学', '包含题库,约 9MB'],
              ['诊断学', '包含讲义,约 15MB']
            ] as [string, string][]
          ).map(([name, sub], i) => (
            <div key={name} className={`flex items-center justify-between gap-4 border-b border-rule-hair py-3 ${i === 2 ? 'border-b-0' : ''}`}>
              <div>
                <div className="text-[14px] leading-[1.4] text-ink-primary">{name}</div>
                <div className="mt-0.5 text-[12px] leading-[1.4] text-ink-tertiary">{sub}</div>
              </div>
              <LexSwitch checked={false} onCheckedChange={() => {}} disabled ariaLabel={`启用${name}`} />
            </div>
          ))}
        </div>
      </section>

      {/* API Key:Collapsible 原地展开(清单 6,高度展开动画走 .lex-collapse) */}
      <section>
        <h2 className="border-b border-rule-hair pb-2 font-serif text-[17px] font-semibold text-ink-primary">API</h2>
        {(() => {
          const line = keyStatusLine(keyStatus)
          return (
            <div className="mt-3 flex items-center gap-2 text-[14px] text-ink-primary">
              {line.ok ? <CheckIcon size={16} className="shrink-0 text-moss-500" /> : <CloseIcon size={16} className="shrink-0 text-vermilion-500" />}
              <span>{line.text}</span>
            </div>
          )
        })()}
        <LexCollapsible.Root open={keyExpanded} onOpenChange={setKeyExpanded}>
          <LexCollapsible.Trigger asChild>
            <button className="mt-1 cursor-pointer text-[13px] text-ink-tertiary transition-colors duration-[120ms] ease-out hover:text-ink-secondary">
              {keyExpanded ? '收起' : '使用自己的 Key'}
            </button>
          </LexCollapsible.Trigger>
          <LexCollapsibleContent>
            <div className="mt-2 border-l-2 border-rule-strong bg-paper-quote px-3 py-3">
              {/* Error Shake(kinetics):Key 校验失败时输入框衰减抖动 */}
              <motion.div
                animate={keyTest && !keyTest.ok && !minimal ? { x: [0, -9, 9, -6, 6, -2, 0] } : { x: 0 }}
                transition={keyTest && !keyTest.ok && !minimal ? { duration: 0.42, ease: 'easeOut' } : { duration: 0.15 }}
              >
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value)
                    setKeyTest(null)
                  }}
                  placeholder="sk-…"
                  spellCheck={false}
                  className="h-8 w-full rounded-sm border border-rule-hair bg-paper-raised px-3 font-mono text-[13px] text-ink-primary outline-none transition-colors duration-[120ms] ease-out focus:border-indigo-500"
                />
              </motion.div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button variant="primary" disabled={!keyInput.trim() || keyTesting} onClick={() => void saveAndTest()}>
                  {keyTesting ? '测试中…' : '保存并测试'}
                </Button>
                {keyStatus?.source === 'override' && (
                  <Button variant="ghost" className="px-0" onClick={() => void revertToBuiltin()}>
                    恢复内置 Key
                  </Button>
                )}
                {keyTest && (
                  <span className={`flex items-center gap-1 text-[13px] ${keyTest.ok ? 'text-moss-500' : 'text-vermilion-500'}`}>
                    {keyTest.ok ? <CheckIcon size={14} /> : <CloseIcon size={14} />}
                    {keyTest.message}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[12px] leading-[1.6] text-ink-tertiary">自定义 Key 仅保存在本地数据库,不会上传;测试通过后才会保存</p>
            </div>
          </LexCollapsibleContent>
        </LexCollapsible.Root>
      </section>

      {/* 数据与存储(M5 记忆管理):画像只读展示 + 清除(画像由学习数据实时聚合) */}
      <section>
        <h2 className="border-b border-rule-hair pb-2 font-serif text-[17px] font-semibold text-ink-primary">数据与存储</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-tertiary">
          学习者画像由你的答题、复习与对话记录自动生成,每次新对话作为 AI 的背景记忆;清除后新会话从零开始,已生成的会话不受影响
        </p>
        <div className="mt-3 rounded-md border border-rule-hair bg-paper-quote p-4">
          {snapshot === null ? (
            <p className="text-[13px] text-ink-tertiary">画像载入中…</p>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-[1.8] text-ink-secondary">{snapshot}</pre>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="secondary" onClick={() => setConfirmClear('chat')}>
            清空对话历史
          </Button>
          <Button variant="secondary" onClick={() => setConfirmClear('study')}>
            清空学习记录
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={loadSnapshot}>
            刷新画像
          </Button>
        </div>
      </section>

      <section>
        <h2 className="border-b border-rule-hair pb-2 font-serif text-[17px] font-semibold text-ink-primary">关于</h2>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 text-[13px]">
          {(
            [
              ['版本', info ? info.app : '—'],
              ['Electron', info ? `${info.electron} x64` : '—'],
              ['平台', info ? `${info.platform} · Node ${info.node}` : '—'],
              ['开源许可 / 插图', '插图:Servier Medical Art · CC BY 4.0']
            ] as [string, string][]
          ).map(([k, v]) => (
            <Fragment key={k}>
              <span className="text-ink-tertiary">{k}</span>
              <span className="font-mono tabular-nums text-ink-secondary">{v}</span>
            </Fragment>
          ))}
        </div>
      </section>

      {/* 清除确认(M5):两类记录分开警示,不可恢复 */}
      <LexAlertDialog
        open={confirmClear !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmClear(null)
        }}
        title={confirmClear === 'chat' ? '清空全部对话历史?' : '清空全部学习记录?'}
        description={
          confirmClear === 'chat'
            ? '所有会话与消息将被删除,不可恢复;教材索引与复习卡不受影响。'
            : '答题记录、复习日志与复习卡池将被删除,不可恢复;知识卡内容与教材索引保留。'
        }
        actionLabel="清空"
        onAction={doClear}
      />
    </div>
  )
}

// 动效预览:翻面按三档白名单表现(UI方案 7.4)——完整=3D 翻面,精简=交叉淡入,最少=瞬时
function FlipPreview({ level, playKey }: { level: MotionLevel; playKey: number }) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (playKey > 0) setFlipped((f) => !f)
  }, [playKey])

  const label = flipped ? '背面 · 答案' : '正面 · 问题'
  const rot = flipped ? 180 : 0

  if (level === 'reduced') {
    return (
      <motion.div
        key={`${playKey}-${label}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex h-[84px] w-[120px] items-center justify-center rounded-md border border-rule-hair bg-paper-raised font-serif text-[15px] text-ink-primary"
      >
        {label}
      </motion.div>
    )
  }

  const Face = ({ back }: { back: boolean }) => (
    <div
      style={{
        backfaceVisibility: 'hidden',
        transform: back ? 'rotateY(180deg)' : undefined,
        position: 'absolute',
        inset: 0
      }}
      className="flex items-center justify-center rounded-md border border-rule-hair bg-paper-raised font-serif text-[15px] text-ink-primary"
    >
      {back ? '背面 · 答案' : '正面 · 问题'}
    </div>
  )

  return (
    <div className="relative h-[84px] w-[120px]" style={{ perspective: 600 }}>
      {level === 'minimal' ? (
        <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d', transform: `rotateY(${rot}deg)` }}>
          <Face back={false} />
          <Face back={true} />
        </div>
      ) : (
        <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: rot }} transition={SPRING.default}>
          <Face back={false} />
          <Face back={true} />
        </motion.div>
      )}
    </div>
  )
}
