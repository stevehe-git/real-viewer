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

// 只启用 TF 调试
debug.enable(true)
debug.enableModule('tf', true)

// 设置日志级别
debug.setLevel('debug')  // none | error | warn | info | debug

// 禁用所有调试
debug.disableAll()

// 查看帮助
debug.help()
```

### 代码中使用

```typescript
import { tfDebugger, renderDebugger, enableModuleDebug } from '@/utils/debug'

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
}, 1000)
```

## 注意事项

1. 调试功能默认关闭，需要手动启用
2. 统计信息每秒更新一次频率数据
3. 日志输出会根据日志级别过滤
4. 配置会自动保存到 localStorage，刷新页面后仍然有效
