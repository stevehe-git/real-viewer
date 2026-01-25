/**
 * Hitmap 子元素处理工具函数
 * 完全基于 regl-worldview 的 getChildrenForHitmapDefaults.js 实现
 */

import type { AssignNextColorsFn, MouseEventObject } from '../types'

function nonInstancedGetChildrenForHitmapFromSingleProp<T>(
  prop: T,
  assignNextColors: AssignNextColorsFn,
  excludedObjects: MouseEventObject[],
  useOriginalMarkerProp: boolean = false
): T | null {
  // 传递给事件回调的 marker
  const eventCallbackMarker = useOriginalMarkerProp
    ? (prop as any).originalMarker
    : prop
  if (excludedObjects.some(({ object }) => object === eventCallbackMarker)) {
    return null
  }
  const hitmapProp = { ...(prop as any) }
  const [hitmapColor] = assignNextColors(eventCallbackMarker, 1)
  hitmapProp.color = hitmapColor
  if (hitmapProp.colors && hitmapProp.points && hitmapProp.points.length) {
    hitmapProp.colors = new Array(hitmapProp.points.length).fill(hitmapColor)
  }
  return hitmapProp as T
}

/**
 * 非实例化渲染的 hitmap 子元素处理
 */
export const nonInstancedGetChildrenForHitmap = <T>(
  props: T,
  assignNextColors: AssignNextColorsFn,
  excludedObjects: MouseEventObject[]
): T | null => {
  if (Array.isArray(props)) {
    return (props
      .map((prop) =>
        nonInstancedGetChildrenForHitmapFromSingleProp(prop, assignNextColors, excludedObjects)
      )
      .filter(Boolean) as any) as T
  }
  return nonInstancedGetChildrenForHitmapFromSingleProp(props, assignNextColors, excludedObjects)
}

/**
 * 与 nonInstancedGetChildrenForHitmap 几乎相同，但传递给事件回调的对象是 prop.originalMarker，而不仅仅是 prop
 */
export const getChildrenForHitmapWithOriginalMarker = <T>(
  props: T,
  assignNextColors: AssignNextColorsFn,
  excludedObjects: MouseEventObject[]
): T | null => {
  if (Array.isArray(props)) {
    return (props
      .map((prop) =>
        nonInstancedGetChildrenForHitmapFromSingleProp(prop, assignNextColors, excludedObjects, true)
      )
      .filter(Boolean) as any) as T
  }
  return nonInstancedGetChildrenForHitmapFromSingleProp(props, assignNextColors, excludedObjects, true)
}

function instancedGetChildrenForHitmapFromSingleProp<T>(
  prop: T,
  assignNextColors: AssignNextColorsFn,
  excludedObjects: MouseEventObject[],
  pointCountPerInstance: number
): T | null {
  const matchedExcludedObjects = excludedObjects.filter(
    ({ object, instanceIndex }) => object === prop
  )
  const filteredIndices = matchedExcludedObjects
    .map(({ object, instanceIndex }) => instanceIndex)
    .filter((instanceIndex) => typeof instanceIndex === 'number')
  const hitmapProp = { ...(prop as any) }
  const instanceCount =
    (hitmapProp.points && Math.ceil(hitmapProp.points.length / pointCountPerInstance)) || 1
  // 返回每个实例一个颜色
  const idColors = assignNextColors(prop, instanceCount)
  const startColor = idColors[0]
  // 必须将这些实例颜色映射到 pointCountPerInstance 个点
  if (hitmapProp.points && hitmapProp.points.length) {
    const allColors = new Array(hitmapProp.points.length).fill(null).map(() => startColor)
    for (let i = 0; i < instanceCount; i++) {
      for (let j = 0; j < pointCountPerInstance; j++) {
        const idx = i * pointCountPerInstance + j
        if (idx < allColors.length) {
          allColors[idx] = idColors[i]
        }
      }
    }
    hitmapProp.colors = allColors
    if (filteredIndices.length) {
      hitmapProp.points = hitmapProp.points.filter(
        (_: any, index: number) =>
          !filteredIndices.includes(Math.floor(index / pointCountPerInstance))
      )
      hitmapProp.colors = hitmapProp.colors.filter(
        (_: any, index: number) =>
          !filteredIndices.includes(Math.floor(index / pointCountPerInstance))
      )
    } else if (matchedExcludedObjects.length) {
      // 如果没有实例索引，就过滤掉整个对象
      return null
    }
  } else {
    hitmapProp.color = startColor
    if (matchedExcludedObjects.length) {
      return null
    }
  }
  return hitmapProp as T
}

/**
 * 创建实例化渲染的 hitmap 子元素处理函数
 */
export const createInstancedGetChildrenForHitmap = (pointCountPerInstance: number) => <T>(
  props: T,
  assignNextColors: AssignNextColorsFn,
  excludedObjects: MouseEventObject[]
): T | null => {
  if (Array.isArray(props)) {
    return (props
      .map((prop) =>
        instancedGetChildrenForHitmapFromSingleProp(
          prop,
          assignNextColors,
          excludedObjects,
          pointCountPerInstance
        )
      )
      .filter(Boolean) as any) as T
  }
  return instancedGetChildrenForHitmapFromSingleProp(
    props,
    assignNextColors,
    excludedObjects,
    pointCountPerInstance
  )
}
