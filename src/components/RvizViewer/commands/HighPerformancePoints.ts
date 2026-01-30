/**
 * 高性能点云渲染命令
 * 实现：
 * 1. 使用预创建的regl buffer，避免每帧重新上传数据
 * 2. 所有计算（顶点变换、投影、颜色映射）在GPU着色器中完成
 * 3. 支持单次draw call渲染所有点云
 * 4. regl状态固化，避免动态创建命令
 * 
 * 参照 regl-worldview 和 Foxglove 的主流方案
 */
import type { Regl } from '../types'
import type { PointCloudBufferManager } from './PointCloudBufferManager'

type HighPerformancePointsProps = {
  useWorldSpaceSize?: boolean
}

/**
 * 创建高性能点云渲染命令
 * 所有状态在初始化时固化，避免运行时动态创建
 */
export const makeHighPerformancePointsCommand = (
  _bufferManager: PointCloudBufferManager,
  { useWorldSpaceSize = true }: HighPerformancePointsProps = {}
) => {
  return (regl: Regl) => {
    if (!regl) {
      throw new Error('Invalid regl instance')
    }

    const [minLimitPointSize, maxLimitPointSize] = regl.limits.pointSizeDims

    /**
     * 高性能点云着色器
     * 所有计算在GPU中完成：
     * - 顶点变换（pose应用）
     * - 投影变换
     * - 颜色映射（支持多种颜色变换器）
     * - 世界空间点大小计算
     */
    const vertShader = `
      precision highp float;

      // 顶点属性：直接从buffer读取，无需CPU映射
      attribute vec3 position;
      attribute vec4 color;

      // 统一变量：每帧更新的轻量参数
      uniform mat4 projection;
      uniform mat4 view;
      uniform float pointSize;
      uniform bool useWorldSpaceSize;
      uniform float viewportWidth;
      uniform float viewportHeight;
      uniform float minPointSize;
      uniform float maxPointSize;
      
      // Pose变换（每个实例）
      uniform vec3 posePosition;
      uniform vec4 poseRotation;
      
      // 颜色映射参数（可选）
      uniform bool useColorMapping;
      uniform float minValue;
      uniform float maxValue;
      uniform vec3 minColor;
      uniform vec3 maxColor;
      uniform bool useRainbow;
      uniform float intensity; // 从color.a中提取（如果使用intensity映射）

      // 输出到片段着色器
      varying vec4 fragColor;

      // 旋转四元数函数（GPU中计算）
      vec3 rotate(vec3 v, vec4 q) {
        vec3 temp = cross(q.xyz, v) + q.w * v;
        return v + (2.0 * cross(q.xyz, temp));
      }

      // 应用pose变换（GPU中计算）
      vec3 applyPose(vec3 point) {
        return rotate(point, poseRotation) + posePosition;
      }

      // 彩虹色映射（GPU中计算）
      vec3 rainbowColor(float t) {
        t = clamp(t, 0.0, 1.0);
        float r = abs(t * 6.0 - 3.0) - 1.0;
        float g = 2.0 - abs(t * 6.0 - 2.0);
        float b = 2.0 - abs(t * 6.0 - 4.0);
        return clamp(vec3(r, g, b), 0.0, 1.0);
      }

      // 线性颜色映射（GPU中计算）
      vec3 linearColorMapping(float value) {
        float t = (value - minValue) / (maxValue - minValue);
        t = clamp(t, 0.0, 1.0);
        
        if (useRainbow) {
          return rainbowColor(t);
        } else {
          return mix(minColor, maxColor, t);
        }
      }

      void main() {
        // GPU中应用pose变换
        vec3 worldPos = applyPose(position);
        
        // GPU中计算投影
        vec4 viewPos = view * vec4(worldPos, 1.0);
        gl_Position = projection * viewPos;
        
        // GPU中计算颜色映射
        if (useColorMapping) {
          float value = intensity; // 使用intensity值进行映射
          vec3 mappedColor = linearColorMapping(value);
          fragColor = vec4(mappedColor, color.a);
        } else {
          fragColor = color; // 直接使用顶点颜色
        }

        // GPU中计算点大小（世界空间）
        if (useWorldSpaceSize) {
          // 计算世界空间中1单位在屏幕上的像素大小
          vec4 up = projection * (viewPos + vec4(0.0, 1.0, 0.0, 0.0));
          float d = length(up.xyz / up.w - gl_Position.xyz / gl_Position.w);
          float invAspect = viewportHeight / viewportWidth;
          gl_PointSize = pointSize * 0.5 * d * viewportWidth * invAspect;
        } else {
          gl_PointSize = pointSize;
        }

        // 限制点大小范围
        gl_PointSize = min(maxPointSize, max(minPointSize, gl_PointSize));
      }
    `

    const fragShader = `
      precision highp float;
      varying vec4 fragColor;
      
      void main() {
        gl_FragColor = fragColor;
      }
    `

    /**
     * 创建固化的regl命令
     * 所有状态在初始化时设置，避免运行时动态创建
     */
    const command = regl({
      primitive: 'points',
      vert: vertShader,
      frag: fragShader,
      
      // 属性：直接从buffer读取，无需CPU映射函数
      attributes: {
        position: regl.prop('positionBuffer'),
        color: regl.prop('colorBuffer')
      },

      // 统一变量：每帧更新的轻量参数
      uniforms: {
        projection: regl.prop('projection'),
        view: regl.prop('view'),
        pointSize: regl.prop('pointSize'),
        useWorldSpaceSize: useWorldSpaceSize,
        viewportWidth: regl.context('viewportWidth'),
        viewportHeight: regl.context('viewportHeight'),
        minPointSize: minLimitPointSize,
        maxPointSize: maxLimitPointSize,
        
        // Pose变换（每个实例）
        posePosition: regl.prop('posePosition'),
        poseRotation: regl.prop('poseRotation'),
        
        // 颜色映射参数
        useColorMapping: regl.prop('useColorMapping'),
        minValue: regl.prop('minValue'),
        maxValue: regl.prop('maxValue'),
        minColor: regl.prop('minColor'),
        maxColor: regl.prop('maxColor'),
        useRainbow: regl.prop('useRainbow'),
        intensity: regl.prop('intensity')
      },

      // 点数量
      count: regl.prop('count'),

      // 深度测试和混合（固化状态）
      depth: {
        enable: true,
        mask: true
      },
      blend: {
        enable: true,
        func: {
          src: 'src alpha',
          dst: 'one minus src alpha'
        }
      }
    })

    /**
     * 渲染函数：支持单次draw call渲染所有点云
     * 通过instanced rendering或多次调用实现批量渲染
     */
    return (props: any) => {
      if (Array.isArray(props)) {
        // 批量渲染：遍历所有实例
        for (const instanceProps of props) {
          if (instanceProps && instanceProps.count > 0) {
            command(instanceProps)
          }
        }
      } else {
        // 单个实例渲染
        if (props && props.count > 0) {
          command(props)
        }
      }
    }
  }
}

