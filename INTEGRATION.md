# 工程集成说明

## 已完成的工作

### 1. Store系统 (Pinia)
- ✅ 创建了 `src/stores/rviz.ts` - RViz主状态管理
- ✅ 创建了 `src/stores/types.ts` - 类型定义
- ✅ 在 `main.ts` 中初始化Pinia和RViz store
- ✅ 配置了路径别名 `@` 指向 `src` 目录

### 2. 面板系统集成
- ✅ 在 `Overview.vue` 中集成了 `PanelManager`
- ✅ 集成了 `PanelSettingsDrawer` 抽屉组件
- ✅ 实现了面板显示/隐藏的动态布局
- ✅ 连接了所有面板事件到store状态

### 3. 通信插件系统
- ✅ 插件注册机制已实现
- ✅ ROS、MQTT、WebSocket插件已注册
- ✅ Store中实现了插件管理和连接功能

### 4. 视图控制集成
- ✅ 网格显示/隐藏控制
- ✅ 坐标轴显示/隐藏控制
- ✅ 相机模式切换
- ✅ 背景颜色设置
- ✅ 显示选项控制（机器人、地图、激光）

## 使用说明

### 启动应用
```bash
npm run dev
```

### 访问导航预览
访问 `/navigation/overview` 路由即可看到：
- 左侧：3D视图（RvizViewer）
- 右侧：面板管理器（PanelManager）
- 顶部：标题栏和面板设置按钮

### 面板设置
1. 点击顶部右侧的"面板设置"按钮
2. 在抽屉中选择要显示的面板
3. 点击"应用设置"保存配置

### 可用面板
- **视图控制**：相机控制、显示选项、背景设置
- **场景信息**：FPS、相机位置、渲染统计
- **工具面板**：截图、导出、录制等工具
- **显示配置**：Grid、Axes等显示项配置
- **机器人连接**：ROS、MQTT等协议连接管理

## 配置说明

### 面板配置持久化
面板配置会自动保存到 `localStorage`，键名：`rviz-panel-config`

### Store状态
所有状态通过Pinia store管理：
- `sceneState` - 场景状态（网格、坐标轴、相机等）
- `panelConfig` - 面板配置（启用的面板、宽度等）
- `communicationState` - 通信状态（连接信息、话题列表等）

## 扩展指南

### 添加新面板
1. 在 `src/components/panels/panels-manager/` 下创建新面板组件
2. 继承 `BasePanel` 组件
3. 在 `PanelManager.vue` 中注册新面板
4. 在 `PanelSettingsDrawer.vue` 中添加面板选项

### 添加新通信插件
1. 在 `src/plugins/communication/` 下创建插件文件
2. 实现 `CommunicationPlugin` 接口
3. 在 `src/plugins/communication/index.ts` 中注册插件
4. 插件会自动在应用启动时注册到store

## 注意事项

1. **路径别名**：确保使用 `@/` 前缀导入src目录下的文件
2. **Store初始化**：在 `main.ts` 中已自动初始化，无需手动调用
3. **面板宽度**：默认300px，可通过store的 `panelConfig.panelWidth` 调整
4. **响应式布局**：面板显示/隐藏时，3D视图会自动调整宽度
