/**
 * 统一的话题订阅管理器
 * 负责管理所有组件的话题订阅，避免重复订阅
 * 支持多种数据格式（ROS/protobuf/json）
 */
import { toRaw, ref } from 'vue'
import * as ROSLIB from 'roslib'
import type { CommunicationPlugin } from '@/stores/rviz'
import { DataConverter } from './dataConverter'

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
  // 节流：状态更新节流器（每100ms最多更新一次）
  private statusUpdateThrottleTimer: number | null = null
  private pendingStatusUpdate = false
  private rosInstance: ROSLIB.Ros | null = null
  private rosPlugin: CommunicationPlugin | null = null

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
   */
  private triggerStatusUpdateThrottled() {
    this.pendingStatusUpdate = true
    
    if (this.statusUpdateThrottleTimer === null) {
      this.statusUpdateThrottleTimer = window.setTimeout(() => {
        if (this.pendingStatusUpdate) {
          this.statusUpdateTrigger.value++
          this.pendingStatusUpdate = false
        }
        this.statusUpdateThrottleTimer = null
      }, 200) // 每100ms最多更新一次
    }
  }

  /**
   * 订阅话题
   */
  subscribe(
    componentId: string,
    componentType: string,
    topic: string | undefined,
    queueSize: number = 10
  ): boolean {
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
      this.triggerStatusUpdateThrottled()
      return false
    }

    // 更新 ROS 实例（每次订阅前都更新，确保获取最新实例）
    this.updateROSInstance()

    // 检查 ROS 插件和实例
    console.log("TopicSubscriptionManager subscribe rosPlugin", this.rosPlugin)
    if (!this.rosPlugin) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'ROS plugin not set'
      })
      this.triggerStatusUpdateThrottled()
      console.warn(`TopicSubscriptionManager: ROS plugin not set for component ${componentId}, subscription will be retried`)
      return false
    }

    console.log("TopicSubscriptionManager subscribe rosInstance", this.rosInstance, this.rosInstance?.isConnected)
    if (!this.rosInstance) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'ROS instance not available'
      })
      this.triggerStatusUpdateThrottled()
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
      this.triggerStatusUpdateThrottled()
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
      this.triggerStatusUpdateThrottled()
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
        // console.log("TopicSubscriptionManager subscribe message", message)
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

        // 更新状态
        this.statuses.set(componentId, {
          subscribed: true,
          hasData: hasData,
          messageCount: currentStatus.messageCount + 1,
          lastMessageTime: timestamp,
          error: null
        })
        
        // 节流触发响应式更新（每100ms最多更新一次，避免CPU过高）
        this.triggerStatusUpdateThrottled()

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
        }
      })

      this.subscribers.set(componentId, subscriber)

      // 初始化状态
      this.statuses.set(componentId, {
        subscribed: true,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: null
      })
      this.triggerStatusUpdateThrottled()

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

    // 保留状态和队列，但标记为未订阅
    const currentStatus = this.statuses.get(componentId)
    if (currentStatus) {
      this.statuses.set(componentId, {
        ...currentStatus,
        subscribed: false
      })
      this.triggerStatusUpdateThrottled()
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
      this.triggerStatusUpdateThrottled()
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
