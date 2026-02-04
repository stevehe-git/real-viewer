/**
 * 全局调试控制
 * 在浏览器控制台中可以通过 window.debug 访问调试功能
 */

import { debugManager, enableDebug, setDebugLogLevel, enableModuleDebug } from './debugManager'
import { tfDebugger } from './tfDebug'
import { renderDebugger } from './renderDebug'
import { panelDebugger } from './panelDebug'

// 全局调试接口
const globalDebugAPI = {
  // 启用/禁用调试
  enable: (enabled: boolean = true) => {
    enableDebug(enabled)
    console.log(`Debug ${enabled ? 'enabled' : 'disabled'}`)
  },

  // 设置日志级别
  setLevel: (level: 'none' | 'error' | 'warn' | 'info' | 'debug') => {
    setDebugLogLevel(level)
    console.log(`Debug log level set to: ${level}`)
  },

  // 启用/禁用模块调试
  enableModule: (module: string, enabled: boolean = true) => {
    enableModuleDebug(module, enabled)
    console.log(`Module '${module}' debug ${enabled ? 'enabled' : 'disabled'}`)
  },

  // 获取配置
  getConfig: () => {
    return debugManager.getConfig()
  },

  // 重置配置
  reset: () => {
    debugManager.resetConfig()
    console.log('Debug config reset')
  },

  // TF 调试
  tf: {
    // 显示统计信息
    stats: () => {
      tfDebugger.logStats()
    },
    // 获取统计信息
    getStats: () => {
      return tfDebugger.getStats()
    },
    // 重置统计信息
    reset: () => {
      tfDebugger.resetStats()
      console.log('TF stats reset')
    }
  },

  // 渲染调试
  render: {
    // 显示统计信息
    stats: () => {
      renderDebugger.logStats()
    },
    // 获取统计信息
    getStats: () => {
      return renderDebugger.getStats()
    },
    // 重置统计信息
    reset: () => {
      renderDebugger.resetStats()
      console.log('Render stats reset')
    }
  },

  // Panel 调试
  panel: {
    // 显示所有统计信息
    stats: (filterByType?: string) => {
      panelDebugger.logAllStats(filterByType as any)
    },
    // 按类型显示统计信息
    statsByType: (panelType: string) => {
      panelDebugger.logStatsByType(panelType as any)
    },
    // 获取统计信息
    getStats: (componentId?: string) => {
      return componentId 
        ? panelDebugger.getComponentStats(componentId)
        : panelDebugger.getPanelStats()
    },
    // 获取按类型分组的统计信息
    getStatsByType: () => {
      return panelDebugger.getStatsByType()
    },
    // 显示性能警告
    warnings: () => {
      panelDebugger.logPerformanceWarnings()
    },
    // 获取性能警告列表
    getWarnings: () => {
      return panelDebugger.getPerformanceWarnings()
    },
    // 获取渲染历史
    history: (limit?: number) => {
      return panelDebugger.getRenderHistory(limit)
    },
    // 导出统计信息
    export: () => {
      return panelDebugger.exportStats()
    },
    // 重置统计信息
    reset: (componentId?: string) => {
      panelDebugger.resetStats(componentId)
      console.log(componentId ? `Panel stats reset for ${componentId}` : 'All panel stats reset')
    }
  },

  // 快速启用所有调试
  enableAll: () => {
    enableDebug(true)
    enableModuleDebug('tf', true)
    enableModuleDebug('render', true)
    enableModuleDebug('panel', true)
    setDebugLogLevel('debug')
    console.log('All debug modules enabled')
  },

  // 快速禁用所有调试
  disableAll: () => {
    enableDebug(false)
    console.log('All debug modules disabled')
  },

  // 帮助信息
  help: () => {
    console.log(`
Debug API Usage:

  // 启用/禁用调试
  debug.enable(true)           // 启用全局调试
  debug.enable(false)          // 禁用全局调试

  // 设置日志级别
  debug.setLevel('debug')      // none | error | warn | info | debug

  // 启用/禁用模块调试
  debug.enableModule('tf', true)      // 启用 TF 调试
  debug.enableModule('render', true)  // 启用渲染调试
  debug.enableModule('panel', true)   // 启用 Panel 调试

  // 快速启用所有调试
  debug.enableAll()

  // 快速禁用所有调试
  debug.disableAll()

  // TF 调试
  debug.tf.stats()             // 显示 TF 统计信息
  debug.tf.getStats()          // 获取 TF 统计信息对象
  debug.tf.reset()             // 重置 TF 统计信息

  // 渲染调试
  debug.render.stats()          // 显示渲染统计信息
  debug.render.getStats()       // 获取渲染统计信息对象
  debug.render.reset()          // 重置渲染统计信息

  // Panel 调试
  debug.panel.stats()           // 显示所有 Panel 统计信息
  debug.panel.stats('LaserScan') // 显示指定类型的 Panel 统计信息
  debug.panel.statsByType('PointCloud') // 按类型显示统计信息
  debug.panel.getStats()        // 获取所有 Panel 统计信息
  debug.panel.getStats('componentId') // 获取指定组件的统计信息
  debug.panel.getStatsByType()  // 获取按类型分组的统计信息
  debug.panel.warnings()        // 显示性能警告
  debug.panel.getWarnings()     // 获取性能警告列表
  debug.panel.history(10)       // 获取最近10条渲染历史
  debug.panel.export()          // 导出统计信息
  debug.panel.reset()           // 重置所有 Panel 统计信息
  debug.panel.reset('componentId') // 重置指定组件的统计信息

  // 获取配置
  debug.getConfig()            // 获取当前调试配置

  // 重置配置
  debug.reset()                // 重置所有调试配置

Examples:
  debug.enableAll()            // 启用所有调试
  debug.tf.stats()             // 查看 TF 统计
  debug.render.stats()         // 查看渲染统计
  debug.panel.stats()          // 查看所有 Panel 统计
  debug.panel.stats('LaserScan') // 查看 LaserScan 类型的统计
  debug.panel.warnings()       // 查看性能警告
`)
  }
}

// 在浏览器环境中暴露全局调试 API
if (typeof window !== 'undefined') {
  ;(window as any).debug = globalDebugAPI
}

export default globalDebugAPI
