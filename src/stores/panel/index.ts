/**
 * 面板配置管理
 * 管理面板的显示、布局、悬浮等配置
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface FloatingPanel {
  panelId: string
  x: number
  y: number
  width: number
  height: number
}

export interface PanelConfig {
  enabledPanels: string[]
  panelWidth: number
  floatingPanels: FloatingPanel[]
  imagePanelOrder?: string[]
  allPanelsOrder?: string[]
}

export const usePanelStore = defineStore('panel', () => {
  const panelConfig = ref<PanelConfig>({
    enabledPanels: ['view-control', 'scene-info', 'tools', 'display'],
    panelWidth: 300,
    floatingPanels: []
  })

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
  function reorderAllPanels(fromIndex: number, toIndex: number, displayComponents: any[]) {
    if (!panelConfig.value.allPanelsOrder) {
      const allPanelIds = [
        ...panelConfig.value.enabledPanels,
        ...displayComponents
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

  return {
    panelConfig,
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
    savePanelConfig,
    loadPanelConfig
  }
})
