/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'
import { ASTAttr, CompilerOptions } from 'types/compiler'

// Regular Expressions for parsing tags and attributes
// 属性匹配
const attribute =
  /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute =
  /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)  // 开始标签匹配
const startTagClose = /^\s*(\/?)>/  // 自闭合标签匹配
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`) // 结束标签匹配
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
// 注释节点匹配
const comment = /^<!\--/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) =>
  tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr(value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export interface HTMLParserOptions extends CompilerOptions {
  start?: (
    tag: string,
    attrs: ASTAttr[],
    unary: boolean,
    start: number,
    end: number
  ) => void
  end?: (tag: string, start: number, end: number) => void
  chars?: (text: string, start?: number, end?: number) => void
  comment?: (content: string, start: number, end: number) => void
}

export function parseHTML(html, options: HTMLParserOptions) {
  const stack: any[] = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        // 解析注释
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          // 若注释闭合
          if (commentEnd >= 0) {
            if (options.shouldKeepComment && options.comment) {
              // 如果需要保留注释，则创建注释类型的 AST 节点
              options.comment(
                html.substring(4, commentEnd),
                index,
                index + commentEnd + 3
              )
            }
            // 不保留注释则跳过"-->"，向后解析
            advance(commentEnd + 3)
            continue
          }
        }

        // https://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 解析条件注释
        // 先正则匹配条件注释
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')
          
          // 如果条件节点闭合，则从原本的html字符串中把条件注释截掉，不需要创建 AST 节点
          if (conditionalEnd >= 0) {
            // 继续向后解析
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        // 解析doctype
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          // 继续向后解析
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        // 解析元素标签
        const endTagMatch = html.match(endTag)
        // 若匹配成功，获得数组，否则得到null
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        // 解析元素标签
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          // 处理元素标签，转化成对应的 AST
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag =
        reCache[stackedTag] ||
        (reCache[stackedTag] = new RegExp(
          '([\\s\\S]*?)(</' + stackedTag + '[^>]*>)',
          'i'
        ))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (__DEV__ && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, {
          start: index + html.length
        })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()
  // 移动解析游标
  function advance(n) {
    index += n
    html = html.substring(n)
  }
  // 解析元素标签，返回匹配结果
  function parseStartTag() {
    // 匹配开始标签
    const start = html.match(startTagOpen)
    // 开始标签匹配成功，会返回一个数组，取start[1]为tagName
    if (start) {
      const match: any = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      // 向后解析
      advance(start[0].length)
      let end, attr
      // 匹配元素标签和结束标签
      while (
        !(end = html.match(startTagClose)) &&
        (attr = html.match(dynamicArgAttribute) || html.match(attribute))
      ) {
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      // 通过匹配结果判断当前元素是否是自闭合标签
      if (end) {
        match.unarySlash = end[1] // 非自闭合标签匹配结果中的end[1]为""，而自闭合标签匹配结果中的end[1]为"/"
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  // 处理元素的开始标签
  function handleStartTag(match) {
    const tagName = match.tagName // 开始标签的标签名
    const unarySlash = match.unarySlash // 是否为可闭合标签

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }
    
    const unary = isUnaryTag(tagName) || !!unarySlash // 是不是自闭合

    const l = match.attrs.length  // 属性长度
    const attrs: ASTAttr[] = new Array(l)
    // 循环处理提取出来的标签属性数组 match.attrs
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i] // 某个属性对象
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines =
        tagName === 'a' && args[1] === 'href'
          ? options.shouldDecodeNewlinesForHref
          : options.shouldDecodeNewlines
      attrs[i] = {  
        name: args[1],  // 标签属性的属性名
        value: decodeAttr(value, shouldDecodeNewlines)  // 标签属性的属性值
      }
      if (__DEV__ && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    // 如果非自闭合，入栈
    if (!unary) {
      stack.push({
        tag: tagName,
        lowerCasedTag: tagName.toLowerCase(),
        attrs: attrs,
        start: match.start,
        end: match.end
      })
      lastTag = tagName
    }
    // 如果是自闭合标签，调用 start 钩子函数并传入处理好的参数创建 AST 节点
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
  // 处理结束元素标签，调用 end 钩子函数
  function parseEndTag(tagName?: any, start?: any, end?: any) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (__DEV__ && (i > pos || !tagName) && options.warn) {
          options.warn(`tag <${stack[i].tag}> has no matching end tag.`, {
            start: stack[i].start,
            end: stack[i].end
          })
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
