/**
 * RViz Store
 * 主文件：组合所有功能模块
 * 
 * 重构说明：
 * - 按功能模块拆分到 stores/rviz/ 目录
 * - 主文件负责组合和协调所有模块
 * - 提供统一的接口和状态管理
 */
import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { PluginRegistry } from '@/plugins/communication'
import { tfManager } from '@/services/tfManager'
import type {
  DisplayComponentData,
  GlobalOptions,
  PanelConfig,
  SceneState,
  RobotConnection
} from './rviz/types'
import { createDefaultGlobalOptions, createGlobalOptionsManager } from './rviz/globalOptions'
import { createDefaultPanelConfig } from './rviz/panelConfig'
import { createDefaultSceneState, createSceneStateManager } from './rviz/sceneState'
import { createDisplayComponentManager, getDefaultOptions } from './rviz/displayComponent'
import { createDataSubscriptionManager } from './rviz/dataSubscription'
import { createPanelConfigManager } from './rviz/panelConfig'
import { createRobotConnectionManager } from './rviz/robotConnection'
import { createConfigPersistenceManager } from './rviz/configPersistence'

export const useRvizStore = defineStore('rviz', () => {
  // ==================== 状态定义 ====================
  
  // 通信插件注册表
  const communicationPlugins = ref<Map<string, any>>(new Map())

  // 机器人连接
  const robotConnection = reactive<RobotConnection>({
    protocol: 'ros',
    params: {
      host: 'localhost',
      port: 9090
    },
    connected: false,
    availablePlugins: []
  })

  // 面板配置
  const panelConfig = reactive<PanelConfig>(createDefaultPanelConfig())

  // 全局选项
  const globalOptions = reactive<GlobalOptions>(createDefaultGlobalOptions())

  // 3D场景状态
  const sceneState = reactive<SceneState>(createDefaultSceneState())

  // Display组件列表
  const displayComponents = ref<DisplayComponentData[]>([])

  // 选中的组件ID
  const selectedItem = ref<string>('')

  // 组件数据缓存
  const componentDataCache = ref<Map<string, any>>(new Map())

  // ==================== 创建功能模块 ====================

  // 配置持久化（需要先创建，因为其他模块会用到）
  const persistenceManager = createConfigPersistenceManager({
    displayComponents,
    globalOptions,
    panelConfig,
    sceneState,
    getDefaultOptions
  })

  // Display 组件管理
  const displayManager = createDisplayComponentManager({
    displayComponents,
    selectedItem,
    panelConfig,
    sceneState,
    saveComponents: persistenceManager.saveComponents,
    savePanelConfig: persistenceManager.savePanelConfig
  })

  // 数据订阅管理
  const subscriptionManager = createDataSubscriptionManager({
    componentDataCache
  })

  // 全局选项管理
  const globalOptionsManager = createGlobalOptionsManager(globalOptions)

  // 场景状态管理
  const sceneStateManager = createSceneStateManager(sceneState)

  // 面板配置管理
  const panelConfigManager = createPanelConfigManager(
    panelConfig,
    persistenceManager.savePanelConfig
  )

  // 机器人连接管理
  const robotConnectionManager = createRobotConnectionManager({
    communicationPlugins,
    robotConnection
  })

  // ==================== 初始化方法 ====================

  // 初始化统一面板顺序
  const initAllPanelsOrder = () => {
    if (!panelConfig.allPanelsOrder || panelConfig.allPanelsOrder.length === 0) {
      panelConfig.allPanelsOrder = []
      
      // 先添加标准面板
      for (const panelId of panelConfig.enabledPanels) {
        panelConfig.allPanelsOrder.push(panelId)
      }
      
      // 再添加图像面板
      if (panelConfig.imagePanelOrder) {
        for (const componentId of panelConfig.imagePanelOrder) {
          panelConfig.allPanelsOrder.push(`image-${componentId}`)
        }
      }
      
      persistenceManager.savePanelConfig()
    }
  }

  // 初始化
  const init = () => {
    // 初始化统一面板顺序
    initAllPanelsOrder()
    
    // 注册所有通信插件
    PluginRegistry.registerAll({ registerPlugin: robotConnectionManager.registerPlugin })

    // 加载配置
    persistenceManager.loadPanelConfig()
    persistenceManager.loadGlobalOptions()
    persistenceManager.loadComponents()
  }

  // 重置场景
  const resetScene = () => {
    sceneState.showRobot = true
    sceneState.showMap = true
    sceneState.showPath = false
    sceneState.showLaser = false
    sceneState.showGrid = true
    sceneState.showAxes = true
    sceneState.backgroundColor = '#fdfdfd'
    sceneState.cameraMode = 'orbit'
    sceneState.isRecording = false
    sceneState.performanceMode = false
    sceneState.showDebugInfo = false

    // 更新全局选项
    globalOptions.backgroundColor = '#f8f7f7'
    globalOptions.frameRate = 30
    globalOptions.defaultLight = true

    persistenceManager.saveGlobalOptions()
  }

  // ==================== 返回接口 ====================

  return {
    // 状态
    robotConnection,
    panelConfig,
    globalOptions,
    sceneState,
    displayComponents,
    selectedItem,
    componentDataCache,

    // Display 组件管理
    ...displayManager,

    // 数据订阅管理
    ...subscriptionManager,

    // 全局选项管理
    ...globalOptionsManager,

    // 场景状态管理
    ...sceneStateManager,

    // 面板配置管理
    ...panelConfigManager,

    // 机器人连接管理
    ...robotConnectionManager,

    // 配置持久化
    ...persistenceManager,

    // 初始化方法
    init,
    resetScene,

    // TF 管理器相关
    getTFFrames: () => tfManager.getFrames(),
    getTFFramesRef: () => tfManager.getFramesRef()
  }
})

// 导出类型（向后兼容）
export type {
  DisplayComponentData,
  GlobalOptions,
  PanelConfig,
  SceneState,
  RobotConnection
} from './rviz/types'
