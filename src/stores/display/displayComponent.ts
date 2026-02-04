/**
 * Display 组件管理模块
 * 负责 Display 组件的增删改查、选择、同步等操作
 */
import type { Ref } from 'vue'
import type { DisplayComponentData, PanelConfig, SceneState } from '../types'

export interface DisplayComponentContext {
  displayComponents: Ref<DisplayComponentData[]>
  selectedItem: Ref<string>
  panelConfig: PanelConfig
  sceneState: SceneState
  saveComponents: () => void
  savePanelConfig: () => void
}

/**
 * 获取默认配置选项
 */
export function getDefaultOptions(type: string): Record<string, any> {
  const defaults: Record<string, any> = {
    grid: {
      referenceFrame: '<Fixed Frame>',
      planeCellCount: 10,
      normalCellCount: 0,
      cellSize: 1,
      lineStyle: 'Lines',
      color: '#a0a0a4',
      alpha: 0.5,
      plane: 'XY',
      offset: '0; 0; 0',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0
    },
    axes: {
      referenceFrame: '<Fixed Frame>',
      length: 1,
      radius: 0.1,
      showTrail: false,
      alpha: 1
    },
    camera: {
      topic: '/camera/rgb/image_raw',
      queueSize: 2,
      transportHint: 'raw'
    },
    map: {
      topic: '/map',
      alpha: 1.0, // RViz 默认完全不透明，显示更清晰
      colorScheme: 'map',
      drawBehind: false,
      resolution: 0,
      width: 0,
      height: 0,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      orientationW: 1,
      unreliable: false,
      useTimestamp: false
    },
    path: {
      topic: '/path',
      color: '#ff0000',
      bufferLength: 1
    },
    marker: {
      topic: '/marker',
      queueSize: 100
    },
    image: {
      topic: '/camera/rgb/image_raw',
      queueSize: 2,
      transportHint: 'raw'
    },
    laserscan: {
      topic: '/scan',
      queueSize: 10,
      style: 'Flat Squares',
      size: 0.01,
      alpha: 1,
      colorTransformer: 'Intensity',
      useRainbow: true,
      autocomputeIntensityBounds: true,
      minIntensity: 0,
      maxIntensity: 0,
      minColor: { r: 0, g: 0, b: 0 },
      maxColor: { r: 255, g: 255, b: 255 },
      invertRainbow: false
    },
    pointcloud2: {
      topic: '/pointcloud',
      queueSize: 10,
      size: 0.01,
      alpha: 1,
      colorTransformer: 'RGB',
      useRainbow: true,
      minColor: { r: 0, g: 0, b: 0 },
      maxColor: { r: 255, g: 255, b: 255 }
    },
    tf: {
      showNames: true,
      showAxes: true,
      showArrows: true,
      markerScale: 2,
      markerAlpha: 1,
      updateInterval: 0,
      frameTimeout: 15,
      filterWhitelist: '',
      filterBlacklist: '',
      frames: [
        { name: 'base_footprint', enabled: true },
        { name: 'base_link', enabled: true },
        { name: 'base_scan', enabled: true },
        { name: 'camera_link', enabled: true },
        { name: 'camera_rgb_frame', enabled: true },
        { name: 'camera_rgb_optical_frame', enabled: true },
        { name: 'caster_back_left_link', enabled: true },
        { name: 'caster_back_right_link', enabled: true },
        { name: 'imu_link', enabled: true },
        { name: 'map', enabled: true },
        { name: 'odom', enabled: true },
        { name: 'wheel_left_link', enabled: true },
        { name: 'wheel_right_link', enabled: true }
      ]
    },
    'global-options': {
      fixedFrame: 'map',
      backgroundColor: '#808080',
      frameRate: 30,
      defaultLight: true
    }
  }
  return defaults[type] || {}
}

/**
 * 同步组件状态到3D场景
 */
