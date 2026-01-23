import * as ROSLIB from 'roslib'
import type { CommunicationPlugin, ConnectionParams, ConnectionParam } from '@/stores/rviz'

export class ROSPlugin implements CommunicationPlugin {
  id = 'ros'
  name = 'ROS'
  description = 'Robot Operating System WebSocket连接'

  private rosInstance: ROSLIB.Ros | null = null

  getConnectionParams(): ConnectionParam[] {
    return [
      {
        key: 'host',
        label: 'ROS Master主机',
        type: 'text',
        required: true,
        defaultValue: 'localhost',
        placeholder: '输入ROS Master主机地址',
        description: 'ROS Master运行的主机地址'
      },
      {
        key: 'port',
        label: 'WebSocket端口',
        type: 'number',
        required: true,
        defaultValue: 9090,
        placeholder: '输入WebSocket端口',
        description: 'ROS WebSocket服务器端口'
      }
    ]
  }

  private currentParams: ConnectionParams | null = null

  async connect(params: ConnectionParams): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 如果已经存在连接，先断开
      if (this.rosInstance) {
        this.disconnect()
      }

      const { host, port } = params
      console.log(`Connecting to ROS at ${host}:${port}`)

      // 保存当前连接参数
      this.currentParams = { ...params, connected: false }

      // 创建ROS连接
      this.rosInstance = new ROSLIB.Ros({
        url: `ws://${host}:${port}`
      })

      // 连接成功
      this.rosInstance.on('connection', () => {
        console.log('Connected to ROS')
        if (this.currentParams) {
          this.currentParams.connected = true
        }
        resolve(true)
      })

      // 连接错误
      this.rosInstance.on('error', (error) => {
        console.error('ROS connection error:', error)
        if (this.currentParams) {
          this.currentParams.connected = false
        }
        reject(error)
      })

      // 连接关闭
      this.rosInstance.on('close', () => {
        console.log('ROS connection closed')
        if (this.currentParams) {
          this.currentParams.connected = false
        }
      })

      // 设置连接超时
      setTimeout(() => {
        if (!this.currentParams?.connected) {
          reject(new Error('Connection timeout'))
        }
      }, 5000)
    })
  }

  disconnect(): void {
    if (this.rosInstance) {
      console.log('Disconnecting from ROS')
      this.rosInstance.close()
      this.rosInstance = null
    }
    if (this.currentParams) {
      this.currentParams.connected = false
    }
  }

  isConnected(): boolean {
    return this.currentParams?.connected || false
  }

  getConnectionInfo(): ConnectionParams & { status: string } {
    return {
      ...(this.currentParams || { host: '', port: 0 }),
      status: this.currentParams?.connected ? '已连接' : '未连接'
    }
  }

  // 获取 ROS 实例
  getROSInstance(): ROSLIB.Ros | null {
    // 直接返回实例，不访问 isConnected 以避免在响应式代理中访问私有成员
    return this.rosInstance
  }
}

// 创建ROS插件实例
export const rosPlugin = new ROSPlugin()