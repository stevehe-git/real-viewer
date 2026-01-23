/**
 * 数据订阅管理模块
 * 负责组件数据缓存和话题订阅管理
 */
import type { Ref } from 'vue'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'

export interface DataSubscriptionContext {
  componentDataCache: Ref<Map<string, any>>
}

/**
 * 创建数据订阅管理功能
 */
export function createDataSubscriptionManager(context: DataSubscriptionContext) {
  const { componentDataCache } = context

  // 更新组件数据（从话题订阅接收的数据）
  const updateComponentData = (componentId: string, data: any) => {
    componentDataCache.value.set(componentId, data)
  }

  // 获取组件数据
  // 优先从统一订阅管理器获取最新数据（单一数据源）
  const getComponentData = (componentId: string): any | null => {
    // 优先从统一订阅管理器获取最新数据
    const latestMessage = topicSubscriptionManager.getLatestMessage(componentId)
    if (latestMessage) {
      return latestMessage
    }
    // 回退到缓存（兼容旧代码，但应该逐步移除）
    return componentDataCache.value.get(componentId) || null
  }

  // 清除组件数据
  const clearComponentData = (componentId: string) => {
    componentDataCache.value.delete(componentId)
    topicSubscriptionManager.clearCache(componentId)
  }

  // 订阅组件话题（统一管理）
  const subscribeComponentTopic = (
    componentId: string,
    componentType: string,
    topic: string | undefined,
    queueSize: number = 10
  ): boolean => {
    console.log("subscribeComponentTopic", componentId, componentType, topic, queueSize)
    return topicSubscriptionManager.subscribe(componentId, componentType, topic, queueSize)
  }

  // 取消订阅组件话题
  const unsubscribeComponentTopic = (componentId: string) => {
    topicSubscriptionManager.unsubscribe(componentId)
  }

  // 获取组件订阅状态
  const getComponentSubscriptionStatus = (componentId: string) => {
    return topicSubscriptionManager.getStatus(componentId)
  }

  return {
    updateComponentData,
    getComponentData,
    clearComponentData,
    subscribeComponentTopic,
    unsubscribeComponentTopic,
    getComponentSubscriptionStatus
  }
}
