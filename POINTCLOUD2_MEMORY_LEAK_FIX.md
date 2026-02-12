# PointCloud2 WebGL 内存泄漏修复

## 问题描述

PointCloud2 在有 WebGL 的电脑上会出现内存泄漏，没有 WebGL 的则不会。这说明问题出在 **GPU Buffer 的生命周期管理**上。

## 根本原因

### 1. **`removeInstance` 方法没有销毁 GPU buffer** ⚠️

**位置**: `src/components/RvizViewer/commands/PointCloudBufferManager.ts:482-485`

**问题**：
```typescript
removeInstance(componentId: string): void {
  this.pointCloudDataMap.delete(componentId)
  this.instanceConfigs.delete(componentId)
  // ⚠️ 没有销毁 GPU buffer！buffer 仍然在 bufferCache 中占用 GPU 内存
}
```

**影响**：
- 当组件被移除时，GPU buffer 仍然在 `bufferCache` 中
- 只有在 LRU 清理时才会销毁 buffer，但如果缓存没满，buffer 永远不会被销毁
- 导致 GPU 内存持续增长，最终导致内存泄漏

### 2. **`clearAll` 方法没有销毁 GPU buffer** ⚠️

**位置**: `src/components/RvizViewer/commands/PointCloudBufferManager.ts:490-493`

**问题**：
```typescript
clearAll(): void {
  this.pointCloudDataMap.clear()
  this.instanceConfigs.clear()
  // ⚠️ 没有销毁 GPU buffer！bufferCache 中的 buffer 仍然占用 GPU 内存
}
```

**影响**：
- 清除所有实例时，GPU buffer 没有被销毁
- 导致 GPU 内存泄漏

### 3. **数据更新时旧的 buffer 没有被销毁** ⚠️

**位置**: `src/components/RvizViewer/commands/PointCloudBufferManager.ts:194-227`

**问题**：
- 当数据更新（dataHash 变化）时，创建新的 buffer
- 但旧的 buffer 仍然在 `bufferCache` 中，没有被销毁
- 只有在 LRU 清理时才会销毁，导致内存泄漏

## 修复方案

### 1. **修复 `removeInstance` 方法**

**修复内容**：
- 检查该 componentId 使用的 buffer 是否还有其他引用（通过 dataHash）
- 如果没有其他引用，立即销毁 buffer 释放 GPU 内存
- 实现引用计数机制，确保不会误删正在使用的 buffer

**代码**：
```typescript
removeInstance(componentId: string): void {
  const data = this.pointCloudDataMap.get(componentId)
  
  // 删除实例数据
  this.pointCloudDataMap.delete(componentId)
  this.instanceConfigs.delete(componentId)
  
  // 关键修复：检查该 componentId 使用的 buffer 是否还有其他引用
  if (data) {
    const dataHash = data.dataHash
    
    // 检查是否还有其他 componentId 使用相同的 buffer
    let hasOtherReferences = false
    for (const [otherComponentId, otherData] of this.pointCloudDataMap.entries()) {
      if (otherComponentId !== componentId && otherData.dataHash === dataHash) {
        hasOtherReferences = true
        break
      }
    }
    
    // 如果没有其他引用，销毁 buffer
    if (!hasOtherReferences) {
      const bufferItem = this.bufferCache.get(dataHash)
      if (bufferItem) {
        // 销毁 buffer 释放 GPU 内存
        bufferItem.positionBuffer.destroy?.()
        bufferItem.colorBuffer?.destroy?.()
        bufferItem.intensityBuffer?.destroy?.()
        this.bufferCache.delete(dataHash)
      }
    }
  }
}
```

### 2. **修复 `clearAll` 方法**

**修复内容**：
- 销毁所有 GPU buffer 释放 GPU 内存
- 然后清除所有数据

**代码**：
```typescript
clearAll(): void {
  // 关键修复：销毁所有 buffer 释放 GPU 内存
  for (const item of this.bufferCache.values()) {
    item.positionBuffer.destroy?.()
    item.colorBuffer?.destroy?.()
    item.intensityBuffer?.destroy?.()
  }
  
  // 清除所有数据
  this.bufferCache.clear()
  this.pointCloudDataMap.clear()
  this.instanceConfigs.clear()
}
```

