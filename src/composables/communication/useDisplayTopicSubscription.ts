/**
 * 显示组件话题订阅管理器
 * 自动订阅所有显示配置中有 topic 的组件，并在话题变更时重新订阅
 */
import { watch, onMounted, onUnmounted } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'

// 需要订阅话题的组件类型
const TOPIC_COMPONENT_TYPES = ['map', 'path', 'laserscan', 'pointcloud2', 'marker', 'image', 'camera']

/**
 * 检查组件是否需要订阅话题
 */
function needsTopicSubscription(componentType: string): boolean {
  return TOPIC_COMPONENT_TYPES.includes(componentType)
}

/**
 * 订阅单个组件的话题
 */
function subscribeComponent(component: any) {
  const topic = component.options?.topic
  const queueSize = component.options?.queueSize || 10

  if (!topic || !component.enabled) {
    return
  }

  // 订阅话题
  topicSubscriptionManager.subscribe(
    component.id,
    component.type,
    topic,
    queueSize,
    (message: any) => {
      // 消息回调：更新组件数据到 store
      const rvizStore = useRvizStore()
      rvizStore.updateComponentData(component.id, message)
    },
    (error: string) => {
      console.error(`Failed to subscribe to topic ${topic} for component ${component.id}:`, error)
    }
  )
}

/**
 * 取消订阅单个组件的话题
 */
function unsubscribeComponent(componentId: string) {
  topicSubscriptionManager.unsubscribe(componentId)
}

/**
 * 全局显示组件话题订阅管理器
 */
export function useDisplayTopicSubscription() {
  const rvizStore = useRvizStore()

  /**
   * 订阅所有需要订阅的组件
   */
  function subscribeAllComponents() {
    if (!rvizStore.communicationState.isConnected) {
      return
    }

    rvizStore.displayComponents.forEach(component => {
      if (needsTopicSubscription(component.type) && component.enabled) {
        subscribeComponent(component)
      }
    })
  }

  /**
   * 取消订阅所有组件
   */
  function unsubscribeAllComponents() {
    rvizStore.displayComponents.forEach(component => {
      if (needsTopicSubscription(component.type)) {
        unsubscribeComponent(component.id)
      }
    })
  }

  // 监听连接状态：连接后自动订阅所有组件
  watch(
    () => rvizStore.communicationState.isConnected,
    (isConnected) => {
      if (isConnected) {
        // 连接后延迟一小段时间再订阅，确保 ROS 连接完全建立
        setTimeout(() => {
          subscribeAllComponents()
        }, 200)
      } else {
        // 断开连接时取消所有订阅
        unsubscribeAllComponents()
      }
    },
    { immediate: false }
  )

  // 监听组件列表变化：新添加的组件自动订阅
  watch(
    () => rvizStore.displayComponents.map(c => ({
      id: c.id,
      type: c.type,
      enabled: c.enabled,
      topic: c.options?.topic,
      queueSize: c.options?.queueSize
    })),
    (newComponents, oldComponents) => {
      if (!rvizStore.communicationState.isConnected) {
        return
      }

      // 检查新添加的组件
      if (oldComponents) {
        const oldIds = new Set(oldComponents.map(c => c.id))
        const newIds = new Set(newComponents.map(c => c.id))
        
        // 新添加的组件
        newComponents.forEach(component => {
          if (!oldIds.has(component.id) && needsTopicSubscription(component.type) && component.enabled) {
            const fullComponent = rvizStore.displayComponents.find(c => c.id === component.id)
            if (fullComponent) {
              subscribeComponent(fullComponent)
            }
          }
        })

        // 删除的组件
        oldComponents.forEach(component => {
          if (!newIds.has(component.id) && needsTopicSubscription(component.type)) {
            unsubscribeComponent(component.id)
          }
        })
      }
    },
    { deep: true }
  )

  // 监听每个组件的话题和启用状态变化
  watch(
    () => rvizStore.displayComponents.map(c => ({
      id: c.id,
      type: c.type,
      enabled: c.enabled,
      topic: c.options?.topic,
      queueSize: c.options?.queueSize || 10
    })),
    (newComponents, oldComponents) => {
      if (!rvizStore.communicationState.isConnected) {
        return
      }

      if (oldComponents) {
        const oldMap = new Map(oldComponents.map(c => [c.id, c]))
        
        newComponents.forEach(newComponent => {
          if (!needsTopicSubscription(newComponent.type)) {
            return
          }

          const oldComponent = oldMap.get(newComponent.id)
          if (!oldComponent) {
            return
          }

          // 检查话题是否变化
          const topicChanged = oldComponent.topic !== newComponent.topic
          // 检查队列大小是否变化
          const queueSizeChanged = oldComponent.queueSize !== newComponent.queueSize
          // 检查启用状态是否变化
          const enabledChanged = oldComponent.enabled !== newComponent.enabled

          // 获取完整的组件对象
          const fullComponent = rvizStore.displayComponents.find(c => c.id === newComponent.id)
          if (!fullComponent) {
            return
          }

          // 如果话题或队列大小变化，重新订阅
          if (topicChanged || queueSizeChanged) {
            // 先取消旧订阅
            unsubscribeComponent(newComponent.id)
            // 如果启用，重新订阅
            if (newComponent.enabled && newComponent.topic) {
              subscribeComponent(fullComponent)
            }
          } else if (enabledChanged) {
            // 只有启用状态变化
            if (newComponent.enabled && newComponent.topic) {
              // 启用时订阅
              subscribeComponent(fullComponent)
            } else {
              // 禁用时取消订阅
              unsubscribeComponent(newComponent.id)
            }
          }
        })
      }
    },
    { deep: true }
  )

  // 组件挂载时，如果已连接，立即订阅所有组件
  onMounted(() => {
    if (rvizStore.communicationState.isConnected) {
      subscribeAllComponents()
    }
  })

  // 组件卸载时，取消所有订阅
  onUnmounted(() => {
    unsubscribeAllComponents()
  })

  return {
    subscribeAllComponents,
    unsubscribeAllComponents
  }
}
