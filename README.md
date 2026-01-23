# 机器人可视化平台 (ROS Viewer)

基于 Vue3 + TypeScript 开发的通用机器人可视化平台，支持多种通信协议（ROS、MQTT、WebSocket等），可扩展实现不同机型可视化UI，类似 RViz 的功能，用于调试和监控各类机器人系统。

## 📋 目录

- [核心特性](#-核心特性)
- [技术架构](#-技术架构)
- [支持的ROS消息类型](#-支持的ros消息类型)
- [3D可视化功能](#-3d可视化功能)
- [页面功能](#-页面功能)
- [安装和运行](#-安装和运行)
- [使用指南](#-使用指南)
- [开发指南](#-开发指南)
- [项目结构](#-项目结构)
- [更新记录](#-更新记录)
🎯 核心特性
✅ 已实现的核心功能
1. 多协议通信支持

    ✅ ROS1/ROS2 - 完整的 ROS 生态系统支持
    ✅ MQTT - 轻量级物联网通信协议
    ✅ WebSocket - 实时双向通信
    ✅ 可扩展架构 - 支持自定义协议扩展

2. 统一数据格式

    ✅ 标准化机器人数据模型
    ✅ 自动协议数据转换
    ✅ 类型安全的数据处理
    ✅ 实时数据流管理

3. 高性能UI系统

    ✅ 组件化设计 - 每个功能模块独立封装
    ✅ 业务逻辑分离 - UI显示与业务逻辑完全分离
    ✅ 单一职责原则 - 每个组件职责清晰
    ✅ 可复用架构 - 组件和函数高度可复用
    ✅ 低延迟渲染 - 优化性能和响应速度

4. 先进的3D可视化功能

    ✅ 3D场景渲染 - 基于 THREE.js 的高性能3D渲染引擎
    ✅ 2D地图渲染和交互 - 支持 nav_msgs/OccupancyGrid
    ✅ 机器人位姿实时跟踪 - TF 坐标系树可视化
    ✅ 路径规划可视化 - nav_msgs/Path 消息渲染
    ✅ 传感器数据展示 - 激光雷达、点云、图像等
    ✅ 多图层管理 - 支持多个显示组件叠加
    ✅ 实时状态监控 - FPS、内存、对象数量等性能指标
    ✅ 交互式控制 - 鼠标旋转、平移、缩放
    ✅ 可配置显示 - 网格、坐标轴、背景色等可配置

5. 完整的数据管理系统

    ✅ Pinia状态管理 - 集中式状态管理
    ✅ 通用数据结构 - 支持 ROS/Protobuf/JSON 数据格式
    ✅ 数据持久化 - 本地存储和导出功能
    ✅ 实时数据流 - 高性能数据处理管道

6. 路由和导航系统

    ✅ Vue Router - 完整的路由支持
    ✅ 多页面架构 - 仪表板、控制面板、数据分析等
    ✅ 导航控制 - 直观的页面导航

🏗️ 技术架构

### 前端框架

- **Vue 3.5+** - 使用 Composition API + `<script setup>` 语法
- **TypeScript 5.9+** - 完整的类型安全支持
- **Vite 7.2+** - 快速的开发构建工具
- **Vue Router 4.6+** - 单页面应用路由管理
- **Pinia 3.0+** - 现代化状态管理库

### 3D渲染引擎

- **THREE.js 0.182+** - 强大的3D图形库
- **OrbitControls** - 交互式相机控制
- 支持 WebGL 硬件加速渲染

### UI组件库

- **Element Plus 2.13+** - 企业级 Vue 3 UI 组件库
- **@element-plus/icons-vue** - Element Plus 图标库

### 通信协议

- **roslib 2.0+** - ROS JavaScript 客户端库
  - 支持 ROS1/ROS2 通信
  - WebSocket 桥接（rosbridge）
- **MQTT** - 轻量级物联网通信协议（插件化实现）
- **WebSocket** - 实时双向通信（插件化实现）

### 核心依赖

```json
{
  "dependencies": {
    "vue": "^3.5.24",
    "vue-router": "^4.6.4",
    "pinia": "^3.0.4",
    "three": "^0.182.0",
    "roslib": "^2.0.1",
    "element-plus": "^2.13.1",
    "@element-plus/icons-vue": "^2.3.2"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vite": "^7.2.4",
    "vue-tsc": "^3.1.4",
    "@types/three": "^0.182.0"
  }
}
```

### 架构设计

**通信插件系统**
- `ProtocolManager` - 协议管理器，统一管理所有通信协议
- `ROSPlugin` - ROS 通信实现
- `MQTTPlugin` - MQTT 通信实现
- `WebSocketPlugin` - WebSocket 通信实现
- 插件化架构，易于扩展新的通信协议

**数据转换系统**
- `DataConverter` - 统一数据转换接口
- `ROSDataConverter` - ROS 消息格式转换
- `ProtobufDataConverter` - Protobuf 格式转换（预留）
- 支持多种数据格式的统一处理

**状态管理系统**
- `rviz.ts` (Pinia Store) - RViz 相关状态管理
  - 显示组件管理
  - 全局配置管理
  - 话题订阅管理
  - 面板配置管理

**3D渲染系统**
- `use3DRenderer.ts` - 3D 渲染组合式函数
  - 地图渲染
  - 路径渲染
  - 激光扫描渲染
  - 点云渲染
  - TF 坐标系渲染

**话题订阅系统**
- `TopicSubscriptionManager` - 统一的话题订阅管理器
  - 支持多组件订阅同一话题
  - 消息队列管理
  - 订阅状态管理
  - 自动重连机制

📦 安装和运行
前置要求

    Node.js >= 20
    ROS1 环境（可选，用于 ROS 通信）

安装依赖

npm install

开发模式

npm run dev

应用将在 http://localhost:5173 启动
构建生产版本

npm run build

🎨 使用指南

### 快速开始

1. **启动应用**
   ```bash
   npm run dev
   ```
   访问 http://localhost:5173 进入应用

2. **配置ROS连接**
   - 确保 ROS 环境已启动
   - 启动 rosbridge_server：
     ```bash
     rosrun rosbridge_server rosbridge_websocket
     ```
   - 在应用中配置 ROS 连接：
     - WebSocket URL: `ws://localhost:9090`
     - 点击连接按钮

3. **添加显示组件**
   - 点击"Add"按钮添加新的显示组件
   - 选择显示类型（Map、LaserScan、PointCloud2等）
   - 配置话题名称和参数
   - 启用组件开始可视化

### 3D可视化操作

**相机控制**
- **旋转视角**: 鼠标左键拖拽
- **平移场景**: 鼠标中键拖拽
- **缩放场景**: 鼠标滚轮
- **重置视角**: 点击"Reset Camera"按钮

**显示配置**
- **网格**: 在视图控制面板中切换网格显示
- **坐标轴**: 切换全局坐标轴显示
- **背景色**: 自定义场景背景颜色
- **组件可见性**: 在显示面板中启用/禁用各个组件

### 添加显示组件示例

**添加地图显示**
1. 点击"Add"按钮
2. 选择"Map"类型
3. 配置话题：`/map`
4. 设置颜色和透明度
5. 启用组件

**添加激光扫描显示**
1. 选择"LaserScan"类型
2. 配置话题：`/scan`
3. 选择渲染样式（Flat Squares/Points/Billboards）
4. 设置点大小和颜色映射
5. 启用组件

**添加TF坐标系显示**
1. 选择"TF"类型
2. 配置固定帧（Fixed Frame）：`map`
3. 选择要显示的坐标系
4. 配置显示选项（名称、坐标轴、箭头）
5. 启用组件

### 面板管理

- **显示/隐藏面板**: 在设置中配置要显示的面板
- **折叠面板**: 点击面板标题栏折叠/展开
- **关闭面板**: 点击关闭按钮（设置面板除外）
- **面板配置**: 面板配置会自动保存到本地存储

🔧 开发指南
架构原则

    组件封装 - 每个功能模块独立组件
    函数抽取 - 业务逻辑抽取为独立函数
    职责分离 - UI显示与业务逻辑分离
    单一职责 - 每个组件/函数职责清晰
    高性能 - 优化渲染和数据处理性能
    类型安全 - 完整的 TypeScript 类型支持

### 添加新的显示类型

1. **创建配置组件** (`src/components/panels/display-configs/YourTypeConfig.vue`)
2. **在 DisplayComponent.vue 中注册配置组件**
3. **在 use3DRenderer.ts 中添加渲染逻辑**
4. **在 DisplayTypeSelector.vue 中添加类型选项**

### 添加新的通信协议

1. **实现 CommunicationPlugin 接口** (`src/plugins/communication/your-protocol-plugin.ts`)
2. **在 ProtocolManager 中注册插件**
3. **创建对应的数据转换器**（如需要）

### 数据流设计

```
ROS Topic → rosbridge → TopicSubscriptionManager → Store → Component → use3DRenderer → THREE.js Scene
```

- **数据接收**: ROS 话题通过 rosbridge WebSocket 传输到前端
- **数据管理**: TopicSubscriptionManager 统一管理订阅和消息队列
- **状态存储**: Pinia Store 管理组件状态和配置
- **数据渲染**: use3DRenderer 将 ROS 数据转换为 THREE.js 对象
- **场景更新**: THREE.js 场景实时渲染更新

### 性能优化建议

- **节流更新**: 使用节流机制限制更新频率（如 TF 更新每 100ms 一次）
- **对象复用**: 复用 THREE.js 对象，避免频繁创建和销毁
- **资源清理**: 及时清理不再使用的几何体和材质，防止内存泄漏
- **按需渲染**: 只渲染可见和启用的组件
- **消息队列**: 使用消息队列避免消息丢失，支持队列大小配置

## 📡 支持的ROS消息类型

### 3D可视化消息类型

| 消息类型 | ROS消息类型 | 说明 | 配置选项 |
|---------|------------|------|---------|
| **Grid** | - | 网格显示 | 单元格大小、平面方向、颜色、透明度 |
| **Axes** | - | 坐标轴显示 | 长度、半径、透明度 |
| **Map** | `nav_msgs/OccupancyGrid` | 占用网格地图 | 话题、颜色、透明度 |
| **Path** | `nav_msgs/Path` | 路径显示 | 话题、颜色、线宽 |
| **LaserScan** | `sensor_msgs/LaserScan` | 激光扫描数据 | 话题、样式、大小、颜色映射 |
| **PointCloud2** | `sensor_msgs/PointCloud2` | 点云数据 | 话题、大小、颜色映射 |
| **Marker** | `visualization_msgs/Marker` | 可视化标记 | 话题、大小、颜色 |
| **Image** | `sensor_msgs/Image` | 图像显示 | 话题、图像质量 |
| **Camera** | `sensor_msgs/Image` | 相机图像 | 话题、图像质量 |
| **TF** | `tf2_msgs/TFMessage` | 坐标变换树 | 显示名称、坐标轴、箭头、帧过滤 |

### 消息类型特性

- **LaserScan**: 支持多种渲染样式（Flat Squares、Points、Billboards），支持强度颜色映射
- **PointCloud2**: 支持 RGB 和强度颜色映射，支持彩虹色映射
- **TF**: 完整的坐标变换树可视化，支持帧过滤和启用/禁用
- **Map**: 实时地图更新，支持透明度和颜色配置

## 🎮 3D可视化功能

### 场景控制

- **相机控制**
  - 鼠标左键：旋转视角
  - 鼠标中键：平移场景
  - 鼠标滚轮：缩放场景
  - 重置相机：一键恢复到默认视角

- **显示选项**
  - 网格显示/隐藏
  - 坐标轴显示/隐藏
  - 背景颜色自定义
  - 机器人模型显示/隐藏

### 面板系统

系统提供可配置的面板系统，支持以下面板：

1. **视图控制面板** (ViewControlPanel)
   - 重置视角
   - 切换网格/坐标轴显示
   - 相机模式切换
   - 背景颜色设置

2. **场景信息面板** (SceneInfoPanel)
   - 实时 FPS 显示
   - 相机位置信息
   - 渲染对象数量
   - 内存使用情况
   - 纹理数量统计

3. **工具面板** (ToolPanel)
   - 截图功能
   - 场景导出
   - 场景重置
   - 录制控制
   - 性能模式切换
   - 调试信息显示

4. **显示面板** (DisplayPanel)
   - 添加/删除显示组件
   - 配置组件参数
   - 启用/禁用组件
   - 组件重命名和复制

5. **机器人连接面板** (RobotConnectionPanel)
   - ROS 连接配置
   - 连接状态显示
   - 话题列表查看

### 显示组件配置

每个显示组件都支持详细的配置选项：

- **Grid**: 单元格大小、平面方向（XY/XZ/YZ）、颜色、透明度、偏移
- **Axes**: 长度、半径、透明度
- **LaserScan**: 样式、点大小、透明度、颜色映射、强度范围
- **PointCloud2**: 点大小、透明度、颜色映射（RGB/强度）
- **TF**: 显示名称、坐标轴、箭头、标记缩放、帧过滤

## 📄 页面功能

### 导航 (Navigation)

- **导航预览** (`/navigation/overview`)
  - 实时导航状态监控
  - 机器人位置跟踪
  - 路径可视化

- **路径规划** (`/navigation/route-planning`)
  - 路径规划界面
  - 目标点设置
  - 路径优化

### 航点管理 (Waypoints)

- **航点列表** (`/waypoints/list`)
  - 查看所有航点
  - 航点编辑和删除

- **创建/编辑航点** (`/waypoints/create`, `/waypoints/edit/:id`)
  - 航点位置设置
  - 航点属性配置

### 地图管理 (Map Management)

- **地图列表** (`/map-management/list`)
  - 查看所有地图
  - 地图预览和编辑

- **创建/编辑地图** (`/map-management/create`, `/map-management/edit/:id`)
  - 地图创建和编辑
  - 地图属性配置

### 控制 (Control)

- **设备控制** (`/control/device-control`)
  - 设备状态监控
  - 设备控制命令

- **远程控制** (`/control/remote-control`)
  - 远程操作界面
  - 实时控制反馈

- **指令历史** (`/control/command-history`)
  - 查看历史指令
  - 指令重放

- **状态监控** (`/control/status-monitoring`)
  - 系统状态监控
  - 实时数据展示

### 数据分析 (Analysis)

- **数据分析** (`/analysis/data-analysis`)
  - 数据统计和分析
  - 数据可视化

- **性能报告** (`/analysis/performance-report`)
  - 系统性能分析
  - 性能报告生成

- **统计信息** (`/analysis/statistics`)
  - 数据统计
  - 趋势分析

- **趋势分析** (`/analysis/trend-analysis`)
  - 数据趋势可视化
  - 预测分析

### 任务管理 (Task Management)

- **任务列表** (`/task-management/task-list`)
  - 查看所有任务
  - 任务状态监控

- **创建/编辑任务** (`/task-management/task-create`, `/task-management/task-edit/:id`)
  - 任务创建和编辑
  - 任务参数配置

- **任务执行** (`/task-management/task-execution/:id`)
  - 任务执行监控
  - 实时执行状态

### 用户管理 (User Management)

- **用户列表** (`/user-management/user-list`)
  - 用户管理
  - 用户信息查看

- **添加/编辑用户** (`/user-management/user-add`, `/user-management/user-edit/:id`)
  - 用户创建和编辑
  - 用户权限配置

- **用户权限** (`/user-management/user-permissions/:id`)
  - 权限管理
  - 角色配置

## 📁 项目结构

```
ros-viewer/
├── src/
│   ├── components/          # Vue 组件
│   │   ├── panels/         # 面板组件系统
│   │   │   ├── display-configs/  # 显示组件配置
│   │   │   ├── BasePanel.vue
│   │   │   ├── DisplayPanel.vue
│   │   │   ├── PanelManager.vue
│   │   │   └── ...
│   │   ├── Rviz3DViewer.vue  # 3D 可视化主组件
│   │   ├── Sidebar.vue
│   │   └── Header.vue
│   ├── composables/        # 组合式函数
│   │   ├── use3DRenderer.ts  # 3D 渲染逻辑
│   │   └── useTopicSubscription.ts
│   ├── services/           # 服务层
│   │   ├── dataConverter.ts  # 数据转换器
│   │   ├── tfManager.ts      # TF 管理器
│   │   └── topicSubscriptionManager.ts
│   ├── stores/             # Pinia 状态管理
│   │   └── rviz.ts         # RViz 状态存储
│   ├── plugins/            # 通信插件
│   │   └── communication/  # 通信协议实现
│   │       ├── ros-plugin.ts
│   │       ├── mqtt-plugin.ts
│   │       └── websocket-plugin.ts
│   ├── views/              # 页面视图
│   │   ├── Navigation/     # 导航相关页面
│   │   ├── Control/        # 控制相关页面
│   │   ├── Analysis/       # 分析相关页面
│   │   └── ...
│   ├── router/             # 路由配置
│   │   └── index.ts
│   └── main.ts             # 应用入口
├── public/                  # 静态资源
├── package.json            # 项目配置
└── README.md              # 项目文档
```

### 核心模块说明

- **`use3DRenderer.ts`**: 3D 渲染核心逻辑，负责将 ROS 数据转换为 THREE.js 场景对象
- **`tfManager.ts`**: TF 坐标变换管理器，处理 `/tf` 和 `/tf_static` 话题
- **`topicSubscriptionManager.ts`**: 统一的话题订阅管理器，支持多组件订阅
- **`dataConverter.ts`**: 数据格式转换器，支持 ROS/Protobuf/JSON 格式转换
- **`rviz.ts`**: Pinia 状态存储，管理所有显示组件和全局配置

## 📝 更新记录

### 2024-12-XX - TF 坐标系渲染修复

#### 🐛 修复的问题

1. **重复渲染问题**
   - 修复了 TF 树根节点被重复渲染两次的问题
   - 移除了 `updateTFRender` 函数中重复的根节点遍历代码

2. **坐标转换错误**
   - 修复了 ROS 坐标系到 THREE.js 坐标系的位置转换错误
   - 问题：在俯视 XY 平面时，base_scan 和 base_footprint 的 X 轴和 Y 轴显示被交换
   - 原因：位置转换时 ROS Y 轴（向左）直接映射到 THREE.js X 轴，未考虑符号
   - 修复：将 `threeX = rosY` 改为 `threeX = -rosY`，确保正确的坐标映射

3. **Frame 默认渲染问题**
   - 修复了当 `options.frames` 为空时，所有 frame 都不被渲染的问题
   - 现在默认会渲染所有从 `tfManager` 获取的 frames

4. **坐标转换注释优化**
   - 更新了所有坐标转换相关的注释，明确说明 ROS 坐标系标准
   - ROS 标准：X 向前，Y 向左，Z 向上（右手坐标系）
   - THREE.js 标准：X 向右，Y 向上，Z 向前

#### 🔧 技术细节

**坐标转换逻辑**：
- ROS X（向前）→ THREE.js Z（向前）
- ROS Y（向左）→ THREE.js -X（向左），经过旋转矩阵后变为 +X（向右）
- ROS Z（向上）→ THREE.js Y（向上）

**旋转矩阵**：
1. 绕 Y 轴旋转 -90 度：将 ROS 的 XZ 平面旋转到 THREE.js 的 XZ 平面
2. 绕 Z 轴旋转 180 度：将 ROS 的 Y 轴（向左）翻转到 THREE.js 的 X 轴（向右）

#### ✅ 验证结果

修复后，在俯视 XY 平面时：
- base_scan 和 base_footprint 的 X 轴和 Y 轴大小和方向与 RViz 完全一致
- 所有 frame 的坐标轴颜色和方向正确显示
- 坐标变换路径查找逻辑正确，支持从 fixedFrame 向下查找和从 frameName 向下查找（取逆）两种情况

#### 📁 修改的文件

- `src/composables/use3DRenderer.ts`
  - 修复 `updateTFRender` 函数中的重复渲染
  - 修复位置转换逻辑（两处：pathDown 和 pathUp 路径）
  - 添加默认 frame 渲染逻辑
  - 更新坐标转换注释

---

### 2024-12-XX - TF 渲染器架构重构

#### 🎯 重构概述

根据核心结论重构了整个 TF 数据订阅和渲染逻辑，确保与 RViz 完全一致。本次重构采用全新的架构设计，将 TF 渲染逻辑完全分离，使用正确的坐标转换公式，严格还原 ROS TF 树的层级结构。

#### 📐 核心原理（必须牢记）

**ROS 与 THREE.js 的坐标系差异**：

- **ROS (RViz) 标准坐标系**：右手坐标系
  - X 轴 → 机器人正前方
  - Y 轴 → 机器人左侧方
  - Z 轴 → 垂直地面正上方

- **THREE.js 标准坐标系**：右手坐标系
  - X 轴 → 屏幕右侧方
  - Y 轴 → 屏幕正上方
  - Z 轴 → 屏幕正前方（朝向自己）

**唯一正确的坐标转换公式**：

```typescript
// ROS 原始平移数据: ros_x, ros_y, ros_z
const three_x = ros_x;    // ROS X → THREE.js X
const three_y = ros_z;    // ROS Z → THREE.js Y
const three_z = -ros_y;   // ROS Y → THREE.js -Z（取反）
```

**关键点**：
- ROS 的 Z 轴对应 THREE.js 的 Y 轴（垂直高度）
- ROS 的 Y 轴取反对应 THREE.js 的 Z 轴（解决左右方向颠倒）
- ROS 的 X 轴直接对应 THREE.js 的 X 轴（前进方向一致）

**四元数处理**：

ROS 和 THREE.js 的四元数数学定义完全相同，分量一一对应，直接赋值即可，无需任何修改。轴向映射已包含在平移坐标转换中，不需要对四元数做额外修改。

```typescript
// ROS 四元数：{x: qx, y: qy, z: qz, w: qw}
// THREE.js 四元数：THREE.Quaternion(qx, qy, qz, qw)
mesh.quaternion.set(ros_qx, ros_qy, ros_qz, ros_qw);
```

#### 🏗️ 架构重构

**1. 创建 TFRenderer 服务类**

新增文件：`src/services/tfRenderer.ts`

**职责**：
- TF 层级结构管理
- 坐标转换应用
- 坐标轴和标签渲染
- 资源清理

**核心方法**：
- `buildFrameHierarchy()`: 根据 TF 树构建 THREE.js Group 层级
- `applyTransform()`: 应用 ROS Transform 到 THREE.js Group（使用正确的坐标转换）
- `addAxes()`: 添加坐标轴可视化
- `addLabel()`: 添加名称标签
- `updateAllTransforms()`: 更新所有 frame 的变换数据

**2. 重构 use3DRenderer.ts**

**主要变更**：
- 引入 `TFRenderer` 类
- 简化 `updateTFRender()` 函数
- 移除复杂的路径查找和矩阵累积逻辑
- 使用 Group 父子关系直接还原 TF 树

**3. 坐标转换工具**

文件：`src/services/coordinateConverter.ts`（已存在）

**功能**：
- `convertROSTranslationToThree()`: 平移坐标转换
- `convertROSRotationToThree()`: 四元数转换（直接赋值）
- `applyROSTransformToObject()`: 便捷函数，同时应用平移和旋转

#### 🔧 关键实现细节

**1. 层级关系建立**

使用 THREE.Group 建立父子关系，严格还原 ROS TF 树的层级结构：

```typescript
// ✅ 正确方式：使用 Group 建立父子关系
const mapFrame = new THREE.Group()
const odomFrame = new THREE.Group()
const baseLinkFrame = new THREE.Group()
const baseScanFrame = new THREE.Group()

// 严格建立父子关系（和 ROS TF 树完全一致）
mapFrame.add(odomFrame)
odomFrame.add(baseLinkFrame)
baseLinkFrame.add(baseScanFrame)

scene.add(mapFrame)  // 只添加根节点
```

**为什么必须这么做**：
- 子对象的坐标永远是相对父对象的本地坐标
- Three.js 自动计算世界坐标
- 和 ROS 的 TF 逻辑完全一致

**2. 坐标转换应用**

```typescript
// ✅ 应用 map→odom 的 TF 数据（本地坐标）
odomFrame.position.set(ros_x, ros_z, -ros_y)  // 平移转换
odomFrame.quaternion.set(ros_qx, ros_qy, ros_qz, ros_qw)  // 四元数直接赋值
```

**3. 坐标轴渲染**

根据坐标转换公式，坐标轴应该这样绘制：
- **X 轴（红色）**：沿着 THREE.js 的 X 方向（对应 ROS X 向前）
- **Y 轴（绿色）**：沿着 THREE.js 的 -Z 方向（对应 ROS Y 向左）
- **Z 轴（蓝色）**：沿着 THREE.js 的 Y 方向（对应 ROS Z 向上）

#### ✨ 重构优势

1. **逻辑清晰**：坐标转换、TF树构建、渲染完全分离
2. **易于维护**：TFRenderer 类封装所有 TF 相关逻辑
3. **性能优化**：避免重复计算，使用 Group 层级自动计算世界坐标
4. **正确性保证**：严格遵循 ROS TF 树的层级结构
5. **代码复用**：坐标转换逻辑可在其他地方复用

#### ✅ 验证要点

修复后，在俯视 XY 平面时应该看到：
- base_scan 和 base_footprint 的 X 轴和 Y 轴大小和方向与 RViz 完全一致
- 所有 frame 的坐标轴颜色和方向正确显示
- 坐标变换路径正确，父子关系正确还原

#### 📁 文件变更

**新增文件**：
- `src/services/tfRenderer.ts` - TF 渲染器服务类

**修改文件**：
- `src/composables/use3DRenderer.ts` - 重构 TF 渲染逻辑，使用新的 TFRenderer 类
- `src/services/coordinateConverter.ts` - 已存在，提供坐标转换工具

**保持不变**：
- `src/services/tfManager.ts` - TF 数据管理逻辑不变

#### ⚠️ 注意事项

1. **不要使用欧拉角**：ROS 和 THREE.js 都优先使用四元数，避免万向锁问题
2. **不要手动计算世界坐标**：使用 Group 父子关系，Three.js 自动计算
3. **不要修改四元数分量**：直接赋值即可，轴向映射已包含在平移转换中
4. **确保父子关系正确**：这是保证所有坐标变换正确的核心前提

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 编写代码
- 遵循 Vue 3 Composition API 最佳实践
- 保持代码注释清晰
- 遵循现有的代码风格

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [THREE.js](https://threejs.org/) - JavaScript 3D 库
- [Element Plus](https://element-plus.org/) - Vue 3 组件库
- [roslib](https://github.com/RobotWebTools/roslibjs) - ROS JavaScript 库
- [RViz](http://wiki.ros.org/rviz) - ROS 可视化工具（设计参考）

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送 Pull Request
- 项目讨论区

---

**注意**: 本项目仍在积极开发中，部分功能可能尚未完全实现。欢迎贡献代码和提出建议！
