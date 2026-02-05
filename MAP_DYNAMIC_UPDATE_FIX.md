# 地图动态更新修复文档

## 问题描述

在 ROS 建图过程中，地图面板（Map Panel）订阅的数据在增加，但左侧的渲染并没有动态更新。即使消息已经到达，状态更新已经触发，watch 回调已经执行，但地图渲染仍然没有变化。

## 问题分析

### 1. 哈希检测的局限性

- **问题**：`generateQuickMessageHash` 只采样前100、中间100、后100个点来生成哈希
- **影响**：建图过程中，如果地图数据只在非采样区域变化，哈希检测会返回 `hashChanged: false`，导致更新被跳过
- **位置**：`src/composables/viewer/scene/useDisplaySync.ts`

### 2. 双重哈希检测

- **问题**：`useDisplaySync.ts` 和 `SceneManager.updateMap` 都进行哈希检测，可能导致双重过滤
- **影响**：即使 `useDisplaySync` 判断需要更新，`SceneManager` 的哈希检测仍可能阻止更新
- **位置**：`src/components/RvizViewer/core/SceneManager.ts`

### 3. 纹理缓存问题

- **问题**：即使 `textureData` 引用变化，如果 `dataHash` 相同，纹理缓存仍会返回旧的纹理对象
- **影响**：Worker 处理了新的数据，但渲染仍使用旧的纹理，导致视觉上无变化
- **位置**：`src/components/RvizViewer/commands/MapTexture.ts`

### 4. mapProps 缓存问题

- **问题**：`mapProps` 缓存逻辑在 `dataHash` 相同时会复用旧的 `textureData`，即使 Worker 处理了新的数据
- **影响**：即使纹理数据引用变化，`mapProps` 仍使用旧的纹理数据引用
- **位置**：`src/components/RvizViewer/core/SceneManager.ts`

## 解决方案

### 1. 添加时间戳辅助判断（useDisplaySync.ts）

**修改位置**：`src/composables/viewer/scene/useDisplaySync.ts`

**修改内容**：
- 在哈希检测的基础上，添加时间戳辅助判断
- 即使哈希相同，如果时间戳变化，也允许更新
- 这确保了建图过程中的动态更新

**关键代码**：
```typescript
// 获取消息的时间戳，用于辅助判断（建图过程中，即使哈希相同，时间戳变化也应该更新）
const status = topicSubscriptionManager.getStatus(mapComponent.id)
const currentTimestamp = status?.lastMessageTime || Date.now()
const lastProcessedTimestamp = lastProcessedMessageHashes.get(`${mapComponent.id}_timestamp`) || 0

// 关键修复：对于建图场景，即使哈希相同，如果时间戳变化，也应该更新
if (lastHash === undefined || lastHash !== messageHash || currentTimestamp !== lastProcessedTimestamp) {
  // 更新地图
  lastProcessedMessageHashes.set(`${mapComponent.id}_timestamp`, currentTimestamp)
  context.updateMap(message, mapComponent.id)
}
```

### 2. 放宽 SceneManager 哈希检测（SceneManager.ts）

**修改位置**：`src/components/RvizViewer/core/SceneManager.ts`

**修改内容**：
- 即使哈希相同，也允许更新（信任 `useDisplaySync` 的时间戳判断）
- 不在这里跳过，让后续处理继续，即使哈希相同也允许更新

**关键代码**：
```typescript
if (shouldSkip) {
  // 关键修复：对于建图场景，即使哈希相同，也允许更新（信任 useDisplaySync 的时间戳判断）
  // useDisplaySync 已经通过时间戳判断需要更新，说明确实有新消息到达
  // 即使哈希相同，也可能是采样检测的漏检，应该允许更新
  // 不返回，继续处理更新，因为 useDisplaySync 已经判断需要更新
}
```

### 3. 纹理数据变化检测（SceneManager.ts）

**修改位置**：`src/components/RvizViewer/core/SceneManager.ts` - `updateMap()`

**修改内容**：
- 在保存纹理数据时，检查纹理数据是否真的变化了
- 即使哈希相同，也检查纹理数据引用是否变化

**关键代码**：
```typescript
// 检查纹理数据是否真的变化了（即使哈希相同，数据可能已经变化）
const oldTextureData = this.mapTextureDataMap.get(componentId)
const textureDataChanged = !oldTextureData || 
  oldTextureData.textureData !== result.textureData ||
  oldTextureData.width !== result.width ||
  oldTextureData.height !== result.height ||
  oldTextureData.dataHash !== (result.dataHash || dataHash)
```

