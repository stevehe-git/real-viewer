/**
 * 渲染调试工具
 * 用于跟踪和记录渲染相关的性能指标和调试信息
 */

import { debugManager } from './debugManager'

const MODULE_NAME = 'render'

interface RenderStats {
  frameCount: number
  frameTime: number
  lastFrameTime: number
  fps: number
  drawCallCount: number
  lastDrawCallCount: number
}

class RenderDebugger {
  private stats: RenderStats = {
    frameCount: 0,
    frameTime: 0,
    lastFrameTime: 0,
    fps: 0,
    drawCallCount: 0,
    lastDrawCallCount: 0
  }

  private frameTimes: number[] = []
  private lastFPSUpdate = 0
  private fpsUpdateInterval = 5000 // 5秒更新一次 FPS

  /**
   * 记录帧开始
   */
  recordFrameStart(): number {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return 0
    return performance.now()
  }

  /**
   * 记录帧结束
   */
  recordFrameEnd(startTime: number, drawCallCount?: number): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME) || !startTime) return
    
    const duration = performance.now() - startTime
    this.stats.frameCount++
    this.stats.frameTime += duration
    this.stats.lastFrameTime = duration
    this.frameTimes.push(Date.now())
    
    if (drawCallCount !== undefined) {
      this.stats.lastDrawCallCount = drawCallCount
      this.stats.drawCallCount += drawCallCount
    }
    
    this.updateFPS()
    
    if (debugManager.shouldLog('debug')) {
      const drawCallInfo = drawCallCount !== undefined ? `, draw calls: ${drawCallCount}` : ''
      console.debug(`[Render Debug] Frame completed in ${duration.toFixed(2)}ms${drawCallInfo}`)
    }
  }

  /**
   * 更新 FPS
   */
  private updateFPS(): void {
    const now = Date.now()
    if (now - this.lastFPSUpdate < this.fpsUpdateInterval) {
      return
    }
    
    this.lastFPSUpdate = now
    const windowStart = now - this.fpsUpdateInterval
    
    // 计算 FPS（基于最近5秒的数据）
    // 关键修复：需要除以时间窗口（秒）才能得到正确的 FPS
    const frameCount = this.frameTimes.filter(t => t >= windowStart).length
    const timeWindowSeconds = this.fpsUpdateInterval / 1000 // 转换为秒
    this.stats.fps = frameCount / timeWindowSeconds
    
    // 清理旧数据（保留最近5秒的数据）
    this.frameTimes = this.frameTimes.filter(t => t >= windowStart)
    
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
    
    const avgFrameTime = this.stats.frameTime / Math.max(this.stats.frameCount, 1)
    const avgDrawCalls = this.stats.drawCallCount / Math.max(this.stats.frameCount, 1)
    
    console.log(`[Render Debug] Stats:
  FPS: ${this.stats.fps.toFixed(1)}
  Frame Time: avg ${avgFrameTime.toFixed(2)}ms, last ${this.stats.lastFrameTime.toFixed(2)}ms
  Draw Calls: avg ${avgDrawCalls.toFixed(1)}, last ${this.stats.lastDrawCallCount}`)
  }

  /**
   * 获取统计信息
   */
  getStats(): Readonly<RenderStats> {
    return { ...this.stats }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      frameCount: 0,
      frameTime: 0,
      lastFrameTime: 0,
      fps: 0,
      drawCallCount: 0,
      lastDrawCallCount: 0
    }
    this.frameTimes = []
  }

  /**
   * 输出调试信息
   */
  log(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
    if (!debugManager.isModuleEnabled(MODULE_NAME)) return
    if (!debugManager.shouldLog(level)) return
    
    const prefix = `[Render Debug]`
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
export const renderDebugger = new RenderDebugger()

// 导出便捷方法
export function logRender(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info'): void {
  renderDebugger.log(message, level)
}
