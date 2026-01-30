/**
 * 调试管理器
 * 统一管理所有功能模块的调试开关和日志输出
 */

export interface DebugConfig {
  enabled: boolean
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug'
  modules: Record<string, boolean>
}

class DebugManager {
  private config: DebugConfig = {
    enabled: false,
    logLevel: 'info',
    modules: {}
  }

  // 从 localStorage 加载配置
  constructor() {
    this.loadConfig()
  }

  /**
   * 加载配置（从 localStorage）
   */
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('debug-config')
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) }
      }
    } catch (error) {
      console.warn('Failed to load debug config:', error)
    }
  }

  /**
   * 保存配置（到 localStorage）
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('debug-config', JSON.stringify(this.config))
    } catch (error) {
      console.warn('Failed to save debug config:', error)
    }
  }

  /**
   * 启用/禁用全局调试
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    this.saveConfig()
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: DebugConfig['logLevel']): void {
    this.config.logLevel = level
    this.saveConfig()
  }

  /**
   * 启用/禁用特定模块的调试
   */
  setModuleEnabled(module: string, enabled: boolean): void {
    this.config.modules[module] = enabled
    this.saveConfig()
  }

  /**
   * 检查模块是否启用调试
   */
  isModuleEnabled(module: string): boolean {
    if (!this.config.enabled) return false
    // 默认关闭，只有明确启用时才返回 true
    return this.config.modules[module] === true
  }

  /**
   * 检查是否应该输出指定级别的日志
   */
  shouldLog(level: 'error' | 'warn' | 'info' | 'debug'): boolean {
    if (!this.config.enabled) return false
    
    const levels: Record<string, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    }
    
    const currentLevel = levels[this.config.logLevel] ?? 2
    const targetLevel = levels[level] ?? 2
    
    return targetLevel <= currentLevel
  }

  /**
   * 获取配置
   */
  getConfig(): Readonly<DebugConfig> {
    return { ...this.config }
  }

  /**
   * 重置配置
   */
  resetConfig(): void {
    this.config = {
      enabled: false,
      logLevel: 'info',
      modules: {}
    }
    this.saveConfig()
  }
}

// 单例
export const debugManager = new DebugManager()

// 导出便捷方法
export function enableDebug(enabled: boolean = true): void {
  debugManager.setEnabled(enabled)
}

export function setDebugLogLevel(level: DebugConfig['logLevel']): void {
  debugManager.setLogLevel(level)
}

export function enableModuleDebug(module: string, enabled: boolean = true): void {
  debugManager.setModuleEnabled(module, enabled)
}

export function isModuleDebugEnabled(module: string): boolean {
  return debugManager.isModuleEnabled(module)
}
