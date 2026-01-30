# RvizViewer Commands

本目录包含所有渲染命令，完全基于 regl-worldview 的实现。

## 已实现的命令

- **Grid** - 网格
- **Axes** - 坐标轴
- **Points** - 点云
- **Lines** - 线条
- **Triangles** - 三角形
- **Spheres** - 球体
- **Cubes** - 立方体
- **Cylinders** - 圆柱体
- **Cones** - 圆锥体
- **Arrows** - 箭头
- **FilledPolygons** - 填充多边形（新增）
- **Text** - 文本（使用 DOM 元素）（新增）
- **GLText** - 文本（使用 SDF 纹理，GPU 渲染）（新增）
- **GLTFScene** - GLTF/GLB 场景（新增）
- **DrawPolygons** - 绘制和编辑多边形（新增）

## 新增命令说明

### FilledPolygons（填充多边形）

使用 `earcut` 库将多边形三角化，然后使用 Triangles 命令渲染。

**依赖**：
```bash
npm install earcut
```

**使用示例**：
```typescript
import { filledPolygons } from '@/components/RvizViewer/commands'

const command = filledPolygons(regl)
command([{
  pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 }
  ],
  color: { r: 1, g: 0, b: 0, a: 0.5 }
}])
```

### Text（文本 - DOM 版本）

使用 DOM 元素在 3D 空间中渲染文本。文本会根据相机位置自动更新位置。

**使用示例**：
```typescript
import { text } from '@/components/RvizViewer/commands'

const command = text(regl)
// 注意：Text 命令的实际渲染由 WorldviewContext 的 paint 回调处理
// 需要在 WorldviewContext 中注册文本渲染逻辑
```

### GLText（文本 - GPU 渲染版本）

使用 Signed Distance Field (SDF) 纹理在 WebGL 中渲染文本。比 Text 命令更高效，支持大量文本渲染。

**依赖**：
```bash
npm install @mapbox/tiny-sdf memoize-one lodash
```

**使用示例**：
```typescript
import { glText, makeGLTextCommand } from '@/components/RvizViewer/commands'

// 创建 GLText 命令
const command = makeGLTextCommand({
  resolution: 160, // 字体分辨率
  autoBackgroundColor: true, // 自动背景色
  scaleInvariantFontSize: 20, // 缩放不变字体大小（像素）
  borderRadius: 4, // 圆角半径
  paddingScale: [1.2, 1.1] // 内边距缩放 [x, y]
})(regl)

// 渲染文本
command([{
  pose: { 
    position: { x: 0, y: 0, z: 0 }, 
    orientation: { x: 0, y: 0, z: 0, w: 1 } 
  },
  scale: { x: 1, y: 1, z: 1 },
  text: 'Hello\nWorld',
  color: { r: 1, g: 1, b: 1, a: 1 },
  billboard: true, // 是否始终面向相机
  highlightedIndices: [0, 1, 2], // 高亮字符索引
  highlightColor: { r: 1, g: 0, b: 1, a: 1 } // 高亮颜色
}])
```

**特性**：
- 使用 SDF 纹理，支持高质量文本渲染
- 支持多行文本（使用 `\n` 分隔）
- 支持 billboard 模式（文本始终面向相机）
- 支持 scale invariant（缩放不变）
- 支持字符高亮
- 支持自动背景色
- 支持圆角背景
- 使用实例化渲染，性能优异

### GLTFScene（GLTF/GLB 场景）

用于渲染 GLTF/GLB 3D 模型。支持纹理、材质和 Draco 压缩。

**依赖**：
```bash
npm install memoize-weak
```

**使用示例**：
```typescript
import { gltfScene } from '@/components/RvizViewer/commands'
import parseGLB from '@/components/RvizViewer/utils/parseGLB'

// 加载 GLB 文件
const arrayBuffer = await fetch('/path/to/model.glb').then(r => r.arrayBuffer())
const model = await parseGLB(arrayBuffer)

const command = gltfScene(regl)
command({
  model,
  pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
  scale: { x: 1, y: 1, z: 1 },
  alpha: 1.0
})
```

### DrawPolygons（绘制和编辑多边形）

用于绘制和编辑多边形，支持鼠标交互（点击、拖拽、双击等）。

**依赖**：
```bash
npm install distance-to-line-segment
```

**使用示例**：
```typescript
import { drawPolygons, PolygonBuilder } from '@/components/RvizViewer/commands'

// 创建多边形构建器
const builder = new PolygonBuilder()

// 添加多边形
builder.addPolygon({
  name: 'My Polygon',
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 }
  ]
})

// 渲染多边形
const command = drawPolygons(regl)
command(builder.polygons)

// 将鼠标事件处理器添加到 Worldview
// builder.onMouseDown, builder.onMouseMove, builder.onMouseUp, builder.onDoubleClick, builder.onKeyDown
```

**PolygonBuilder 功能**：
- `pushPoint(point)` - 添加新点
- `addPolygon(cmd)` - 添加完整的多边形
- `closeActivePolygon()` - 关闭当前活动多边形
- `deletePolygon(polygon)` - 删除多边形
- `deletePoint(point)` - 删除点
- `selectObject(object)` - 选择对象（点或多边形）
- 鼠标事件处理器：`onMouseDown`, `onMouseMove`, `onMouseUp`, `onDoubleClick`
- 键盘事件处理器：`onKeyDown` (Delete/Backspace 删除)

## 注意事项

1. **FilledPolygons** 需要安装 `earcut` 依赖
2. **GLTFScene** 需要安装 `memoize-weak` 依赖
3. **DrawPolygons** 需要安装 `distance-to-line-segment` 依赖
4. **GLText** 需要安装 `@mapbox/tiny-sdf`、`memoize-one` 和 `lodash` 依赖
5. **Text** 命令使用 DOM 元素，需要在 WorldviewContext 中实现 paint 回调来更新文本位置
6. **GLText** 比 **Text** 性能更好，适合大量文本渲染，但需要更多依赖
7. 所有命令都遵循 regl-worldview 的 API 设计，保持兼容性

## 类型定义

所有类型定义在 `../types.ts` 中：
- `PolygonType` - 多边形类型
- `TextMarker` - 文本标记类型
- `GLBModel` - GLB 模型类型
