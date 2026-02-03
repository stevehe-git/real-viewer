import { watch, computed, type WatchStopHandle } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { topicSubscriptionManager, type SubscriptionStatus, type CachedMessage } from '@/services/topicSubscriptionManager'

/**
 * 话题订阅和数据缓存 composable
 * 使用统一的话题订阅管理器，避免重复订阅
 * 注意：此 composable 可能在 watch 回调中被调用，因此不自动注册 onUnmounted
 * 调用者需要手动管理清理（通过返回的 cleanup 函数）
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
  
  // 存储 watch 停止句柄
  const watchStopHandles: WatchStopHandle[] = []
  
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
  
  // 订阅话题（使用统一管理器，只在已连接时订阅）
  // 参照 rviz/webviz：TopicSubscriptionManager 内部会检查 topic 和 queueSize 是否改变
  // 如果没有改变且已经订阅，则不会重新订阅
  const subscribe = () => {
    if (!topic || topic.trim() === '') {
      return
    }
    // 检查连接状态，只有在已连接时才订阅
    if (!rvizStore.communicationState.isConnected) {
      return
    }
    // TopicSubscriptionManager.subscribe 内部会检查是否需要重新订阅
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
  
  // 清理所有 watch 和订阅
  const cleanup = () => {
    watchStopHandles.forEach(stop => stop())
    watchStopHandles.length = 0
    unsubscribe()
    clearCache()
  }
  
  // 监听消息变化，更新 store
  const stopWatchMessage = watch(
    () => [status.value.hasData, status.value.lastMessageTime],
    () => {
      if (status.value.hasData) {
        const message = getLatestMessage.value
        if (message) {
          // 更新组件数据到 store
          rvizStore.updateComponentData(componentId, message)
        }
      }
    },
    { immediate: true }
  )
  watchStopHandles.push(stopWatchMessage)
  
  // 监听话题变化
  const stopWatchTopic = watch(() => topic, (newTopic: string | undefined) => {
    if (newTopic && newTopic.trim() !== '') {
      // 只有在已连接时才订阅
      if (rvizStore.communicationState.isConnected) {
        subscribe()
      }
    } else {
      unsubscribe()
      clearCache()
    }
  }, { immediate: true })
  watchStopHandles.push(stopWatchTopic)
  
  // 监听队列大小变化
  // 参照 rviz/webviz：queueSize 改变时需要重新订阅（因为 ROSLIB.Topic 的 queue_size 在创建时设置，无法动态修改）
  const stopWatchQueueSize = watch(() => queueSize, (newQueueSize, oldQueueSize) => {
    // 只有当 queueSize 实际改变时才重新订阅
    if (oldQueueSize !== undefined && newQueueSize !== oldQueueSize) {
      // 重新订阅以应用新的队列大小（只有在已连接时）
      if (topic && topic.trim() !== '' && rvizStore.communicationState.isConnected) {
        subscribe()
      }
    }
  })
  watchStopHandles.push(stopWatchQueueSize)
  
  // 监听 ROS 连接状态
  const stopWatchConnection = watch(() => rvizStore.communicationState.isConnected, (connected) => {
    if (connected && topic && topic.trim() !== '') {
      // 连接后延迟一小段时间再订阅，确保 ROS 连接完全建立
      setTimeout(() => {
        subscribe()
      }, 200)
    } else {
      unsubscribe()
      clearCache()
    }
  })
  watchStopHandles.push(stopWatchConnection)
  
  return {
    status,
    messageQueue,
    subscribe,
    unsubscribe,
    getLatestMessage: () => getLatestMessage.value, // 返回函数以保持API兼容
    getAllMessages,
    clearCache,
    cleanup // 返回清理函数，供调用者手动管理
  }
}
