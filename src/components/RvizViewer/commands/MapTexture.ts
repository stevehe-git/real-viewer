/**
 * MapTexture 命令 - 工业级地图渲染优化
 * 使用纹理渲染占用栅格地图，替代大量三角形渲染
 * 参考 RViz 和 regl-worldview 的实现
 */
import type { Regl } from '../types'
import {
  defaultBlend
} from './utils/commandUtils'
import withRenderStateOverrides from './utils/withRenderStateOverrides'

// 纹理缓存：避免重复创建相同的地图纹理
interface CachedMapTexture {
  texture: any
  width: number
  height: number
  dataHash: string
}

const textureCache = new Map<string, CachedMapTexture>()

function getMapTextureCacheKey(
  width: number,
  height: number,
  dataHash: string
): string {
  return `${width}_${height}_${dataHash}`
}

function getCachedMapTexture(
  regl: Regl,
  cacheKey: string
): CachedMapTexture | null {
  const cached = textureCache.get(cacheKey)
  if (cached) {
    return cached
  }
  return null
}

/**
 * 清理指定组件的地图纹理缓存
 * @param componentId 组件ID
 * @param dataHash 数据哈希（可选，如果提供则只清理匹配的缓存）
 */
export function clearMapTextureCache(componentId: string, dataHash?: string): void {
  if (dataHash) {
    // 清理特定数据哈希的缓存
    const keysToDelete: string[] = []
    textureCache.forEach((cached, key) => {
      if (cached.dataHash === dataHash || key.includes(componentId)) {
        keysToDelete.push(key)
        // 销毁纹理资源
        if (cached.texture && cached.texture.destroy) {
          cached.texture.destroy()
        }
      }
    })
    keysToDelete.forEach(key => textureCache.delete(key))
  } else {
    // 清理所有包含该 componentId 的缓存
    const keysToDelete: string[] = []
    textureCache.forEach((cached, key) => {
      if (key.includes(componentId)) {
        keysToDelete.push(key)
        if (cached.texture && cached.texture.destroy) {
          cached.texture.destroy()
        }
      }
    })
    keysToDelete.forEach(key => textureCache.delete(key))
  }
}

/**
 * 清理所有地图纹理缓存
 */
export function clearAllMapTextureCache(): void {
  textureCache.forEach((cached) => {
    if (cached.texture && cached.texture.destroy) {
      cached.texture.destroy()
    }
  })
  textureCache.clear()
}

function createMapTexture(
  regl: Regl,
  rgbaData: Uint8Array,
  width: number,
  height: number,
  cacheKey: string
): CachedMapTexture {
  // 创建纹理：使用 RGBA 格式，每个像素 4 字节
  const texture = regl.texture({
    data: rgbaData,
    width,
    height,
    format: 'rgba',
    type: 'uint8',
    // 使用线性过滤以获得平滑的颜色过渡
    min: 'linear',
    mag: 'linear',
    // 不重复，超出范围使用边缘颜色
    wrap: 'clamp'
  })

  const cached: CachedMapTexture = {
    texture,
    width,
    height,
    dataHash: cacheKey
  }

  textureCache.set(cacheKey, cached)
  return cached
}

// 预定义的顶点和纹理坐标 buffer（复用，避免每帧重新创建）
let cachedPositionBuffer: any = null
let cachedTexCoordBuffer: any = null

function getPositionBuffer(regl: Regl): any {
  if (!cachedPositionBuffer) {
    // 创建单位四边形：从 (0,0) 到 (1,1)
    // 在顶点着色器中会转换为实际的世界坐标
    const positions = new Float32Array([
      0, 0,  // 第一个三角形
      1, 0,
      1, 1,
      0, 0,  // 第二个三角形
      1, 1,
      0, 1
    ])
    cachedPositionBuffer = regl.buffer(positions)
  }
  return cachedPositionBuffer
}

function getTexCoordBuffer(regl: Regl): any {
  if (!cachedTexCoordBuffer) {
    // 纹理坐标：从 (0,0) 到 (1,1)
    const texCoords = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 0,
      1, 1,
      0, 1
    ])
    cachedTexCoordBuffer = regl.buffer(texCoords)
  }
  return cachedTexCoordBuffer
}

