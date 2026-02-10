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

    // GPU端颜色映射配置
    uniform int colorTransformer; // 0=Flat, 1=Intensity, 2=Axis
    uniform bool useRainbow;
    uniform float intensityMin;
    uniform float intensityMax;
    uniform vec3 minColor;
    uniform vec3 maxColor;
    uniform vec3 flatColor;
    uniform float alpha;
    uniform int axisColor; // 0=X, 1=Y, 2=Z
    uniform float axisMin;
    uniform float axisMax;

    attribute vec3 point;
    attribute float intensity; // 用于Intensity模式，如果不需要则为0（可选属性）
    varying vec4 fragColor;
    
    // HSL转RGB（GPU端实现）
    vec3 hslToRgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0);
      return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
    }
    
    void main () {
      vec3 pos = applyPose(point);
      gl_Position = projection * view * vec4(pos, 1);
      
      // GPU端颜色映射计算
      vec3 finalColor = vec3(1.0);
      
      if (colorTransformer == 1) {
        // Intensity模式
        float intensityRange = intensityMax - intensityMin;
        float normalizedIntensity = 0.0;
        if (intensityRange > 0.001) { // 避免除零
          normalizedIntensity = clamp((intensity - intensityMin) / intensityRange, 0.0, 1.0);
        }
        
        if (useRainbow) {
          // Rainbow模式：HSV颜色空间（0=blue, 1=red）
          float hue = (1.0 - normalizedIntensity) * 240.0 / 360.0;
          finalColor = hslToRgb(vec3(hue, 1.0, 0.5));
        } else {
          // 线性插值模式
          finalColor = mix(minColor, maxColor, normalizedIntensity);
        }
      } else if (colorTransformer == 2) {
        // Axis模式：使用原始坐标（point）而不是变换后的坐标（pos）
        // 这样颜色映射会基于点云在原始frame中的坐标值（与RViz行为一致）
        float axisValue = axisColor == 0 ? point.x : (axisColor == 1 ? point.y : point.z);
        float axisRange = axisMax - axisMin;
        float normalizedAxis = 0.0;
        if (axisRange > 0.001) { // 避免除零
          normalizedAxis = clamp((axisValue - axisMin) / axisRange, 0.0, 1.0);
        }
        
        // 始终使用Rainbow模式：红色→黄色→绿色
        float hue = normalizedAxis * 120.0 / 360.0;
        finalColor = hslToRgb(vec3(hue, 1.0, 0.5));
      } else {
        // Flat模式
        finalColor = flatColor;
      }
      
      fragColor = vec4(finalColor, alpha);

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
            // 性能优化：优先使用缓存的 GPU buffer（如果存在）
            // 这样可以避免每帧重新创建 Float32Array，大幅提升性能
            if (props._cachedBuffers?.positionBuffer) {
              return props._cachedBuffers.positionBuffer
            }
            
            // 优化：支持Float32Array二进制格式
            // GPU端颜色映射：格式为 [x1, y1, z1, intensity1, x2, y2, z2, intensity2, ...] (4个float/点)
            // 或旧格式：[x1, y1, z1, r1, g1, b1, a1, ...] (7个float/点，向后兼容)
            if (props.pointData && props.pointData instanceof Float32Array) {
              const pointData = props.pointData
              const stride = props.useGpuColorMapping ? 4 : 7
              const pointCount = props.pointCount || Math.floor(pointData.length / stride)
              if (pointCount <= 0) {
                // 如果没有点，返回至少1个元素的数组（regl要求）
                return new Float32Array(3).fill(0)
              }
              // 提取位置数据：每4个或7个float中取前3个
              const positions = new Float32Array(pointCount * 3)
              for (let i = 0; i < pointCount; i++) {
                const srcOffset = i * stride
                const dstOffset = i * 3
                if (srcOffset + 2 < pointData.length) {
                  positions[dstOffset + 0] = pointData[srcOffset + 0]
                  positions[dstOffset + 1] = pointData[srcOffset + 1]
                  positions[dstOffset + 2] = pointData[srcOffset + 2]
                } else {
                  positions[dstOffset + 0] = 0
                  positions[dstOffset + 1] = 0
                  positions[dstOffset + 2] = 0
                }
              }
              return positions
            }
            // 向后兼容：对象数组格式
            return props.points.map((point: any) => (Array.isArray(point) ? point : pointToVec3(point)))
          },
          intensity: (_context: any, props: any) => {
            // 性能优化：优先使用缓存的 GPU buffer（如果存在）
            if (props._cachedBuffers?.intensityBuffer) {
              return props._cachedBuffers.intensityBuffer
            }
            
            // GPU端颜色映射：提取intensity数据
            // 注意：regl要求attribute必须始终提供有效的Float32Array，且长度必须与point属性匹配
            if (props.pointData && props.pointData instanceof Float32Array && props.useGpuColorMapping) {
              const pointData = props.pointData
              const stride = 4
              const pointCount = props.pointCount || Math.floor(pointData.length / stride)
              if (pointCount > 0) {
                // 提取intensity数据：每4个float中取第4个
                const intensities = new Float32Array(pointCount)
                for (let i = 0; i < pointCount; i++) {
                  const offset = i * stride + 3
                  if (offset < pointData.length) {
                    const val = pointData[offset]
                    intensities[i] = isFinite(val) ? val : 0.0
                  } else {
                    intensities[i] = 0.0
                  }
                }
                return intensities
              }
            }
            // 向后兼容：如果没有intensity数据，返回0数组
            // 确保总是返回有效的Float32Array，长度与point属性匹配
            const stride = props.useGpuColorMapping ? 4 : 7
            const pointCount = props.pointCount || (props.pointData?.length ? Math.floor(props.pointData.length / stride) : 0)
            const count = Math.max(1, pointCount) // 至少1个元素
            return new Float32Array(count).fill(0)
          },
          color: (_context: any, props: any) => {
            // 性能优化：优先使用缓存的 GPU buffer（如果存在，且是旧格式）
            if (props._cachedBuffers?.colorBuffer && !props.useGpuColorMapping) {
              return props._cachedBuffers.colorBuffer
            }
            
            // 向后兼容：如果使用GPU颜色映射，不需要color属性（但regl要求attribute必须存在）
            if (props.useGpuColorMapping) {
              const pointCount = props.pointCount || (props.pointData?.length ? Math.floor(props.pointData.length / 4) : 0)
              const count = Math.max(1, pointCount) // 至少1个元素
              return new Float32Array(count * 4).fill(1.0) // 占位，不会被使用
            }
            // 旧格式：支持Float32Array二进制格式
            if (props.pointData && props.pointData instanceof Float32Array) {
              const pointData = props.pointData
              const pointCount = props.pointCount || Math.floor(pointData.length / 7)
              if (pointCount <= 0) {
                return new Float32Array(4).fill(1.0) // 至少1个元素
              }
              // 提取颜色数据：每7个float中取后4个
              const colors = new Float32Array(pointCount * 4)
              for (let i = 0; i < pointCount; i++) {
                const srcOffset = i * 7
                const dstOffset = i * 4
                if (srcOffset + 6 < pointData.length) {
                  colors[dstOffset + 0] = pointData[srcOffset + 3]
                  colors[dstOffset + 1] = pointData[srcOffset + 4]
                  colors[dstOffset + 2] = pointData[srcOffset + 5]
                  colors[dstOffset + 3] = pointData[srcOffset + 6]
                } else {
                  colors[dstOffset + 0] = 1.0
                  colors[dstOffset + 1] = 1.0
                  colors[dstOffset + 2] = 1.0
                  colors[dstOffset + 3] = 1.0
                }
              }
              return colors
            }
            // 向后兼容：对象数组格式
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
          },
          // GPU端颜色映射uniforms
          colorTransformer: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return 0 // 使用旧的颜色属性
            const transformer = props.colorTransformer || 'Flat'
            switch (transformer) {
              case 'Intensity': return 1
              case 'Axis': return 2
              default: return 0 // Flat
          }
        },
          useRainbow: (_context: any, props: any) => {
            return props.useGpuColorMapping ? (props.useRainbow ?? true) : false
          },
          intensityMin: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return 0
            const min = props.minIntensity ?? 0
            return min
          },
          intensityMax: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return 1
            const min = props.minIntensity ?? 0
            const max = props.maxIntensity ?? 1
            // 如果min和max相同或max小于min，调整max以避免除零或负数范围
            return (max <= min) ? (min + 1.0) : max
          },
          minColor: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return [0, 0, 0]
            const min = props.minColor || { r: 0, g: 0, b: 0 }
            return [min.r / 255, min.g / 255, min.b / 255]
          },
          maxColor: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return [1, 1, 1]
            const max = props.maxColor || { r: 255, g: 255, b: 255 }
            return [max.r / 255, max.g / 255, max.b / 255]
          },
          flatColor: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return [1, 1, 1]
            const flat = props.flatColor || { r: 255, g: 255, b: 0 }
            return [flat.r / 255, flat.g / 255, flat.b / 255]
          },
          alpha: (_context: any, props: any) => {
            return props.useGpuColorMapping ? (props.alpha ?? 1.0) : 1.0
          },
          axisColor: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return 2 // Z
            const axis = props.axisColor || 'Z'
            switch (axis.toUpperCase()) {
              case 'X': return 0
              case 'Y': return 1
              default: return 2 // Z
            }
          },
          axisMin: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return 0
            const min = props.axisMin ?? 0
            return min
          },
          axisMax: (_context: any, props: any) => {
            if (!props.useGpuColorMapping) return 1
            const min = props.axisMin ?? 0
            const max = props.axisMax ?? 1
            // 如果min和max相同，调整max以避免除零
            return (max === min && max === 0) ? 1 : max
          }
        },

        count: (_context: any, props: any) => {
          // 优化：支持Float32Array格式
          if (props.pointData && props.pointData instanceof Float32Array) {
            const stride = props.useGpuColorMapping ? 4 : 7
            const pointCount = props.pointCount || Math.floor(props.pointData.length / stride)
            return Math.max(0, pointCount) // 确保非负
          }
          // 向后兼容：对象数组格式
          return props.points?.length || 0
        }
      })
    )

    // 返回包装函数，支持数组和单个对象
    return (inProps: any) => {
      if (Array.isArray(inProps)) {
        // 如果是数组，遍历每个元素并渲染
        inProps.forEach((pointData: any, index: number) => {
          // 优化：支持Float32Array格式
          const hasPointData = pointData?.pointData instanceof Float32Array
          const hasPoints = pointData?.points && pointData.points.length > 0
          
          if (!pointData || (!hasPointData && !hasPoints)) {
            console.warn(`Points: Invalid point data at index ${index}`, pointData)
            return
          }
          command(pointData)
        })
      } else {
        // 如果是单个对象，直接渲染
        // 优化：支持Float32Array格式
        const hasPointData = inProps?.pointData instanceof Float32Array
        const hasPoints = inProps?.points && inProps.points.length > 0
        
        if (!inProps || (!hasPointData && !hasPoints)) {
          console.warn(`Points: Invalid point data`, inProps)
          return
        }
        command(inProps)
      }
    }
  }
}

export default function Points(props: Props) {
  return makePointsCommand(props)
}
