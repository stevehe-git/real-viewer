/**
 * Display 组件管理
 * 管理显示组件的添加、删除、更新等
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DisplayComponentData } from './types'
import { getDefaultOptions } from './display/displayComponent'

export interface DisplayComponent {
  id: string
  name: string
  type: string
  enabled: boolean
  options?: any
}

export const useDisplayStore = defineStore('display', () => {
  // 显示组件列表
  const displayComponents = ref<DisplayComponentData[]>([])

  // 组件数据存储（用于存储订阅的消息数据）
  const componentData = ref<Map<string, any>>(new Map())

  // 选中的组件ID
  const selectedItem = ref<string>('')

  // 添加组件
  function addComponent(component: DisplayComponentData | { type: string; name: string }) {
    let newComponent: DisplayComponentData
    
    if ('id' in component) {
      newComponent = component as DisplayComponentData
    } else {
      // 从类型和名称创建
      newComponent = {
        id: `${component.type}-${Date.now()}`,
        type: component.type,
        name: component.name,
        enabled: true,
        expanded: true,
        options: getDefaultOptions(component.type)
      }
    }
    
    const existing = displayComponents.value.find(c => c.id === newComponent.id)
    if (!existing) {
      displayComponents.value.push(newComponent)
    }
  }

  // 删除组件
  function removeComponent(componentId: string) {
    const index = displayComponents.value.findIndex(c => c.id === componentId)
    if (index > -1) {
      displayComponents.value.splice(index, 1)
      componentData.value.delete(componentId)
      if (selectedItem.value === componentId) {
        selectedItem.value = ''
      }
    }
  }

  // 更新组件
  function updateComponent(componentId: string, updates: Partial<DisplayComponentData>) {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      Object.assign(component, updates)
    }
  }

  // 更新组件选项
  function updateComponentOptions(componentId: string, options: Record<string, any>) {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      component.options = {
        ...component.options,
        ...options
      }
    }
  }

  // 更新组件数据
  function updateComponentData(componentId: string, data: any) {
    componentData.value.set(componentId, data)
  }

  // 清除组件数据
  function clearComponentData(componentId: string) {
    componentData.value.delete(componentId)
  }

  // 获取组件数据
  function getComponentData(componentId: string): any {
    return componentData.value.get(componentId) || null
  }

  // 初始化：添加默认网格组件
  function initialize() {
    // 如果显示组件列表为空，添加默认的网格组件
    if (displayComponents.value.length === 0) {
      const defaultGridComponent: DisplayComponentData = {
        id: 'display-grid-default',
        name: 'Grid',
        type: 'grid',
        enabled: true,
        expanded: true,
        options: getDefaultOptions('grid')
      }
      displayComponents.value.push(defaultGridComponent)
    }
  }

  return {
    displayComponents,
    componentData,
    selectedItem,
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

// 导出类型（保持向后兼容）
export type { DisplayComponent } from './types'
