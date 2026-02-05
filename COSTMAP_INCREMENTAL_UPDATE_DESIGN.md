# Costmap 增量更新设计方案

## 概述

当 map panel 选择 `/move_base/global_costmap/costmap` 话题时，自动订阅 `/move_base/global_costmap/costmap_updates` 话题，并根据 costmap_updates 的更新数据（x, y, width, height, data）来增量更新 costmap 中的数据。

## 数据格式

### costmap_updates 消息格式
```javascript
{
  header: {
    seq: 148,
    stamp: { secs: 25, nsecs: 625000000 },
    frame_id: "map"
  },
  x: 121,        // 更新区域的起始 X 坐标
  y: 128,        // 更新区域的起始 Y 坐标
  width: 152,    // 更新区域的宽度
  height: 143,   // 更新区域的高度
  data: [0, ...] // 更新区域的数据数组（width * height 个元素）
}
```

## 架构设计

### 1. 自动订阅机制

**位置**: `src/composables/viewer/scene/useDisplaySync.ts` - `syncMapDisplay()`

**实现逻辑**:
- 检测 topic 是否以 `/costmap` 结尾
- 如果是，自动生成 `_updates` topic（将 `/costmap` 替换为 `/costmap_updates`）
- 为 updates topic 创建独立的订阅（使用特殊的 componentId，如 `${componentId}_updates`）

### 2. 数据存储结构

**位置**: `src/components/RvizViewer/core/SceneManager.ts`

**新增数据结构**:
```typescript
// 保存完整的 costmap 原始数据（用于增量更新）
private mapRawDataMap = new Map<string, Int8Array>() // key: componentId, value: 完整的地图数据数组

// 保存 costmap 的元信息（用于验证 updates 是否匹配）
private mapMetadataMap = new Map<string, {
  width: number
  height: number
  resolution: number
  origin: any
}>()

// 保存 updates 订阅的 componentId 映射
private costmapUpdatesMap = new Map<string, string>() // key: costmap componentId, value: updates componentId
```

### 3. 增量更新流程

#### 3.1 初始 costmap 处理
- 当收到完整的 costmap 消息时：
  1. 保存完整的数据数组到 `mapRawDataMap`
  2. 保存元信息到 `mapMetadataMap`
  3. 正常处理并渲染

#### 3.2 costmap_updates 处理
- 当收到 costmap_updates 消息时：
  1. 根据 updates componentId 找到对应的 costmap componentId
  2. 从 `mapRawDataMap` 获取完整的 costmap 数据
  3. 验证 updates 的坐标和尺寸是否在 costmap 范围内
  4. 根据 x, y, width, height 将 updates.data 合并到 costmap 数据中
  5. 重新生成纹理数据
  6. 更新渲染

### 4. 数据合并算法

```typescript
function mergeCostmapUpdate(
  costmapData: Int8Array,
  costmapWidth: number,
  costmapHeight: number,
  updateX: number,
  updateY: number,
  updateWidth: number,
  updateHeight: number,
  updateData: number[]
): void {
  // 验证边界
  if (updateX < 0 || updateY < 0 || 
      updateX + updateWidth > costmapWidth || 
      updateY + updateHeight > costmapHeight) {
    console.warn('Costmap update out of bounds')
    return
  }
  
  // 合并数据
  for (let dy = 0; dy < updateHeight; dy++) {
    for (let dx = 0; dx < updateWidth; dx++) {
      const updateIndex = dy * updateWidth + dx
      const costmapIndex = (updateY + dy) * costmapWidth + (updateX + dx)
      costmapData[costmapIndex] = updateData[updateIndex]
    }
  }
}
```

## 实现步骤

### Step 1: 扩展 SceneManager

1. **添加数据存储**:
   - `mapRawDataMap`: 保存完整 costmap 数据
   - `mapMetadataMap`: 保存 costmap 元信息
   - `costmapUpdatesMap`: 保存 costmap 到 updates 的映射

2. **修改 `updateMap` 方法**:
   - 检测是否为 costmap topic
   - 如果是，保存完整数据到 `mapRawDataMap`
   - 保存元信息到 `mapMetadataMap`

