/**
 * 通信状态管理
 * 管理机器人连接、插件、话题订阅等
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { PluginRegistry } from '../../plugins/communication'
import type { CommunicationPlugin, ConnectionParams } from '../types'

export interface CommunicationState {
  currentPlugin: CommunicationPlugin | null
  isConnected: boolean
  host: string
  port: number
  topics: string[]
}

// 机器人连接状态（兼容旧代码）
export interface RobotConnection {
  connected: boolean
  availablePlugins: CommunicationPlugin[]
  currentPlugin: CommunicationPlugin | null
  connectionParams: ConnectionParams | null
}

export const useCommunicationStore = defineStore('communication', () => {
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

  // 获取所有可用插件
  const availablePlugins = computed(() => {
    return Array.from(registeredPlugins.value.values())
  })

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

  // 连接机器人
  async function connectRobot(pluginId: string, params: ConnectionParams): Promise<boolean> {
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

  // 初始化：注册所有插件
  function initialize() {
    PluginRegistry.registerAll({ registerPlugin })
  }

  return {
    communicationState,
    registeredPlugins,
    availablePlugins,
    robotConnection,
    registerPlugin,
    connectRobot,
    disconnectRobot,
    getTopics,
    initialize
  }
})
