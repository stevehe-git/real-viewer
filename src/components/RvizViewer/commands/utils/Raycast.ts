/**
 * Raycast 工具函数
 * 完全基于 regl-worldview 的 Raycast.js 实现
 */
import { vec3, mat4 } from 'gl-matrix'
import type { Vec3 } from '../../types'

type ClickInfo = { clientX: number; clientY: number; width: number; height: number }

const tempVec = vec3.create()
const tempMat = mat4.create()

export class Ray {
  origin: Vec3
  dir: Vec3
  point: Vec3

  constructor(origin: Vec3, dir: Vec3, point: Vec3) {
    this.origin = origin
    this.dir = dir
    this.point = point
  }

  distanceToPoint(point: Vec3): number {
    return vec3.distance(this.origin, point)
  }

  // https://commons.apache.org/proper/commons-math/javadocs/api-3.6/src-html/org/apache/commons/math3/geometry/euclidean/threed/Plane.html#line.394
  planeIntersection(planeCoordinate: Vec3, planeNormal: Vec3): Vec3 | null {
    const d = vec3.dot(planeNormal, planeCoordinate)
    const cosine = vec3.dot(planeNormal, this.dir)

    if (cosine === 0) {
      return null
    }

    const x = (d - vec3.dot(planeNormal, this.origin)) / cosine
    const contact = vec3.add(vec3.create(), this.origin, vec3.scale(tempVec, this.dir, x))
    return contact as Vec3
  }
}

// adapted from https://github.com/regl-project/regl/blob/master/example/raycast.js
export function getRayFromClick(
  camera: { getProjection: () => any; getView: () => any },
  { clientX, clientY, width, height }: ClickInfo
): Ray {
  const projectionMatrix = camera.getProjection()
  const viewMatrix = camera.getView()

  const vp = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix)
  const invVp = mat4.invert(mat4.create(), vp)

  const mouseX = (2.0 * clientX) / width - 1.0
  const mouseY = (-2.0 * clientY) / height + 1.0
  // get a single point on the camera ray.
  const rayPoint = vec3.transformMat4(vec3.create(), [mouseX, mouseY, 0.0], invVp) as Vec3

  // get the position of the camera.
  const rayOrigin = vec3.transformMat4(vec3.create(), [0, 0, 0], mat4.invert(mat4.create(), viewMatrix)) as Vec3
  const rayDir = vec3.normalize(vec3.create(), vec3.subtract(tempVec, rayPoint, rayOrigin)) as Vec3

  return new Ray(rayOrigin, rayDir, rayPoint)
}
