// jieba 中文预分词(《详细方案》工程注记 A):
// FTS5 unicode61 对中文整句无效,写入与查询前必须统一用本模块切词
// cutForSearch=搜索引擎模式,长词会同时产出 2 字子词(心肌梗死→心肌|梗死|心肌梗死),保证 2 字医学词可命中
import { Jieba } from '@node-rs/jieba'
import { dict } from '@node-rs/jieba/dict'

const jieba = Jieba.withDict(dict)

/** 高频虚词:索引与查询两端过滤,保持口径一致 */
const STOPWORDS = new Set([
  '的', '了', '和', '与', '或', '及', '在', '是', '对', '中', '为', '等', '之', '并', '其', '由', '从',
  '被', '把', '向', '于', '有', '不', '也', '都', '而', '则', '以', '还', '很', '更', '最', '这', '那',
  '什么', '怎么', '如何', '以及', '对于', '关于', '通过', '可以', '进行', '出现', '发生', '引起', '导致'
])

const TOKEN_RE = /^[\u4e00-\u9fa5A-Za-z0-9]+$/

/** 分词并空格拼接;丢弃虚词与单字节符号,>=2 字符保精度 */
export function tokenize(text: string): string {
  const words = jieba.cutForSearch(text, true).filter((w) => {
    if (!TOKEN_RE.test(w)) return false
    if (STOPWORDS.has(w)) return false
    return w.length >= 2 || /[A-Za-z0-9]/.test(w)
  })
  return [...new Set(words)].join(' ')
}

/** 组 FTS5 MATCH 表达式:词间 OR 保召回,bm25 排序保精度 */
export function toMatchQuery(tokenized: string): string {
  return tokenized
    .split(' ')
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(' OR ')
}
