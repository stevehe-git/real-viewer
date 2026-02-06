/**
 * Points 命令
 * 完全基于 regl-worldview 的 Points.js 实现
 */
import type { Regl, PointType } from '../types'
import { getVertexColors, pointToVec3, withPose } from './utils/commandUtils'

type PointsProps = {
  useWorldSpaceSize?: boolean
  style?: string // 'Points' | 'Squares' | 'Flat Squares' | 'Spheres' | 'Boxes'
}

type Props = PointsProps & {
  children: ReadonlyArray<PointType>
}

export const makePointsCommand = ({ useWorldSpaceSize, style = 'Points' }: PointsProps = {}) => {
  return (regl: Regl) => {
    if (!regl) {
      throw new Error('Invalid regl instance')
    }

    const [minLimitPointSize, maxLimitPointSize] = regl.limits.pointSizeDims
    
    // 创建 regl command（用于渲染单个 PointType）
    const command = regl(
      withPose({
        primitive: 'points',
        vert: `
    precision mediump float;

    #WITH_POSE

    uniform mat4 projection, view;
    uniform float pointSize;
    uniform bool useWorldSpaceSize;
    uniform float viewportWidth;
    uniform float viewportHeight;
    uniform float minPointSize;
    uniform float maxPointSize;
    uniform int pointStyle;

    attribute vec3 point;
    attribute vec4 color;
    varying vec4 fragColor;
    void main () {
      vec3 pos = applyPose(point);
      gl_Position = projection * view * vec4(pos, 1);
      fragColor = color;

      if (useWorldSpaceSize) {
        // Calculate the point size based on world dimensions:
        // First, we need to compute a new point that is one unit away from
        // the center of the current point being rendered. We do it in view space
        // in order to make sure the new point is always one unit up and it's not
        // affected by view rotation.
        vec4 up = projection * (view * vec4(pos, 1.0) + vec4(0.0, 1.0, 0.0, 0.0));

        // Then, we compute the distance between both points in clip space, dividing
        // by the w-component to account for distance in perspective projection.
        float d = length(up.xyz / up.w - gl_Position.xyz / gl_Position.w);

        // Finally, the point size is calculated using the size of the render target
        // and it's aspect ratio. We multiply it by 0.5 since distance in clip space
        // is in range [0, 2] (because clip space's range is [-1, 1]) and
        // we need it to be [0, 1].
        float invAspect = viewportHeight / viewportWidth;
        gl_PointSize = pointSize * 0.5 * d * viewportWidth * invAspect;
      } else {
        gl_PointSize = pointSize;
      }

      // Finally, ensure the calculated point size is within the limits.
      gl_PointSize = min(maxPointSize, max(minPointSize, gl_PointSize));
    }
    `,
        frag: `
    precision mediump float;
    varying vec4 fragColor;
    uniform int pointStyle;
    
    void main () {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      
      // Style 0: Points (圆形)
      // Style 1: Squares (圆角方形)
      // Style 2: Flat Squares (方形，无圆角)
      // Style 3: Spheres (球形，带光照)
      // Style 4: Boxes (立方体，需要特殊处理，暂时用方形代替)
      
      if (pointStyle == 0) {
        // Points: 圆形点
        if (dist > 0.5) discard;
        float alpha = fragColor.a * (1.0 - smoothstep(0.0, 0.5, dist));
        gl_FragColor = vec4(fragColor.rgb, alpha);
      } else if (pointStyle == 1) {
        // Squares: 圆角方形
        vec2 absCoord = abs(coord);
        float maxDist = max(absCoord.x, absCoord.y);
        if (maxDist > 0.5) discard;
        float cornerDist = length(absCoord - vec2(0.35));
        float alpha = fragColor.a;
        if (cornerDist < 0.15) {
          // 圆角处理
          alpha *= smoothstep(0.15, 0.0, cornerDist);
        }
        gl_FragColor = vec4(fragColor.rgb, alpha);
      } else if (pointStyle == 2) {
        // Flat Squares: 方形，无圆角
        vec2 absCoord = abs(coord);
        if (max(absCoord.x, absCoord.y) > 0.5) discard;
        gl_FragColor = fragColor;
      } else if (pointStyle == 3) {
        // Spheres: 球形，带简单光照效果
        if (dist > 0.5) discard;
        // 计算法线（从中心指向当前像素）
        vec3 normal = normalize(vec3(coord, sqrt(1.0 - dist * dist)));
        // 简单光照（假设光源在相机位置）
        float light = max(0.3, dot(normal, vec3(0.0, 0.0, 1.0)));
        float alpha = fragColor.a * (1.0 - smoothstep(0.0, 0.5, dist));
        gl_FragColor = vec4(fragColor.rgb * light, alpha);
      } else {
        // Boxes: 立方体（暂时用方形代替，真正的立方体需要 geometry shader）
        vec2 absCoord = abs(coord);
        if (max(absCoord.x, absCoord.y) > 0.5) discard;
        // 简单的边框效果
        float edgeDist = min(0.5 - absCoord.x, 0.5 - absCoord.y);
        float edge = smoothstep(0.0, 0.1, edgeDist);
        gl_FragColor = vec4(fragColor.rgb * edge, fragColor.a);
      }
    }
    `,
        attributes: {
          point: (_context: any, props: any) => {
            return props.points.map((point: any) => (Array.isArray(point) ? point : pointToVec3(point)))
          },
          color: (_context: any, props: any) => {
            const colors = getVertexColors(props)
            return colors
          }
        },

        uniforms: {
          pointSize: (_context: any, props: any) => {
            return props.scale?.x || 1
          },
          useWorldSpaceSize: !!useWorldSpaceSize,
          viewportWidth: regl.context('viewportWidth'),
          viewportHeight: regl.context('viewportHeight'),
          minPointSize: minLimitPointSize,
          maxPointSize: maxLimitPointSize,
          pointStyle: (_context: any, props: any) => {
            // 从 props 中获取 style，如果没有则使用默认值
            const pointStyle = props.style || style || 'Points'
            // 映射样式名称到数字
            switch (pointStyle) {
              case 'Points': return 0
              case 'Squares': return 1
              case 'Flat Squares': return 2
              case 'Spheres': return 3
              case 'Boxes': return 4
              default: return 0
            }
          }
        },

        count: regl.prop('points.length')
      })
    )

    // 返回包装函数，支持数组和单个对象
    return (inProps: any) => {
      if (Array.isArray(inProps)) {
        // 如果是数组，遍历每个元素并渲染
        inProps.forEach((pointData: any, index: number) => {
          if (!pointData || !pointData.points || pointData.points.length === 0) {
            console.warn(`Points: Invalid point data at index ${index}`, pointData)
            return
          }
          // console.log(`Points: Rendering point cloud ${index}:`, {
          //   points: pointData.points?.length,
          //   pose: pointData.pose,
          //   color: pointData.color,
          //   colors: pointData.colors?.length,
          //   scale: pointData.scale
          // })
          command(pointData)
        })
      } else {
        // 如果是单个对象，直接渲染
        command(inProps)
      }
    }
  }
}

export default function Points(props: Props) {
  return makePointsCommand(props)
}
