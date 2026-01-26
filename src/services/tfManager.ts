/**
 * TF (Transform) 管理器
 * 管理坐标变换树
 */
import { ref, computed } from 'vue'

interface Frame {
  name: string
  parent: string | null
  timestamp: number
  translation: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

interface SubscriptionStatus {
  subscribed: boolean
  hasData: boolean
  messageCount: number
  lastMessageTime: number | null
}

class TFManager {
  private frames = ref<Map<string, Frame>>(new Map())
  private fixedFrame = ref<string>('map')
  private frameTimeout = ref<number>(15) // 默认15秒超时
  private subscriptionStatus = ref<SubscriptionStatus>({
    subscribed: false,
    hasData: false,
    messageCount: 0,
    lastMessageTime: null
  })
  private dataUpdateTrigger = ref(0)

  /**
   * 获取所有帧
   */
  getFrames(): Frame[] {
    return Array.from(this.frames.value.values())
  }

  /**
   * 获取帧信息
   */
  getFrameInfo(frameName: string, fixedFrameName: string = this.fixedFrame.value): {
    name: string
    parent: string | null
    age: number
    exists: boolean
  } {
    const frame = this.frames.value.get(frameName)
    if (!frame) {
      return {
        name: frameName,
        parent: null,
        age: Infinity,
        exists: false
      }
    }

    const age = (Date.now() - frame.timestamp) / 1000 // 转换为秒
    return {
      name: frameName,
      parent: frame.parent,
      age,
      exists: true
    }
  }

  /**
   * 添加或更新帧
   */
  updateFrame(frame: Frame) {
    this.frames.value.set(frame.name, {
      ...frame,
      timestamp: Date.now()
    })
    this.subscriptionStatus.value.hasData = true
    this.subscriptionStatus.value.messageCount++
    this.subscriptionStatus.value.lastMessageTime = Date.now()
    this.dataUpdateTrigger.value++
  }

  /**
   * 移除超时的帧
   */
  removeExpiredFrames() {
    const now = Date.now()
    const timeoutMs = this.frameTimeout.value * 1000

    for (const [name, frame] of this.frames.value.entries()) {
      if (now - frame.timestamp > timeoutMs) {
        this.frames.value.delete(name)
      }
    }
  }

  /**
   * 设置固定帧
   */
  setFixedFrame(frameName: string) {
    this.fixedFrame.value = frameName
  }

  /**
   * 获取固定帧
   */
  getFixedFrame(): string {
    return this.fixedFrame.value
  }

  /**
   * 获取固定帧的响应式引用
   */
  getFixedFrameRef() {
    return this.fixedFrame
  }

  /**
   * 设置帧超时时间（秒）
   */
  setFrameTimeout(timeout: number) {
    this.frameTimeout.value = timeout
  }

  /**
   * 获取帧超时时间
   */
  getFrameTimeout(): number {
    return this.frameTimeout.value
  }

  /**
   * 设置订阅状态
   */
  setSubscriptionStatus(status: Partial<SubscriptionStatus>) {
    this.subscriptionStatus.value = {
      ...this.subscriptionStatus.value,
      ...status
    }
  }

  /**
   * 获取订阅状态引用（用于响应式）
   */
  getSubscriptionStatusRef() {
    return this.subscriptionStatus
  }

  /**
   * 获取数据更新触发器（用于触发重新计算）
   */
  getDataUpdateTrigger() {
    return computed(() => this.dataUpdateTrigger.value)
  }

  /**
   * 查找两个帧之间的变换
   */
  lookupTransform(targetFrame: string, sourceFrame: string): {
    translation: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number; w: number }
  } | null {
    // 简化实现：直接查找目标帧
    const frame = this.frames.value.get(targetFrame)
    if (!frame) {
      return null
    }

    return {
      translation: frame.translation,
      rotation: frame.rotation
    }
  }

  /**
   * 清除所有帧
   */
  clear() {
    this.frames.value.clear()
    this.subscriptionStatus.value = {
      subscribed: false,
      hasData: false,
      messageCount: 0,
      lastMessageTime: null
    }
  }

  /**
   * 启动定期清理超时帧
   */
  startCleanupTimer(interval: number = 1000) {
    setInterval(() => {
      this.removeExpiredFrames()
    }, interval)
  }
}

export const tfManager = new TFManager()

// 启动清理定时器
tfManager.startCleanupTimer()
