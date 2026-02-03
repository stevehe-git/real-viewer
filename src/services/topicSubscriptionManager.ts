/**
 * 统一的话题订阅管理器
 * 负责管理所有组件的话题订阅，避免重复订阅
 * 支持多种数据格式（ROS/protobuf/json）
 */
import { toRaw, ref } from 'vue'
import * as ROSLIB from 'roslib'
import type { CommunicationPlugin } from '@/stores/types'
import { DataConverter } from './dataConverter'
import { useRvizStore } from '@/stores/rviz'

export interface SubscriptionStatus {
  subscribed: boolean
  hasData: boolean
  messageCount: number
  lastMessageTime: number | null
  error: string | null
}

export interface CachedMessage {
  data: any
  timestamp: number
  format: 'ros' | 'protobuf' | 'json'
}

export class TopicSubscriptionManager {
  private subscribers = new Map<string, ROSLIB.Topic<any>>()
  private messageQueues = new Map<string, CachedMessage[]>()
  private statuses = new Map<string, SubscriptionStatus>()
  // 使用响应式 ref 来触发状态更新通知
  private statusUpdateTrigger = ref(0)
  // 节流：状态更新节流器（每200ms最多更新一次）
  private statusUpdateThrottleTimer: number | null = null
  private pendingStatusUpdate = false
  private rosInstance: ROSLIB.Ros | null = null
  private rosPlugin: CommunicationPlugin | null = null
  // 记录每个componentId的当前订阅参数，用于避免重复订阅
  private subscriptionParams = new Map<string, { topic: string; queueSize: number }>()

  // 组件类型到消息类型的映射
  private readonly COMPONENT_MESSAGE_TYPES: Record<string, string> = {
    map: 'nav_msgs/OccupancyGrid',
    path: 'nav_msgs/Path',
    laserscan: 'sensor_msgs/LaserScan',
    pointcloud2: 'sensor_msgs/PointCloud2',
    marker: 'visualization_msgs/Marker',
    image: 'sensor_msgs/Image',
    camera: 'sensor_msgs/Image'
  }

  /**
   * 设置 ROS 插件实例
   */
  setROSPlugin(plugin: CommunicationPlugin | null) {
    console.log("TopicSubscriptionManager setROSPlugin", plugin)
    this.rosPlugin = plugin
    this.updateROSInstance()
    
    // 如果插件已设置且已连接，重新订阅所有已订阅的话题
    if (plugin && this.rosInstance) {
      // 使用 try-catch 安全地访问 isConnected，避免代理对象访问私有成员的问题
      try {
        const isConnected = this.rosInstance.isConnected
        if (isConnected) {
          // 获取所有已订阅的组件ID
          const subscribedIds = Array.from(this.subscribers.keys())
          subscribedIds.forEach((componentId) => {
            // 重新订阅（这里需要组件信息，暂时跳过，由外部组件重新订阅）
            console.log("TopicSubscriptionManager: ROS plugin updated, component", componentId, "should resubscribe")
          })
        }
      } catch (error) {
        // 如果访问 isConnected 失败，忽略（可能是代理对象问题）
        console.warn("TopicSubscriptionManager: Could not check ROS connection status", error)
      }
    }
  }

  /**
   * 更新 ROS 实例
   */
  private updateROSInstance() {
    if (this.rosPlugin) {
      // 检查是否有 getROSInstance 方法
      if (typeof (this.rosPlugin as any).getROSInstance === 'function') {
        // 使用 toRaw 获取原始对象，避免响应式代理导致的私有成员访问问题
        const rawPlugin = toRaw(this.rosPlugin)
        const instance = (rawPlugin as any).getROSInstance() as ROSLIB.Ros | null
        // 也使用 toRaw 确保获取原始 ROS 实例
        this.rosInstance = instance ? toRaw(instance) : null
        console.log("TopicSubscriptionManager updateROSInstance", this.rosInstance, this.rosInstance?.isConnected)
      } else {
        // 如果没有 getROSInstance 方法
        console.warn("ROSPlugin does not have getROSInstance method")
        this.rosInstance = null
      }
    } else {
      this.rosInstance = null
      console.log("TopicSubscriptionManager updateROSInstance - no rosPlugin")
    }
  }

  /**
   * 检查话题是否有效
   */
  private isValidTopic(topic: string | undefined): boolean {
    return !!(topic && topic.trim() !== '' && topic !== '<Fixed Frame>')
  }

  /**
   * 检查数据是否有效（使用数据转换层）
   */
  private isValidData(message: any, componentType: string): boolean {
    return DataConverter.isValidData(message, componentType, 'ros')
  }

