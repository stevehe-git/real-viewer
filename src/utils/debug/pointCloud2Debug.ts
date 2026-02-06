/**
 * PointCloud2 调试工具
 * 用于跟踪和记录 PointCloud2 相关的性能指标和调试信息
 */

import { debugManager } from './debugManager'

const MODULE_NAME = 'pointcloud2'

interface PointCloud2Stats {
  // 消息相关
  messageCount: number
  lastMessageTime: number
  messageFrequency: number // Hz
  
  // Worker 处理相关
  workerProcessCount: number
  workerProcessTime: number
  lastWorkerProcessTime: number
  avgWorkerProcessTime: number
  maxWorkerProcessTime: number
  workerProcessFrequency: number // Hz
  
  // 合并操作相关
  mergeCount: number
  mergeTime: number
  lastMergeTime: number
  avgMergeTime: number
  maxMergeTime: number
  mergeFrequency: number // Hz
  historyDataCount: number // 合并的历史数据数量
  mergedPointsCount: number // 合并后的总点数
  
  // 渲染相关
  renderCount: number
  renderTime: number
  lastRenderTime: number
  avgRenderTime: number
  maxRenderTime: number
  renderFrequency: number // Hz
}

class PointCloud2Debugger {
  private stats: PointCloud2Stats = {
    messageCount: 0,
    lastMessageTime: 0,
    messageFrequency: 0,
    workerProcessCount: 0,
    workerProcessTime: 0,
    lastWorkerProcessTime: 0,
    avgWorkerProcessTime: 0,
    maxWorkerProcessTime: 0,
    workerProcessFrequency: 0,
    mergeCount: 0,
    mergeTime: 0,
    lastMergeTime: 0,
    avgMergeTime: 0,
    maxMergeTime: 0,
    mergeFrequency: 0,
    historyDataCount: 0,
    mergedPointsCount: 0,
    renderCount: 0,
    renderTime: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
    maxRenderTime: 0,
    renderFrequency: 0
  }

  private frequencyUpdateInterval = 5000 // 5秒更新一次频率
  private lastFrequencyUpdate = 0
  private messageTimes: number[] = []
  private workerProcessTimes: number[] = []
  private mergeTimes: number[] = []
  private renderTimes: number[] = []

