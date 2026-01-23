/**
 * 全局选项管理模块
 * 负责全局选项的初始化和更新
 */
import type { GlobalOptions } from './types'

/**
 * 创建默认全局选项
 */
export function createDefaultGlobalOptions(): GlobalOptions {
  return {
    fixedFrame: 'map',
    backgroundColor: '#f8f7f7',
    frameRate: 30,
    defaultLight: true
  }
}

/**
 * 创建全局选项管理功能
 */
export function createGlobalOptionsManager(globalOptions: GlobalOptions) {
  // 更新全局选项
  const updateGlobalOptions = (options: Partial<GlobalOptions>) => {
    Object.assign(globalOptions, options)
  }

  return {
    updateGlobalOptions
  }
}
