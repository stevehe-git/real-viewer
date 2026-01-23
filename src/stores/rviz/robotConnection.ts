/**
 * 机器人连接管理模块
 * 负责机器人连接、插件管理等操作
 */
import type { Ref } from 'vue'
import { PluginRegistry } from '@/plugins/communication'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'
import { tfManager } from '@/services/tfManager'
import type { CommunicationPlugin, ConnectionParams, RobotConnection } from './types'

export interface RobotConnectionContext {
  communicationPlugins: Ref<Map<string, CommunicationPlugin>>
  robotConnection: RobotConnection
}

/**
 * 创建机器人连接管理功能
 */
export function createRobotConnectionManager(context: RobotConnectionContext) {
  const { communicationPlugins, robotConnection } = context
  
  // 当前使用的插件实例
  let currentPlugin: CommunicationPlugin | null = null

  // 更新可用插件列表
  const updateAvailablePlugins = () => {
    robotConnection.availablePlugins = Array.from(communicationPlugins.value.values())
  }

  // 注册插件
  const registerPlugin = (plugin: CommunicationPlugin) => {
    communicationPlugins.value.set(plugin.id, plugin)
    updateAvailablePlugins()
  }

  // 注销插件
  const unregisterPlugin = (pluginId: string) => {
    communicationPlugins.value.delete(pluginId)
    updateAvailablePlugins()
  }

  // 获取插件
  const getPlugin = (pluginId: string): CommunicationPlugin | null => {
    return communicationPlugins.value.get(pluginId) || null
  }

  // 连接机器人
  const connectRobot = async (protocol: string, params: ConnectionParams) => {
    try {
      // 如果已经连接，先断开
      if (currentPlugin) {
        await disconnectRobot()
      }

      // 获取对应的插件
      currentPlugin = getPlugin(protocol)
      if (!currentPlugin) {
        throw new Error(`Plugin '${protocol}' not found`)
      }

      robotConnection.protocol = protocol
      robotConnection.params = { ...params }

      // 使用插件连接
      const success = await currentPlugin.connect(params)
      if (!success) {
        throw new Error('Connection failed')
      } else {
        console.log('Connection successful')
      }

      // 先更新话题订阅管理器的 ROS 插件（在设置 connected 之前）
      if (protocol === 'ros' && currentPlugin) {
        topicSubscriptionManager.setROSPlugin(currentPlugin)
      }

      // 最后设置连接状态，这会触发 watch 订阅话题
      robotConnection.connected = true
      
      // 在连接成功后初始化 TF 管理器
      if (protocol === 'ros' && currentPlugin) {
        setTimeout(() => {
          const rosInstance = (currentPlugin as any).getROSInstance?.()
          if (rosInstance) {
            try {
              tfManager.setROSInstance(rosInstance)
              console.log('RViz: TFManager set ROS instance successfully')
            } catch (error) {
              console.error('RViz: TFManager error setting ROS instance', error)
            }
          }
        }, 100)
      }

      return true
    } catch (error) {
      console.error('Robot connection failed:', error)
      robotConnection.connected = false
      currentPlugin = null
      return false
    }
  }

  // 断开机器人连接
  const disconnectRobot = () => {
    try {
      if (currentPlugin) {
        currentPlugin.disconnect()
        currentPlugin = null
      }

      robotConnection.connected = false

      // 断开连接时取消所有订阅
      topicSubscriptionManager.unsubscribeAll()
      topicSubscriptionManager.clearAllCache()
      topicSubscriptionManager.setROSPlugin(null)
      
      // 清理 TF 管理器
      tfManager.cleanup()
    } catch (error) {
      console.error('Robot disconnection failed:', error)
    }
  }

  // 初始化插件（从注册表加载）
  const initPlugins = () => {
    const plugins = PluginRegistry.getAllPlugins()
    plugins.forEach(plugin => {
      registerPlugin(plugin)
    })
  }

  return {
    registerPlugin,
    unregisterPlugin,
    getPlugin,
    connectRobot,
    disconnectRobot,
    initPlugins
  }
}
