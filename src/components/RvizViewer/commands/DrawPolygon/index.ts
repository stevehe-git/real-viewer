/**
 * DrawPolygon 命令
 * 完全基于 regl-worldview 的 DrawPolygon/index.js 实现
 * 用于绘制和编辑多边形
 */
import type { Line, Point, Vec3, Scale, GetChildrenForHitmap, SphereList, Color } from '../../types'
import { vec4ToRGBA, vec3ToPoint } from '../utils/commandUtils'
import { lines } from '../Lines'
import { spheres } from '../Spheres'

export function multiplyScale(scale: Scale, factor: number): Scale {
  return { x: scale.x * factor, y: scale.y * factor, z: scale.z * factor }
}

export const DEFAULT_COLOR: Vec3 = [1, 1, 1]
export const ACTIVE_POLYGON_COLOR: Vec3 = [0.8, 0, 0.8]
export const ACTIVE_POINT_COLOR: Vec3 = [1, 0.2, 1]
export const LINE_STRIP = 'line strip'
const POINT_SIZE_FACTOR = 1.3
export const DRAW_SCALE: Scale = { x: 0.1, y: 0.1, z: 0.1 }
export const DRAW_POINT_SCALE: Scale = multiplyScale(DRAW_SCALE, POINT_SIZE_FACTOR)
export const HITMAP_SCALE: Scale = { x: 0.5, y: 0.5, z: 0.5 }
export const HITMAP_POINT_SCALE: Scale = multiplyScale(HITMAP_SCALE, POINT_SIZE_FACTOR)
export const POSE = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 }
}

let count = 1

export class PolygonPoint {
  id: number
  point: Vec3
  active: boolean = false

  constructor(points: Vec3) {
    this.id = count++
    this.point = points
  }
}

export class Polygon {
  id: number
  name: string
  points: PolygonPoint[] = []
  active: boolean = false

  constructor(name: string = '') {
    this.name = name
    this.id = count++
  }
}

export type DrawPolygonType = Polygon

const polygonLinesGetChildrenForHitmap: GetChildrenForHitmap = <T extends any>(
  props: T,
  assignNextColors: (object: any, count: number) => Vec3[],
  excludedObjects: any[]
) => {
  // This is almost identical to the default nonInstancedGetChildrenForHitmap, with changes marked.
  return props
    .map((prop: any) => {
      if (excludedObjects.some(({ object }) => object === prop)) {
        return null
      }
      const hitmapProp = { ...prop }
      // Change from original: pass the original marker as a callback object instead of this marker.
      const [hitmapColor] = assignNextColors(prop.originalMarker, 1)
      // Change from original: increase scale for hitmap
      hitmapProp.scale = HITMAP_SCALE

      hitmapProp.color = hitmapColor
      if (hitmapProp.colors && hitmapProp.points && hitmapProp.points.length) {
        hitmapProp.colors = new Array(hitmapProp.points.length).fill(hitmapColor)
      }
      return hitmapProp
    })
    .filter(Boolean) as T
}

/**
 * Draw the polygon lines
 */
function renderPolygonLines(regl: any, polygons: Polygon[]): void {
  const linesData: Line[] = []
  for (const poly of polygons) {
    const color = poly.active ? ACTIVE_POLYGON_COLOR : DEFAULT_COLOR
    const points: (Point | Vec3)[] = poly.points.map(({ point }) => vec3ToPoint(point))

    linesData.push({
      primitive: LINE_STRIP,
      pose: POSE,
      points,
      scale: DRAW_SCALE,
      color: vec4ToRGBA([color[0], color[1], color[2], 1]),
      originalMarker: poly
    })
  }

  if (linesData.length > 0) {
    const linesCommand = lines(regl)
    linesCommand(linesData)
  }
}

const polygonPointsGetChildrenForHitmap: GetChildrenForHitmap = <T extends any>(
  props: T,
  assignNextColors: (object: any, count: number) => Vec3[],
  excludedObjects: any[]
) => {
  // This is similar to the default nonInstancedGetChildrenForHitmap, with changes marked.
  return props
    .map((prop: any) => {
      if (excludedObjects.some(({ object }) => object === prop)) {
        return null
      }
      const hitmapProp = { ...prop }
      // Change from original: assign a non-instanced color to each point color, even though this marker uses
      // instancing.
      // This is so that we can have a unique callback object for each point.
      hitmapProp.colors = hitmapProp.colors.map((color: any, index: number) => {
        return assignNextColors(prop.originalMarkers[index], 1)
      })
      // Change from original: increase scale for hitmap
      hitmapProp.scale = HITMAP_POINT_SCALE
      return hitmapProp
    })
    .filter(Boolean) as T
}

/**
 * Draw the polygon points at the end of each lines
 */
function renderPolygonPoints(regl: any, polygons: Polygon[]): void {
  const points: Point[] = []
  const colors: Color[] = []
  const originalMarkers: PolygonPoint[] = []

  for (const poly of polygons) {
    const color = poly.active ? ACTIVE_POLYGON_COLOR : DEFAULT_COLOR
    for (const point of poly.points) {
      const convertedPoint = vec3ToPoint(point.point)
      points.push(convertedPoint)
      const pointColor = point.active ? ACTIVE_POINT_COLOR : color
      colors.push({ r: pointColor[0], g: pointColor[1], b: pointColor[2], a: 1 })
      originalMarkers.push(point)
    }
  }

  if (points.length > 0) {
    const sphereList: SphereList = {
      points,
      colors,
      pose: POSE,
      scale: DRAW_POINT_SCALE,
      originalMarkers
    }

    const spheresCommand = spheres(regl)
    spheresCommand([sphereList])
  }
}

/**
 * DrawPolygons 命令工厂函数
 */
export const makeDrawPolygonsCommand = () => (regl: any) => {
  return (props: any, isHitmap: boolean = false) => {
    const polygons: Polygon[] = Array.isArray(props) ? props : [props]
    if (polygons.length === 0) {
      return
    }

    renderPolygonLines(regl, polygons)
    renderPolygonPoints(regl, polygons)
  }
}

export const drawPolygons = (regl: any) => {
  return makeDrawPolygonsCommand()(regl)
}

export default function DrawPolygons(props: { children: DrawPolygonType[] }) {
  return makeDrawPolygonsCommand()
}
