/**
 * Panel 调试工具
 * 用于跟踪和记录每个组件(componentId) panel 的渲染信息
 */

import { debugManager } from './debugManager'

const MODULE_NAME = 'panel'

export type PanelType = 
  | 'Grid' 
  | 'Axes' 
  | 'PointCloud' 
  | 'PointCloud2' 
  | 'LaserScan' 
  | 'Path' 
  | 'Map' 
  | 'TF-Axes' 
  | 'TF-Arrows'

interface PanelRenderInfo {
  componentId?: string
  panelType: PanelType
  dataSize?: number // 数据大小（点数、地图大小等）
  renderTime?: number // 渲染时间（ms）
  layerIndex?: number
  timestamp?: number // 自动添加，不需要手动提供
}

interface PanelStats {
  [componentId: string]: {
    panelType: PanelType
    renderCount: number
    totalRenderTime: number
    lastRenderTime: number
    avgRenderTime: number
    minRenderTime: number
    maxRenderTime: number
    lastDataSize: number
    lastLayerIndex?: number
    renderFrequency: number // Hz
    updateFrequency: number // Hz (数据更新频率)
    lastUpdateTime: number
    dataChangeCount: number // 数据变化次数
    performanceWarnings: number // 性能警告次数
  }
}

class PanelDebugger {
  private stats: PanelStats = {}
  private renderHistory: PanelRenderInfo[] = []
  private maxHistorySize = 100 // 最多保留100条历史记录
  
  // 频率更新相关
  private frequencyUpdateInterval = 5000 // 5秒更新一次频率
  private lastFrequencyUpdate = 0
  private renderTimes: Map<string, number[]> = new Map() // 每个组件的渲染时间戳
  private updateTimes: Map<string, number[]> = new Map() // 每个组件的数据更新时间戳
  
  // 性能阈值
  private performanceThresholds = {
    slowRenderTime: 16.67, // 超过一帧时间（60fps）视为慢渲染
    verySlowRenderTime: 33.33, // 超过两帧时间视为非常慢
    largeDataSize: 1000000 // 大数据量阈值（1M点）
  }

  /**
   * 记录 Panel 渲染信息
   */
  recordPanelRender(info: PanelRenderInfo): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return

    const componentId = info.componentId || 'global'
    const now = performance.now()
    const timestamp = Date.now()

    // 更新统计信息
    if (!this.stats[componentId]) {
      this.stats[componentId] = {
        panelType: info.panelType,
        renderCount: 0,
        totalRenderTime: 0,
        lastRenderTime: 0,
        avgRenderTime: 0,
        minRenderTime: Infinity,
        maxRenderTime: 0,
        lastDataSize: 0,
        renderFrequency: 0,
        updateFrequency: 0,
        lastUpdateTime: timestamp,
        dataChangeCount: 0,
        performanceWarnings: 0
      }
      this.renderTimes.set(componentId, [])
      this.updateTimes.set(componentId, [])
    }

    const stat = this.stats[componentId]
    if (!stat) return // 防御性检查
    
    stat.renderCount++
    
    // 记录渲染时间
    if (info.renderTime !== undefined) {
      stat.totalRenderTime += info.renderTime
      stat.lastRenderTime = info.renderTime
      stat.avgRenderTime = stat.totalRenderTime / stat.renderCount
      stat.minRenderTime = Math.min(stat.minRenderTime, info.renderTime)
      stat.maxRenderTime = Math.max(stat.maxRenderTime, info.renderTime)
      
      // 性能警告
      if (info.renderTime > this.performanceThresholds.verySlowRenderTime) {
        stat.performanceWarnings++
        if (debugManager.shouldLog('warn')) {
          console.warn(
            `[Panel Debug] ${info.panelType}[${componentId}] very slow render: ${info.renderTime.toFixed(2)}ms`
          )
        }
      } else if (info.renderTime > this.performanceThresholds.slowRenderTime) {
        stat.performanceWarnings++
        if (debugManager.shouldLog('debug')) {
          console.debug(
            `[Panel Debug] ${info.panelType}[${componentId}] slow render: ${info.renderTime.toFixed(2)}ms`
          )
        }
      }
    }
    
    // 记录数据大小
    if (info.dataSize !== undefined) {
      const previousSize = stat.lastDataSize
      stat.lastDataSize = info.dataSize
      
      // 检测数据变化
      if (previousSize !== 0 && previousSize !== info.dataSize) {
        stat.dataChangeCount++
        const updateTimes = this.updateTimes.get(componentId) || []
        updateTimes.push(timestamp)
        this.updateTimes.set(componentId, updateTimes)
      }
    }
    
    if (info.layerIndex !== undefined) {
      stat.lastLayerIndex = info.layerIndex
    }

    // 记录渲染时间戳
    const renderTimes = this.renderTimes.get(componentId) || []
    renderTimes.push(timestamp)
    this.renderTimes.set(componentId, renderTimes)

