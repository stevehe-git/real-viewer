/**
 * FilledPolygons 命令
 * 完全基于 regl-worldview 的 FilledPolygons.js 实现
 * 使用 earcut 库将多边形三角化，然后使用 Triangles 命令渲染
 * 
 * 注意：需要安装 earcut 依赖
 * npm install earcut
 */
// @ts-ignore - earcut 可能没有类型定义
import earcut from 'earcut'
import type { Regl, PolygonType, Vec3, Point } from '../types'
import { shouldConvert, pointToVec3 } from './utils/commandUtils'
import { makeTrianglesCommand } from './Triangles'

const NO_POSE = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }
}

const DEFAULT_SCALE = { x: 1, y: 1, z: 1 }

function flatten3D(points: Vec3[]): Float32Array {
  const array = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    if (point) {
      const [x, y, z] = point
      array[i * 3] = x
      array[i * 3 + 1] = y
      array[i * 3 + 2] = z
    }
  }
  return array
}

function getEarcutPoints(points: Vec3[]): Vec3[] {
  const flattenedPoints = flatten3D(points)
  const indices = earcut(flattenedPoints, null, 3)
  const newPoints: Vec3[] = []
  for (let i = 0; i < indices.length; i++) {
    const originalIndex = indices[i]
    if (originalIndex >= 0 && originalIndex < points.length) {
      const point = points[originalIndex]
      if (point) {
        newPoints.push(point)
      }
    }
  }
  return newPoints
}

const generateTriangles = (polygons: PolygonType[]): any[] => {
  return polygons.map((poly) => {
    let points: Vec3[]
    if (shouldConvert(poly.points)) {
      points = (poly.points as Point[]).map(pointToVec3)
    } else {
      points = poly.points as Vec3[]
    }
    const pose = poly.pose ? poly.pose : NO_POSE
    const earcutPoints = getEarcutPoints(points)
    return {
      ...poly,
      points: earcutPoints,
      pose,
      scale: DEFAULT_SCALE,
      originalMarker: poly
    }
  })
}

export const makeFilledPolygonsCommand = () => (regl: Regl) => {
  const trianglesCommand = makeTrianglesCommand()(regl)
  return (_props: any, polygons: PolygonType[]) => {
    const props = Array.isArray(polygons) ? polygons : [polygons]
    trianglesCommand(generateTriangles(props), false)
  }
}

export const filledPolygons = (regl: Regl) => {
  return makeFilledPolygonsCommand()(regl)
}

export default function FilledPolygons(_props: { children: PolygonType[] }) {
  return makeFilledPolygonsCommand()
}
