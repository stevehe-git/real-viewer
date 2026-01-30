/**
 * TF 调试工具
 * 用于跟踪和记录 TF 相关的性能指标和调试信息
 */

import { debugManager } from './debugManager'

const MODULE_NAME = 'tf'

interface TFStats {
  // 处理相关
  processCount: number
  processTime: number
  lastProcessTime: number
  processFrequency: number // Hz
  
  // 渲染相关
  renderCount: number
  renderTime: number
  lastRenderTime: number
  renderFrequency: number // Hz
  
  // 数据相关
  messageCount: number
  lastMessageTime: number
  messageFrequency: number // Hz
  dynamicMessageCount: number // 动态消息计数
  staticMessageCount: number // 静态消息计数
  dynamicMessageFrequency: number // 动态消息频率（Hz）
  
  // Worker 相关
  workerProcessCount: number
  workerProcessTime: number
  workerLastProcessTime: number
  workerProcessFrequency: number // Hz
  
  // 缓存相关
  cacheHitCount: number
  cacheMissCount: number
  cacheHitRate: number
}

class TFDebugger {
  private stats: TFStats = {
    processCount: 0,
    processTime: 0,
    lastProcessTime: 0,
    processFrequency: 0,
    renderCount: 0,
    renderTime: 0,
    lastRenderTime: 0,
    renderFrequency: 0,
    messageCount: 0,
    lastMessageTime: 0,
    messageFrequency: 0,
    dynamicMessageCount: 0,
    staticMessageCount: 0,
    dynamicMessageFrequency: 0,
    workerProcessCount: 0,
    workerProcessTime: 0,
    workerLastProcessTime: 0,
    workerProcessFrequency: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cacheHitRate: 0
  }

  private frequencyUpdateInterval = 5000 // 5秒更新一次频率
  private lastFrequencyUpdate = 0
  private processTimes: number[] = []
  private renderTimes: number[] = []
  private messageTimes: number[] = []
  private dynamicMessageTimes: number[] = [] // 动态消息时间戳
  private staticMessageTimes: number[] = [] // 静态消息时间戳
  private workerProcessTimes: number[] = []

  /**
   * 记录 TF 处理开始
   */
  recordProcessStart(): number {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return 0
    return performance.now()
  }

