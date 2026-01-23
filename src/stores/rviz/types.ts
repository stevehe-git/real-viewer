/**
 * RViz Store 类型定义
 * 集中管理所有类型接口
 */

// Display组件配置接口
export interface DisplayComponentData {
  id: string
  type: string
  name: string
  enabled: boolean
  expanded: boolean
  options: Record<string, any>
}

// 全局选项接口
export interface GlobalOptions {
  fixedFrame: string
  backgroundColor: string
  frameRate: number
  defaultLight: boolean
}

// 连接参数接口
export interface ConnectionParams {
  host: string
  port: number
  [key: string]: any
}

// 通信插件接口
export interface CommunicationPlugin {
  id: string
  name: string
  description: string
  // 获取连接参数配置
  getConnectionParams(): ConnectionParam[]
  connect(params: ConnectionParams): Promise<boolean>
  disconnect(): void
  isConnected(): boolean
  getConnectionInfo(): ConnectionParams & { status: string }
}

// 连接参数配置接口
export interface ConnectionParam {
  key: string
  label: string
  type: 'text' | 'number' | 'password' | 'select'
  required: boolean
  defaultValue: any
  options?: { label: string; value: any }[] // 用于select类型
  placeholder?: string
  description?: string
}

// 机器人连接接口
export interface RobotConnection {
  protocol: string
  params: ConnectionParams
  connected: boolean
  availablePlugins: CommunicationPlugin[]
}

// 悬浮面板信息接口
export interface FloatingPanelInfo {
  panelId: string
  x: number
  y: number
  width: number
  height: number
}

// 面板配置接口
export interface PanelConfig {
  enabledPanels: string[]
  panelWidth: number
  isFullscreen: boolean
  floatingPanels?: FloatingPanelInfo[]
  imagePanelOrder?: string[] // 图像面板的显示顺序（componentId 数组）
  allPanelsOrder?: string[] // 所有面板的统一顺序（标准面板ID + image-${componentId}）
}

// 3D场景状态接口
export interface SceneState {
  showGrid: boolean
  showAxes: boolean
  showRobot: boolean
  showMap: boolean
  showPath: boolean
  showLaser: boolean
  cameraMode: string
  backgroundColor: string
  fps: number
  cameraPos: { x: number; y: number; z: number }
  objectCount: number
  memoryUsage: number
  textureCount: number
  isRecording: boolean
  performanceMode: boolean
  showDebugInfo: boolean
}