// 地图渲染命令：使用单个四边形 + 纹理
// 工业级优化：使用 buffer 缓存、正确的深度测试、优化的着色器
const mapTextureCommand = (regl: Regl) => {
  // 在命令创建时捕获 regl 实例，以便在 uniform 函数中使用
  // 预创建顶点和纹理坐标 buffer
  const positionBuffer = getPositionBuffer(regl)
  const texCoordBuffer = getTexCoordBuffer(regl)
  
  return {
    primitive: 'triangles',
    vert: `
      precision mediump float;

      attribute vec2 position;
      attribute vec2 texCoord;

      uniform mat4 projection, view;
      uniform vec2 mapSize; // 地图的宽度和高度（世界单位）
      uniform vec2 mapOrigin; // 地图原点位置（世界单位）

      varying vec2 vTexCoord;

      void main() {
        // 计算世界坐标：从纹理坐标转换为世界坐标
        // position 是 [0,1] 范围的纹理坐标，需要转换为世界坐标
        // 使用精确的浮点运算，避免精度问题
        vec2 worldPos2D = mapOrigin + position * mapSize;
        vec3 worldPos = vec3(worldPos2D.x, worldPos2D.y, 0.0);
        
        // 应用投影和视图变换
        // 确保在不同视角下都能正确渲染
        gl_Position = projection * view * vec4(worldPos, 1.0);
        vTexCoord = texCoord;
      }
    `,
    frag: `
      precision mediump float;

      uniform sampler2D mapTexture;
      uniform float alpha;
      uniform int colorScheme; // 0: map, 1: costmap, 2: raw

      varying vec2 vTexCoord;

      // 在 GPU 中计算颜色映射（map 方案）
      vec3 mapColorScheme(float occupancy) {
        if (occupancy < 0.0) {
          // 未知区域：深青灰色
          return vec3(0.25, 0.45, 0.45);
        } else if (occupancy < 0.01) {
          // 自由空间：浅灰色
          return vec3(0.7, 0.7, 0.7);
        } else {
          // 占用区域：深灰色渐变
          float normalizedOccupancy = occupancy;
          float gray = max(0.0, 0.5 - normalizedOccupancy * 0.5);
          return vec3(gray, gray, gray);
        }
      }

      // Costmap 颜色方案
      vec3 costmapColorScheme(float occupancy) {
        if (occupancy < 0.0) {
          return vec3(0.25, 0.45, 0.45);
        } else if (occupancy < 0.01) {
          return vec3(0.2, 0.8, 0.2);
        } else {
          float normalizedOccupancy = occupancy;
          return vec3(
            min(1.0, normalizedOccupancy * 2.0),
            max(0.0, 1.0 - normalizedOccupancy * 0.5),
            0.2
          );
        }
      }

      void main() {
        // 从纹理读取占用值（R 通道存储占用值，归一化到 0-1）
        // 使用 clamp 确保纹理坐标在有效范围内
        vec2 clampedTexCoord = clamp(vTexCoord, 0.0, 1.0);
        vec4 texColor = texture2D(mapTexture, clampedTexCoord);
        
        // 提取占用值：占用值存储在 R 通道，范围 0-1
        // -1 (未知) -> 0.0
        // 0 (自由) -> 0.5
        // 1-100 (占用) -> 0.5 + (occupancy/100.0) * 0.5
        float occupancyValue = texColor.r;
        
        vec3 color;
        if (colorScheme == 0) {
          // map 方案
          // 将 occupancyValue 转换回原始占用值范围
          float occupancy;
          if (occupancyValue < 0.25) {
            occupancy = -1.0; // 未知
          } else if (occupancyValue < 0.5) {
            occupancy = 0.0; // 自由
          } else {
            occupancy = (occupancyValue - 0.5) * 2.0; // 0-1 范围
          }
          color = mapColorScheme(occupancy);
        } else if (colorScheme == 1) {
          // costmap 方案
          float occupancy;
          if (occupancyValue < 0.25) {
            occupancy = -1.0;
          } else if (occupancyValue < 0.5) {
            occupancy = 0.0;
          } else {
            occupancy = (occupancyValue - 0.5) * 2.0;
          }
          color = costmapColorScheme(occupancy);
        } else {
          // raw 方案：直接使用纹理颜色
          color = texColor.rgb;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `,
    attributes: {
      // 使用预创建的 buffer，避免每帧重新创建数组
      position: positionBuffer,
      texCoord: texCoordBuffer
    },
    uniforms: {
      mapTexture: (_context: any, props: any) => {
        // 使用缓存的纹理
        if (props._cachedTexture?.texture) {
          return props._cachedTexture.texture
        }
        
        // 如果没有缓存，尝试从缓存中获取
        if (props.textureData && props.width && props.height) {
          const cacheKey = getMapTextureCacheKey(
            props.width,
            props.height,
            props.dataHash || ''
          )
          
          // 使用闭包捕获的 regl 实例
          const cached = getCachedMapTexture(regl, cacheKey)
          if (cached) {
            props._cachedTexture = cached
            return cached.texture
          }
          
          // 创建新纹理
          const rgbaData = new Uint8Array(props.textureData)
          const newCached = createMapTexture(
            regl,
            rgbaData,
            props.width,
            props.height,
            cacheKey
          )
          props._cachedTexture = newCached
          return newCached.texture
        }
        
        // 回退：返回空纹理
        return props.mapTexture || null
      },
      mapSize: (_context: any, props: any) => {
        // 地图的世界尺寸（米）
        const width = props.width || 0
        const height = props.height || 0
        const resolution = props.resolution || 0.05
        return [width * resolution, height * resolution]
      },
      mapOrigin: (_context: any, props: any) => {
        // 地图原点位置（世界坐标）
        const origin = props.origin || {}
        const pos = origin.position || {}
        return [pos.x || 0, pos.y || 0]
      },
      alpha: (_context: any, props: any) => {
        return props.alpha !== undefined ? props.alpha : 1.0
      },
      colorScheme: (_context: any, props: any) => {
        // 0: map, 1: costmap, 2: raw
        const scheme = props.colorScheme || 'map'
        if (scheme === 'costmap') return 1
        if (scheme === 'raw') return 2
        return 0
      }
    },
    // 深度测试配置：确保地图在不同视角下正确渲染
    // 使用 <= 比较，允许相同深度的像素渲染（地图在同一平面）
    depth: {
      enable: true,
      mask: true,
      func: '<='
    },
    blend: defaultBlend,
    count: 6 // 2个三角形 = 6个顶点
  }
}

export const mapTexture = (regl: Regl) => {
  return withRenderStateOverrides(mapTextureCommand)(regl)
}

export const makeMapTextureCommand = () => {
  return mapTexture
}

export default function MapTexture(props: any) {
  return makeMapTextureCommand()
}
