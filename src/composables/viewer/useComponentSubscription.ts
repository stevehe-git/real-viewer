/**
 * 组件订阅管理 composable
 * 负责管理组件的话题订阅和数据更新
 */
import { watch, onUnmounted } from 'vue'
import * as THREE from 'three'
import type { useRvizStore } from '@/stores/rviz'
import type { ReturnType as Renderer3DType } from '../use3DRenderer'

export interface ComponentSubscriptionContext {
  rvizStore: ReturnType<typeof useRvizStore>
  renderer3D: Renderer3DType<typeof import('../use3DRenderer').use3DRenderer> | null
  updateComponentVisibility: (componentId: string, componentType: string) => void
  gridHelper: THREE.GridHelper | null
  axesHelper: THREE.Group | null
}

export interface ComponentSubscriptionResult {
  cleanup: () => void
}

/**
 * 检查话题是否有效
 */
const isValidTopic = (topic: string | undefined): boolean => {
  return !!(topic && topic.trim() !== '' && topic !== '<Fixed Frame>')
}

/**
 * 创建组件订阅管理器
 */
export function useComponentSubscription(
  context: ComponentSubscriptionContext
): ComponentSubscriptionResult {
  const { rvizStore, renderer3D, updateComponentVisibility, gridHelper, axesHelper } = context

  let dataCheckTimer: ReturnType<typeof setInterval> | null = null

  // 监听displayComponents的变化，使用统一订阅管理器订阅话题
  const unsubscribeComponents = watch(
    () => rvizStore.displayComponents,
    (newComponents) => {
      // 检查各种组件是否存在且启用（不依赖topic的组件）
      const hasGrid = newComponents.some(c => c.type === 'grid' && c.enabled)
      const hasAxes = newComponents.some(c => c.type === 'axes' && c.enabled)

      // 遍历所有组件，订阅配置了topic的组件（使用统一订阅管理器）
      newComponents.forEach((component) => {
        // 跳过不需要topic的组件类型
        if (component.type === 'grid' || component.type === 'axes' || component.type === 'robotmodel') {
          return
        }

        // 如果组件启用且有有效的topic，则订阅
        if (component.enabled) {
          const topic = component.options?.topic
          if (isValidTopic(topic) && rvizStore.robotConnection.connected) {
            const success = rvizStore.subscribeComponentTopic(
              component.id,
              component.type,
              topic,
              component.options?.queueSize || 10
            )
            if (!success) {
              console.warn(`Failed to subscribe component ${component.id}, will retry on connection`)
            }
          } else {
            rvizStore.unsubscribeComponentTopic(component.id)
            updateComponentVisibility(component.id, component.type)
          }
        } else {
          rvizStore.unsubscribeComponentTopic(component.id)
          updateComponentVisibility(component.id, component.type)
        }
      })

      // 更新不依赖topic的组件可见性
      if (gridHelper) {
        gridHelper.visible = hasGrid
      }
      if (axesHelper) {
        axesHelper.visible = hasAxes
      }

      // 更新sceneState以保持同步
      rvizStore.sceneState.showGrid = hasGrid
      rvizStore.sceneState.showAxes = hasAxes
    },
    { deep: true, immediate: true }
  )

  // 监听连接状态，当连接时重新订阅所有组件
  const unsubscribeConnection = watch(
    () => rvizStore.robotConnection.connected,
    (connected) => {
      if (connected) {
        setTimeout(() => {
          rvizStore.displayComponents.forEach((component) => {
            if (component.enabled && isValidTopic(component.options?.topic)) {
              rvizStore.subscribeComponentTopic(
                component.id,
                component.type,
                component.options?.topic,
                component.options?.queueSize || 10
              )
            }
          })
        }, 300)
      }
    }
  )

  // 监听组件数据变化，更新 3D 渲染
  const unsubscribeData = watch(
    () => rvizStore.displayComponents,
    () => {
      if (!renderer3D) return

      rvizStore.displayComponents.forEach((component) => {
        if (component.type === 'grid') {
          return
        }

        if (component.type === 'axes') {
          if (component.enabled && renderer3D) {
            renderer3D.updateComponentRender(component.id, component.type, {})
            updateComponentVisibility(component.id, component.type)
          } else if (renderer3D) {
            renderer3D.setComponentVisibility(component.type, false, component.id)
          }
          return
        }

        if (component.type === 'tf') {
          if (component.enabled && renderer3D) {
            renderer3D.updateComponentRender(component.id, component.type, {})
            updateComponentVisibility(component.id, component.type)
          } else if (renderer3D) {
            renderer3D.setComponentVisibility(component.type, false, component.id)
          }
          return
        }

        if (component.type === 'robotmodel') {
          if (component.enabled && renderer3D) {
            renderer3D.updateComponentRender(component.id, component.type, {})
            updateComponentVisibility(component.id, component.type)
          } else if (renderer3D) {
            renderer3D.setComponentVisibility(component.type, false, component.id)
          }
          return
        }

        if (!component.enabled) {
          return
        }

        const data = rvizStore.getComponentData(component.id)
        const subscriptionStatus = rvizStore.getComponentSubscriptionStatus(component.id)

        if (data && subscriptionStatus?.hasData && renderer3D) {
          renderer3D.updateComponentRender(component.id, component.type, data)
          updateComponentVisibility(component.id, component.type)
        } else if (renderer3D) {
          renderer3D.setComponentVisibility(component.type, false, component.id)
        }
      })
    },
    { deep: true }
  )

  // 监听组件数据变化（从统一订阅管理器）
  const unsubscribeDataCheck = watch(
    () => rvizStore.robotConnection.connected,
    (connected) => {
      if (connected && !dataCheckTimer) {
        dataCheckTimer = setInterval(() => {
          if (!renderer3D) return

          rvizStore.displayComponents.forEach((component) => {
            if (component.enabled) {
              if (component.type === 'tf') {
                renderer3D!.updateComponentRender(component.id, component.type, {})
                updateComponentVisibility(component.id, component.type)
                return
              }

              if (component.type === 'robotmodel') {
                renderer3D!.updateComponentRender(component.id, component.type, {})
                updateComponentVisibility(component.id, component.type)
                return
              }

              const data = rvizStore.getComponentData(component.id)
              const subscriptionStatus = rvizStore.getComponentSubscriptionStatus(component.id)

              if (data && subscriptionStatus?.hasData && renderer3D) {
                renderer3D.updateComponentRender(component.id, component.type, data)
                updateComponentVisibility(component.id, component.type)
              }
            }
          })
        }, 100)
      } else if (!connected && dataCheckTimer) {
        clearInterval(dataCheckTimer)
        dataCheckTimer = null
      }
    }
  )

  const cleanup = () => {
    unsubscribeComponents()
    unsubscribeConnection()
    unsubscribeData()
    unsubscribeDataCheck()

    if (dataCheckTimer) {
      clearInterval(dataCheckTimer)
      dataCheckTimer = null
    }
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    cleanup
  }
}
