import { watch, onUnmounted, computed } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { topicSubscriptionManager, type SubscriptionStatus, type CachedMessage } from '@/services/topicSubscriptionManager'

/**
 * 话题订阅和数据缓存 composable
 * 使用统一的话题订阅管理器，避免重复订阅
 */
export function useTopicSubscription(
  componentId: string,
  componentType: string,
  topic: string | undefined,
  queueSize: number = 10
) {
  const rvizStore = useRvizStore()
  
  // 获取状态更新触发器（用于响应式追踪）
  const statusUpdateTrigger = topicSubscriptionManager.getStatusUpdateTrigger()
  
  // 订阅状态（从统一管理器获取，通过触发器实现响应式）
  const status = computed<SubscriptionStatus>(() => {
    // 访问触发器以确保响应式追踪
    statusUpdateTrigger.value
    return topicSubscriptionManager.getStatus(componentId) || {
      subscribed: false,
      hasData: false,
      messageCount: 0,
      lastMessageTime: null,
      error: null
    }
  })
  
  // 数据缓存队列（从统一管理器获取）
  const messageQueue = computed<CachedMessage[]>(() => {
    return topicSubscriptionManager.getAllMessages(componentId)
  })
  
  // 订阅话题（使用统一管理器）
  const subscribe = () => {
    if (!topic || topic.trim() === '') {
      return
    }
    rvizStore.subscribeComponentTopic(componentId, componentType, topic, queueSize)
  }
  
  // 取消订阅（使用统一管理器）
  const unsubscribe = () => {
    rvizStore.unsubscribeComponentTopic(componentId)
  }
  
  // 获取最新消息（从统一管理器获取，使用响应式追踪）
  const getLatestMessage = computed(() => {
    // 访问触发器以确保响应式追踪
    statusUpdateTrigger.value
    return topicSubscriptionManager.getLatestMessage(componentId)
  })
  
  // 获取所有缓存的消息（从统一管理器获取）
  const getAllMessages = (): CachedMessage[] => {
    return topicSubscriptionManager.getAllMessages(componentId)
  }
  
  // 清空缓存（使用统一管理器）
  const clearCache = () => {
    topicSubscriptionManager.clearCache(componentId)
  }
  
  // 监听话题变化
  watch(() => topic, (newTopic: string | undefined) => {
    if (newTopic && newTopic.trim() !== '') {
      subscribe()
    } else {
      unsubscribe()
      clearCache()
    }
  }, { immediate: true })
  
  // 监听队列大小变化
  watch(() => queueSize, () => {
    // 重新订阅以应用新的队列大小
    if (topic && topic.trim() !== '') {
      subscribe()
    }
  })
  
  // 监听 ROS 连接状态
  watch(() => rvizStore.robotConnection.connected, (connected) => {
    if (connected && topic && topic.trim() !== '') {
      subscribe()
    } else {
      unsubscribe()
      clearCache()
    }
  })
  
  // 组件卸载时取消订阅
  onUnmounted(() => {
    unsubscribe()
    clearCache()
  })
  
  return {
    status,
    messageQueue,
    subscribe,
    unsubscribe,
    getLatestMessage: () => getLatestMessage.value, // 返回函数以保持API兼容
    getAllMessages,
    clearCache
  }
}