### 3. **修复 `updatePointCloudData` 方法**

**修复内容**：
- 当数据变化（dataHash 不同）时，检查旧的 buffer 是否还有其他引用
- 如果没有其他引用，销毁旧的 buffer 释放 GPU 内存

**代码**：
```typescript
updatePointCloudData(componentId: string, data: CompactPointCloudData): void {
  // ... 现有逻辑 ...
  
  // 关键修复：如果数据变化，检查旧的 buffer 是否还有其他引用
  if (oldDataHash && oldDataHash !== data.dataHash) {
    // 检查是否还有其他 componentId 使用相同的旧 buffer
    let hasOtherReferences = false
    for (const [otherComponentId, otherData] of this.pointCloudDataMap.entries()) {
      if (otherComponentId !== componentId && otherData.dataHash === oldDataHash) {
        hasOtherReferences = true
        break
      }
    }
    
    // 如果没有其他引用，销毁旧的 buffer
    if (!hasOtherReferences) {
      const oldBufferItem = this.bufferCache.get(oldDataHash)
      if (oldBufferItem) {
        oldBufferItem.positionBuffer.destroy?.()
        oldBufferItem.colorBuffer?.destroy?.()
        oldBufferItem.intensityBuffer?.destroy?.()
        this.bufferCache.delete(oldDataHash)
      }
    }
  }
}
```

## 为什么只在有 WebGL 的电脑上泄漏？

1. **没有 WebGL 的电脑**：
   - 不会创建 GPU buffer（regl buffer 创建失败或返回 null）
   - 所以不会有 GPU 内存泄漏
   - 但可能有 CPU 内存泄漏（Float32Array）

2. **有 WebGL 的电脑**：
   - 会创建 GPU buffer（regl buffer 成功创建）
   - 如果 buffer 没有被正确销毁，会导致 GPU 内存泄漏
   - GPU 内存泄漏比 CPU 内存泄漏更严重，因为 GPU 内存通常更有限

## 修复效果

### 修复前

| 场景 | GPU 内存 | 状态 |
|------|----------|------|
| 移除组件 | **不释放** | ❌ 泄漏 |
| 清除所有 | **不释放** | ❌ 泄漏 |
| 数据更新 | **不释放旧 buffer** | ❌ 泄漏 |

### 修复后

| 场景 | GPU 内存 | 状态 |
|------|----------|------|
| 移除组件 | **立即释放**（如果没有其他引用） | ✅ 正常 |
| 清除所有 | **立即释放所有** | ✅ 正常 |
| 数据更新 | **立即释放旧 buffer**（如果没有其他引用） | ✅ 正常 |

## 测试建议

1. **测试移除组件**：
   - 添加 PointCloud2 组件
   - 移除组件
   - 检查 GPU 内存是否释放（使用 Chrome DevTools Memory Profiler）

2. **测试清除所有**：
   - 添加多个 PointCloud2 组件
   - 调用 `clearAllPointCloud2s()`
   - 检查 GPU 内存是否全部释放

3. **测试数据更新**：
   - 添加 PointCloud2 组件
   - 更新数据（dataHash 变化）
   - 检查旧的 buffer 是否被销毁

4. **测试引用计数**：
   - 添加两个 PointCloud2 组件，使用相同的数据（相同 dataHash）
   - 移除其中一个组件
   - 检查 buffer 是否仍然存在（因为另一个组件还在使用）

## 总结

通过修复三个关键方法（`removeInstance`、`clearAll`、`updatePointCloudData`），现在 PointCloud2 的 GPU buffer 会在不再使用时立即销毁，防止内存泄漏。

**关键点**：
1. ✅ 实现引用计数机制，确保不会误删正在使用的 buffer
2. ✅ 在组件移除时检查并销毁不再使用的 buffer
3. ✅ 在数据更新时检查并销毁旧的 buffer
4. ✅ 在清除所有时销毁所有 buffer

这样就解决了在有 WebGL 的电脑上的内存泄漏问题。
