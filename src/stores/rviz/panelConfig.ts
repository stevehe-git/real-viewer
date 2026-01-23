/**
 * 面板配置管理模块
 * 负责面板的启用/禁用、悬浮、排序等操作
 */
import type { PanelConfig, FloatingPanelInfo } from './types'

/**
 * 创建默认面板配置
 */
export function createDefaultPanelConfig(): PanelConfig {
  return {
    enabledPanels: ['view-control', 'scene-info', 'tools', 'display'],
    panelWidth: 300,
    isFullscreen: false,
    floatingPanels: [],
    imagePanelOrder: [],
    allPanelsOrder: []
  }
}

/**
 * 创建面板配置管理功能
 */
export function createPanelConfigManager(
  panelConfig: PanelConfig,
  savePanelConfig: () => void
) {
  // 更新面板配置
  const updatePanelConfig = (config: Partial<PanelConfig>) => {
    Object.assign(panelConfig, config)
    savePanelConfig()
  }

  // 切换面板启用状态
  const togglePanel = (panelId: string) => {
    const index = panelConfig.enabledPanels.indexOf(panelId)
    if (index === -1) {
      panelConfig.enabledPanels.push(panelId)
    } else {
      panelConfig.enabledPanels.splice(index, 1)
    }
    savePanelConfig()
  }

  // 检查面板是否启用
  const isPanelEnabled = (panelId: string): boolean => {
    return panelConfig.enabledPanels.includes(panelId)
  }

  // 将面板移到悬浮窗口
  const floatPanel = (
    panelId: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
  ) => {
    if (!panelConfig.floatingPanels) {
      panelConfig.floatingPanels = []
    }
    
    // 如果已经在悬浮列表中，更新位置
    const existingPanel = panelConfig.floatingPanels.find(p => p.panelId === panelId)
    if (existingPanel) {
      if (x !== undefined) existingPanel.x = x
      if (y !== undefined) existingPanel.y = y
      if (width !== undefined) existingPanel.width = width
      if (height !== undefined) existingPanel.height = height
      savePanelConfig()
      return
    }
    
    // 从 enabledPanels 中移除（仅对标准面板）
    if (!panelId.startsWith('image-')) {
      const index = panelConfig.enabledPanels.indexOf(panelId)
      if (index > -1) {
        panelConfig.enabledPanels.splice(index, 1)
      }
    }
    
    // 从统一顺序中移除
    if (!panelConfig.allPanelsOrder) {
      panelConfig.allPanelsOrder = []
    }
    const orderIndex = panelConfig.allPanelsOrder.indexOf(panelId)
    if (orderIndex > -1) {
      panelConfig.allPanelsOrder.splice(orderIndex, 1)
    }
    
    // 添加到悬浮列表
    panelConfig.floatingPanels.push({
      panelId,
      x: x || 100,
      y: y || 100,
      width: width || 268,
      height: height || 500
    })
    
    savePanelConfig()
  }

  // 将面板从悬浮窗口移回 PanelManager
  const dockPanel = (panelId: string, insertIndex?: number) => {
    if (!panelConfig.floatingPanels) return
    
    // 从悬浮列表中移除
    const floatingIndex = panelConfig.floatingPanels.findIndex(p => p.panelId === panelId)
    if (floatingIndex > -1) {
      panelConfig.floatingPanels.splice(floatingIndex, 1)
    }
    
    // 确保统一顺序存在
    if (!panelConfig.allPanelsOrder) {
      panelConfig.allPanelsOrder = []
    }
    
    // 从统一顺序中移除（如果存在）
    const currentOrderIndex = panelConfig.allPanelsOrder.indexOf(panelId)
    if (currentOrderIndex > -1) {
      panelConfig.allPanelsOrder.splice(currentOrderIndex, 1)
    }
    
    // 添加到 enabledPanels（仅对标准面板）
    if (!panelId.startsWith('image-') && !panelConfig.enabledPanels.includes(panelId)) {
      panelConfig.enabledPanels.push(panelId)
    }
    
    // 插入到统一顺序的指定位置
    if (insertIndex !== undefined && insertIndex >= 0) {
      panelConfig.allPanelsOrder.splice(insertIndex, 0, panelId)
    } else {
      // 如果没有指定位置，添加到末尾
      panelConfig.allPanelsOrder.push(panelId)
    }
    
    savePanelConfig()
  }

  // 更新悬浮面板位置
  const updateFloatingPanelPosition = (panelId: string, x: number, y: number) => {
    if (!panelConfig.floatingPanels) return
    
    const panel = panelConfig.floatingPanels.find(p => p.panelId === panelId)
    if (panel) {
      panel.x = x
      panel.y = y
      savePanelConfig()
    }
  }

  // 关闭悬浮面板
  const closeFloatingPanel = (panelId: string, insertIndex?: number) => {
    if (!panelConfig.floatingPanels) return
    
    const index = panelConfig.floatingPanels.findIndex(p => p.panelId === panelId)
    if (index > -1) {
      panelConfig.floatingPanels.splice(index, 1)
      
      // 使用统一的面板顺序管理
      if (!panelConfig.allPanelsOrder) {
        panelConfig.allPanelsOrder = []
      }
      
      // 从统一顺序中移除（如果存在）
      const currentOrderIndex = panelConfig.allPanelsOrder.indexOf(panelId)
      if (currentOrderIndex > -1) {
        panelConfig.allPanelsOrder.splice(currentOrderIndex, 1)
      }
      
      // 将面板重新添加到 enabledPanels（仅对标准面板）
      if (!panelId.startsWith('image-') && !panelConfig.enabledPanels.includes(panelId)) {
        panelConfig.enabledPanels.push(panelId)
      }
      
      // 插入到统一顺序的指定位置
      if (insertIndex !== undefined && insertIndex >= 0) {
        panelConfig.allPanelsOrder.splice(insertIndex, 0, panelId)
      } else {
        // 如果没有指定位置，添加到末尾
        panelConfig.allPanelsOrder.push(panelId)
      }
      
      savePanelConfig()
    }
  }

  // 获取悬浮面板列表
  const getFloatingPanels = (): FloatingPanelInfo[] => {
    return panelConfig.floatingPanels || []
  }

  // 重新排序所有面板（用于 PanelManager 内部拖拽）
  const reorderAllPanels = (fromIndex: number, toIndex: number) => {
    if (!panelConfig.allPanelsOrder) {
      panelConfig.allPanelsOrder = []
      // 初始化：先添加标准面板，再添加图像面板
      for (const panelId of panelConfig.enabledPanels) {
        panelConfig.allPanelsOrder.push(panelId)
      }
      if (panelConfig.imagePanelOrder) {
        for (const componentId of panelConfig.imagePanelOrder) {
          panelConfig.allPanelsOrder.push(`image-${componentId}`)
        }
      }
    }
    
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= panelConfig.allPanelsOrder.length) return
    if (toIndex < 0 || toIndex >= panelConfig.allPanelsOrder.length) return
    
    const panelId = panelConfig.allPanelsOrder[fromIndex]
    if (!panelId) return
    
    // 从原位置移除
    panelConfig.allPanelsOrder.splice(fromIndex, 1)
    
    // 调整目标索引（如果从前面移除，目标索引需要减1）
    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    
    // 插入到新位置
    panelConfig.allPanelsOrder.splice(adjustedToIndex, 0, panelId)
    
    savePanelConfig()
  }

  return {
    updatePanelConfig,
    togglePanel,
    isPanelEnabled,
    floatPanel,
    dockPanel,
    updateFloatingPanelPosition,
    closeFloatingPanel,
    getFloatingPanels,
    reorderAllPanels
  }
}
