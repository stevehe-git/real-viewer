/**
 * Utils 工具函数统一导出
 * 基于 regl-worldview 的 utils 目录实现
 */

// 基础工具函数
export { default as aggregate } from './aggregate'
export { getNodeEnv, inWebWorker } from './common'
export { default as eulerFromQuaternion } from './eulerFromQuaternion'
export { default as getOrthographicBounds } from './getOrthographicBounds'
export { default as queuePromise } from './queuePromise'
export { signal, type Signal } from './signal'

// Hitmap 相关
export { default as HitmapObjectIdManager } from './HitmapObjectIdManager'
export {
  nonInstancedGetChildrenForHitmap,
  getChildrenForHitmapWithOriginalMarker,
  createInstancedGetChildrenForHitmap
} from './getChildrenForHitmapDefaults'

// GLB 和 Draco 支持（可选，需要 draco3d 依赖）
export { default as decodeCompressedGLB } from './draco'
export { default as parseGLB, type GLBModel } from './parseGLB'

// 数学工具（自定义）
export * from './math'

// Shader 工具（自定义）
export * from './shaders'