    // 添加到历史记录
    this.renderHistory.push({
      ...info,
      timestamp: now
    })

    // 限制历史记录大小
    if (this.renderHistory.length > this.maxHistorySize) {
      this.renderHistory.shift()
    }

    // 更新频率
    this.updateFrequency()

    // 输出调试信息
    if (debugManager.shouldLog('debug')) {
      const renderTimeInfo = info.renderTime !== undefined ? ` in ${info.renderTime.toFixed(2)}ms` : ''
      const dataSizeInfo = info.dataSize !== undefined ? `, data size: ${this.formatDataSize(info.dataSize)}` : ''
      const layerInfo = info.layerIndex !== undefined ? `, layer: ${info.layerIndex}` : ''
      const componentInfo = info.componentId ? `[${info.componentId}]` : ''
      const freqInfo = stat.renderFrequency > 0 ? `, freq: ${stat.renderFrequency.toFixed(1)}Hz` : ''
      
      console.debug(
        `[Panel Debug] ${info.panelType}${componentInfo} rendered${renderTimeInfo}${dataSizeInfo}${layerInfo}${freqInfo}`
      )
    }
  }

  /**
   * 更新频率统计
   */
  private updateFrequency(): void {
    const now = Date.now()
    if (now - this.lastFrequencyUpdate < this.frequencyUpdateInterval) {
      return
    }
    
    this.lastFrequencyUpdate = now
    const windowStart = now - this.frequencyUpdateInterval
    
    // 更新每个组件的渲染频率和数据更新频率
    Object.keys(this.stats).forEach(componentId => {
      const stat = this.stats[componentId]
      if (!stat) return
      
      // 计算渲染频率
      const renderTimes = this.renderTimes.get(componentId) || []
      const recentRenderTimes = renderTimes.filter(t => t >= windowStart)
      stat.renderFrequency = recentRenderTimes.length
      
      // 清理旧数据
      this.renderTimes.set(componentId, recentRenderTimes)
      
      // 计算数据更新频率
      const updateTimes = this.updateTimes.get(componentId) || []
      const recentUpdateTimes = updateTimes.filter(t => t >= windowStart)
      stat.updateFrequency = recentUpdateTimes.length
      
      // 清理旧数据
      this.updateTimes.set(componentId, recentUpdateTimes)
    })
  }

  /**
   * 格式化数据大小
   */
  private formatDataSize(size: number): string {
    if (size < 1000) {
      return `${size}`
    } else if (size < 1000000) {
      return `${(size / 1000).toFixed(1)}K`
    } else {
      return `${(size / 1000000).toFixed(1)}M`
    }
  }

  /**
   * 获取 Panel 统计信息
   */
  getPanelStats(componentId?: string): Readonly<PanelStats> | Readonly<PanelStats[string]> | null {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return null

    if (componentId) {
      return this.stats[componentId] ? { ...this.stats[componentId] } : null
    }
    return { ...this.stats }
  }

  /**
   * 获取渲染历史
   */
  getRenderHistory(limit?: number): Readonly<PanelRenderInfo[]> {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return []

    const history = [...this.renderHistory]
    if (limit) {
      return history.slice(-limit)
    }
    return history
  }

  /**
   * 输出所有 Panel 的统计信息
   */
  logAllStats(filterByType?: PanelType): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    if (!debugManager.shouldLog('info')) return

    // 更新频率（确保数据是最新的）
    this.updateFrequency()

    let componentIds = Object.keys(this.stats)
    
    // 按类型过滤
    if (filterByType) {
      componentIds = componentIds.filter(id => this.stats[id]?.panelType === filterByType)
    }
    
    if (componentIds.length === 0) {
      console.log(`[Panel Debug] No panel stats available${filterByType ? ` for type: ${filterByType}` : ''}`)
      return
    }

    console.log(`[Panel Debug] Panel Stats (${componentIds.length} panels${filterByType ? `, type: ${filterByType}` : ''}):`)
    componentIds.forEach(componentId => {
      const stat = this.stats[componentId]
      if (!stat) return // 防御性检查
      
      const renderTimeInfo = stat.avgRenderTime > 0 
        ? `avg: ${stat.avgRenderTime.toFixed(2)}ms (min: ${stat.minRenderTime === Infinity ? 'N/A' : stat.minRenderTime.toFixed(2)}ms, max: ${stat.maxRenderTime.toFixed(2)}ms), last: ${stat.lastRenderTime.toFixed(2)}ms`
        : 'N/A'
      const dataSizeInfo = stat.lastDataSize > 0 
        ? `, data: ${this.formatDataSize(stat.lastDataSize)}`
        : ''
      const layerInfo = stat.lastLayerIndex !== undefined 
        ? `, layer: ${stat.lastLayerIndex}`
        : ''
      const freqInfo = stat.renderFrequency > 0 
        ? `, render freq: ${stat.renderFrequency.toFixed(1)}Hz`
        : ''
      const updateFreqInfo = stat.updateFrequency > 0 
        ? `, update freq: ${stat.updateFrequency.toFixed(1)}Hz`
        : ''
      const warningInfo = stat.performanceWarnings > 0 
        ? `, ⚠️ ${stat.performanceWarnings} warnings`
        : ''
      
      console.log(
        `  ${stat.panelType}${componentId !== 'global' ? ` [${componentId}]` : ''}: ` +
        `${stat.renderCount} renders, ${renderTimeInfo}${dataSizeInfo}${layerInfo}${freqInfo}${updateFreqInfo}${warningInfo}`
      )
    })
  }

  /**
   * 输出指定类型的 Panel 统计信息
   */
  logStatsByType(panelType: PanelType): void {
    this.logAllStats(panelType)
  }

  /**
   * 获取性能警告的组件列表
   */
  getPerformanceWarnings(): Array<{ componentId: string; panelType: PanelType; warnings: number; avgRenderTime: number }> {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return []
    
    const warnings: Array<{ componentId: string; panelType: PanelType; warnings: number; avgRenderTime: number }> = []
    
    Object.keys(this.stats).forEach(componentId => {
      const stat = this.stats[componentId]
      if (!stat || stat.performanceWarnings === 0) return
      
      warnings.push({
        componentId,
        panelType: stat.panelType,
        warnings: stat.performanceWarnings,
        avgRenderTime: stat.avgRenderTime
      })
    })
    
    // 按警告次数和平均渲染时间排序
    warnings.sort((a, b) => {
      if (b.warnings !== a.warnings) {
        return b.warnings - a.warnings
      }
      return b.avgRenderTime - a.avgRenderTime
    })
    
    return warnings
  }

  /**
   * 输出性能警告
   */
  logPerformanceWarnings(): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    if (!debugManager.shouldLog('warn')) return
    
    const warnings = this.getPerformanceWarnings()
    if (warnings.length === 0) {
      console.log('[Panel Debug] No performance warnings')
      return
    }
    
    console.warn(`[Panel Debug] Performance Warnings (${warnings.length} panels):`)
    warnings.forEach(({ componentId, panelType, warnings: warningCount, avgRenderTime }) => {
      console.warn(
        `  ${panelType}[${componentId}]: ${warningCount} warnings, avg render time: ${avgRenderTime.toFixed(2)}ms`
      )
    })
  }

  /**
   * 重置统计信息
   */
  resetStats(componentId?: string): void {
    if (componentId) {
      delete this.stats[componentId]
      this.renderTimes.delete(componentId)
      this.updateTimes.delete(componentId)
    } else {
      this.stats = {}
      this.renderHistory = []
      this.renderTimes.clear()
      this.updateTimes.clear()
      this.lastFrequencyUpdate = 0
    }
  }

  /**
   * 导出统计信息（用于分析或保存）
   */
  exportStats(): {
    stats: PanelStats
    history: Readonly<PanelRenderInfo[]>
    timestamp: number
  } {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) {
      return { stats: {}, history: [], timestamp: Date.now() }
    }
    
    return {
      stats: { ...this.stats },
      history: [...this.renderHistory],
      timestamp: Date.now()
    }
  }

  /**
   * 获取指定组件的详细统计信息
   */
  getComponentStats(componentId: string): Readonly<PanelStats[string]> | null {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return null
    
    // 更新频率（确保数据是最新的）
    this.updateFrequency()
    
    return this.stats[componentId] ? { ...this.stats[componentId] } : null
  }

  /**
   * 获取按类型分组的统计信息
   */
  getStatsByType(): Record<PanelType, PanelStats[string][]> {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) {
      return {} as Record<PanelType, PanelStats[string][]>
    }
    
    // 更新频率（确保数据是最新的）
    this.updateFrequency()
    
    const grouped: Record<PanelType, PanelStats[string][]> = {} as Record<PanelType, PanelStats[string][]>
    
    Object.keys(this.stats).forEach(componentId => {
      const stat = this.stats[componentId]
      if (!stat) return
      
      if (!grouped[stat.panelType]) {
        grouped[stat.panelType] = []
      }
      grouped[stat.panelType].push({ ...stat })
    })
    
    return grouped
  }

  /**
   * 输出调试信息
   */
  log(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    if (!debugManager.shouldLog(level)) return
    
    const prefix = `[Panel Debug]`
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`)
        break
      case 'warn':
        console.warn(`${prefix} ${message}`)
        break
      case 'info':
        console.info(`${prefix} ${message}`)
        break
      case 'debug':
        console.debug(`${prefix} ${message}`)
        break
    }
  }
}

// 单例
export const panelDebugger = new PanelDebugger()

// 导出便捷方法
export function logPanel(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
  panelDebugger.log(message, level)
}
