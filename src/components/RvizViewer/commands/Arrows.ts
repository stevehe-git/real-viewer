/**
 * Arrows 命令
 * 完全基于 regl-worldview 的 Arrows.js 实现
 */
import { vec3, quat } from 'gl-matrix'
import type { Arrow } from '../types'
import { pointToVec3, vec3ToPoint, orientationToVec4, vec4ToOrientation } from './utils/commandUtils'
import Cones, { cones } from './Cones'
import Cylinders, { cylinders } from './Cylinders'

const UNIT_X_VECTOR: [number, number, number] = Object.freeze([0, 0, 1]) as [number, number, number]

type Props = {
  children: Arrow[]
}

const generateArrowPrimitives = (markers: Arrow[]) => {
  const cylinderPrimitives: any[] = []
  const conePrimitives: any[] = []

  for (const marker of markers) {
    let shaftWidthX: number
    let shaftWidthY: number
    let shaftLength: number
    let headWidthX: number
    let headWidthY: number
    let headLength: number

    let basePosition: Vec3
    let orientation: quat
    let dir: Vec3
    if (marker.points && marker.points.length === 2) {
      const [start, end] = marker.points
      basePosition = [start.x, start.y, start.z]
      const tipPosition: Vec3 = [end.x, end.y, end.z]
      const length = vec3.distance(basePosition, tipPosition)

      dir = vec3.subtract(vec3.create(), tipPosition, basePosition) as Vec3
      vec3.normalize(dir, dir)
      orientation = quat.rotationTo(quat.create(), UNIT_X_VECTOR, dir)

      headWidthX = headWidthY = marker.scale?.y || 1
      headLength = marker.scale?.z || length * 0.3
      shaftWidthX = shaftWidthY = marker.scale?.x || 1
      shaftLength = length - headLength
    } else {
      basePosition = pointToVec3(marker.pose.position)
      orientation = orientationToVec4(marker.pose.orientation)
      quat.rotateY(orientation, orientation, Math.PI / 2)
      dir = vec3.transformQuat(vec3.create(), UNIT_X_VECTOR, orientation) as Vec3

      shaftWidthX = marker.scale?.y || 1
      shaftWidthY = marker.scale?.z || 1
      headWidthX = 2 * shaftWidthX
      headWidthY = 2 * shaftWidthY

      // these magic numbers taken from
      // https://github.com/ros-visualization/rviz/blob/57325fa075893de70f234f4676cdd08b411858ff/src/rviz/default_plugin/markers/arrow_marker.cpp#L113
      headLength = 0.23 * (marker.scale?.x || 1)
      shaftLength = 0.77 * (marker.scale?.x || 1)
    }

    const shaftPosition = vec3.scaleAndAdd(vec3.create(), basePosition, dir, shaftLength / 2) as Vec3
    const headPosition = vec3.scaleAndAdd(vec3.create(), basePosition, dir, shaftLength + headLength / 2) as Vec3

    cylinderPrimitives.push({
      // Set the original marker so we can use it in mouse events
      originalMarker: marker,
      scale: { x: shaftWidthX, y: shaftWidthY, z: shaftLength },
      color: marker.color,
      pose: {
        position: vec3ToPoint(shaftPosition),
        orientation: vec4ToOrientation(orientation)
      }
    })
    conePrimitives.push({
      // Set the original marker so we can use it in mouse events
      originalMarker: marker,
      scale: { x: headWidthX, y: headWidthY, z: headLength },
      color: marker.color,
      pose: {
        position: vec3ToPoint(headPosition),
        orientation: vec4ToOrientation(orientation)
      }
    })
  }

  return {
    cones: conePrimitives,
    cylinders: cylinderPrimitives
  }
}

export const makeArrowsCommand = () => {
  return (regl: any) => {
    const conesCommand = cones(regl)
    const cylindersCommand = cylinders(regl)

    return (props: any) => {
      const items: Arrow[] = Array.isArray(props) ? props : [props]
      const { cones: conePrimitives, cylinders: cylinderPrimitives } = generateArrowPrimitives(items)

      cylindersCommand(cylinderPrimitives)
      conesCommand(conePrimitives)
    }
  }
}

export default function Arrows(props: Props) {
  return makeArrowsCommand()
}
