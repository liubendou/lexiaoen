// 极简类名合并:ui/ 组件内部拼条件类用
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')
