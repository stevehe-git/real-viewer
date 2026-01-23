# 通信插件系统

RViz的通信插件系统允许开发者轻松添加新的通信协议支持，而不需要修改核心代码。

## 插件架构

### CommunicationPlugin 接口

每个通信插件都需要实现以下接口：

```typescript
interface CommunicationPlugin {
  id: string                    // 插件唯一标识符
  name: string                  // 插件显示名称
  description: string           // 插件描述
  connect(host: string, port: number): Promise<boolean>  // 连接方法
  disconnect(): void            // 断开连接方法
  getTopics(): Promise<string[]> // 获取可用话题列表
  isConnected(): boolean        // 检查连接状态
  getConnectionInfo(): {        // 获取连接信息
    host: string
    port: number
    status: string
  }
}
```

## 现有插件

### ROS Plugin (`ros-plugin.ts`)
- **协议**: ROS WebSocket
- **依赖**: `roslib` 库
- **功能**: 完整的ROS master连接和话题管理

### MQTT Plugin (`mqtt-plugin.ts`)
- **协议**: MQTT
- **状态**: 框架已实现，等待mqtt.js集成
- **功能**: MQTT broker连接（预留实现）

### WebSocket Plugin (`websocket-plugin.ts`)
- **协议**: 原生WebSocket
- **功能**: 基础WebSocket连接

## 如何添加新插件

### 1. 创建插件文件

在 `src/plugins/communication/` 目录下创建新的插件文件：

```typescript
// my-protocol-plugin.ts
import type { CommunicationPlugin } from '@/stores/rviz'

export class MyProtocolPlugin implements CommunicationPlugin {
  id = 'my-protocol'
  name = 'My Protocol'
  description = 'Custom protocol implementation'

  private connection: any = null

  async connect(host: string, port: number): Promise<boolean> {
    // 实现连接逻辑
    return true
  }

  disconnect(): void {
    // 实现断开连接逻辑
  }

  async getTopics(): Promise<string[]> {
    // 返回可用的话题列表
    return ['topic1', 'topic2']
  }

  isConnected(): boolean {
    return this.connection !== null
  }

  getConnectionInfo() {
    return {
      host: 'localhost',
      port: 8080,
      status: this.isConnected() ? '已连接' : '未连接'
    }
  }
}

export const myProtocolPlugin = new MyProtocolPlugin()
```

### 2. 注册插件

在 `src/plugins/communication/index.ts` 中添加新插件：

```typescript
import { myProtocolPlugin } from './my-protocol-plugin'

// 添加到可用插件列表
export const availablePlugins: CommunicationPlugin[] = [
  rosPlugin,
  mqttPlugin,
  websocketPlugin,
  myProtocolPlugin  // 新增插件
]
```

### 3. 安装依赖（如果需要）

如果新插件需要额外的npm包，在项目根目录运行：

```bash
npm install package-name
```

## 插件生命周期

1. **注册**: 应用启动时，所有插件自动注册到store
2. **选择**: 用户在UI中选择通信协议
3. **连接**: 调用插件的 `connect()` 方法建立连接
4. **使用**: 连接成功后可获取话题列表等信息
5. **断开**: 调用 `disconnect()` 方法清理连接

## 使用示例

```typescript
// 在组件中使用
import { useRvizStore } from '@/stores/rviz'

const rvizStore = useRvizStore()

// 连接到ROS
await rvizStore.connectRobot('ros', 'localhost', 9090)

// 获取话题列表
const topics = await rvizStore.getTopics()

// 断开连接
rvizStore.disconnectRobot()
```

## 扩展建议

### 数据可视化集成
插件可以扩展为不仅提供连接功能，还能：
- 订阅特定话题
- 解析消息数据
- 提供数据给3D场景渲染

### 插件配置
可以为插件添加配置选项：
- 认证信息
- 连接参数
- 数据格式设置

### 插件市场
未来可以实现插件市场机制：
- 动态加载插件
- 插件版本管理
- 用户自定义插件