  /**
   * 记录 TF 处理结束
   */
  recordProcessEnd(startTime: number): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME) || !startTime) return
    
    const duration = performance.now() - startTime
    this.stats.processCount++
    this.stats.processTime += duration
    this.stats.lastProcessTime = duration
    this.processTimes.push(Date.now())
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      console.debug(`[TF Debug] Process completed in ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * 记录 TF 渲染开始
   */
  recordRenderStart(): number {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return 0
    return performance.now()
  }

  /**
   * 记录 TF 渲染结束
   */
  recordRenderEnd(startTime: number): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME) || !startTime) return
    
    const duration = performance.now() - startTime
    this.stats.renderCount++
    this.stats.renderTime += duration
    this.stats.lastRenderTime = duration
    this.renderTimes.push(Date.now())
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      console.debug(`[TF Debug] Render completed in ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * 记录 TF 消息接收
   * @param isStatic 是否为静态消息（/tf_static）
   */
  recordMessage(isStatic: boolean = false): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    
    this.stats.messageCount++
    this.messageTimes.push(Date.now())
    
    if (isStatic) {
      this.stats.staticMessageCount++
      this.staticMessageTimes.push(Date.now())
    } else {
      this.stats.dynamicMessageCount++
      this.dynamicMessageTimes.push(Date.now())
    }
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      const type = isStatic ? 'static' : 'dynamic'
      console.debug(`[TF Debug] ${type} message received (total: ${this.stats.messageCount}, dynamic: ${this.stats.dynamicMessageCount}, static: ${this.stats.staticMessageCount})`)
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
  recordWorkerProcessEnd(startTime: number): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME) || !startTime) return
    
    const duration = performance.now() - startTime
    this.stats.workerProcessCount++
    this.stats.workerProcessTime += duration
    this.stats.workerLastProcessTime = duration
    this.workerProcessTimes.push(Date.now())
    
    this.updateFrequency()
    
    if (debugManager.shouldLog('debug')) {
      console.debug(`[TF Debug] Worker process completed in ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    this.stats.cacheHitCount++
    this.updateCacheRate()
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss(): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    this.stats.cacheMissCount++
    this.updateCacheRate()
  }

  /**
   * 更新缓存命中率
   */
  private updateCacheRate(): void {
    const total = this.stats.cacheHitCount + this.stats.cacheMissCount
    if (total > 0) {
      this.stats.cacheHitRate = this.stats.cacheHitCount / total
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
    
    // 计算频率（转换为 Hz：5秒内的数量 / 5秒）
    const windowSeconds = this.frequencyUpdateInterval / 1000
    
    // 计算处理频率
    this.stats.processFrequency = this.processTimes.filter(t => t >= windowStart).length / windowSeconds
    
    // 计算渲染频率
    this.stats.renderFrequency = this.renderTimes.filter(t => t >= windowStart).length / windowSeconds
    
    // 计算消息频率（只统计动态消息，静态消息不计入频率）
    const dynamicMessagesInWindow = this.dynamicMessageTimes.filter(t => t >= windowStart).length
    this.stats.dynamicMessageFrequency = dynamicMessagesInWindow / windowSeconds
    // 保留总消息频率用于兼容性（但主要关注动态消息频率）
    this.stats.messageFrequency = this.messageTimes.filter(t => t >= windowStart).length / windowSeconds
    
    // 计算 Worker 处理频率
    this.stats.workerProcessFrequency = this.workerProcessTimes.filter(t => t >= windowStart).length / windowSeconds
    
    // 清理旧数据（保留最近5秒的数据）
    this.processTimes = this.processTimes.filter(t => t >= windowStart)
    this.renderTimes = this.renderTimes.filter(t => t >= windowStart)
    this.messageTimes = this.messageTimes.filter(t => t >= windowStart)
    this.dynamicMessageTimes = this.dynamicMessageTimes.filter(t => t >= windowStart)
    this.staticMessageTimes = this.staticMessageTimes.filter(t => t >= windowStart)
    this.workerProcessTimes = this.workerProcessTimes.filter(t => t >= windowStart)
    
    // 输出统计信息
    if (debugManager.shouldLog('info')) {
      this.logStats()
    }
  }

  /**
   * 输出统计信息
   */
  logStats(): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    
    console.log(`[TF Debug] Stats:
  Process: ${this.stats.processFrequency.toFixed(1)} Hz (avg: ${(this.stats.processTime / Math.max(this.stats.processCount, 1)).toFixed(2)}ms, last: ${this.stats.lastProcessTime.toFixed(2)}ms)
  Render: ${this.stats.renderFrequency.toFixed(1)} Hz (avg: ${(this.stats.renderTime / Math.max(this.stats.renderCount, 1)).toFixed(2)}ms, last: ${this.stats.lastRenderTime.toFixed(2)}ms)
  Messages: ${this.stats.dynamicMessageFrequency.toFixed(1)} Hz (total: ${this.stats.messageCount}, dynamic: ${this.stats.dynamicMessageCount}, static: ${this.stats.staticMessageCount})
  Worker: ${this.stats.workerProcessFrequency.toFixed(1)} Hz (avg: ${(this.stats.workerProcessTime / Math.max(this.stats.workerProcessCount, 1)).toFixed(2)}ms, last: ${this.stats.workerLastProcessTime.toFixed(2)}ms)
  Cache: ${(this.stats.cacheHitRate * 100).toFixed(1)}% hit rate (${this.stats.cacheHitCount} hits, ${this.stats.cacheMissCount} misses)`)
  }

  /**
   * 获取统计信息
   */
  getStats(): Readonly<TFStats> {
    return { ...this.stats }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      processCount: 0,
      processTime: 0,
      lastProcessTime: 0,
      processFrequency: 0,
      renderCount: 0,
      renderTime: 0,
      lastRenderTime: 0,
      renderFrequency: 0,
      messageCount: 0,
      lastMessageTime: 0,
      messageFrequency: 0,
      dynamicMessageCount: 0,
      staticMessageCount: 0,
      dynamicMessageFrequency: 0,
      workerProcessCount: 0,
      workerProcessTime: 0,
      workerLastProcessTime: 0,
      workerProcessFrequency: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
      cacheHitRate: 0
    }
    this.processTimes = []
    this.renderTimes = []
    this.messageTimes = []
    this.dynamicMessageTimes = []
    this.staticMessageTimes = []
    this.workerProcessTimes = []
  }

  /**
   * 输出调试信息
   */
  log(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    if (!debugManager.shouldLog(level)) return
    
    const prefix = `[TF Debug]`
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
export const tfDebugger = new TFDebugger()

// 导出便捷方法
export function logTF(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
  tfDebugger.log(message, level)
}
