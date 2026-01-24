/**
 * 命令工具函数
 * 完全基于 regl-worldview 的 commandUtils 实现
 */
import type { Color, Point, Orientation, Vec4, Vec3 } from '../../types'

const rotateGLSL = `
  uniform vec3 _position;
  uniform vec4 _rotation;

  // rotate a 3d point v by a rotation quaternion q
  vec3 rotate(vec3 v, vec4 q) {
    vec3 temp = cross(q.xyz, v) + q.w * v;
    return v + (2.0 * cross(q.xyz, temp));
  }

  vec3 applyPose(vec3 point) {
    // rotate the point and then add the position of the pose
    return rotate(point, _rotation) + _position;
  }
`

const DEFAULT_TEXT_COLOR: Color = { r: 1, g: 1, b: 1, a: 1 }

export const pointToVec3 = ({ x, y, z }: Point): Vec3 => {
  return [x, y, z]
}

export const orientationToVec4 = ({ x, y, z, w }: Orientation): Vec4 => {
  return [x, y, z, w]
}

export const vec3ToPoint = ([x, y, z]: Vec3): Point => ({ x, y, z })

export const vec4ToOrientation = ([x, y, z, w]: Vec4): Orientation => ({ x, y, z, w })

export const pointToVec3Array = (points: Point[]): Float32Array => {
  const result = new Float32Array(points.length * 3)
  let i = 0
  for (const { x, y, z } of points) {
    result[i++] = x
    result[i++] = y
    result[i++] = z
  }
  return result
}

export const toRGBA = (val: Color): Vec4 => {
  return [val.r, val.g, val.b, val.a ?? 1]
}

export const vec4ToRGBA = (color: Vec4): Color => ({ r: color[0], g: color[1], b: color[2], a: color[3] })

export const toColor = (val: Color | Vec4): Color => (Array.isArray(val) ? vec4ToRGBA(val) : val)

export function getCSSColor(color: Color = DEFAULT_TEXT_COLOR): string {
  const { r, g, b, a = 1 } = color
  return `rgba(${(r * 255).toFixed()}, ${(g * 255).toFixed()}, ${(b * 255).toFixed()}, ${a.toFixed(3)})`
}

const toRGBAArray = (colors: ReadonlyArray<Color>): Float32Array => {
  const result = new Float32Array(colors.length * 4)
  let i = 0
  for (const { r, g, b, a = 1 } of colors) {
    result[i++] = r
    result[i++] = g
    result[i++] = b
    result[i++] = a
  }
  return result
}

const constantRGBAArray = (count: number, { r, g, b, a = 1 }: Color): Float32Array => {
  const result = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    result[4 * i + 0] = r
    result[4 * i + 1] = g
    result[4 * i + 2] = b
    result[4 * i + 3] = a
  }
  return result
}

// default blend func params to be mixed into regl commands
export const defaultReglBlend = {
  enable: true,
  // this is the same gl.BlendFunc used by three.js by default
  func: {
    src: 'src alpha',
    dst: 'one minus src alpha',
    srcAlpha: 1,
    dstAlpha: 'one minus src alpha'
  },
  equation: {
    rgb: 'add',
    alpha: 'add'
  }
}

export const defaultReglDepth = {
  enable: true,
  mask: true
}

export const defaultDepth = {
  enable: (_context: any, props: any) => (props.depth && props.depth.enable) || defaultReglDepth.enable,
  mask: (_context: any, props: any) => (props.depth && props.depth.mask) || defaultReglDepth.mask
}

export const defaultBlend = {
  ...defaultReglBlend,
  enable: (_context: any, props: any) => (props.blend && props.blend.enable) || defaultReglBlend.enable,
  func: (_context: any, props: any) => (props.blend && props.blend.func) || defaultReglBlend.func
}

// TODO: deprecating, remove before 1.x release
export const blend = defaultBlend

// takes a regl command definition object and injects
// position and rotation from the object pose and also
// inserts some glsl helpers to apply the pose to points in a fragment shader
export function withPose<T extends { vert: string; uniforms?: any }>(command: T): T {
  const { vert, uniforms } = command
  const newVert = vert.replace('#WITH_POSE', rotateGLSL)
  const newUniforms = {
    ...uniforms,
    _position: (_context: any, props: any) => {
      const { position } = props.pose
      return Array.isArray(position) ? position : pointToVec3(position)
    },
    _rotation: (_context: any, props: any) => {
      const { orientation: r } = props.pose
      return Array.isArray(r) ? r : [r.x, r.y, r.z, r.w]
    }
  }
  return {
    ...command,
    vert: newVert,
    uniforms: newUniforms
  } as T
}

export function getVertexColors({
  colors,
  color,
  points
}: {
  colors?: ReadonlyArray<Color> | ReadonlyArray<Vec4>
  color: Color
  points: ReadonlyArray<Point>
}): Float32Array | ReadonlyArray<Vec4> {
  if ((!colors || !colors.length) && color) {
    return constantRGBAArray(points.length, color)
  }
  if (colors) {
    if (shouldConvert(colors)) {
      return toRGBAArray(colors as Color[])
    }
    // 如果已经是 Vec4[]，直接返回
    return colors as ReadonlyArray<Vec4>
  }
  return []
}

function hasNestedArrays(arr: any[]): boolean {
  return arr.length > 0 && Array.isArray(arr[0])
}

// Returns a function which accepts a single color, an array of colors, and the number of instances,
// and returns a color attribute buffer for use in regl.
// If there are multiple colors in the colors array, one color will be assigned to each instance.
// In the case of a single color, the same color will be used for all instances.
export function colorBuffer(regl: any) {
  const buffer = regl.buffer({
    usage: 'dynamic',
    data: []
  })

  return function (color: any, colors: any, length: number) {
    let data: any
    let divisor: number
    if (!colors || !colors.length) {
      data = shouldConvert(color) ? toRGBA(color) : color
      divisor = length
    } else {
      data = shouldConvert(colors) ? toRGBAArray(colors) : colors
      divisor = 1
    }
    return {
      buffer: buffer({
        usage: 'dynamic',
        data
      }),
      divisor
    }
  }
}

// used to determine if the input/array of inputs is an object like {r: 0, g: 0, b: 0} or [0,0,0]
export function shouldConvert(props: any): boolean {
  if (!props || hasNestedArrays(props) || !isNaN(props[0])) {
    return false
  }
  return true
}

export function intToRGB(i: number = 0): Vec4 {
  const r = ((i >> 16) & 255) / 255
  const g = ((i >> 8) & 255) / 255
  const b = (i & 255) / 255
  return [r, g, b, 1] as Vec4
}

export function getIdFromColor(rgb: Vec4): number {
  const r = rgb[0] * 255
  const g = rgb[1] * 255
  const b = rgb[2] * 255
  return b | (g << 8) | (r << 16)
}

export function getIdFromPixel(rgb: Uint8Array): number {
  const r = rgb[0] ?? 0
  const g = rgb[1] ?? 0
  const b = rgb[2] ?? 0
  return b | (g << 8) | (r << 16)
}
