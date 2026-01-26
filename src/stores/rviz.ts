/**
 * RViz Store
 * 管理RViz应用的状态，包括场景状态、面板配置、通信插件等
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { PluginRegistry } from '../plugins/communication'
import type { CommunicationPlugin } from './types'

// 场景状态
interface SceneState {
  cameraMode: 'orbit' | 'firstPerson'
  showGrid: boolean
  showAxes: boolean
  showRobot: boolean
  showMap: boolean
  showLaser: boolean
  backgroundColor: string
  fps: number
  cameraPos: { x: number; y: number; z: number }
  objectCount: number
  memoryUsage: number
  textureCount: number
  isRecording: boolean
  performanceMode: boolean
  showDebugInfo: boolean
}

// 显示组件
interface DisplayComponent {
  id: string
  name: string
  type: string
  enabled: boolean
  options?: any
}

// 面板配置
interface PanelConfig {
  enabledPanels: string[]
  panelWidth: number
  floatingPanels: Array<{
    panelId: string
    x: number
    y: number
    width: number
    height: number
  }>
  imagePanelOrder?: string[]
  allPanelsOrder?: string[]
}

  // 通信状态
  interface CommunicationState {
    currentPlugin: CommunicationPlugin | null
    isConnected: boolean
    host: string
    port: number
    topics: string[]
  }

  // 机器人连接状态（兼容旧代码）
  interface RobotConnection {
    connected: boolean
    availablePlugins: CommunicationPlugin[]
    currentPlugin: CommunicationPlugin | null
    connectionParams: import('./types').ConnectionParams | null
  }

export const useRvizStore = defineStore('rviz', () => {
  // 场景状态
  const sceneState = ref<SceneState>({
    cameraMode: 'orbit',
    showGrid: true,
    showAxes: true,
    showRobot: false,
    showMap: false,
    showLaser: false,
    backgroundColor: '#808080',
    fps: 60,
    cameraPos: { x: 0, y: 0, z: 0 },
    objectCount: 0,
    memoryUsage: 0,
    textureCount: 0,
    isRecording: false,
    performanceMode: true,
    showDebugInfo: false
  })

  // 面板配置
  const panelConfig = ref<PanelConfig>({
    enabledPanels: ['view-control', 'scene-info', 'tools', 'display'],
    panelWidth: 300,
    floatingPanels: []
  })

  // 通信状态
  const communicationState = ref<CommunicationState>({
    currentPlugin: null,
    isConnected: false,
    host: 'localhost',
    port: 9090,
    topics: []
  })

  // 已注册的插件
  const registeredPlugins = ref<Map<string, CommunicationPlugin>>(new Map())

  // 显示组件列表
  const displayComponents = ref<DisplayComponent[]>([])

  // 组件数据存储（用于存储订阅的消息数据）
  const componentData = ref<Map<string, any>>(new Map())

  // 机器人连接状态（兼容旧代码）
  const robotConnection = computed<RobotConnection>(() => ({
    connected: communicationState.value.isConnected,
    availablePlugins: availablePlugins.value,
    currentPlugin: communicationState.value.currentPlugin,
    connectionParams: communicationState.value.currentPlugin
      ? communicationState.value.currentPlugin.getConnectionInfo()
      : null
  }))

  // 注册插件
  function registerPlugin(plugin: CommunicationPlugin) {
    registeredPlugins.value.set(plugin.id, plugin)
  }

  // 获取所有可用插件
  const availablePlugins = computed(() => {
    return Array.from(registeredPlugins.value.values())
  })

  // 连接机器人
  async function connectRobot(pluginId: string, params: import('./types').ConnectionParams): Promise<boolean> {
    const plugin = registeredPlugins.value.get(pluginId)
    if (!plugin) {
      console.error(`Plugin ${pluginId} not found`)
      return false
    }

    try {
      const success = await plugin.connect(params)
      if (success) {
        communicationState.value.currentPlugin = plugin
        communicationState.value.isConnected = true
        communicationState.value.host = params.host
        communicationState.value.port = params.port
        // 获取话题列表
        communicationState.value.topics = await plugin.getTopics()
      }
      return success
    } catch (error) {
      console.error('Failed to connect:', error)
      return false
    }
  }

  // 断开连接
  function disconnectRobot() {
    if (communicationState.value.currentPlugin) {
      communicationState.value.currentPlugin.disconnect()
      communicationState.value.currentPlugin = null
      communicationState.value.isConnected = false
      communicationState.value.topics = []
    }
  }

  // 获取话题列表
  async function getTopics(): Promise<string[]> {
    if (communicationState.value.currentPlugin && communicationState.value.isConnected) {
      try {
        const topics = await communicationState.value.currentPlugin.getTopics()
        communicationState.value.topics = topics
        return topics
      } catch (error) {
        console.error('Failed to get topics:', error)
        return []
      }
    }
    return []
  }

  // 面板管理
  function enablePanel(panelId: string) {
    if (!panelConfig.value.enabledPanels.includes(panelId)) {
      panelConfig.value.enabledPanels.push(panelId)
      savePanelConfig()
    }
  }

  function disablePanel(panelId: string) {
    const index = panelConfig.value.enabledPanels.indexOf(panelId)
    if (index > -1) {
      panelConfig.value.enabledPanels.splice(index, 1)
      savePanelConfig()
    }
  }

  function togglePanel(panelId: string) {
    if (panelConfig.value.enabledPanels.includes(panelId)) {
      disablePanel(panelId)
    } else {
      enablePanel(panelId)
    }
  }

  // 悬浮面板管理
  function addFloatingPanel(panelId: string, x: number, y: number, width: number, height: number) {
    panelConfig.value.floatingPanels.push({
      panelId,
      x,
      y,
      width,
      height
    })
    savePanelConfig()
  }

  function removeFloatingPanel(panelId: string) {
    const index = panelConfig.value.floatingPanels.findIndex(p => p.panelId === panelId)
    if (index > -1) {
      panelConfig.value.floatingPanels.splice(index, 1)
      savePanelConfig()
    }
  }

  function getFloatingPanels() {
    return panelConfig.value.floatingPanels
  }

  function updateFloatingPanelPosition(panelId: string, x: number, y: number) {
    const panel = panelConfig.value.floatingPanels.find(p => p.panelId === panelId)
    if (panel) {
      panel.x = x
      panel.y = y
      savePanelConfig()
    }
  }

  // 重新排序所有面板
  function reorderAllPanels(fromIndex: number, toIndex: number) {
    if (!panelConfig.value.allPanelsOrder) {
      const allPanelIds = [
        ...panelConfig.value.enabledPanels,
        ...displayComponents.value
          .filter(c => (c.type === 'camera' || c.type === 'image') && c.enabled)
          .map(c => `image-${c.id}`)
      ]
      panelConfig.value.allPanelsOrder = [...allPanelIds]
    }
    
    const order = panelConfig.value.allPanelsOrder
    if (fromIndex >= 0 && fromIndex < order.length && toIndex >= 0 && toIndex < order.length) {
      const [moved] = order.splice(fromIndex, 1)
      if (moved) {
        order.splice(toIndex, 0, moved)
        savePanelConfig()
      }
    }
  }

  // 将面板设为悬浮
  function floatPanel(panelId: string, x: number, y: number, width: number, height: number = 400) {
    // 如果面板已经在悬浮列表中，更新位置
    const existing = panelConfig.value.floatingPanels.find(p => p.panelId === panelId)
    if (existing) {
      existing.x = x
      existing.y = y
      existing.width = width
      existing.height = height
    } else {
      // 从启用列表中移除（如果存在）
      const index = panelConfig.value.enabledPanels.indexOf(panelId)
      if (index > -1) {
        panelConfig.value.enabledPanels.splice(index, 1)
      }
      // 添加到悬浮列表
      addFloatingPanel(panelId, x, y, width, height)
    }
    savePanelConfig()
  }

  // 关闭悬浮面板（移除），可选插入位置
  function closeFloatingPanel(panelId: string, insertIndex?: number) {
    removeFloatingPanel(panelId)
    // 如果指定了插入位置，将面板添加到启用列表的指定位置
    if (insertIndex !== undefined && insertIndex >= 0) {
      if (!panelConfig.value.enabledPanels.includes(panelId)) {
        panelConfig.value.enabledPanels.splice(insertIndex, 0, panelId)
      }
    }
    savePanelConfig()
  }

  // 将悬浮面板停靠回PanelManager，可选插入位置
  function dockPanel(panelId: string, insertIndex?: number) {
    // 从悬浮列表中移除
    removeFloatingPanel(panelId)
    // 添加到启用列表
    if (!panelConfig.value.enabledPanels.includes(panelId)) {
      if (insertIndex !== undefined && insertIndex >= 0) {
        panelConfig.value.enabledPanels.splice(insertIndex, 0, panelId)
      } else {
        panelConfig.value.enabledPanels.push(panelId)
      }
    }
    savePanelConfig()
  }

  // 更新面板配置
  function updatePanelConfig(config: Partial<PanelConfig>) {
    if (config.enabledPanels) {
      panelConfig.value.enabledPanels = config.enabledPanels
    }
    if (config.panelWidth !== undefined) {
      panelConfig.value.panelWidth = config.panelWidth
    }
    if (config.floatingPanels) {
      panelConfig.value.floatingPanels = config.floatingPanels
    }
    savePanelConfig()
  }

  // 保存面板配置到localStorage
  function savePanelConfig() {
    try {
      localStorage.setItem('rviz-panel-config', JSON.stringify({
        enabledPanels: panelConfig.value.enabledPanels,
        panelWidth: panelConfig.value.panelWidth,
        floatingPanels: panelConfig.value.floatingPanels
      }))
    } catch (error) {
      console.error('Failed to save panel config:', error)
    }
  }

  // 从localStorage加载面板配置
  function loadPanelConfig() {
    try {
      const saved = localStorage.getItem('rviz-panel-config')
      if (saved) {
        const config = JSON.parse(saved)
        if (config.enabledPanels) {
          panelConfig.value.enabledPanels = config.enabledPanels
        }
        if (config.panelWidth) {
          panelConfig.value.panelWidth = config.panelWidth
        }
        if (config.floatingPanels) {
          panelConfig.value.floatingPanels = config.floatingPanels
        }
      }
    } catch (error) {
      console.error('Failed to load panel config:', error)
    }
  }

  // 配置管理
  function saveCurrentConfig() {
    try {
      const config = {
        sceneState: sceneState.value,
        panelConfig: panelConfig.value,
        communicationState: communicationState.value
      }
      localStorage.setItem('rviz-full-config', JSON.stringify(config))
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  function exportConfig() {
    try {
      const config = {
        sceneState: sceneState.value,
        panelConfig: panelConfig.value,
        communicationState: communicationState.value,
        version: '1.0.0',
        exportDate: new Date().toISOString()
      }
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rviz-config-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export config:', error)
    }
  }

  function importConfig(configData: any): boolean {
    try {
      if (configData.sceneState) {
        sceneState.value = { ...sceneState.value, ...configData.sceneState }
      }
      if (configData.panelConfig) {
        panelConfig.value = { ...panelConfig.value, ...configData.panelConfig }
        savePanelConfig()
      }
      if (configData.communicationState) {
        communicationState.value = { ...communicationState.value, ...configData.communicationState }
      }
      return true
    } catch (error) {
      console.error('Failed to import config:', error)
      return false
    }
  }

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

  // 初始化：注册所有插件并加载配置
  function initialize() {
    PluginRegistry.registerAll({ registerPlugin })
    loadPanelConfig()
    
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
    // State
    sceneState,
    panelConfig,
    communicationState,
    displayComponents,
    robotConnection,
    
    // Getters
    availablePlugins,
    
    // Actions
    registerPlugin,
    connectRobot,
    disconnectRobot,
    getTopics,
    enablePanel,
    disablePanel,
    togglePanel,
    addFloatingPanel,
    removeFloatingPanel,
    getFloatingPanels,
    updateFloatingPanelPosition,
    reorderAllPanels,
    floatPanel,
    closeFloatingPanel,
    dockPanel,
    updatePanelConfig,
    saveCurrentConfig,
    exportConfig,
    importConfig,
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
