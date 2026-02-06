# 调试工具使用说明

## 概述

本项目提供了按功能模块分类的调试系统，支持通过标志位控制各个模块的调试开关。

## 功能模块

### 1. TF 调试 (`tf`)
- **处理频率**：TF 数据处理频率（Hz）
- **渲染频率**：TF 渲染频率（Hz）
- **消息频率**：TF 消息接收频率（Hz）
- **Worker 处理频率**：Worker 中 TF 处理频率（Hz）
- **缓存命中率**：变换矩阵缓存命中率

### 2. 渲染调试 (`render`)
- **FPS**：帧率
- **帧时间**：每帧渲染时间
- **绘制调用次数**：每帧的绘制调用数量

### 3. Panel 调试 (`panel`)
- **渲染频率**：各类型 Panel 的渲染频率（Hz）
- **渲染时间**：Panel 渲染耗时
- **性能警告**：自动检测性能瓶颈并发出警告
- **渲染历史**：记录最近的渲染操作

### 4. PointCloud2 调试 (`pointcloud2`)
- **消息频率**：PointCloud2 消息接收频率（Hz）
- **Worker 处理频率**：Worker 中 PointCloud2 处理频率（Hz）
- **Worker 处理时间**：Worker 处理耗时（平均、最大）
- **合并操作频率**：Decay Time 合并操作频率（Hz）
- **合并操作时间**：合并操作耗时（平均、最大）
- **历史数据数量**：参与合并的历史数据项数量
- **合并后点数**：合并后的总点数
- **渲染频率**：PointCloud2 渲染频率（Hz）
- **渲染时间**：渲染耗时（平均、最大）

## 使用方法

### 浏览器控制台

在浏览器控制台中，可以通过 `window.debug` 访问调试功能：

```javascript
// 启用所有调试
debug.enableAll()

// 查看 TF 统计信息
debug.tf.stats()

// 查看渲染统计信息
debug.render.stats()

// 查看 Panel 统计信息
debug.panel.stats()

// 查看 PointCloud2 统计信息
debug.pointcloud2.stats()

// 只启用 TF 调试
debug.enable(true)
debug.enableModule('tf', true)

// 只启用 PointCloud2 调试
debug.enable(true)
debug.enableModule('pointcloud2', true)

// 设置日志级别
debug.setLevel('debug')  // none | error | warn | info | debug

// 禁用所有调试
debug.disableAll()

// 查看帮助
debug.help()
```

### 代码中使用

```typescript
import { 
  tfDebugger, 
  renderDebugger, 
  panelDebugger,
  pointCloud2Debugger,
  enableModuleDebug 
} from '@/utils/debug'

// 启用 TF 调试
enableModuleDebug('tf', true)

// 记录 TF 处理开始
const startTime = tfDebugger.recordProcessStart()

// ... 处理代码 ...

// 记录 TF 处理结束
tfDebugger.recordProcessEnd(startTime)

// 记录消息接收
tfDebugger.recordMessage()

// 记录缓存命中/未命中
tfDebugger.recordCacheHit()
tfDebugger.recordCacheMiss()

// 输出调试日志
tfDebugger.log('Processing TF data', 'info')

// 获取统计信息
const stats = tfDebugger.getStats()
console.log('TF Process Frequency:', stats.processFrequency, 'Hz')

// PointCloud2 调试示例
enableModuleDebug('pointcloud2', true)

// 记录消息接收
pointCloud2Debugger.recordMessage()

// 记录 Worker 处理
const workerStartTime = pointCloud2Debugger.recordWorkerProcessStart()
// ... Worker 处理代码 ...
pointCloud2Debugger.recordWorkerProcessEnd(workerStartTime, pointsCount)

// 记录合并操作
const mergeStartTime = pointCloud2Debugger.recordMergeStart()
// ... 合并代码 ...
pointCloud2Debugger.recordMergeEnd(mergeStartTime, historyDataCount, mergedPointsCount)

// 记录渲染
const renderStartTime = pointCloud2Debugger.recordRenderStart()
// ... 渲染代码 ...
pointCloud2Debugger.recordRenderEnd(renderStartTime)

// 获取 PointCloud2 统计信息
const pc2Stats = pointCloud2Debugger.getStats()
console.log('Merge Avg Time:', pc2Stats.avgMergeTime, 'ms')
console.log('Merge Frequency:', pc2Stats.mergeFrequency, 'Hz')
```

