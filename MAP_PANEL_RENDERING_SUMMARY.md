# Map Panel 渲染逻辑总结

## 概述

系统支持同时渲染多个地图（Map Panel），每个地图可以独立配置和显示。渲染采用纹理渲染技术，使用单个四边形替代大量三角形，性能提升 100-1000 倍。

## 核心架构

### 1. 数据流程

```
ROS Topic (OccupancyGrid)
    ↓
TopicSubscriptionManager (订阅消息)
    ↓
useDisplaySync.syncMapDisplay() (同步显示状态)
    ↓
SceneManager.updateMap() (处理地图数据)
    ↓
Web Worker (后台处理，转换为纹理数据)
    ↓
SceneManager.updateMapDrawCall() (创建/更新渲染命令)
    ↓
统一渲染回调 (所有地图共享一次 camera.draw)
    ↓
GPU 渲染 (纹理渲染)
```

### 2. 关键数据结构

#### SceneManager 中的地图相关 Map：

- **`mapTextureDataMap`**: 存储处理后的纹理数据（每个 componentId 对应一个纹理数据）
- **`mapConfigMap`**: 存储每个地图的配置（alpha, colorScheme, drawBehind）
- **`mapCommands`**: 存储每个地图的 regl command 实例
- **`mapPropsMap`**: 存储每个地图的渲染属性（用于传递给 regl command）
- **`mapTopicMap`**: 存储每个地图的 topic（用于检测 topic 变化）
- **`mapDataHashMap`**: 存储数据哈希（用于纹理缓存）
- **`mapMessageHashMap`**: 存储消息哈希（用于检测数据变化）
- **`mapRequestIds`**: 存储请求 ID（用于取消过时的 Worker 请求）

## 渲染流程详解

### 阶段 1: 数据订阅与同步

**位置**: `src/composables/viewer/scene/useDisplaySync.ts`

```typescript
function syncMapDisplay(previousMapIds?: Set<string>): Set<string> {
  // 1. 获取所有 map 类型的组件
  const mapComponents = rvizStore.displayComponents.filter(c => c.type === 'map')
  
  // 2. 清理已删除的地图组件
  // 3. 处理每个地图组件：
  mapComponents.forEach((mapComponent) => {
    if (mapComponent.enabled) {
      // 设置配置（alpha, colorScheme, drawBehind, topic）
      context.setMapOptions({...}, mapComponent.id)
      
      // 获取最新消息并更新
      const mapMessage = topicSubscriptionManager.getLatestMessage(mapComponent.id)
      if (mapMessage) {
        context.updateMap(mapMessage, mapComponent.id)
      }
    }
  })
}
```

### 阶段 2: 数据预处理

**位置**: `src/components/RvizViewer/core/SceneManager.ts` - `updateMap()`

#### 2.1 消息验证与哈希检测

```typescript
// 生成消息哈希（包含数据内容采样）
const messageHash = this.generateMapMessageHash(message)
const lastMessageHash = this.mapMessageHashMap.get(componentId)

// 如果消息哈希相同，直接返回（避免重复处理）
if (lastMessageHash === messageHash && this.mapTextureDataMap.has(componentId)) {
  return
}
```

#### 2.2 Web Worker 处理

```typescript
// 使用 Web Worker 在后台处理地图数据
const result = await worker.processMap({
  componentId,
  message: serializedMessage,
  config: { alpha, colorScheme }
})

// 保存处理后的纹理数据
this.mapTextureDataMap.set(componentId, {
  textureData: result.textureData,  // RGBA 纹理数据
  width, height, resolution, origin,
  dataHash: result.dataHash
})
```

**Worker 处理逻辑** (`src/workers/dataProcessor.worker.ts`):

- 将 OccupancyGrid 数据转换为 RGBA 纹理数据
- R 通道存储占用值（归一化到 0-1）:
  - `-1` (未知) → `0.0`
  - `0` (自由) → `0.5`
  - `1-100` (占用) → `0.5 + (occupancy/100.0) * 0.5`
- G, B 通道保留，A 通道存储 alpha

### 阶段 3: 渲染命令创建

**位置**: `src/components/RvizViewer/core/SceneManager.ts` - `updateMapDrawCall()`

#### 3.1 创建独立的 regl Command

```typescript
// 为每个地图创建独立的 regl command 实例
if (!this.mapCommands.has(componentId)) {
  const mapCommand = makeMapTextureCommand()(this.reglContext)
  this.mapCommands.set(componentId, mapCommand)
}
```

#### 3.2 Z 偏移计算（深度排序）