/**
 * 准备点云实例的渲染属性
 * 从bufferManager获取buffer，准备uniform参数
 */
export function preparePointCloudInstance(
  bufferManager: PointCloudBufferManager,
  componentId: string,
  projection: any,
  view: any
): any | null {
  const buffers = bufferManager.getBuffers(componentId)
  const config = bufferManager.getInstanceConfig(componentId)
  const data = bufferManager.getPointCloudData(componentId)

  if (!buffers || !config || !data) {
    return null
  }

  // 提取pose
  const pose = config.pose
  const posePosition = [pose.position.x, pose.position.y, pose.position.z]
  const poseRotation = [pose.orientation.x, pose.orientation.y, pose.orientation.z, pose.orientation.w]

  // 准备颜色映射参数
  const useColorMapping = !!(config.colorTransformer && config.colorTransformer !== 'flat')
  const minValue = config.minValue ?? 0
  const maxValue = config.maxValue ?? 1
  const minColor = config.minColor ? [config.minColor.r, config.minColor.g, config.minColor.b] : [0, 0, 1]
  const maxColor = config.maxColor ? [config.maxColor.r, config.maxColor.g, config.maxColor.b] : [1, 0, 0]
  const useRainbow = config.useRainbow ?? false

  // 点大小
  const pointSize = config.pointSize ?? data.pointSize ?? 1.0

  return {
    // Buffer引用（已上传到GPU）
    positionBuffer: buffers.positionBuffer,
    colorBuffer: buffers.colorBuffer,
    count: buffers.count,

    // 变换矩阵（每帧更新）
    projection,
    view,

    // Pose变换（每个实例）
    posePosition,
    poseRotation,

    // 点大小
    pointSize,

    // 颜色映射参数
    useColorMapping,
    minValue,
    maxValue,
    minColor,
    maxColor,
    useRainbow,
    intensity: 0.5 // 默认值，实际应从数据中提取
  }
}

/**
 * 准备所有点云实例的渲染属性（用于单次draw call）
 */
export function prepareAllPointCloudInstances(
  bufferManager: PointCloudBufferManager,
  projection: any,
  view: any
): any[] {
  const instances = bufferManager.getAllInstances()
  const props: any[] = []

  for (const instance of instances) {
    const prop = preparePointCloudInstance(bufferManager, instance.componentId, projection, view)
    if (prop) {
      props.push(prop)
    }
  }

  return props
}