  /**
   * 节流触发状态更新（避免频繁更新导致CPU过高）
   * 立即触发一次更新，然后节流后续更新
   */
  private triggerStatusUpdateThrottled(immediate: boolean = false) {
    if (immediate) {
      // 立即更新（用于订阅状态变化等关键更新）
      this.statusUpdateTrigger.value++
      this.pendingStatusUpdate = false
      if (this.statusUpdateThrottleTimer !== null) {
        clearTimeout(this.statusUpdateThrottleTimer)
        this.statusUpdateThrottleTimer = null
      }
      return
    }
    
    this.pendingStatusUpdate = true
    
    if (this.statusUpdateThrottleTimer === null) {
      // 对于高频消息类型（如图像），使用更长的节流间隔（200ms）
      // 对于其他类型，使用较短的间隔（100ms）以保持响应性
      const throttleInterval = 200 // 统一使用 200ms，减少更新频率
      this.statusUpdateThrottleTimer = window.setTimeout(() => {
        if (this.pendingStatusUpdate) {
          this.statusUpdateTrigger.value++
          this.pendingStatusUpdate = false
        }
        this.statusUpdateThrottleTimer = null
      }, throttleInterval)
    }
  }

  /**
   * 订阅话题
   * 参照 rviz/webviz：只有 topic 或 queueSize 改变时才重新订阅
   */
  subscribe(
    componentId: string,
    componentType: string,
    topic: string | undefined,
    queueSize: number = 10
  ): boolean {
    // 检查话题是否有效
    if (!this.isValidTopic(topic)) {
      // 如果话题无效，取消订阅
      this.unsubscribe(componentId)
      this.subscriptionParams.delete(componentId)
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'Topic not specified'
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新状态
      return false
    }

    // 关键优化：检查 topic 和 queueSize 是否改变
    // 如果都没有改变，且已经订阅，则不需要重新订阅
    const currentParams = this.subscriptionParams.get(componentId)
    const currentStatus = this.statuses.get(componentId)
    if (currentParams && currentStatus?.subscribed) {
      if (currentParams.topic === topic && currentParams.queueSize === queueSize) {
        // topic 和 queueSize 都没有改变，且已经订阅，不需要重新订阅
        return true
      }
    }

    // topic 或 queueSize 改变了，需要重新订阅
    // 先取消旧的订阅
    this.unsubscribe(componentId)

    // 检查话题是否有效
    if (!this.isValidTopic(topic)) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'Topic not specified'
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新状态
      return false
    }

    // 更新 ROS 实例（每次订阅前都更新，确保获取最新实例）
    this.updateROSInstance()

    // 检查 ROS 插件和实例
    // 如果插件未设置，尝试从 store 获取
    if (!this.rosPlugin) {
      try {
        const rvizStore = useRvizStore()
        const plugin = rvizStore.communicationState.currentPlugin
        if (plugin && plugin.id === 'ros') {
          this.setROSPlugin(plugin)
        }
      } catch (error) {
        // 忽略错误，可能是循环依赖或其他问题
      }
    }
    