**关键策略**：为每个地图分配唯一的 Z 偏移，避免深度冲突

```typescript
// 分离 drawBehind 和正常地图
const drawBehindMaps: string[] = []
const normalMaps: string[] = []

// 分配 Z 偏移：
if (drawBehind) {
  // drawBehind 地图：Z < 0
  // 第一个: -0.01, 第二个: -0.02, 第三个: -0.03...
  zOffset = -0.01 - drawBehindIndex * 0.001
} else {
  // 正常地图：Z >= 0
  // 第一个: 0.0, 第二个: 0.001, 第三个: 0.002...
  zOffset = normalIndex * 0.001
}
```

#### 3.3 创建渲染属性

```typescript
const mapProps = {
  textureData: textureData.textureData,
  width, height, resolution, origin,
  alpha: currentConfig.alpha,
  colorScheme: currentConfig.colorScheme,
  zOffset: zOffset,
  dataHash: textureData.dataHash
}

this.mapPropsMap.set(componentId, mapProps)
```

### 阶段 4: 统一渲染回调

**位置**: `src/components/RvizViewer/core/SceneManager.ts` - `updateMapRenderCallback()`

#### 核心优化：所有地图共享一次 `camera.draw` 调用

```typescript
this.mapRenderCallback = () => {
  const { camera } = this.worldviewContext.initializedData
  const cameraState = this.worldviewContext.cameraStore.state
  
  // 关键优化：只调用一次 camera.draw
  camera.draw(cameraState, () => {
    // 按 Z 偏移排序（从后到前）
    const sortedMaps = Array.from(this.mapPropsMap.entries())
      .sort((a, b) => a[1].zOffset - b[1].zOffset)
    
    // 依次渲染所有地图
    for (const [componentId, mapProps] of sortedMaps) {
      const mapCommand = this.mapCommands.get(componentId)
      if (mapCommand && mapProps) {
        mapCommand([mapProps], false)
      }
    }
  })
}

// 注册统一的地图渲染回调
this.worldviewContext.registerPaintCallback(this.mapRenderCallback)
```

**性能优势**：
- N 个地图只调用 1 次 `camera.draw`，而不是 N 次
- 大幅降低 CPU 使用率
- 参照 RViz 的实现方式

### 阶段 5: GPU 渲染

**位置**: `src/components/RvizViewer/commands/MapTexture.ts`

#### 5.1 顶点着色器

```glsl
// 将纹理坐标转换为世界坐标
vec2 worldPos2D = mapOrigin + position * mapSize;
vec3 worldPos = vec3(worldPos2D.x, worldPos2D.y, zOffset);
gl_Position = projection * view * vec4(worldPos, 1.0);
```

#### 5.2 片段着色器

**颜色方案**：

1. **map 方案**（默认）:
   - 未知区域：深青灰色 `(0.25, 0.45, 0.45)`
   - 自由空间：浅灰色 `(0.7, 0.7, 0.7)`
   - 占用区域：深灰色渐变（占用值越高，颜色越深）

2. **costmap 方案**:
   - 未知区域：深青灰色
   - 自由空间：深灰色 `(0.2, 0.2, 0.2)`
   - 高成本区域：洋红色渐变 `(R: 0.5-1.0, G: 0, B: 0.5-1.0)`

3. **raw 方案**:
   - 直接显示原始占用值（灰度图）

```glsl
// 从纹理读取占用值
float occupancyValue = texture2D(mapTexture, vTexCoord).r;

// 根据 colorScheme 选择颜色方案
if (colorScheme == 0) {
  color = mapColorScheme(occupancy);
} else if (colorScheme == 1) {
  color = costmapColorScheme(occupancy);
} else {
  color = vec3(rawValue, rawValue, rawValue); // raw
}

gl_FragColor = vec4(color, alpha);
```

#### 5.3 深度测试配置

```typescript
depth: {
  enable: true,
  mask: false,  // 禁用深度写入，避免多个地图之间的 Z-fighting
  func: 'less'  // 只渲染更近的像素
}
```

**为什么禁用深度写入**：
- 每个地图已经有唯一的 Z 偏移（0.001 间隔）
- 不需要深度写入即可确保正确的渲染顺序
- 避免多个地图之间的 Z-fighting

## 配置管理

### 配置更新流程

**位置**: `src/components/RvizViewer/core/SceneManager.ts` - `updateMapOptions()`