## 配置

调试配置会自动保存到 `localStorage`，键名为 `debug-config`。

### 配置结构

```typescript
{
  enabled: boolean,           // 全局调试开关
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug',  // 日志级别
  modules: {                  // 各模块开关
    'tf': boolean,
    'render': boolean,
    'panel': boolean,
    'pointcloud2': boolean,
    // ... 其他模块
  }
}
```

## 统计信息

### TF 统计信息

- `processFrequency`: 处理频率（Hz）
- `renderFrequency`: 渲染频率（Hz）
- `messageFrequency`: 消息频率（Hz）
- `workerProcessFrequency`: Worker 处理频率（Hz）
- `cacheHitRate`: 缓存命中率（0-1）

### 渲染统计信息

- `fps`: 帧率（Hz）
- `lastFrameTime`: 最后一帧时间（ms）
- `lastDrawCallCount`: 最后一帧绘制调用次数

### Panel 统计信息

- `renderFrequency`: 渲染频率（Hz）
- `lastRenderTime`: 最后渲染时间（ms）
- `avgRenderTime`: 平均渲染时间（ms）
- `maxRenderTime`: 最大渲染时间（ms）

### PointCloud2 统计信息

- `messageFrequency`: 消息接收频率（Hz）
- `workerProcessFrequency`: Worker 处理频率（Hz）
- `lastWorkerProcessTime`: 最后 Worker 处理时间（ms）
- `avgWorkerProcessTime`: 平均 Worker 处理时间（ms）
- `maxWorkerProcessTime`: 最大 Worker 处理时间（ms）
- `mergeFrequency`: 合并操作频率（Hz）
- `lastMergeTime`: 最后合并时间（ms）
- `avgMergeTime`: 平均合并时间（ms）
- `maxMergeTime`: 最大合并时间（ms）
- `historyDataCount`: 参与合并的历史数据项数量
- `mergedPointsCount`: 合并后的总点数
- `renderFrequency`: 渲染频率（Hz）
- `lastRenderTime`: 最后渲染时间（ms）
- `avgRenderTime`: 平均渲染时间（ms）
- `maxRenderTime`: 最大渲染时间（ms）

## 示例

### 启用 TF 调试并查看统计

```javascript
// 在浏览器控制台中
debug.enable(true)
debug.enableModule('tf', true)
debug.setLevel('info')

// 等待几秒后查看统计
debug.tf.stats()
```

### 监控 100Hz TF 数据处理

```javascript
// 启用所有调试
debug.enableAll()

// 查看实时统计（每秒更新一次）
setInterval(() => {
  debug.tf.stats()
  debug.render.stats()
  debug.pointcloud2.stats()
}, 1000)
```

### 监控 PointCloud2 性能瓶颈

```javascript
// 启用 PointCloud2 调试
debug.enable(true)
debug.enableModule('pointcloud2', true)
debug.setLevel('warn')  // 只显示警告和错误

// 查看统计信息
debug.pointcloud2.stats()

// 获取详细统计
const stats = debug.pointcloud2.getStats()
console.log('合并操作平均耗时:', stats.avgMergeTime, 'ms')
console.log('合并操作最大耗时:', stats.maxMergeTime, 'ms')
console.log('合并频率:', stats.mergeFrequency, 'Hz')
console.log('合并后的点数:', stats.mergedPointsCount.toLocaleString())

// 如果合并时间过长，会自动发出警告
// 阈值：合并 > 100ms，渲染 > 16.67ms（一帧时间）
```

## 注意事项

1. 调试功能默认关闭，需要手动启用
2. 统计信息每秒更新一次频率数据
3. 日志输出会根据日志级别过滤
4. 配置会自动保存到 localStorage，刷新页面后仍然有效
