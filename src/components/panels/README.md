# 面板系统 (Panel System)

这个面板系统允许用户动态添加、删除和配置各种控制面板，提供高度可定制的ROS可视化界面。

## 架构概述

### 组件结构
```
panels/
├── BasePanel.vue          # 基础面板组件，提供折叠、关闭等通用功能
├── ViewControlPanel.vue   # 视图控制面板（相机、重置、显示选项等）
├── SceneInfoPanel.vue     # 场景信息面板（FPS、位置、对象数量等）
├── ToolPanel.vue          # 工具面板（截图、导出、录制等）
└── PanelManager.vue       # 面板管理器，负责面板的显示和配置
```

### 主要特性

1. **可折叠面板**: 每个面板都可以折叠/展开
2. **可关闭面板**: 面板可以被关闭（除了设置面板）
3. **动态配置**: 用户可以通过设置面板选择显示哪些面板
4. **持久化配置**: 面板配置会保存到localStorage
5. **可扩展**: 轻松添加新的面板类型

## 使用方法

### 添加新面板

1. 创建新的面板组件，继承`BasePanel`：
```vue
<template>
  <BasePanel title="我的面板" :icon="MyIcon">
    <!-- 面板内容 -->
  </BasePanel>
</template>
```

2. 在`PanelManager.vue`中注册新面板：
   - 导入新组件
   - 添加到`availablePanels`数组
   - 在模板中添加条件渲染
   - 添加相应的props和events

3. 在`Rviz3DViewer.vue`中添加状态和处理逻辑：
   - 添加相关的响应式变量
   - 实现事件处理函数
   - 传递给`PanelManager`

### 面板配置

面板的显示状态通过localStorage持久化保存，键名为`rviz-enabled-panels`。

## 现有面板

### 视图控制面板 (ViewControlPanel)
- 重置视角
- 切换网格显示
- 切换坐标轴显示
- 相机模式切换
- 显示选项控制
- 背景颜色设置

### 场景信息面板 (SceneInfoPanel)
- FPS显示
- 相机位置
- 渲染对象数量
- 内存使用情况
- 纹理数量

### 工具面板 (ToolPanel)
- 截图功能
- 场景导出
- 场景重置
- 录制控制
- 性能模式切换
- 调试信息显示

## 扩展指南

要添加新的面板类型：

1. **创建面板组件**：继承`BasePanel`，实现特定功能
2. **注册面板**：在`PanelManager`中添加面板定义
3. **添加状态管理**：在`Rviz3DViewer`中添加相关状态和处理逻辑
4. **配置传递**：确保props和events正确传递

这个设计使得系统高度模块化，便于维护和扩展。