/**
 * RViz Store (主入口)
 * 组合所有功能模块，提供统一的访问接口，保持向后兼容
 */
import { defineStore } from 'pinia'
import { computed, toRef } from 'vue'
import { useSceneStore } from './scene'
import { usePanelStore } from './panel'
import { useCommunicationStore } from './communication'
import { useDisplayStore } from './display'

export const useRvizStore = defineStore('rviz', () => {
  // 获取各个功能模块的 store
  const sceneStore = useSceneStore()
  const panelStore = usePanelStore()
  const communicationStore = useCommunicationStore()
  const displayStore = useDisplayStore()

  // 重新导出状态（保持向后兼容，使用 toRef 保持响应式）
  const sceneState = toRef(sceneStore, 'sceneState')
  const panelConfig = toRef(panelStore, 'panelConfig')
  const communicationState = toRef(communicationStore, 'communicationState')
  const displayComponents = toRef(displayStore, 'displayComponents')
  const robotConnection = computed(() => communicationStore.robotConnection)
  const availablePlugins = computed(() => communicationStore.availablePlugins)

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
        Object.assign(sceneState.value, configData.sceneState)
      }
      if (configData.panelConfig) {
        Object.assign(panelConfig.value, configData.panelConfig)
        panelStore.savePanelConfig()
      }
      if (configData.communicationState) {
        Object.assign(communicationState.value, configData.communicationState)
      }
      return true
    } catch (error) {
      console.error('Failed to import config:', error)
      return false
    }
  }

  // 初始化：初始化所有模块
  function initialize() {
    communicationStore.initialize()
    panelStore.loadPanelConfig()
    displayStore.initialize()
  }

  // 重新导出所有方法（保持向后兼容）
  return {
    // State
    sceneState,
    panelConfig,
    communicationState,
    displayComponents,
    robotConnection,
    
    // Getters
    availablePlugins,
    
    // Scene methods (通过 sceneStore 访问)
    // 场景状态直接通过 sceneState 访问，不需要额外方法
    
    // Panel methods
    enablePanel: panelStore.enablePanel,
    disablePanel: panelStore.disablePanel,
    togglePanel: panelStore.togglePanel,
    addFloatingPanel: panelStore.addFloatingPanel,
    removeFloatingPanel: panelStore.removeFloatingPanel,
    getFloatingPanels: panelStore.getFloatingPanels,
    updateFloatingPanelPosition: panelStore.updateFloatingPanelPosition,
    reorderAllPanels: (fromIndex: number, toIndex: number) => {
      panelStore.reorderAllPanels(fromIndex, toIndex, displayStore.displayComponents)
    },
    floatPanel: panelStore.floatPanel,
    closeFloatingPanel: panelStore.closeFloatingPanel,
    dockPanel: panelStore.dockPanel,
    updatePanelConfig: panelStore.updatePanelConfig,
    
    // Communication methods
    registerPlugin: communicationStore.registerPlugin,
    connectRobot: communicationStore.connectRobot,
    disconnectRobot: communicationStore.disconnectRobot,
    getTopics: communicationStore.getTopics,
    
    // Display methods
    addComponent: displayStore.addComponent,
    removeComponent: displayStore.removeComponent,
    updateComponent: displayStore.updateComponent,
    updateComponentOptions: displayStore.updateComponentOptions,
    updateComponentData: displayStore.updateComponentData,
    clearComponentData: displayStore.clearComponentData,
    getComponentData: displayStore.getComponentData,
    
    // Config methods
    saveCurrentConfig,
    exportConfig,
    importConfig,
    
    // Initialize
    initialize
  }
})

// 导出类型（保持向后兼容）
export type { SceneState } from './scene'
export type { PanelConfig, FloatingPanel } from './panel'
export type { CommunicationState, RobotConnection } from './communication'
export type { DisplayComponent } from './display'
