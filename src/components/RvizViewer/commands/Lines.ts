/**
 * Lines 命令
 * 完全基于 regl-worldview 的 Lines.js 实现
 * 这是一个简化版本，保留了核心功能
 */
import flatten from 'lodash/flatten'
import memoize from 'lodash/memoize'
import type { Regl, Line, Vec4, Color, Pose, DepthState, BlendState } from '../../types'
import {
  defaultBlend,
  withPose,
  toRGBA,
  shouldConvert,
  pointToVec3,
  defaultReglDepth,
  defaultReglBlend
} from './utils/commandUtils'

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT
const POINT_BYTES = 3 * FLOAT_BYTES
const DEFAULT_MONOCHROME_COLOR: Vec4 = [1, 1, 1, 0.2]

// The four points forming the triangles' vertices.
// Values do not matter, they just need to be distinct.
const POINT_TYPES = { BL: 0, TR: 1, BR: 2, TL: 3 }
const VERTICES_PER_INSTANCE = Object.keys(POINT_TYPES).length

// 简化的 vertex shader（完整版本请参考 regl-worldview）
const vert = `
precision mediump float;

attribute float pointType;

// per-instance attributes
attribute vec4 colorB;
attribute vec4 colorC;
attribute vec3 positionA;
attribute vec3 positionB;
attribute vec3 positionC;
attribute vec3 positionD;
// per-instance pose attributes
attribute vec3 posePosition;
attribute vec4 poseRotation;

uniform mat4 projection, view;
uniform float viewportWidth;
uniform float viewportHeight;
uniform float alpha;
uniform float thickness;
uniform bool joined;
uniform bool scaleInvariant;

varying vec4 vColor;

${Object.keys(POINT_TYPES)
  .map((k) => `const float POINT_${k} = ${POINT_TYPES[k]}.0;`)
  .join('\n')}

#WITH_POSE

vec3 applyPoseInstance(vec3 point, vec4 rotation, vec3 position) {
  return rotate(point, rotation) + position;
}

vec2 rotateCCW(vec2 v) {
  return vec2(-v.y, v.x);
}

vec2 normalizeOrZero(vec2 v) {
  return length(v) < 0.00001 ? vec2(0, 0) : normalize(v);
}

void setPosition(vec4 proj, vec2 offset) {
  gl_Position = proj;
  offset *= thickness / 2.;
  if (scaleInvariant) {
    offset.x /= viewportWidth / 2.0;
    offset.y /= viewportHeight / 2.0;
    offset *= proj.w;
  } else {
    offset *= length(projection[0].xyz);
    offset.y *= viewportWidth / viewportHeight;
  }
  gl_Position.xy += offset;
}

void main () {
  bool isStart = positionA == positionB;
  bool isEnd = positionC == positionD;
  bool isLeft = (pointType == POINT_TL || pointType == POINT_BL);
  bool isTop = (pointType == POINT_TL || pointType == POINT_TR);
  bool isEndpoint = isLeft ? isStart : isEnd;

  float scale = isTop ? 1. : -1.;

  mat4 projView = projection * view;
  vec4 projA = projView * vec4(applyPose(applyPoseInstance(positionA, poseRotation, posePosition)), 1);
  vec4 projB = projView * vec4(applyPose(applyPoseInstance(positionB, poseRotation, posePosition)), 1);
  vec4 projC = projView * vec4(applyPose(applyPoseInstance(positionC, poseRotation, posePosition)), 1);
  vec4 projD = projView * vec4(applyPose(applyPoseInstance(positionD, poseRotation, posePosition)), 1);

  vec2 aspectVec = vec2(viewportWidth / viewportHeight, 1.0);
  vec2 screenA = projA.xy / projA.w * aspectVec;
  vec2 screenB = projB.xy / projB.w * aspectVec;
  vec2 screenC = projC.xy / projC.w * aspectVec;
  vec2 screenD = projD.xy / projD.w * aspectVec;

  vec2 dirAB = normalizeOrZero(screenB - screenA);
  vec2 dirBC = normalizeOrZero(screenC - screenB);
  vec2 dirCD = normalizeOrZero(screenD - screenC);

  vec2 perpAB = rotateCCW(dirAB);
  vec2 perpBC = rotateCCW(dirBC);

  vColor = isLeft ? colorB : colorC;
  vColor.a *= alpha;

  vec4 proj = isLeft ? projB : projC;

  if (!joined || isEndpoint) {
    setPosition(proj, scale * perpBC);
    return;
  }

  float cosB = clamp(-dot(dirAB, dirBC), -1., 1.);
  float cosC = clamp(-dot(dirBC, dirCD), -1., 1.);

  bool tooSharpB = cosB > 0.01;
  bool tooSharpC = cosC > 0.01;
  bool tooSharp = isLeft ? tooSharpB : tooSharpC;

  bool turningRightB = dot(dirAB, rotateCCW(dirBC)) > 0.;
  bool turningRightC = dot(dirBC, rotateCCW(dirCD)) > 0.;
  bool turningRight = isLeft ? turningRightB : turningRightC;

  if (tooSharp) {
    vec2 perp = isLeft ? perpAB : perpBC;
    vec2 dir = isLeft ? dirAB : dirBC;
    float scalePerp = isLeft ? -1. : 1.;
    float scaleDir = (turningRight == isLeft) ? 1. : -1.;
    float tanHalfB = sqrt((1. - cosB) / (1. + cosB));
    float tanHalfC = sqrt((1. - cosC) / (1. + cosC));
    float tanHalf = isLeft ? tanHalfB : tanHalfC;
    setPosition(proj, scale * (scalePerp * perp + scaleDir * dir * tanHalf));
  } else {
    vec2 bisectorB = rotateCCW(normalize(dirAB + dirBC));
    vec2 bisectorC = rotateCCW(normalize(dirBC + dirCD));
    vec2 bisector = isLeft ? bisectorB : bisectorC;
    float sinHalfB = sqrt((1. - cosB) / 2.);
    float sinHalfC = sqrt((1. - cosC) / 2.);
    float sinHalf = isLeft ? sinHalfB : sinHalfC;
    setPosition(proj, scale * bisector / sinHalf);
  }
}
`

