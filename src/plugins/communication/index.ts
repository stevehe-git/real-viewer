import type { CommunicationPlugin } from '../../stores/types'
import { rosPlugin } from './ros-plugin'
import { mqttPlugin } from './mqtt-plugin'
import { websocketPlugin } from './websocket-plugin'

// 所有可用的通信插件
export const availablePlugins: CommunicationPlugin[] = [
  rosPlugin,
  mqttPlugin,
  websocketPlugin
]

// 插件注册器
export class PluginRegistry {
  static registerAll(store: any) {
    availablePlugins.forEach(plugin => {
      store.registerPlugin(plugin)
    })
  }
}