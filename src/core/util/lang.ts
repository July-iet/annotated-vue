/*
 * @Author: Jane
 * @Date: 2024-03-04 09:51:12
 * @LastEditTime: 2024-03-14 11:21:01
 * @Description: 
 */
/**
 * unicode letters used for parsing html tags, component names and property paths.
 * using https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * skipping \u10000-\uEFFFF due to it freezing up PhantomJS
 */
export const unicodeRegExp =
  /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/

/**
 * Check if a string starts with $ or _
 */
export function isReserved(str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5f
}

/**
 * Define a property.
 */
// 封装 Object.defineProperty ，只需要传入object和key，创建一个可读可写可配置的属性
export function def(obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 */
const bailRE = new RegExp(`[^${unicodeRegExp.source}.$_\\d]`)
// 将路径传入，例如：data{a{b{c:1}}}
// 参数 path = "a.b.c"; obj = data
export function parsePath(path: string): any {
  if (bailRE.test(path)) {
    return
  }
  // segments = [a,b,c]
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    // 逐层取值，最后返回 1
    return obj
  }
}