```typescript
updateMapOptions(options: {
  alpha?: number
  colorScheme?: string  // 'map' | 'costmap' | 'raw'
  drawBehind?: boolean
  topic?: string
}, componentId: string) {
  // 1. 更新配置
  this.mapConfigMap.set(componentId, newConfig)
  
  // 2. 如果 topic 改变，清理旧数据
  if (oldTopic !== newTopic) {
    clearMapTextureCache(componentId, dataHash)
    // 清理所有相关数据
  }
  
  // 3. 如果 drawBehind 改变，重新计算所有地图的 Z 偏移
  if (oldDrawBehind !== newDrawBehind) {
    this.recalculateAllMapZOffsets()
  }
  
  // 4. 更新渲染命令
  if (hasMapData) {
    this.updateMapDrawCall(componentId)
  }
}
```

### 配置存储

- **配置**存储在 `mapConfigMap` 中（独立于数据）
- **数据更新**不会覆盖配置
- **渲染时**从 `mapConfigMap` 读取最新配置

## 性能优化策略

### 1. 纹理缓存

**位置**: `src/components/RvizViewer/commands/MapTexture.ts`

```typescript
// 纹理缓存键：width_height_dataHash
const cacheKey = `${width}_${height}_${dataHash}`

// 复用相同数据的纹理，避免重复创建
const cached = getCachedMapTexture(regl, cacheKey)
if (cached) {
  return cached.texture
}
```

### 2. 消息哈希检测

```typescript
// 生成消息哈希（采样检查前100、中间100、后100个数据点）
const messageHash = this.generateMapMessageHash(message)

// 如果哈希相同，跳过处理
if (lastMessageHash === messageHash) {
  return
}
```

### 3. Web Worker 后台处理

- 地图数据处理在 Worker 线程中进行
- 不阻塞主线程
- 自动取消过时的请求（使用 requestId）

### 4. 统一渲染回调

- 所有地图共享一次 `camera.draw` 调用
- 在回调内部依次渲染所有地图
- 大幅降低 CPU 使用率

### 5. Buffer 复用

```typescript
// 预创建的顶点和纹理坐标 buffer（全局复用）
let cachedPositionBuffer: any = null
let cachedTexCoordBuffer: any = null
```

### 6. Props 缓存

```typescript
// 缓存 mapProps，避免重复创建
this._mapPropsCache.set(componentId, mapProps)
```

## 多地图渲染顺序

### Z 偏移分配规则

1. **drawBehind 地图**（Z < 0）:
   - 按添加顺序分配：`-0.01, -0.02, -0.03...`
   - 先渲染（在后面）

2. **正常地图**（Z >= 0）:
   - 按添加顺序分配：`0.0, 0.001, 0.002...`
   - 后渲染（在前面）

3. **渲染顺序**:
   - 按 Z 偏移升序排序（Z 值小的先渲染）
   - 确保正确的深度排序

### 示例场景

假设有 3 个地图：
- Map A: `drawBehind=false` → Z = 0.0
- Map B: `drawBehind=true` → Z = -0.01
- Map C: `drawBehind=false` → Z = 0.001

**渲染顺序**：
1. Map B (Z = -0.01) - 先渲染，在后面
2. Map A (Z = 0.0) - 中间渲染
3. Map C (Z = 0.001) - 最后渲染，在最前面

## 关键文件

1. **`src/components/RvizViewer/core/SceneManager.ts`**
   - 地图数据管理
   - 渲染命令创建
   - 统一渲染回调

2. **`src/components/RvizViewer/commands/MapTexture.ts`**
   - GPU 渲染命令
   - 着色器实现
   - 纹理缓存

3. **`src/composables/viewer/scene/useDisplaySync.ts`**
   - 显示状态同步
   - 数据订阅管理

4. **`src/workers/dataProcessor.worker.ts`**
   - 地图数据预处理
   - OccupancyGrid → 纹理数据转换

5. **`src/components/panels/panels-manager/displays/map/MapConfig.vue`**
   - 地图配置 UI
   - 参数显示

## 总结

多个 Map Panel 的渲染逻辑采用以下核心设计：

1. **独立管理**：每个地图有独立的 componentId，独立的数据和配置
2. **纹理渲染**：使用单个四边形 + 纹理，替代大量三角形
3. **统一渲染**：所有地图共享一次 `camera.draw` 调用，在回调内部依次渲染
4. **深度排序**：通过 Z 偏移确保正确的渲染顺序
5. **性能优化**：纹理缓存、消息哈希检测、Web Worker 处理、Buffer 复用

这种设计既保证了多地图的正确渲染，又实现了高性能和低 CPU 使用率。