  /**
   * 记录消息接收
   */
  recordMessage(): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    
    this.stats.messageCount++
    this.stats.lastMessageTime = Date.now()
    this.messageTimes.push(Date.now())
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      console.debug(`[PointCloud2 Debug] Message received (total: ${this.stats.messageCount})`)
    }
  }

  /**
   * 记录 Worker 处理开始
   */
  recordWorkerProcessStart(): number {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return 0
    return performance.now()
  }

  /**
   * 记录 Worker 处理结束
   */
  recordWorkerProcessEnd(startTime: number, pointsCount: number = 0): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME) || !startTime) return
    
    const duration = performance.now() - startTime
    this.stats.workerProcessCount++
    this.stats.workerProcessTime += duration
    this.stats.lastWorkerProcessTime = duration
    this.workerProcessTimes.push(Date.now())
    
    if (duration > this.stats.maxWorkerProcessTime) {
      this.stats.maxWorkerProcessTime = duration
    }
    this.stats.avgWorkerProcessTime = this.stats.workerProcessTime / this.stats.workerProcessCount
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      console.debug(`[PointCloud2 Debug] Worker process completed in ${duration.toFixed(2)}ms (${pointsCount} points)`)
    }
  }

  /**
   * 记录合并操作开始
   */
  recordMergeStart(): number {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return 0
    return performance.now()
  }

  /**
   * 记录合并操作结束
   */
  recordMergeEnd(startTime: number, historyDataCount: number = 0, mergedPointsCount: number = 0): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME) || !startTime) return
    
    const duration = performance.now() - startTime
    this.stats.mergeCount++
    this.stats.mergeTime += duration
    this.stats.lastMergeTime = duration
    this.mergeTimes.push(Date.now())
    
    if (duration > this.stats.maxMergeTime) {
      this.stats.maxMergeTime = duration
    }
    this.stats.avgMergeTime = this.stats.mergeTime / this.stats.mergeCount
    
    if (historyDataCount > 0) {
      this.stats.historyDataCount = historyDataCount
    }
    if (mergedPointsCount > 0) {
      this.stats.mergedPointsCount = mergedPointsCount
    }
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      console.debug(`[PointCloud2 Debug] Merge completed in ${duration.toFixed(2)}ms (${historyDataCount} history items, ${mergedPointsCount} points)`)
    }
    
    // 如果合并时间过长，发出警告
    if (duration > 100) {
      this.log(`Merge operation took ${duration.toFixed(2)}ms (threshold: 100ms)`, 'warn')
    }
  }

  /**
   * 记录渲染开始
   */
  recordRenderStart(): number {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return 0
    return performance.now()
  }

  /**
   * 记录渲染结束
   */
  recordRenderEnd(startTime: number): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME) || !startTime) return
    
    const duration = performance.now() - startTime
    this.stats.renderCount++
    this.stats.renderTime += duration
    this.stats.lastRenderTime = duration
    this.renderTimes.push(Date.now())
    
    if (duration > this.stats.maxRenderTime) {
      this.stats.maxRenderTime = duration
    }
    this.stats.avgRenderTime = this.stats.renderTime / this.stats.renderCount
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      console.debug(`[PointCloud2 Debug] Render completed in ${duration.toFixed(2)}ms`)
    }
    
    // 如果渲染时间过长，发出警告
    if (duration > 16.67) { // 一帧的时间（60fps）
      this.log(`Render operation took ${duration.toFixed(2)}ms (threshold: 16.67ms)`, 'warn')
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
    const window = this.frequencyUpdateInterval
    
    // 计算消息频率
    if (this.messageTimes.length > 0) {
      const recentMessages = this.messageTimes.filter(t => now - t <= window)
      this.stats.messageFrequency = (recentMessages.length * 1000) / window
      // 清理旧数据
      this.messageTimes = this.messageTimes.filter(t => now - t <= window * 2)
    }
    
    // 计算 Worker 处理频率
    if (this.workerProcessTimes.length > 0) {
      const recentProcesses = this.workerProcessTimes.filter(t => now - t <= window)
      this.stats.workerProcessFrequency = (recentProcesses.length * 1000) / window
      // 清理旧数据
      this.workerProcessTimes = this.workerProcessTimes.filter(t => now - t <= window * 2)
    }
    
    // 计算合并频率
    if (this.mergeTimes.length > 0) {
      const recentMerges = this.mergeTimes.filter(t => now - t <= window)
      this.stats.mergeFrequency = (recentMerges.length * 1000) / window
      // 清理旧数据
      this.mergeTimes = this.mergeTimes.filter(t => now - t <= window * 2)
    }
    
    // 计算渲染频率
    if (this.renderTimes.length > 0) {
      const recentRenders = this.renderTimes.filter(t => now - t <= window)
      this.stats.renderFrequency = (recentRenders.length * 1000) / window
      // 清理旧数据
      this.renderTimes = this.renderTimes.filter(t => now - t <= window * 2)
    }
  }

  /**
   * 输出统计信息
   */
  logStats(): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) {
      console.log('PointCloud2 debug is disabled. Enable it with: debug.enableModule("pointcloud2", true)')
      return
    }
    
    console.group('📊 PointCloud2 Statistics')
    
    console.group('📨 Messages')
    console.log(`Count: ${this.stats.messageCount}`)
    console.log(`Frequency: ${this.stats.messageFrequency.toFixed(2)} Hz`)
    console.groupEnd()
    
    console.group('⚙️ Worker Processing')
    console.log(`Count: ${this.stats.workerProcessCount}`)
    console.log(`Last Time: ${this.stats.lastWorkerProcessTime.toFixed(2)}ms`)
    console.log(`Avg Time: ${this.stats.avgWorkerProcessTime.toFixed(2)}ms`)
    console.log(`Max Time: ${this.stats.maxWorkerProcessTime.toFixed(2)}ms`)
    console.log(`Frequency: ${this.stats.workerProcessFrequency.toFixed(2)} Hz`)
    console.groupEnd()
    
    console.group('🔀 Merge Operations')
    console.log(`Count: ${this.stats.mergeCount}`)
    console.log(`Last Time: ${this.stats.lastMergeTime.toFixed(2)}ms`)
    console.log(`Avg Time: ${this.stats.avgMergeTime.toFixed(2)}ms`)
    console.log(`Max Time: ${this.stats.maxMergeTime.toFixed(2)}ms`)
    console.log(`Frequency: ${this.stats.mergeFrequency.toFixed(2)} Hz`)
    console.log(`History Data Count: ${this.stats.historyDataCount}`)
    console.log(`Merged Points Count: ${this.stats.mergedPointsCount.toLocaleString()}`)
    console.groupEnd()
    
    console.group('🎨 Rendering')
    console.log(`Count: ${this.stats.renderCount}`)
    console.log(`Last Time: ${this.stats.lastRenderTime.toFixed(2)}ms`)
    console.log(`Avg Time: ${this.stats.avgRenderTime.toFixed(2)}ms`)
    console.log(`Max Time: ${this.stats.maxRenderTime.toFixed(2)}ms`)
    console.log(`Frequency: ${this.stats.renderFrequency.toFixed(2)} Hz`)
    console.groupEnd()
    
    console.groupEnd()
  }

  /**
   * 获取统计信息
   */
  getStats(): Readonly<PointCloud2Stats> {
    return { ...this.stats }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      messageCount: 0,
      lastMessageTime: 0,
      messageFrequency: 0,
      workerProcessCount: 0,
      workerProcessTime: 0,
      lastWorkerProcessTime: 0,
      avgWorkerProcessTime: 0,
      maxWorkerProcessTime: 0,
      workerProcessFrequency: 0,
      mergeCount: 0,
      mergeTime: 0,
      lastMergeTime: 0,
      avgMergeTime: 0,
      maxMergeTime: 0,
      mergeFrequency: 0,
      historyDataCount: 0,
      mergedPointsCount: 0,
      renderCount: 0,
      renderTime: 0,
      lastRenderTime: 0,
      avgRenderTime: 0,
      maxRenderTime: 0,
      renderFrequency: 0
    }
    
    this.messageTimes = []
    this.workerProcessTimes = []
    this.mergeTimes = []
    this.renderTimes = []
    this.lastFrequencyUpdate = 0
  }

  /**
   * 输出调试日志
   */
  log(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    
    if (!debugManager.shouldLog(level)) return
    
    const prefix = '[PointCloud2 Debug]'
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

export const pointCloud2Debugger = new PointCloud2Debugger()

export function logPointCloud2(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
  pointCloud2Debugger.log(message, level)
}