const frag = `
precision mediump float;
varying vec4 vColor;
void main () {
  gl_FragColor = vColor;
}
`

function pointsEqual(a: any, b: any): boolean {
  const [ax, ay, az] = shouldConvert(a) ? pointToVec3(a) : a
  const [bx, by, bz] = shouldConvert(b) ? pointToVec3(b) : b
  return ax === bx && ay === by && az === bz
}

export const lines = (regl: Regl) => {
  if (!regl) {
    throw new Error('Invalid regl instance')
  }

  // The point type attribute, reused for each instance
  const pointTypeBuffer = regl.buffer({
    type: 'uint16',
    usage: 'static',
    data: [POINT_TYPES.TL, POINT_TYPES.BL, POINT_TYPES.TR, POINT_TYPES.BR]
  })
  const debugColorBuffer = regl.buffer({
    type: 'float',
    usage: 'static',
    data: [
      [0, 1, 1, 1], // cyan
      [1, 0, 0, 1], // red
      [0, 1, 0, 1], // green
      [1, 0, 1, 1] // magenta
    ]
  })
  const defaultPosePositionBuffer = regl.buffer({
    type: 'float',
    usage: 'static',
    data: flatten(new Array(VERTICES_PER_INSTANCE).fill([0, 0, 0]))
  })
  const defaultPoseRotationBuffer = regl.buffer({
    type: 'float',
    usage: 'static',
    data: flatten(new Array(VERTICES_PER_INSTANCE).fill([0, 0, 0, 1]))
  })

  const colorBuffer = regl.buffer({ type: 'float' })
  const positionBuffer1 = regl.buffer({ type: 'float' })
  const positionBuffer2 = regl.buffer({ type: 'float' })
  const posePositionBuffer = regl.buffer({ type: 'float' })
  const poseRotationBuffer = regl.buffer({ type: 'float' })

  const command = regl(
    withPose({
      vert,
      frag,
      blend: defaultBlend,
      uniforms: {
        thickness: regl.prop('scale.x'),
        viewportWidth: regl.context('viewportWidth'),
        viewportHeight: regl.context('viewportHeight'),
        alpha: regl.prop('alpha'),
        joined: regl.prop('joined'),
        scaleInvariant: regl.prop('scaleInvariant')
      },
      attributes: {
        pointType: pointTypeBuffer,
        colorB: (context: any, { joined, monochrome, debug }: any) => ({
          buffer: debug ? debugColorBuffer : colorBuffer,
          offset: 0,
          stride: (joined || monochrome || debug ? 1 : 2) * 4 * FLOAT_BYTES,
          divisor: monochrome || debug ? 0 : 1
        }),
        colorC: (context: any, { joined, monochrome, debug }: any) => ({
          buffer: debug ? debugColorBuffer : colorBuffer,
          offset: monochrome || debug ? 0 : 4 * FLOAT_BYTES,
          stride: (joined || monochrome || debug ? 1 : 2) * 4 * FLOAT_BYTES,
          divisor: monochrome || debug ? 0 : 1
        }),
        positionA: (context: any, { joined }: any) => ({
          buffer: positionBuffer1,
          offset: 0,
          stride: (joined ? 1 : 2) * POINT_BYTES,
          divisor: 1
        }),
        positionB: (context: any, { joined }: any) => ({
          buffer: positionBuffer1,
          offset: POINT_BYTES,
          stride: (joined ? 1 : 2) * POINT_BYTES,
          divisor: 1
        }),
        positionC: (context: any, { joined }: any) => ({
          buffer: positionBuffer2,
          offset: 2 * POINT_BYTES,
          stride: (joined ? 1 : 2) * POINT_BYTES,
          divisor: 1
        }),
        positionD: (context: any, { joined }: any) => ({
          buffer: positionBuffer2,
          offset: 3 * POINT_BYTES,
          stride: (joined ? 1 : 2) * POINT_BYTES,
          divisor: 1
        }),
        posePosition: (context: any, { hasInstancedPoses }: any) => ({
          buffer: hasInstancedPoses ? posePositionBuffer : defaultPosePositionBuffer,
          divisor: hasInstancedPoses ? 1 : 0
        }),
        poseRotation: (context: any, { hasInstancedPoses }: any) => ({
          buffer: hasInstancedPoses ? poseRotationBuffer : defaultPoseRotationBuffer,
          divisor: hasInstancedPoses ? 1 : 0
        })
      },
      count: VERTICES_PER_INSTANCE,
      instances: regl.prop('instances'),
      primitive: regl.prop('primitive')
    })
  )

  let colorArray = new Float32Array(VERTICES_PER_INSTANCE * 4)
  let pointArray = new Float32Array(0)
  let allocatedPoints = 0
  let positionArray = new Float32Array(0)
  let rotationArray = new Float32Array(0)

  function fillPointArray(points: any[], alreadyClosed: boolean, shouldClose: boolean): Float32Array {
    const numTotalPoints = points.length + (shouldClose ? 3 : 2)
    if (allocatedPoints < numTotalPoints) {
      pointArray = new Float32Array(numTotalPoints * 3)
      allocatedPoints = numTotalPoints
    }
    points.forEach((point, i) => {
      const [x, y, z] = shouldConvert(point) ? pointToVec3(point) : point
      const off = 3 + i * 3
      pointArray[off + 0] = x
      pointArray[off + 1] = y
      pointArray[off + 2] = z
    })

    const n = numTotalPoints * 3
    if (alreadyClosed) {
      pointArray.copyWithin(0, n - 9, n - 6)
      pointArray.copyWithin(n - 3, 6, 9)
    } else if (shouldClose) {
      pointArray.copyWithin(0, n - 9, n - 6)
      pointArray.copyWithin(n - 6, 3, 9)
    } else {
      pointArray.copyWithin(0, 3, 6)
      pointArray.copyWithin(n - 3, n - 6, n - 3)
    }
    return pointArray.subarray(0, n)
  }

  function fillPoseArrays(
    instances: number,
    poses: Pose[]
  ): { positionData: Float32Array; rotationData: Float32Array } {
    if (positionArray.length < instances * 3) {
      positionArray = new Float32Array(instances * 3)
      rotationArray = new Float32Array(instances * 4)
    }
    for (let index = 0; index < poses.length; index++) {
      const positionOffset = index * 3
      const rotationOffset = index * 4
      const { position, orientation: r } = poses[index]
      const convertedPosition = Array.isArray(position) ? position : pointToVec3(position)
      positionArray[positionOffset + 0] = convertedPosition[0]
      positionArray[positionOffset + 1] = convertedPosition[1]
      positionArray[positionOffset + 2] = convertedPosition[2]

      const convertedRotation = Array.isArray(r) ? r : [r.x, r.y, r.z, r.w]
      rotationArray[rotationOffset + 0] = convertedRotation[0]
      rotationArray[rotationOffset + 1] = convertedRotation[1]
      rotationArray[rotationOffset + 2] = convertedRotation[2]
      rotationArray[rotationOffset + 3] = convertedRotation[3]
    }
    return {
      positionData: positionArray.subarray(0, instances * 3),
      rotationData: rotationArray.subarray(0, instances * 4)
    }
  }

  function convertColors(colors: any): Vec4[] {
    return shouldConvert(colors) ? colors.map(toRGBA) : colors
  }

  function fillColorArray(
    color: Color | Vec4 | null | undefined,
    colors: (Color | Vec4)[] | null | undefined,
    monochrome: boolean,
    shouldClose: boolean
  ): Float32Array {
    if (monochrome) {
      if (colorArray.length < VERTICES_PER_INSTANCE * 4) {
        colorArray = new Float32Array(VERTICES_PER_INSTANCE * 4)
      }
      const monochromeColor = color || DEFAULT_MONOCHROME_COLOR
      const [convertedMonochromeColor] = convertColors([monochromeColor])
      const [r, g, b, a] = convertedMonochromeColor
      for (let index = 0; index < VERTICES_PER_INSTANCE; index++) {
        const offset = index * 4
        colorArray[offset + 0] = r
        colorArray[offset + 1] = g
        colorArray[offset + 2] = b
        colorArray[offset + 3] = a
      }
      return colorArray.subarray(0, VERTICES_PER_INSTANCE * 4)
    } else if (colors) {
      const length = shouldClose ? colors.length + 1 : colors.length
      if (colorArray.length < length * 4) {
        colorArray = new Float32Array(length * 4)
      }
      const convertedColors = convertColors(colors)
      for (let index = 0; index < convertedColors.length; index++) {
        const offset = index * 4
        const [r, g, b, a] = convertedColors[index]
        colorArray[offset + 0] = r
        colorArray[offset + 1] = g
        colorArray[offset + 2] = b
        colorArray[offset + 3] = a
      }

      if (shouldClose) {
        const [r, g, b, a] = convertedColors[0]
        const lastIndex = length - 1
        colorArray[lastIndex * 4 + 0] = r
        colorArray[lastIndex * 4 + 1] = g
        colorArray[lastIndex * 4 + 2] = b
        colorArray[lastIndex * 4 + 3] = a
      }
      return colorArray.subarray(0, length * 4)
    }
    throw new Error('Impossible: !monochrome implies !!colors.')
  }

  const memoizedRender = memoize(
    (props: { depth?: DepthState; blend?: BlendState }) => {
      const { depth = defaultReglDepth, blend = defaultReglBlend } = props
      return regl({ depth, blend })
    },
    (...args) => JSON.stringify(args)
  )

  const render = (props: { debug?: boolean; depth?: DepthState; blend?: BlendState }, commands: any) => {
    const { debug } = props
    if (debug) {
      memoizedRender({ depth: { enable: false } })(commands)
    } else {
      memoizedRender(props)(commands)
    }
  }

  function renderLine(props: any) {
    const { debug, primitive = 'lines', scaleInvariant = false, depth, blend } = props
    const numInputPoints = props.points.length

    if (numInputPoints < 2) {
      return
    }

    const alreadyClosed = numInputPoints > 2 && pointsEqual(props.points[0], props.points[numInputPoints - 1])
    const shouldClose = !alreadyClosed && props.closed

    const pointData = fillPointArray(props.points, alreadyClosed, shouldClose)
    positionBuffer1({ data: pointData, usage: 'dynamic' })
    positionBuffer2({ data: pointData, usage: 'dynamic' })

    const monochrome = !(props.colors && props.colors.length)
    const colorData = fillColorArray(props.color, props.colors, monochrome, shouldClose)
    colorBuffer({ data: colorData, usage: 'dynamic' })

    const joined = primitive === 'line strip'
    const effectiveNumPoints = numInputPoints + (shouldClose ? 1 : 0)
    const instances = joined ? effectiveNumPoints - 1 : Math.floor(effectiveNumPoints / 2)

    const { poses } = props
    const hasInstancedPoses = !!poses && poses.length > 0
    if (hasInstancedPoses && poses) {
      if (instances !== poses.length) {
        console.error(`Expected ${instances} poses but given ${poses.length} poses: will result in webgl error.`)
        return
      }
      const { positionData, rotationData } = fillPoseArrays(instances, poses)
      posePositionBuffer({ data: positionData, usage: 'dynamic' })
      poseRotationBuffer({ data: rotationData, usage: 'dynamic' })
    }

    render({ debug, depth, blend }, () => {
      command(
        Object.assign({}, props, {
          joined,
          primitive: 'triangle strip',
          alpha: debug ? 0.2 : 1,
          monochrome,
          instances,
          scaleInvariant,
          hasInstancedPoses
        })
      )
      if (debug) {
        command(
          Object.assign({}, props, {
            joined,
            primitive: 'line strip',
            alpha: 1,
            monochrome,
            instances,
            scaleInvariant,
            hasInstancedPoses
          })
        )
      }
    })
  }

  return (inProps: any) => {
    if (Array.isArray(inProps)) {
      inProps.forEach(renderLine)
    } else {
      renderLine(inProps)
    }
  }
}

export default function Lines(props: { children: Line[] }) {
  return lines
}
