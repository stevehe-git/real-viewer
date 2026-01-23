# RViz Store 模块说明

## 目录结构

```
stores/rviz/
├── index.ts              # 统一导出所有模块
├── types.ts              # 类型定义
├── displayComponent.ts   # Display 组件管理
├── dataSubscription.ts   # 数据订阅管理
├── globalOptions.ts      # 全局选项管理
├── sceneState.ts         # 场景状态管理
├── panelConfig.ts        # 面板配置管理
├── robotConnection.ts    # 机器人连接管理
├── configPersistence.ts # 配置持久化
└── README.md             # 本文档
```

## 模块说明

### 1. types.ts
集中管理所有类型接口定义：
- `DisplayComponentData` - Display 组件数据
- `GlobalOptions` - 全局选项
- `PanelConfig` - 面板配置
- `SceneState` - 场景状态
- `RobotConnection` - 机器人连接
- `CommunicationPlugin` - 通信插件
- 其他相关类型

### 2. displayComponent.ts
Display 组件管理模块：
- `getDefaultOptions()` - 获取默认配置选项
- `syncComponentToScene()` - 同步组件状态到场景
- `createDisplayComponentManager()` - 创建组件管理器
  - `addComponent()` - 添加组件
  - `updateComponent()` - 更新组件
  - `removeComponent()` - 删除组件
  - `renameComponent()` - 重命名组件
  - `duplicateComponent()` - 复制组件
  - `selectComponent()` - 选择组件

### 3. dataSubscription.ts
数据订阅管理模块：
- `createDataSubscriptionManager()` - 创建订阅管理器
  - `updateComponentData()` - 更新组件数据
  - `getComponentData()` - 获取组件数据
  - `clearComponentData()` - 清除组件数据
  - `subscribeComponentTopic()` - 订阅话题
  - `unsubscribeComponentTopic()` - 取消订阅
  - `getComponentSubscriptionStatus()` - 获取订阅状态

### 4. globalOptions.ts
全局选项管理模块：
- `createDefaultGlobalOptions()` - 创建默认全局选项
- `createGlobalOptionsManager()` - 创建全局选项管理器
  - `updateGlobalOptions()` - 更新全局选项

### 5. sceneState.ts
场景状态管理模块：
- `createDefaultSceneState()` - 创建默认场景状态
- `createSceneStateManager()` - 创建场景状态管理器
  - `updateSceneState()` - 更新场景状态

### 6. panelConfig.ts
面板配置管理模块：
- `createDefaultPanelConfig()` - 创建默认面板配置
- `createPanelConfigManager()` - 创建面板配置管理器
  - `updatePanelConfig()` - 更新面板配置
  - `togglePanel()` - 切换面板启用状态
  - `isPanelEnabled()` - 检查面板是否启用
  - `floatPanel()` - 将面板移到悬浮窗口
  - `dockPanel()` - 将面板移回 PanelManager
  - `updateFloatingPanelPosition()` - 更新悬浮面板位置
  - `closeFloatingPanel()` - 关闭悬浮面板
  - `getFloatingPanels()` - 获取悬浮面板列表
  - `reorderAllPanels()` - 重新排序所有面板

### 7. robotConnection.ts
机器人连接管理模块：
- `createRobotConnectionManager()` - 创建连接管理器
  - `registerPlugin()` - 注册插件
  - `unregisterPlugin()` - 注销插件
  - `getPlugin()` - 获取插件
  - `connectRobot()` - 连接机器人
  - `disconnectRobot()` - 断开连接
  - `initPlugins()` - 初始化插件

### 8. configPersistence.ts
配置持久化模块：
- `createConfigPersistenceManager()` - 创建持久化管理器
  - `saveComponents()` - 保存组件
  - `saveGlobalOptions()` - 保存全局选项
  - `savePanelConfig()` - 保存面板配置
  - `loadComponents()` - 加载组件
  - `loadGlobalOptions()` - 加载全局选项
  - `loadPanelConfig()` - 加载面板配置
  - `saveCurrentConfig()` - 保存完整配置
  - `loadSavedConfig()` - 加载完整配置
  - `exportConfig()` - 导出配置
  - `importConfig()` - 导入配置

## 使用方式

主文件 `rviz.ts` 组合所有模块：

```typescript
import { useRvizStore } from '@/stores/rviz'

const rvizStore = useRvizStore()

// 使用各个模块的功能
rvizStore.addComponent('grid', 'Grid')
rvizStore.updateGlobalOptions({ fixedFrame: 'map' })
rvizStore.connectRobot('ros', { host: 'localhost', port: 9090 })
```

## 设计原则

1. **单一职责**：每个模块只负责一个功能领域
2. **依赖注入**：通过 Context 注入依赖，避免全局状态
3. **易于测试**：每个模块都是纯函数，易于单元测试
4. **类型安全**：TypeScript 类型检查确保接口一致性
5. **向后兼容**：主文件保持原有接口，不影响现有代码

## 优势

- ✅ **模块化**：每个模块独立，易于理解和维护
- ✅ **可扩展**：添加新功能不影响现有模块
- ✅ **可测试**：每个模块可以独立测试
- ✅ **代码复用**：公共逻辑可以提取到工具函数
- ✅ **类型安全**：完整的 TypeScript 类型支持
