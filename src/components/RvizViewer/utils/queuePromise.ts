/**
 * queuePromise 工具函数
 * 完全基于 regl-worldview 的 queuePromise.js 实现
 */
import { signal, type Signal } from './signal'

type QueuedFn<T extends (...args: any[]) => Promise<any>> = T & { currentPromise?: Promise<any> }

// Wait for the previous promise to resolve before starting the next call to the function.
export default function queuePromise<T extends (...args: any[]) => Promise<any>>(fn: T): QueuedFn<T> {
  // Whether we are currently waiting for a promise returned by `fn` to resolve.
  let calling = false
  // The list of calls made to the function was made while a call was in progress.
  const nextCalls: { args: any[]; promise: Signal<any> }[] = []

  function queuedFn(...args: any[]): Promise<any> {
    if (calling) {
      const returnPromise = signal()
      nextCalls.push({ args, promise: returnPromise })
      return returnPromise.promise
    }
    return start(...args)
  }

  function start(...args: any[]): Promise<any> {
    calling = true

    const promise = fn(...args).finally(() => {
      calling = false
      queuedFn.currentPromise = undefined
      if (nextCalls.length) {
        const { promise: nextPromise, args: nextArgs } = nextCalls.shift()!
        start(...nextArgs)
          .then((result) => nextPromise.resolve(result))
          .catch((error) => nextPromise.reject(error))
      }
    })
    queuedFn.currentPromise = promise

    return promise
  }

  return queuedFn as QueuedFn<T>
}
