/**
 * 话题订阅管理器
 * 统一管理所有组件的话题订阅，避免重复订阅
 */
import { useRvizStore } from '@/stores/rviz'
import { toRaw } from 'vue'
import * as ROSLIB from 'roslib'

interface Subscription {
  componentId: string
  componentType: string
  topic: string
  queueSize: number
  messageCallback: (message: any) => void
  errorCallback: (error: string) => void
  messages: any[]
  lastMessage: any | null
}

class TopicSubscriptionManager {
  private subscriptions = new Map<string, Subscription>()
  private rosSubscribers = new Map<string, any>() // ROS订阅者实例

  /**
   * 订阅话题
   */
  subscribe(
    componentId: string,
    componentType: string,
    topic: string,
    queueSize: number,
    messageCallback: (message: any) => void,
    errorCallback: (error: string) => void
  ) {
    // 如果已订阅，先取消
    if (this.subscriptions.has(componentId)) {
      this.unsubscribe(componentId)
    }

    const rvizStore = useRvizStore()
    const plugin = rvizStore.communicationState.currentPlugin

    if (!plugin || !rvizStore.communicationState.isConnected) {
      errorCallback('Not connected to robot')
      return
    }

    // 创建订阅对象
    const subscription: Subscription = {
      componentId,
      componentType,
      topic,
      queueSize,
      messageCallback,
      errorCallback,
      messages: [],
      lastMessage: null
    }

    this.subscriptions.set(componentId, subscription)

    // 根据插件类型订阅
    if (plugin.id === 'ros') {
      this.subscribeROS(componentId, topic, queueSize, messageCallback, errorCallback)
    } else if (plugin.id === 'mqtt') {
      this.subscribeMQTT(componentId, topic, messageCallback, errorCallback)
    } else if (plugin.id === 'websocket') {
      this.subscribeWebSocket(componentId, topic, messageCallback, errorCallback)
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(componentId: string) {
    const subscription = this.subscriptions.get(componentId)
    if (!subscription) return

    const rvizStore = useRvizStore()
    const plugin = rvizStore.communicationState.currentPlugin

    if (plugin?.id === 'ros') {
      const subscriber = this.rosSubscribers.get(componentId)
      if (subscriber) {
        subscriber.unsubscribe()
        this.rosSubscribers.delete(componentId)
      }
    }

    this.subscriptions.delete(componentId)
  }

  /**
   * 获取最新消息
   */
  getLatestMessage(componentId: string): any | null {
    const subscription = this.subscriptions.get(componentId)
    return subscription?.lastMessage || null
  }

  /**
   * ROS订阅
   */
  private subscribeROS(
    componentId: string,
    topic: string,
    queueSize: number,
    messageCallback: (message: any) => void,
    errorCallback: (error: string) => void
  ) {
    const rvizStore = useRvizStore()
    const plugin = rvizStore.communicationState.currentPlugin

    // 获取ROS实例，使用 toRaw 确保获取原始对象（避免响应式代理问题）
    const rawPlugin = toRaw(plugin)
    const ros = rawPlugin?.getROSInstance?.()
    if (!ros) {
      errorCallback('ROS instance not available')
      return
    }

    // 确保 ros 也是原始对象
    const rawRos = toRaw(ros)

    try {
      const messageType = this.getMessageType(topic)
      const subscriber = new ROSLIB.Topic({
        ros: rawRos,
        name: topic,
        messageType: messageType,
        queue_size: queueSize
      })

      subscriber.subscribe((message: any) => {
        const subscription = this.subscriptions.get(componentId)
        if (subscription) {
          subscription.lastMessage = message
          subscription.messages.push(message)
          // 保持队列大小
          if (subscription.messages.length > queueSize) {
            subscription.messages.shift()
          }
          messageCallback(message)
        }
      })

      this.rosSubscribers.set(componentId, subscriber)
    } catch (error: any) {
      errorCallback(error.message || 'Failed to subscribe to ROS topic')
    }
  }

  /**
   * MQTT订阅
   */
  private subscribeMQTT(
    componentId: string,
    topic: string,
    messageCallback: (message: any) => void,
    errorCallback: (error: string) => void
  ) {
    // TODO: 实现MQTT订阅
    errorCallback('MQTT subscription not implemented yet')
  }

  /**
   * WebSocket订阅
   */
  private subscribeWebSocket(
    componentId: string,
    topic: string,
    messageCallback: (message: any) => void,
    errorCallback: (error: string) => void
  ) {
    // TODO: 实现WebSocket订阅
    errorCallback('WebSocket subscription not implemented yet')
  }

  /**
   * 根据话题名称推断消息类型
   */
  private getMessageType(topic: string): string {
    // 根据话题名称推断消息类型
    if (topic.includes('image') || topic.includes('camera')) {
      return 'sensor_msgs/Image'
    }
    if (topic.includes('scan') || topic.includes('laser')) {
      return 'sensor_msgs/LaserScan'
    }
    if (topic.includes('pointcloud') || topic.includes('points')) {
      return 'sensor_msgs/PointCloud2'
    }
    if (topic.includes('map')) {
      return 'nav_msgs/OccupancyGrid'
    }
    if (topic.includes('path')) {
      return 'nav_msgs/Path'
    }
    if (topic.includes('marker')) {
      return 'visualization_msgs/Marker'
    }
    // 默认类型
    return 'std_msgs/String'
  }

  /**
   * 获取所有订阅
   */
  getAllSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values())
  }

  /**
   * 清除所有订阅
   */
  clearAll() {
    for (const componentId of this.subscriptions.keys()) {
      this.unsubscribe(componentId)
    }
  }
}

export const topicSubscriptionManager = new TopicSubscriptionManager()
