/**
 * TF 树处理器 Worker 管理器
 * 管理 Web Worker 的创建、消息发送和结果接收
 */
import type {
  UpdateTFTreeRequest,
  UpdateTFTreeResult,
  TransformFrame,
  TFTreeNode
} from './tfTreeProcessor.worker'

export class TFTreeProcessorWorker {
  private worker: Worker | null = null
  private pendingRequest: {
    resolve: (result: UpdateTFTreeResult) => void
    reject: (error: Error) => void
    timeout: number
  } | null = null

  constructor() {
    this.initWorker()
  }

  private initWorker(): void {
    try {
      // 创建 Worker（使用 Vite 的 worker 导入方式）
      this.worker = new Worker(
        new URL('./tfTreeProcessor.worker.ts', import.meta.url),
        {
          type: 'module',
          name: 'tfTreeProcessor'
        }
      )

      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data)
      }

      this.worker.onerror = (error) => {
        console.error('TFTreeProcessorWorker error:', error)
        if (this.pendingRequest) {
          clearTimeout(this.pendingRequest.timeout)
          this.pendingRequest.reject(new Error('Worker error'))
          this.pendingRequest = null
        }
      }
    } catch (error) {
      console.warn('Failed to create TFTreeProcessorWorker, falling back to main thread:', error)
      this.worker = null
    }
  }

  private handleMessage(data: UpdateTFTreeResult): void {
    if (this.pendingRequest) {
      clearTimeout(this.pendingRequest.timeout)
      const { resolve, reject } = this.pendingRequest
      this.pendingRequest = null
      
      if (data.error) {
        reject(new Error(data.error))
      } else {
        resolve(data)
      }
    }
  }

  /**
   * 更新 TF 树结构（异步）
   */
  async updateTFTree(
    dynamicTransforms: Map<string, Map<string, TransformFrame>>,
    staticTransforms: Map<string, Map<string, TransformFrame>>,
    availableFrames: string[],
    frameTimeout: number,
    now: number
  ): Promise<UpdateTFTreeResult> {
    if (!this.worker) {
      return this.updateTFTreeSync(dynamicTransforms, staticTransforms, availableFrames, frameTimeout, now)
    }

    // 序列化 Map 为可传输的格式
    const serializedDynamic = this.serializeTransformsMap(dynamicTransforms)
    const serializedStatic = this.serializeTransformsMap(staticTransforms)
    
    const request: UpdateTFTreeRequest = {
      type: 'updateTFTree',
      dynamicTransforms: serializedDynamic,
      staticTransforms: serializedStatic,
      availableFrames,
      frameTimeout,
      now
    }
    
    return this.sendRequest(request, 5000)
  }

  /**
   * 序列化 Map 为可传输的格式
   * 使用 JSON 序列化/反序列化确保数据完全可克隆
   */
  private serializeTransformsMap(
    transforms: Map<string, Map<string, TransformFrame>>
  ): Record<string, Record<string, TransformFrame>> {
    // 先转换为普通对象
    const temp: Record<string, Record<string, TransformFrame>> = {}
    transforms.forEach((children, parent) => {
      temp[parent] = {}
      children.forEach((transform, child) => {
        temp[parent][child] = transform
      })
    })
    
    // 使用 JSON 序列化/反序列化确保数据完全可克隆（移除任何不可序列化的属性）
    try {
      return JSON.parse(JSON.stringify(temp))
    } catch (error) {
      console.warn('Failed to serialize transforms map, using direct copy:', error)
      return temp
    }
  }

  /**
   * 发送请求到 Worker（通用方法）
   */
  private sendRequest(request: UpdateTFTreeRequest, timeoutMs: number): Promise<UpdateTFTreeResult> {
    return new Promise((resolve, reject) => {
      // 如果已有待处理的请求，取消之前的
      if (this.pendingRequest) {
        clearTimeout(this.pendingRequest.timeout)
        this.pendingRequest.reject(new Error('Request cancelled'))
      }

      // 设置超时
      const timeout = window.setTimeout(() => {
        if (this.pendingRequest) {
          this.pendingRequest.reject(new Error('Processing timeout'))
          this.pendingRequest = null
        }
      }, timeoutMs)

      this.pendingRequest = {
        resolve,
        reject,
        timeout
      }

      try {
        // 使用 JSON 序列化/反序列化确保数据完全可克隆
        const serializedRequest = JSON.parse(JSON.stringify(request))
        this.worker!.postMessage(serializedRequest)
      } catch (error) {
        clearTimeout(timeout)
        this.pendingRequest = null
        reject(error)
      }
    })
  }

  /**
   * 同步更新 TF 树（主线程回退方案）
   */
  private updateTFTreeSync(
    dynamicTransforms: Map<string, Map<string, TransformFrame>>,
    staticTransforms: Map<string, Map<string, TransformFrame>>,
    availableFrames: string[],
    frameTimeout: number,
    now: number
  ): UpdateTFTreeResult {
    // 简化实现，返回空树（实际应该调用主线程的同步方法）
    return {
      type: 'tfTreeUpdated',
      tfTree: []
    }
  }

  /**
   * 销毁 Worker
   */
  destroy(): void {
    if (this.pendingRequest) {
      clearTimeout(this.pendingRequest.timeout)
      this.pendingRequest.reject(new Error('Worker destroyed'))
      this.pendingRequest = null
    }

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

// 单例实例
let workerInstance: TFTreeProcessorWorker | null = null

export function getTFTreeProcessorWorker(): TFTreeProcessorWorker {
  if (!workerInstance) {
    workerInstance = new TFTreeProcessorWorker()
  }
  return workerInstance
}

export function destroyTFTreeProcessorWorker(): void {
  if (workerInstance) {
    workerInstance.destroy()
    workerInstance = null
  }
}
