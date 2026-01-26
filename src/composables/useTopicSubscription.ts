/**
 * 话题订阅 Composable
 * 提供统一的话题订阅管理功能
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'

export interface SubscriptionStatus {
  subscribed: boolean
  hasData: boolean
  messageCount: number
  lastMessageTime: number | null
  error: string | null
}

export function useTopicSubscription(
  componentId: string,
  componentType: string,
  topic: string | undefined,
  queueSize: number = 10
) {
  const rvizStore = useRvizStore()
  
  // 订阅状态
  const status = ref<SubscriptionStatus>({
    subscribed: false,
    hasData: false,
    messageCount: 0,
    lastMessageTime: null,
    error: null
  })

  // 获取最新消息
  const getLatestMessage = () => {
    return topicSubscriptionManager.getLatestMessage(componentId)
  }

  // 订阅话题
  const subscribe = () => {
    if (!topic) {
      status.value.error = 'No topic specified'
      return
    }

    try {
      // 检查是否已连接
      if (!rvizStore.communicationState.isConnected) {
        status.value.error = 'Not connected to robot'
        return
      }

      // 通过topicSubscriptionManager订阅
      topicSubscriptionManager.subscribe(
        componentId,
        componentType,
        topic,
        queueSize,
        (message: any) => {
          // 更新状态
          status.value.hasData = true
          status.value.messageCount++
          status.value.lastMessageTime = Date.now()
          status.value.error = null
        },
        (error: string) => {
          status.value.error = error
        }
      )

      status.value.subscribed = true
      status.value.error = null
    } catch (error: any) {
      status.value.error = error.message || 'Subscription failed'
      status.value.subscribed = false
    }
  }

  // 取消订阅
  const unsubscribe = () => {
    topicSubscriptionManager.unsubscribe(componentId)
    status.value.subscribed = false
    status.value.hasData = false
    status.value.messageCount = 0
    status.value.lastMessageTime = null
    status.value.error = null
  }

  // 监听话题变化，自动重新订阅
  watch(() => topic, (newTopic, oldTopic) => {
    if (oldTopic && status.value.subscribed) {
      unsubscribe()
    }
    if (newTopic && rvizStore.communicationState.isConnected) {
      subscribe()
    }
  })

  // 监听连接状态
  watch(() => rvizStore.communicationState.isConnected, (isConnected) => {
    if (!isConnected && status.value.subscribed) {
      unsubscribe()
    } else if (isConnected && topic && !status.value.subscribed) {
      subscribe()
    }
  })

  // 组件卸载时取消订阅
  onUnmounted(() => {
    unsubscribe()
  })

  return {
    status,
    getLatestMessage,
    subscribe,
    unsubscribe
  }
}
