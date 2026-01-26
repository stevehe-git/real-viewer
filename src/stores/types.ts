/**
 * Store类型定义
 */

export interface ConnectionParam {
  key: string
  label: string
  type: 'text' | 'number' | 'password' | 'select'
  required: boolean
  defaultValue: string | number
  placeholder?: string
  description?: string
  options?: Array<{ label: string; value: string | number }>
}

export interface ConnectionParams {
  host: string
  port: number
  connected: boolean
  [key: string]: any // 允许其他连接参数
}

export interface CommunicationPlugin {
  id: string
  name: string
  description: string
  getConnectionParams(): ConnectionParam[]
  connect(params: ConnectionParams): Promise<boolean>
  disconnect(): void
  getTopics(): Promise<string[]>
  isConnected(): boolean
  getConnectionInfo(): ConnectionParams & { status: string }
}
