/**
 * 数学工具函数
 */
import { mat4, vec3 } from 'gl-matrix'
import type { CameraState, Point3D } from '../types'

/**
 * 创建透视投影矩阵
 */
export function createPerspectiveMatrix(
  fov: number,
  aspect: number,
  near: number,
  far: number
): mat4 {
  const matrix = mat4.create()
  mat4.perspective(matrix, fov, aspect, near, far)
  return matrix
}

/**
 * 创建视图矩阵
 */
export function createViewMatrix(camera: CameraState): mat4 {
  const matrix = mat4.create()
  const eye = vec3.fromValues(...camera.position)
  const center = vec3.fromValues(...camera.target)
  const up = vec3.fromValues(...camera.up)
  mat4.lookAt(matrix, eye, center, up)
  return matrix
}

/**
 * 创建模型矩阵（平移、旋转、缩放）
 */
export function createModelMatrix(
  translation: Point3D = { x: 0, y: 0, z: 0 },
  rotation: Point3D = { x: 0, y: 0, z: 0 },
  scale: Point3D = { x: 1, y: 1, z: 1 }
): mat4 {
  const matrix = mat4.create()
  mat4.translate(matrix, matrix, [translation.x, translation.y, translation.z])
  mat4.rotateX(matrix, matrix, rotation.x)
  mat4.rotateY(matrix, matrix, rotation.y)
  mat4.rotateZ(matrix, matrix, rotation.z)
  mat4.scale(matrix, matrix, [scale.x, scale.y, scale.z])
  return matrix
}

/**
 * 计算两点之间的距离
 */
export function distance(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const dz = p2.z - p1.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * 标准化向量
 */
export function normalize(v: [number, number, number]): [number, number, number] {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  if (length === 0) return [0, 0, 0]
  return [v[0] / length, v[1] / length, v[2] / length]
}