    if (!this.rosPlugin) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'ROS plugin not set'
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新状态
      // 不输出警告，因为这是正常情况（连接前尝试订阅）
      return false
    }

    if (!this.rosInstance) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'ROS instance not available'
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新状态
      return false
    }

    // 检查 ROS 连接状态（使用 try-catch 安全访问）
    let isConnected = false
    try {
      isConnected = this.rosInstance.isConnected
    } catch (error) {
      // 如果无法访问 isConnected，尝试使用插件的 isConnected 方法
      if (this.rosPlugin && typeof (this.rosPlugin as any).isConnected === 'function') {
        isConnected = (this.rosPlugin as any).isConnected()
      } else {
        console.warn("TopicSubscriptionManager: Could not check ROS connection status", error)
        this.statuses.set(componentId, {
          subscribed: false,
          hasData: false,
          messageCount: 0,
          lastMessageTime: null,
          error: 'Could not verify ROS connection'
        })
        this.triggerStatusUpdateThrottled()
        return false
      }
    }

    if (!isConnected) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'ROS not connected'
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新状态
      return false
    }

    // 获取消息类型
    const messageType = this.COMPONENT_MESSAGE_TYPES[componentType]
    if (!messageType) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: `Unknown message type for component type: ${componentType}`
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新状态
      return false
    }

    try {
      // 创建订阅者
      const subscriber = new ROSLIB.Topic({
        ros: this.rosInstance,
        name: topic!,
        messageType: messageType,
        queue_size: queueSize
      })

      // 初始化消息队列
      if (!this.messageQueues.has(componentId)) {
        this.messageQueues.set(componentId, [])
      }

      // 订阅消息
      subscriber.subscribe((message: any) => {
        const timestamp = Date.now()

        // 检查数据是否有效
        const hasData = this.isValidData(message, componentType)

        // 获取当前状态
        const currentStatus = this.statuses.get(componentId) || {
          subscribed: true,
          hasData: false,
          messageCount: 0,
          lastMessageTime: null,
          error: null
        }

        // 总是更新消息计数和时间戳（即使数据无效，也要记录收到了消息）
        const newMessageCount = currentStatus.messageCount + 1
        
        // 优化：只在状态实际变化时更新状态对象
        const statusChanged = 
          currentStatus.hasData !== hasData ||
          currentStatus.messageCount === 0 // 第一条消息需要立即更新

        if (statusChanged) {
          // 更新状态（包括 hasData 变化）
          this.statuses.set(componentId, {
            subscribed: true,
            hasData: hasData,
            messageCount: newMessageCount,
            lastMessageTime: timestamp,
            error: hasData ? null : 'Invalid message format or empty data'
          })
          
          // 只在状态变化时触发响应式更新（立即更新）
          this.triggerStatusUpdateThrottled(true)
        } else {
          // 状态未变化，但更新计数和时间戳（确保时间戳总是最新的）
          this.statuses.set(componentId, {
            ...currentStatus,
            messageCount: newMessageCount,
            lastMessageTime: timestamp
          })
          
          // 对于高频消息（如图像），使用更激进的节流（每200ms更新一次）
          if (componentType === 'image' || componentType === 'camera') {
            this.triggerStatusUpdateThrottled() // 使用节流更新
          } else {
            // 对于其他类型，也使用节流更新，但频率更低（确保时间戳能更新）
            this.triggerStatusUpdateThrottled()
          }
        }

        // 如果数据有效，添加到缓存队列
        if (hasData) {
          const queue = this.messageQueues.get(componentId)!
          queue.push({
            data: message,
            timestamp: timestamp,
            format: 'ros' // 目前只支持 ROS，后续可扩展
          })

          // 保持队列大小
          if (queue.length > queueSize) {
            queue.shift()
          }
        } else {
          // 数据无效时，记录警告（仅在开发模式下）
          if (!import.meta.env.PROD) {
            console.warn(`[TopicSubscriptionManager] Invalid data for ${componentId} (${componentType}):`, {
              messageKeys: message ? Object.keys(message) : [],
              hasData: hasData,
              messagePreview: message ? JSON.stringify(message).substring(0, 200) : 'null'
            })
          }
        }
      })

      this.subscribers.set(componentId, subscriber)

      // 保存订阅参数，用于避免重复订阅
      this.subscriptionParams.set(componentId, { topic: topic!, queueSize })

      // 初始化状态
      this.statuses.set(componentId, {
        subscribed: true,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: null
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新订阅状态

      console.log(`Subscribed to topic: ${topic} for component: ${componentId} (${componentType})`)
      return true
    } catch (error: any) {
      console.error(`Failed to subscribe to topic ${topic}:`, error)
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: error?.message || 'Subscription failed'
      })
      this.triggerStatusUpdateThrottled()
      return false
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(componentId: string): void {
    const subscriber = this.subscribers.get(componentId)
    if (subscriber) {
      try {
        subscriber.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing:', error)
      }
      this.subscribers.delete(componentId)
    }

    // 清除订阅参数
    this.subscriptionParams.delete(componentId)

    // 保留状态和队列，但标记为未订阅
    const currentStatus = this.statuses.get(componentId)
    if (currentStatus) {
      this.statuses.set(componentId, {
        ...currentStatus,
        subscribed: false
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新取消订阅状态
    }
  }

  /**
   * 获取最新消息
   */
  getLatestMessage(componentId: string): any | null {
    // 访问触发器以确保响应式追踪
    this.statusUpdateTrigger.value
    const queue = this.messageQueues.get(componentId)
    if (!queue || queue.length === 0) {
      return null
    }
    return queue[queue.length - 1]?.data ?? null
  }

  /**
   * 获取所有缓存的消息
   */
  getAllMessages(componentId: string): CachedMessage[] {
    return [...(this.messageQueues.get(componentId) || [])]
  }

  /**
   * 获取订阅状态
   */
  getStatus(componentId: string): SubscriptionStatus | null {
    // 访问 trigger 以确保响应式追踪
    this.statusUpdateTrigger.value
    return this.statuses.get(componentId) || null
  }
  
  /**
   * 获取状态更新触发器（用于响应式追踪）
   */
  getStatusUpdateTrigger() {
    return this.statusUpdateTrigger
  }

  /**
   * 清理资源（取消所有定时器）
   */
  cleanup() {
    if (this.statusUpdateThrottleTimer !== null) {
      clearTimeout(this.statusUpdateThrottleTimer)
      this.statusUpdateThrottleTimer = null
    }
    this.pendingStatusUpdate = false
  }

  /**
   * 清空缓存
   */
  clearCache(componentId: string): void {
    const queue = this.messageQueues.get(componentId)
    if (queue) {
      queue.length = 0
    }
    const status = this.statuses.get(componentId)
    if (status) {
      this.statuses.set(componentId, {
        ...status,
        hasData: false
      })
      this.triggerStatusUpdateThrottled(true) // 立即更新缓存清空状态
    }
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void {
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing:', error)
      }
    })
    this.subscribers.clear()
  }

  /**
   * 清空所有缓存
   */
  clearAllCache(): void {
    this.messageQueues.clear()
    this.statuses.clear()
  }
}

// 单例实例
export const topicSubscriptionManager = new TopicSubscriptionManager()