3. **新增 `updateCostmapIncremental` 方法**:
   - 处理 costmap_updates 消息
   - 合并数据到完整的 costmap 数据
   - 重新生成纹理

### Step 2: 扩展 useDisplaySync

1. **修改 `syncMapDisplay` 方法**:
   - 检测 topic 是否以 `/costmap` 结尾
   - 自动创建 updates 订阅
   - 监听 updates 消息并调用增量更新

2. **新增 updates 消息监听**:
   - 为每个 costmap 创建独立的 updates 订阅
   - 使用 `${componentId}_updates` 作为 updates 的 componentId

### Step 3: 扩展 TopicSubscriptionManager

1. **支持 map_msgs/OccupancyGridUpdate 消息类型**:
   - 在 `COMPONENT_MESSAGE_TYPES` 中添加映射
   - 支持 updates 消息的订阅

### Step 4: 扩展 Worker 处理

1. **新增增量更新处理函数**:
   - 在 Worker 中添加 `processCostmapUpdate` 函数
   - 处理数据合并和纹理重新生成

## 关键实现细节

### 1. Topic 检测和自动订阅

```typescript
// 在 useDisplaySync.ts 中
function syncMapDisplay(previousMapIds?: Set<string>): Set<string> {
  mapComponents.forEach((mapComponent) => {
    const topic = mapComponent.options?.topic || ''
    
    // 检测是否为 costmap topic
    if (topic.endsWith('/costmap')) {
      const updatesTopic = topic.replace('/costmap', '/costmap_updates')
      const updatesComponentId = `${mapComponent.id}_updates`
      
      // 自动订阅 updates topic
      if (mapComponent.enabled) {
        topicSubscriptionManager.subscribeComponentTopic(
          updatesComponentId,
          'map_updates', // 新的组件类型
          updatesTopic,
          mapComponent.options?.queueSize || 10
        )
      }
    }
  })
}
```

### 2. 增量更新处理

```typescript
// 在 SceneManager.ts 中
async updateCostmapIncremental(updateMessage: any, updatesComponentId: string): Promise<void> {
  // 找到对应的 costmap componentId
  const costmapComponentId = this.findCostmapComponentId(updatesComponentId)
  if (!costmapComponentId) return
  
  // 获取完整的 costmap 数据
  const costmapData = this.mapRawDataMap.get(costmapComponentId)
  const metadata = this.mapMetadataMap.get(costmapComponentId)
  if (!costmapData || !metadata) return
  
  // 验证更新区域
  const { x, y, width, height, data } = updateMessage
  if (x + width > metadata.width || y + height > metadata.height) {
    console.warn('Costmap update out of bounds')
    return
  }
  
  // 合并数据
  this.mergeCostmapUpdate(costmapData, metadata.width, metadata.height, x, y, width, height, data)
  
  // 重新生成纹理
  const updatedMessage = {
    info: {
      width: metadata.width,
      height: metadata.height,
      resolution: metadata.resolution,
      origin: metadata.origin
    },
    data: Array.from(costmapData)
  }
  
  // 使用现有的 updateMap 方法重新处理
  await this.updateMap(updatedMessage, costmapComponentId)
}
```

### 3. 数据合并优化

- 使用 TypedArray 提高性能
- 批量更新而不是逐个像素更新
- 只在更新区域重新生成纹理（可选优化）

## 注意事项

1. **消息类型**: costmap_updates 可能使用 `map_msgs/OccupancyGridUpdate` 消息类型，需要确认
2. **数据同步**: 确保 costmap 完整数据在 updates 之前收到
3. **边界检查**: 严格验证 updates 的坐标和尺寸
4. **性能优化**: 增量更新应该比完整更新快，避免重新处理整个地图
5. **错误处理**: 如果 updates 数据不匹配，回退到完整更新

## 测试场景

1. 选择 `/move_base/global_costmap/costmap` topic
2. 验证是否自动订阅了 `/move_base/global_costmap/costmap_updates`
3. 接收完整的 costmap 消息
4. 接收 costmap_updates 消息
5. 验证增量更新是否正确合并数据
6. 验证渲染是否正确显示更新后的地图
