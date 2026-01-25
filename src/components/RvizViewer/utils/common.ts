/**
 * 通用工具函数
 * 完全基于 regl-worldview 的 common.js 实现
 */

export function getNodeEnv(): string | undefined {
  // @ts-ignore - process may not be defined in browser environment
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV
}

/* eslint-disable no-undef */
export const inWebWorker = (): boolean => {
  if (typeof globalThis === 'undefined') {
    return false
  }
  if (!globalThis.postMessage) {
    return false
  }
  // @ts-ignore - WorkerGlobalScope is not in TypeScript types
  return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope
}
