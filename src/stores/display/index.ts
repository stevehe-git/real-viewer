/**
 * 显示组件管理
 * 管理显示组件的添加、删除、更新等
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DisplayComponent {
  id: string
  name: string
  type: string
  enabled: boolean
  options?: any
}

export const useDisplayStore = defineStore('display', () => {
  // 显示组件列表
  const displayComponents = ref<DisplayComponent[]>([])

  // 组件数据存储（用于存储订阅的消息数据）
  const componentData = ref<Map<string, any>>(new Map())

  // 组件管理方法
  function addComponent(component: DisplayComponent) {
    const existing = displayComponents.value.find(c => c.id === component.id)
    if (!existing) {
      displayComponents.value.push(component)
    }
  }

  function removeComponent(componentId: string) {
    const index = displayComponents.value.findIndex(c => c.id === componentId)
    if (index > -1) {
      displayComponents.value.splice(index, 1)
      componentData.value.delete(componentId)
    }
  }

  function updateComponent(componentId: string, updates: Partial<DisplayComponent>) {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      Object.assign(component, updates)
    }
  }

  function updateComponentOptions(componentId: string, options: Record<string, any>) {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      component.options = {
        ...component.options,
        ...options
      }
    }
  }

  function updateComponentData(componentId: string, data: any) {
    componentData.value.set(componentId, data)
  }

  function clearComponentData(componentId: string) {
    componentData.value.delete(componentId)
  }

  function getComponentData(componentId: string): any {
    return componentData.value.get(componentId) || null
  }

  // 初始化：添加默认网格组件
  function initialize() {
    // 如果显示组件列表为空，添加默认的网格组件
    if (displayComponents.value.length === 0) {
      const defaultGridComponent: DisplayComponent = {
        id: 'display-grid-default',
        name: 'Grid',
        type: 'grid',
        enabled: true,
        options: {}
      }
      displayComponents.value.push(defaultGridComponent)
    }
  }

  return {
    displayComponents,
    componentData,
    addComponent,
    removeComponent,
    updateComponent,
    updateComponentOptions,
    updateComponentData,
    clearComponentData,
    getComponentData,
    initialize
  }
})
