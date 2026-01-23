`# 渲染器模块说明

## 目录结构

```
renderers/
├── index.ts              # 统一导出所有渲染器
├── mapRenderer.ts        # Map 渲染器
├── pathRenderer.ts       # Path 渲染器
├── laserScanRenderer.ts  # LaserScan 渲染器
├── pointCloudRenderer.ts # PointCloud2 渲染器
├── axesRenderer.ts       # Axes 渲染器
├── tfRenderer.ts         # TF 可视化渲染器
└── robotModelRenderer.ts # RobotModel 渲染器
```

## 设计原则

### 1. 单一职责
每个渲染器只负责一种数据类型的渲染，职责清晰。

### 2. 统一接口
所有渲染器都遵循相同的接口模式：
```typescript
export function updateXXXRender(
  context: XXXRendererContext,
  componentId: string,
  message?: any
)
```

### 3. 上下文注入
通过 Context 对象注入依赖，而不是直接访问全局状态：
- `scene`: THREE.js 场景
- `renderObjects`: 渲染对象存储
- `getComponent`: 获取组件配置
- `getFixedFrame`: 获取固定帧
- `getROSInstance`: 获取 ROS 实例（如需要）

### 4. 易于测试
每个渲染器都是纯函数，易于单元测试。

## 使用示例

```typescript
// 在主文件中组合所有渲染器
import {
  updateMapRender,
  updatePathRender,
  updateLaserScanRender,
  // ...
} from './renderers'

// 创建统一的上下文
const context = {
  scene,
  renderObjects,
  getComponent,
  getFixedFrame,
  // ...
}

// 调用渲染器
updateMapRender(context, componentId, message)
```

## 添加新渲染器

1. 在 `renderers/` 目录下创建新文件，如 `newRenderer.ts`
2. 定义 Context 接口和渲染函数
3. 在 `index.ts` 中导出
4. 在主文件 `use3DRenderer.ts` 中集成

## 优势

- ✅ **模块化**：每个渲染器独立，易于理解和维护
- ✅ **可扩展**：添加新渲染器不影响现有代码
- ✅ **可测试**：每个渲染器可以独立测试
- ✅ **代码复用**：公共逻辑可以提取到工具函数
- ✅ **类型安全**：TypeScript 类型检查确保接口一致性
