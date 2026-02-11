/**
 * PointCloud2 处理器 Worker 管理器
 * 管理 PointCloud2 专用 Web Worker 的创建、消息发送和结果接收
 * 从 dataProcessorWorker.ts 中拆分出来，提高代码模块化
 */
import type { 
  PointCloud2ProcessRequest,
  PointCloud2ProcessResult
} from './pointCloud2Processor.worker'

export class PointCloud2ProcessorWorker {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, {
    resolve: (result: PointCloud2ProcessResult) => void
    reject: (error: Error) => void
    timeout: number
  }>()

  constructor() {
    this.initWorker()
  }

  private initWorker(): void {
    try {
      // 创建 Worker（使用 Vite 的 worker 导入方式）
      // Vite 会自动处理 worker 的打包和加载
      this.worker = new Worker(
        new URL('./pointCloud2Processor.worker.ts', import.meta.url),
        { 
          type: 'module',
          name: 'pointCloud2Processor'
        }
      )

      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data)
      }

      this.worker.onerror = (error) => {
        console.error('PointCloud2ProcessorWorker error:', error)
        // 处理所有待处理的请求
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error('Worker error'))
        })
        this.pendingRequests.clear()
      }
    } catch (error) {
      console.warn('Failed to create PointCloud2ProcessorWorker, falling back to main thread:', error)
      this.worker = null
    }
  }

  private handleMessage(data: PointCloud2ProcessResult): void {
    if (data.type === 'pointCloud2Processed') {
      const result = data as PointCloud2ProcessResult
      const requestId = result.componentId // 使用 componentId 作为请求ID
      const pending = this.pendingRequests.get(requestId)
      
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(requestId)
        
        if (result.error) {
          pending.reject(new Error(result.error))
        } else {
          pending.resolve(result)
        }
      }
    }
  }

  /**
   * 处理 PointCloud2 数据（异步）
   */
  async processPointCloud2(request: PointCloud2ProcessRequest): Promise<PointCloud2ProcessResult> {
    if (!this.worker) {
      // 回退到主线程处理（简化实现，直接返回空数据）
      return {
        type: 'pointCloud2Processed',
        componentId: request.componentId,
        data: null,
        error: 'PointCloud2 processing requires Worker'
      }
    }

    // 使用 componentId 作为 requestId，新的请求会取消旧的
    return this.sendRequest(request.componentId, request, 10000)
  }

  /**
   * 发送请求到 Worker（通用方法）
   */
  private sendRequest(requestId: string, request: PointCloud2ProcessRequest, timeoutMs: number): Promise<PointCloud2ProcessResult> {
    return new Promise((resolve, reject) => {
      // 如果已有相同 componentId 的请求，取消旧的请求
      const existing = this.pendingRequests.get(requestId)
      if (existing) {
        clearTimeout(existing.timeout)
        existing.reject(new Error('Request cancelled: new request with same componentId'))
      }

      // 设置超时
      const timeout = window.setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Request timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      // 保存请求
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      })

      // 发送请求到 Worker
      this.worker!.postMessage(request)
    })
  }

  /**
   * 销毁 Worker
   */
  destroy(): void {
    // 取消所有待处理的请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout)
      reject(new Error('Worker destroyed'))
    })
    this.pendingRequests.clear()

    // 终止 Worker
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

// 导出单例实例
export const pointCloud2ProcessorWorker = new PointCloud2ProcessorWorker()
