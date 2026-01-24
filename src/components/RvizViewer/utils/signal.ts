/**
 * Signal 工具函数
 * 完全基于 regl-worldview 的 signal.js 实现
 */

export type Signal<T> = {
  resolve: (value: T) => void
  reject: (error: any) => void
  promise: Promise<T>
}

export function signal<T = any>(): Signal<T> {
  let resolve: (value: T) => void
  let reject: (error: any) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    resolve: resolve!,
    reject: reject!,
    promise
  }
}
