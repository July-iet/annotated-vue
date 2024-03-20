import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string
  tokens: Array<string | { '@binding': string }>
}

export function parseText(
  text: string,   // 待解析的文本内容
  delimiters?: [string, string] // 包裹变量的符号
): TextParseResult | void {
  //@ts-expect-error
  // 用来检查文本中是否包含变量
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  if (!tagRE.test(text)) {
    return
  }
  const tokens: string[] = []
  const rawTokens: any[] = []
  // 先执行括号中的赋值，再将 tagRE.lastIndex 赋值给 lastIndex
  // tagRE.lastIndex 是 exec() 正则的游标
  let lastIndex = (tagRE.lastIndex = 0)
  let match, index, tokenValue
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      // 将 {{ 之前的文本放入 tokens中
      rawTokens.push((tokenValue = text.slice(lastIndex, index)))
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    // 取出匹配结果，用_s包裹起来存在tokeng中
    const exp = parseFilters(match[1].trim())
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    // 更新 lastIndex
    lastIndex = index + match[0].length
  }
  // 把剩下的匹配不上的文本加入token中
  if (lastIndex < text.length) {
    rawTokens.push((tokenValue = text.slice(lastIndex)))
    tokens.push(JSON.stringify(tokenValue))
  }
  // 最后将tokens元素连接
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