export function syncComponentToScene(
  component: DisplayComponentData,
  sceneState: SceneState
) {
  switch (component.type) {
    case 'grid':
      sceneState.showGrid = component.enabled
      if (component.options.alpha !== undefined) {
        sceneState.showGrid = component.enabled && component.options.alpha > 0
      }
      break
    case 'axes':
      sceneState.showAxes = component.enabled
      break
    case 'map':
      sceneState.showMap = component.enabled
      break
    case 'path':
      sceneState.showPath = component.enabled
      break
    case 'laserscan':
      sceneState.showLaser = component.enabled
      break
    case 'robotmodel':
      sceneState.showRobot = component.enabled
      break
  }
}

/**
 * 创建 Display 组件管理功能
 */
export function createDisplayComponentManager(context: DisplayComponentContext) {
  const {
    displayComponents,
    selectedItem,
    panelConfig,
    sceneState,
    saveComponents,
    savePanelConfig
  } = context

  // 添加组件
  const addComponent = (type: string, name: string) => {
    const componentId = `${type}-${Date.now()}`
    const component: DisplayComponentData = {
      id: componentId,
      type,
      name,
      enabled: true,
      expanded: true,
      options: getDefaultOptions(type)
    }
    displayComponents.value.push(component)
    selectedItem.value = componentId
    
    // 如果是图像组件，添加到统一顺序和 imagePanelOrder
    if (type === 'camera' || type === 'image') {
      if (!panelConfig.imagePanelOrder) {
        panelConfig.imagePanelOrder = []
      }
      panelConfig.imagePanelOrder.push(componentId)
      
      if (!panelConfig.allPanelsOrder) {
        panelConfig.allPanelsOrder = []
      }
      panelConfig.allPanelsOrder.push(`image-${componentId}`)
      
      savePanelConfig()
    }
    
    saveComponents()
    return component
  }

  // 更新组件
  const updateComponent = (componentId: string, updates: Partial<DisplayComponentData>) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      Object.assign(component, updates)
      // 如果更新了enabled状态，同步到sceneState
      if (updates.enabled !== undefined) {
        syncComponentToScene(component, sceneState)
      }
      saveComponents()
    }
  }

  // 更新组件配置选项
  const updateComponentOptions = (componentId: string, options: Record<string, any>) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      component.options = { ...component.options, ...options }
      // 同步到sceneState
      syncComponentToScene(component, sceneState)
      saveComponents()
    }
  }

  // 删除组件
  const removeComponent = (componentId: string) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      displayComponents.value.splice(displayComponents.value.indexOf(component), 1)
      if (selectedItem.value === componentId) {
        selectedItem.value = ''
      }
      // 如果是图像组件，从 imagePanelOrder 和统一顺序中移除
      if ((component.type === 'camera' || component.type === 'image')) {
        if (panelConfig.imagePanelOrder) {
          const orderIndex = panelConfig.imagePanelOrder.indexOf(componentId)
          if (orderIndex > -1) {
            panelConfig.imagePanelOrder.splice(orderIndex, 1)
          }
        }
        if (panelConfig.allPanelsOrder) {
          const allOrderIndex = panelConfig.allPanelsOrder.indexOf(`image-${componentId}`)
          if (allOrderIndex > -1) {
            panelConfig.allPanelsOrder.splice(allOrderIndex, 1)
          }
        }
        savePanelConfig()
      }
      // 同步到sceneState - 设置为false
      syncComponentToScene({ ...component, enabled: false }, sceneState)
      saveComponents()
    }
  }

  // 重命名组件
  const renameComponent = (componentId: string, newName: string) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      component.name = newName
      saveComponents()
    }
  }

  // 复制组件
  const duplicateComponent = (componentId: string) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      // 所有相同类型的 panel 使用相同的标题，不添加序号
      const duplicated: DisplayComponentData = {
        ...component,
        id: `${component.type}-${Date.now()}`,
        name: component.name
      }
      displayComponents.value.push(duplicated)
      selectedItem.value = duplicated.id
      saveComponents()
      return duplicated
    }
  }

  // 选择组件
  const selectComponent = (componentId: string) => {
    selectedItem.value = componentId
  }

  return {
    addComponent,
    updateComponent,
    updateComponentOptions,
    removeComponent,
    renameComponent,
    duplicateComponent,
    selectComponent
  }
}
