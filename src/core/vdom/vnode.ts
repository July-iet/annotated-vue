import type { Component } from 'types/component'
import type { ComponentOptions } from 'types/options'
import type { VNodeComponentOptions, VNodeData } from 'types/vnode'

/**
 * @internal
 */
// VNode 类型
export default class VNode {
  tag?: string  // 标签名
  data: VNodeData | undefined
  children?: Array<VNode> | null  // 子节点
  text?: string // 文本
  elm: Node | undefined // 真实dom节点
  ns?: string 
  context?: Component // rendered in this component's scope
  key: string | number | undefined  // key
  componentOptions?: VNodeComponentOptions
  componentInstance?: Component // component instance
  parent: VNode | undefined | null // component placeholder node

  // strictly internal
  raw: boolean // contains raw HTML? (server only)
  isStatic: boolean // hoisted static node
  isRootInsert: boolean // necessary for enter transition check
  isComment: boolean // empty comment placeholder?
  isCloned: boolean // is a cloned node?
  isOnce: boolean // is a v-once node?
  asyncFactory?: Function // async component factory function 异步组件工厂函数
  asyncMeta: Object | void
  isAsyncPlaceholder: boolean
  ssrContext?: Object | void
  fnContext: Component | void // real context vm for functional nodes
  fnOptions?: ComponentOptions | null // for SSR caching
  devtoolsMeta?: Object | null // used to store functional render context for devtools
  fnScopeId?: string | null // functional scope id support
  isComponentRootElement?: boolean | null // for SSR directives

  constructor(
    tag?: string,
    data?: VNodeData,
    children?: Array<VNode> | null,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag  // 当前节点的 标签名
    this.data = data  // 当前节点对应的 对象，包含了具体的一些数据信息，是一个VNodeData类型，可以参考VNodeData类型中的数据信息
    this.children = children  // 当前节点的 子节点，是一个数组, 内部的值是 VNode 类型
    this.text = text  // 当前节点的 文本
    this.elm = elm  // 当前虚拟节点对应的 真实dom节点，Node 类型
    this.ns = undefined // 当前节点的 名字空间
    this.context = context  // 当前组件节点对应的 Vue实例
    this.fnContext = undefined  // 函数式组件对应的 Vue实例
    this.fnOptions = undefined  // 组件的 otpion 选项
    this.fnScopeId = undefined
    this.key = data && data.key // 节点的 key属性，被当作节点的标志，用以优化
    this.componentOptions = componentOptions  // 组件节点的 option 选项
    this.componentInstance = undefined  // 当前组件节点对应的 vue 组件的实例
    this.parent = undefined // 当前节点的 父节点
    this.raw = false  // 简而言之就是是否为原生HTML或只是普通文本，innerHTML的时候为true，textContent的时候为false
    this.isStatic = false // 静态节点标志
    this.isRootInsert = true  // 是否作为跟节点插入
    this.isComment = false  // 是否为注释节点
    this.isCloned = false // 是否为克隆节点
    this.isOnce = false // 是否有v-once指令
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child(): Component | void {
    return this.componentInstance
  }
}

// 创建注释节点
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text  // 文本内容
  node.isComment = true // 注释节点标志位
  return node
}

// 创建文本节点
export function createTextVNode(val: string | number) {
  // tag/data/children 都是 undefined，传入 text
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
// 克隆节点，用于模板编译优化
export function cloneVNode(vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true  // 唯一的不同点
  return cloned
}
