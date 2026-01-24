/**
 * Cylinders 命令
 * 完全基于 regl-worldview 的 Cylinders.js 实现
 */
import type { Cylinder } from '../types'
import fromGeometry from './utils/fromGeometry'
import withRenderStateOverrides from './utils/withRenderStateOverrides'

export function createCylinderGeometry(numSegments: number, cone: boolean) {
  // "poles" are the centers of top/bottom faces
  const northPole: [number, number, number] = [0, 0, 0.5]
  const southPole: [number, number, number] = [0, 0, -0.5]

  const points: [number, number, number][] = [northPole, southPole]

  // Keep side faces separate from top/bottom to improve appearance for semi-transparent colors.
  // We don't have a good approach to transparency right now but this is a small improvement over mixing the faces.
  const sideFaces: [number, number, number][] = []
  const endCapFaces: [number, number, number][] = []

  for (let i = 0; i < numSegments; i++) {
    const theta = (2 * Math.PI * i) / numSegments
    const x = 0.5 * Math.cos(theta)
    const y = 0.5 * Math.sin(theta)
    points.push([x, y, 0.5], [x, y, -0.5])

    const bottomLeftPt = points.length - 1
    const topRightPt = cone ? 0 : i + 1 === numSegments ? 2 : points.length
    const bottomRightPt = i + 1 === numSegments ? 3 : points.length + 1
    sideFaces.push([bottomLeftPt, topRightPt, bottomRightPt])
    endCapFaces.push([bottomLeftPt, bottomRightPt, 1])
    if (!cone) {
      const topLeftPt = points.length - 2
      sideFaces.push([topLeftPt, bottomLeftPt, topRightPt])
      endCapFaces.push([topLeftPt, topRightPt, 0])
    }
  }
  return { points, sideFaces, endCapFaces }
}

const { points, sideFaces, endCapFaces } = createCylinderGeometry(30, false)

export const cylinders = withRenderStateOverrides(fromGeometry(points, sideFaces.concat(endCapFaces)))

export default function Cylinders(props: { children: Cylinder[] }) {
  return cylinders
}
