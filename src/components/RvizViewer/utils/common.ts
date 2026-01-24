/**
 * 通用工具函数
 * 完全基于 regl-worldview 的 common.js 实现
 */

export function getNodeEnv(): string | undefined {
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV
}

/* eslint-disable no-undef */
export const inWebWorker = (): boolean =>
  typeof globalThis !== 'undefined' &&
  globalThis.postMessage &&
  typeof WorkerGlobalScope !== 'undefined' &&
  self instanceof WorkerGlobalScope