### 4. 强制更新 mapProps（SceneManager.ts）

**修改位置**：`src/components/RvizViewer/core/SceneManager.ts` - `updateMapDrawCall()`

**修改内容**：
- 即使 `dataHash` 相同，如果 `textureData` 引用变化，也重新创建 `mapProps`
- 这确保了建图过程中的动态更新

**关键代码**：
```typescript
// 关键修复：即使 dataHash 相同，也要检查 textureData 引用是否变化
const textureDataChanged = !mapProps || mapProps.textureData !== textureData.textureData

if (!mapProps || mapProps.dataHash !== textureData.dataHash || 
    mapProps.alpha !== alpha || mapProps.colorScheme !== colorScheme || 
    mapProps.zOffset !== zOffset || textureDataChanged) {
  // 重新创建 mapProps，确保使用新的 textureData
  mapProps = {
    textureData: textureData.textureData,
    // ...
  }
}
```

### 5. 纹理缓存引用检查（MapTexture.ts）

**修改位置**：`src/components/RvizViewer/commands/MapTexture.ts`

**修改内容**：
- 在 `mapTexture` uniform 函数中，检查 `textureData` 引用是否变化
- 即使 `dataHash` 相同，如果 `textureData` 引用变化，也清除缓存并重新创建纹理
- 在 `CachedMapTexture` 接口中添加 `textureData` 字段，用于保存引用

**关键代码**：
```typescript
interface CachedMapTexture {
  texture: any
  width: number
  height: number
  dataHash: string
  _destroyed?: boolean
  textureData?: any // 保存 textureData 引用，用于检查数据是否变化
}

// 在 mapTexture uniform 函数中
const currentTextureData = props.textureData
const cachedTextureData = props._cachedTextureData

// 如果 textureData 引用变化，清除缓存
if (props._cachedTexture?.texture && currentTextureData !== cachedTextureData) {
  props._cachedTexture = null
  props._cachedTextureData = null
}

// 即使缓存存在，如果 textureData 引用变化，也要重新创建纹理
if (cached && cached.textureData === currentTextureData) {
  // 使用缓存
} else {
  // 清理旧缓存并创建新纹理
}
```

### 6. 纹理销毁保护（MapTexture.ts）

**修改位置**：`src/components/RvizViewer/commands/MapTexture.ts`

**修改内容**：
- 在 `CachedMapTexture` 接口中添加 `_destroyed` 标记
- 在销毁纹理前检查是否已销毁，避免重复销毁
- 使用 try-catch 保护，捕获可能的销毁错误

**关键代码**：
```typescript
interface CachedMapTexture {
  _destroyed?: boolean // 标记纹理是否已被销毁，避免重复销毁
}

// 销毁纹理资源（避免重复销毁）
if (cached.texture && cached.texture.destroy && !cached._destroyed) {
  try {
    cached.texture.destroy()
    cached._destroyed = true
  } catch (error) {
    // 如果销毁失败（可能已经被销毁），忽略错误
    cached._destroyed = true
  }
}
```

## 修改文件列表

1. **src/composables/viewer/scene/useDisplaySync.ts**
   - 添加时间戳辅助判断
   - 修改哈希检测逻辑

2. **src/components/RvizViewer/core/SceneManager.ts**
   - 放宽哈希检测
   - 添加纹理数据变化检测
   - 强制更新 mapProps

3. **src/components/RvizViewer/commands/MapTexture.ts**
   - 添加纹理缓存引用检查
   - 添加纹理销毁保护
   - 修改 `CachedMapTexture` 接口

4. **src/services/topicSubscriptionManager.ts**
   - 立即触发地图组件的状态更新（不节流）

## 测试验证

修复后，地图应该能够：
1. ✅ 在消息到达时及时更新
2. ✅ 即使哈希相同，如果时间戳变化，也能更新
3. ✅ 即使 `dataHash` 相同，如果 `textureData` 引用变化，也能更新
4. ✅ 避免纹理重复销毁错误

## 注意事项

1. **性能影响**：时间戳辅助判断会增加一些更新频率，但对于建图场景是必要的
2. **哈希检测**：采样检测仍然有效，只是作为初步过滤，时间戳作为辅助判断
3. **纹理缓存**：引用检查确保纹理缓存不会阻止动态更新
4. **内存管理**：纹理销毁保护避免内存泄漏和错误

## 相关文档

- `MAP_PANEL_RENDERING_SUMMARY.md` - 地图面板渲染流程总结
- `MULTIPLE_MAP_DISPLAY_SUMMARY.md` - 多地图显示总结
