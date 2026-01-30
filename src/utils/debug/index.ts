/**
 * 调试工具统一导出
 */

export * from './debugManager'
export * from './tfDebug'
export * from './renderDebug'
export { default as globalDebugAPI } from './globalDebug'

// 便捷导出
export {
  debugManager,
  enableDebug,
  setDebugLogLevel,
  enableModuleDebug,
  isModuleDebugEnabled
} from './debugManager'

export {
  tfDebugger,
  logTF
} from './tfDebug'

export {
  renderDebugger,
  logRender
} from './renderDebug'
