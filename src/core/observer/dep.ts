import config from '../config'
import { DebuggerOptions, DebuggerEventExtraInfo } from 'v3'

let uid = 0

const pendingCleanupDeps: Dep[] = []

export const cleanupDeps = () => {
  for (let i = 0; i < pendingCleanupDeps.length; i++) {
    const dep = pendingCleanupDeps[i]
    dep.subs = dep.subs.filter(s => s)
    dep._pending = false
  }
  pendingCleanupDeps.length = 0
}

/**
 * @internal
 */
// 被用来检查是否有当前正在执行的观察者，如果有，就将这个观察者添加到依赖列表中
// watcher 类是实现 depTarget 接口
export interface DepTarget extends DebuggerOptions {
  id: number
  addDep(dep: Dep): void
  update(): void
}

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * @internal
 */
// dep 是一个可观察对象，可以有多个指令指向它
// dep 是一个依赖管理器，负责管理某个数据的依赖数据
export default class Dep {
  // 静态属性
  static target?: DepTarget | null  
  id: number
  subs: Array<DepTarget | null>
  // pending subs cleanup
  _pending = false

  constructor() {
    this.id = uid++
    // subs 数据用于存放依赖
    this.subs = []
  }
  // 新增依赖
  addSub(sub: DepTarget) {
    this.subs.push(sub)
  }
  // 删除依赖，并在下一次程序冲洗时清空
  removeSub(sub: DepTarget) {
    // #12696 deps with massive amount of subscribers are extremely slow to
    // clean up in Chromium
    // to workaround this, we unset the sub for now, and clear them on
    // next scheduler flush.
    this.subs[this.subs.indexOf(sub)] = null
    if (!this._pending) {
      this._pending = true
      pendingCleanupDeps.push(this)
    }
  }
  // 添加一个依赖
  depend(info?: DebuggerEventExtraInfo) {
    if (Dep.target) {
      // 将当前的值放在 dep.target 中
      Dep.target.addDep(this)
      if (__DEV__ && info && Dep.target.onTrack) {
        Dep.target.onTrack({
          effect: Dep.target,
          ...info
        })
      }
    }
  }
  // 通知所有依赖更新
  notify(info?: DebuggerEventExtraInfo) {
    // stabilize the subscriber list first
    // 确定订阅者名单
    const subs = this.subs.filter(s => s) as DepTarget[]
    if (__DEV__ && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 排序
      subs.sort((a, b) => a.id - b.id)
    }
    // 遍历所有的依赖，执行对应的update方法
    for (let i = 0, l = subs.length; i < l; i++) {
      const sub = subs[i]
      if (__DEV__ && info) {
        sub.onTrigger &&
          sub.onTrigger({
            effect: subs[i],
            ...info
          })
      }
      sub.update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// 当前值的 observer 正在被评估，这是全局唯一事件
Dep.target = null
const targetStack: Array<DepTarget | null | undefined> = []

export function pushTarget(target?: DepTarget | null) {
  targetStack.push(target)
  // 让当前的 target 成为全局唯一的 target
  Dep.target = target
}

export function popTarget() {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
