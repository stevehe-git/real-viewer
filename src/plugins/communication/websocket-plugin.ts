import type { CommunicationPlugin, ConnectionParams, ConnectionParam } from '@/stores/types'

export class WebSocketPlugin implements CommunicationPlugin {
  id = 'websocket'
  name = 'WebSocket'
  description = '原生WebSocket连接'

  private ws: WebSocket | null = null
  private connectionParams: ConnectionParams = {
    host: 'localhost',
    port: 8080,
    connected: false,
    protocol: 'ws'
  }

  getConnectionParams(): ConnectionParam[] {
    return [
      {
        key: 'protocol',
        label: '协议类型',
        type: 'select',
        required: true,
        defaultValue: 'ws',
        options: [
          { label: 'WebSocket (ws)', value: 'ws' },
          { label: '安全WebSocket (wss)', value: 'wss' }
        ],
        description: '选择WebSocket协议类型'
      },
      {
        key: 'host',
        label: '主机地址',
        type: 'text',
        required: true,
        defaultValue: 'localhost',
        placeholder: '输入WebSocket服务器地址',
        description: 'WebSocket服务器主机地址'
      },
      {
        key: 'port',
        label: '端口',
        type: 'number',
        required: true,
        defaultValue: 8080,
        placeholder: '输入WebSocket端口',
        description: 'WebSocket服务器端口'
      }
    ]
  }

  async connect(params: ConnectionParams): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 如果已经存在连接，先断开
      if (this.ws) {
        this.disconnect()
      }

      const { protocol, host, port } = params
      const wsUrl = `${protocol}://${host}:${port}`
      console.log(`Connecting to WebSocket at ${wsUrl}`)

      // 更新连接信息
      this.connectionParams = { ...params, connected: false }

      try {
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('Connected to WebSocket')
          this.connectionParams.connected = true
          resolve(true)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket connection error:', error)
          this.connectionParams.connected = false
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('WebSocket connection closed')
          this.connectionParams.connected = false
        }

        // 设置连接超时
        setTimeout(() => {
          if (!this.connectionParams.connected) {
            reject(new Error('Connection timeout'))
          }
        }, 5000)

      } catch (error) {
        console.error('WebSocket connection error:', error)
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      console.log('Disconnecting from WebSocket')
      this.ws.close()
      this.ws = null
    }
    this.connectionParams.connected = false
  }

  isConnected(): boolean {
    return this.connectionParams.connected || false
  }

  getConnectionInfo(): ConnectionParams & { status: string } {
    return {
      ...this.connectionParams,
      status: this.connectionParams.connected ? '已连接' : '未连接'
    }
  }

  async getTopics(): Promise<string[]> {
    if (!this.isConnected()) {
      return []
    }
    // WebSocket获取话题的逻辑
    return []
  }
}

// 创建WebSocket插件实例
export const websocketPlugin = new WebSocketPlugin()