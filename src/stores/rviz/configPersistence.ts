/**
 * 配置持久化模块
 * 负责将配置保存到和从 localStorage 加载
 */
import type { Ref } from 'vue'
import type { DisplayComponentData, GlobalOptions, PanelConfig, SceneState } from './types'
import { syncComponentToScene, getDefaultOptions } from './displayComponent'

export interface ConfigPersistenceContext {
  displayComponents: Ref<DisplayComponentData[]>
  globalOptions: GlobalOptions
  panelConfig: PanelConfig
  sceneState: SceneState
  getDefaultOptions: (type: string) => Record<string, any>
}

/**
 * 创建配置持久化功能
 */
export function createConfigPersistenceManager(context: ConfigPersistenceContext) {
  const {
    displayComponents,
    globalOptions,
    panelConfig,
    sceneState,
    getDefaultOptions
  } = context

  // 保存组件到本地存储
  const saveComponents = () => {
    localStorage.setItem('rviz-display-components', JSON.stringify(displayComponents.value))
  }

  // 保存全局选项到本地存储
  const saveGlobalOptions = () => {
    localStorage.setItem('rviz-global-options', JSON.stringify(globalOptions))
  }

  // 保存面板配置到本地存储
  const savePanelConfig = () => {
    localStorage.setItem('rviz-panel-config', JSON.stringify(panelConfig))
  }

  // 加载组件从本地存储
  const loadComponents = () => {
    const saved = localStorage.getItem('rviz-display-components')
    if (saved) {
      try {
        displayComponents.value = JSON.parse(saved)
        // 同步所有组件到sceneState
        displayComponents.value.forEach(component => {
          syncComponentToScene(component, sceneState)
        })
      } catch (e) {
        console.error('Failed to load display components:', e)
      }
    } else {
      // 默认添加Grid和Axes
      const gridId = `grid-${Date.now()}`
      const axesId = `axes-${Date.now()}`
      displayComponents.value.push({
        id: gridId,
        type: 'grid',
        name: 'Grid',
        enabled: true,
        expanded: true,
        options: getDefaultOptions('grid')
      })
      displayComponents.value.push({
        id: axesId,
        type: 'axes',
        name: 'Axes',
        enabled: true,
        expanded: true,
        options: getDefaultOptions('axes')
      })
    }
  }

  // 加载全局选项从本地存储
  const loadGlobalOptions = () => {
    const saved = localStorage.getItem('rviz-global-options')
    if (saved) {
      try {
        const options = JSON.parse(saved)
        Object.assign(globalOptions, options)
        // 同步到sceneState
        sceneState.backgroundColor = globalOptions.backgroundColor
        sceneState.fps = globalOptions.frameRate
      } catch (e) {
        console.error('Failed to load global options:', e)
      }
    }
  }

  // 加载面板配置从本地存储
  const loadPanelConfig = () => {
    const saved = localStorage.getItem('rviz-panel-config')
    if (saved) {
      try {
        const config = JSON.parse(saved)
        Object.assign(panelConfig, config)
      } catch (e) {
        console.error('Failed to load panel config:', e)
      }
    }
  }

  // 保存完整配置
  const saveCurrentConfig = () => {
    const config = {
      panelConfig: { ...panelConfig },
      globalOptions: { ...globalOptions },
      displayComponents: [...displayComponents.value],
      sceneState: { ...sceneState }
    }
    localStorage.setItem('rviz-full-config', JSON.stringify(config))
    return config
  }

  // 加载完整配置
  const loadSavedConfig = () => {
    const saved = localStorage.getItem('rviz-full-config')
    if (saved) {
      try {
        const config = JSON.parse(saved)
        if (config.panelConfig) Object.assign(panelConfig, config.panelConfig)
        if (config.globalOptions) Object.assign(globalOptions, config.globalOptions)
        if (config.displayComponents) displayComponents.value = config.displayComponents
        if (config.sceneState) Object.assign(sceneState, config.sceneState)
        return config
      } catch (e) {
        console.error('Failed to load config:', e)
      }
    }
    return null
  }

  // 导出配置
  const exportConfig = () => {
    const config = saveCurrentConfig()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = `rviz-config-${new Date().getTime()}.json`
    link.href = URL.createObjectURL(blob)
    link.click()
  }

  // 导入配置
  const importConfig = (configData: any) => {
    try {
      if (configData.panelConfig) Object.assign(panelConfig, configData.panelConfig)
      if (configData.globalOptions) Object.assign(globalOptions, configData.globalOptions)
      if (configData.displayComponents) displayComponents.value = configData.displayComponents
      if (configData.sceneState) Object.assign(sceneState, configData.sceneState)

      // 保存到本地存储
      saveCurrentConfig()
      return true
    } catch (e) {
      console.error('Failed to import config:', e)
      return false
    }
  }

  return {
    saveComponents,
    saveGlobalOptions,
    savePanelConfig,
    loadComponents,
    loadGlobalOptions,
    loadPanelConfig,
    saveCurrentConfig,
    loadSavedConfig,
    exportConfig,
    importConfig
  }
}
