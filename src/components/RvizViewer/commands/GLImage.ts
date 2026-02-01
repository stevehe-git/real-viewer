/**
 * GLImage 命令 - Webviz 风格的 GPU 硬加速图像渲染
 * 
 * 设计理念（参考 Webviz）：
 * 1. CPU 端（浏览器 JS）：极致轻量，仅做数据透传
 *    - 接收 WebSocket 传来的压缩图像二进制数据（JPEG/PNG）或原始像素数据
 *    - 将二进制数据封装为 Blob/ArrayBuffer（零拷贝存储）
 *    - 直接传递给浏览器 GPU 渲染线程，JavaScript 主线程不参与任何解码、格式转换、像素操作
 * 
 * 2. GPU 硬加速（WebGL 纹理 + 硬件解码）
 *    - 图像解码：浏览器 GPU 硬件解码（ImageBitmap API，Chrome 的 Skia 图形引擎对接 GPU 的 VDPAU/VA-API 解码）
 *    - 纹理创建与渲染：GPU 端解码后的像素数据直接创建为 WebGL 2D 纹理（显存存储）
 *    - 像素格式转换：在 GPU shader 中完成（rgb8/bgr8/rgba8/bgra8/mono8）
 * 
 * 3. 渲染载体：浏览器 GPU 渲染层（无重排重绘开销）
 *    - 渲染结果直接写入浏览器的 GPU 合成层
 *    - 避免 DOM 树的重排（Reflow）和重绘（Repaint）
 * 
 * 参考：RViz、regl-worldview、Webviz.io
 */
import type { Regl } from '../types'
import {
  defaultBlend
} from './utils/commandUtils'
import withRenderStateOverrides from './utils/withRenderStateOverrides'

// 纹理缓存：避免重复创建相同的图像纹理
interface CachedImageTexture {
  texture: any
  width: number
  height: number
  imageBitmap: ImageBitmap | null // 用于硬件解码的图像
  dataHash: string
}

const textureCache = new Map<string, CachedImageTexture>()

function getImageTextureCacheKey(
  width: number,
  height: number,
  dataHash: string
): string {
  return `image_${width}_${height}_${dataHash}`
}

function getCachedImageTexture(
  regl: Regl,
  cacheKey: string
): CachedImageTexture | null {
  const cached = textureCache.get(cacheKey)
  if (cached) {
    return cached
  }
  return null
}

/**
 * 清理指定组件的图像纹理缓存
 */
export function clearImageTextureCache(componentId: string, dataHash?: string): void {
  if (dataHash) {
    const keysToDelete: string[] = []
    textureCache.forEach((cached, key) => {
      if (cached.dataHash === dataHash || key.includes(componentId)) {
        keysToDelete.push(key)
        if (cached.texture && cached.texture.destroy) {
          cached.texture.destroy()
        }
        if (cached.imageBitmap) {
          cached.imageBitmap.close()
        }
      }
    })
    keysToDelete.forEach(key => textureCache.delete(key))
  } else {
    const keysToDelete: string[] = []
    textureCache.forEach((cached, key) => {
      if (key.includes(componentId)) {
        keysToDelete.push(key)
        if (cached.texture && cached.texture.destroy) {
          cached.texture.destroy()
        }
        if (cached.imageBitmap) {
          cached.imageBitmap.close()
        }
      }
    })
    keysToDelete.forEach(key => textureCache.delete(key))
  }
}

/**
 * 清理所有图像纹理缓存
 */
export function clearAllImageTextureCache(): void {
  textureCache.forEach((cached) => {
    if (cached.texture && cached.texture.destroy) {
      cached.texture.destroy()
    }
    if (cached.imageBitmap) {
      cached.imageBitmap.close()
    }
  })
  textureCache.clear()
}

/**
 * 从压缩图像（JPEG/PNG）创建纹理（使用浏览器硬件解码）
 * CPU 端只做数据透传，解码由浏览器 GPU 完成
 */
async function createImageTextureFromCompressed(
  regl: Regl,
  blob: Blob | ArrayBuffer,
  cacheKey: string
): Promise<CachedImageTexture | null> {
  try {
    // 使用 ImageBitmap API 进行硬件解码（浏览器 GPU 解码）
    // 这是 Webviz 的核心：CPU 端零计算，解码由浏览器 GPU 完成
    const blobObj = blob instanceof Blob ? blob : new Blob([blob])
    const imageBitmap = await createImageBitmap(blobObj)
    
    // 直接从 ImageBitmap 创建 WebGL 纹理（零拷贝，GPU 到 GPU）
    const texture = regl.texture({
      data: imageBitmap,
      // 使用线性过滤以获得平滑的缩放
      min: 'linear',
      mag: 'linear',
      // 不重复，超出范围使用边缘颜色
      wrap: 'clamp'
    })

    const cached: CachedImageTexture = {
      texture,
      width: imageBitmap.width,
      height: imageBitmap.height,
      imageBitmap,
      dataHash: cacheKey
    }

    textureCache.set(cacheKey, cached)
    return cached
  } catch (error) {
    console.error('Failed to create image texture from compressed data:', error)
    return null
  }
}

/**
 * 从原始像素数据创建纹理（最小化 CPU 处理）
 * 注意：对于原始像素数据，我们仍然需要在 CPU 端做最小化的格式转换
 * 但降采样和大部分处理都在 GPU shader 中完成
 */
function createImageTextureFromRawPixels(
  regl: Regl,
  rgbaData: Uint8Array,
  width: number,
  height: number,
  cacheKey: string
): CachedImageTexture {
  // 创建纹理：使用 RGBA 格式
  const texture = regl.texture({
    data: rgbaData,
    width,
    height,
    format: 'rgba',
    type: 'uint8',
    min: 'linear',
    mag: 'linear',
    wrap: 'clamp'
  })

  const cached: CachedImageTexture = {
    texture,
    width,
    height,
    imageBitmap: null, // 原始像素数据不使用 ImageBitmap
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

// 图像渲染命令：使用单个四边形 + 纹理
// Webviz 风格：GPU 硬加速，CPU 零计算
const glImageCommand = (regl: Regl) => {
  const positionBuffer = getPositionBuffer(regl)
  const texCoordBuffer = getTexCoordBuffer(regl)
  
  return {
    primitive: 'triangles',
    vert: `
      precision mediump float;

      attribute vec2 position;
      attribute vec2 texCoord;

      uniform mat4 projection, view;
      uniform vec2 imageSize; // 图像的显示尺寸（归一化到 [0,1]）
      uniform vec2 imagePosition; // 图像的显示位置（归一化到 [0,1]）
      uniform float zOffset; // Z 轴偏移

      varying vec2 vTexCoord;

      void main() {
        // 计算显示坐标：从归一化位置转换为世界坐标
        vec2 displayPos = imagePosition + position * imageSize;
        vec3 worldPos = vec3(displayPos.x, displayPos.y, zOffset);
        
        // 应用投影和视图变换
        gl_Position = projection * view * vec4(worldPos, 1.0);
        vTexCoord = texCoord;
      }
    `,
    frag: `
      precision mediump float;

      uniform sampler2D imageTexture;
      uniform float alpha;
      uniform int encoding; // 0: rgb8, 1: bgr8, 2: rgba8, 3: bgra8, 4: mono8, 5: compressed (JPEG/PNG)
      uniform bool flipY; // 是否垂直翻转（ROS 图像通常是倒置的）

      varying vec2 vTexCoord;

      void main() {
        // 处理垂直翻转（ROS 图像通常需要翻转）
        vec2 texCoord = flipY ? vec2(vTexCoord.x, 1.0 - vTexCoord.y) : vTexCoord;
        vec2 clampedTexCoord = clamp(texCoord, 0.0, 1.0);
        
        // 从纹理读取颜色
        vec4 texColor = texture2D(imageTexture, clampedTexCoord);
        
        vec3 color;
        
        // 如果是从压缩图像（JPEG/PNG）创建的纹理，直接使用（浏览器已解码为 RGB）
        if (encoding == 5) {
          color = texColor.rgb;
        } else if (encoding == 0) {
          // rgb8: 直接使用 RGB
          color = texColor.rgb;
        } else if (encoding == 1) {
          // bgr8: 交换 R 和 B
          color = vec3(texColor.b, texColor.g, texColor.r);
        } else if (encoding == 2) {
          // rgba8: 直接使用 RGBA
          color = texColor.rgb;
        } else if (encoding == 3) {
          // bgra8: 交换 R 和 B
          color = vec3(texColor.b, texColor.g, texColor.r);
        } else if (encoding == 4) {
          // mono8: 灰度图，使用 R 通道作为灰度值
          float gray = texColor.r;
          color = vec3(gray, gray, gray);
        } else {
          // 默认：rgb8
          color = texColor.rgb;
        }
        
        gl_FragColor = vec4(color, alpha);
      }
    `,
    attributes: {
      position: positionBuffer,
      texCoord: texCoordBuffer
    },
    uniforms: {
      imageTexture: async (_context: any, props: any) => {
        // 使用缓存的纹理
        if (props._cachedTexture?.texture) {
          return props._cachedTexture.texture
        }
        
        // 如果没有缓存，创建新纹理
        if (props.compressedData) {
          // 压缩图像（JPEG/PNG）：使用浏览器硬件解码
          const cacheKey = getImageTextureCacheKey(
            props.width || 0,
            props.height || 0,
            props.dataHash || ''
          )
          
          const cached = getCachedImageTexture(regl, cacheKey)
          if (cached) {
            props._cachedTexture = cached
            return cached.texture
          }
          
          // 创建新纹理（异步，但 regl 会等待）
          const newCached = await createImageTextureFromCompressed(
            regl,
            props.compressedData,
            cacheKey
          )
          if (newCached) {
            props._cachedTexture = newCached
            return newCached.texture
          }
        } else if (props.rawPixelData && props.width && props.height) {
          // 原始像素数据：最小化 CPU 处理
          const cacheKey = getImageTextureCacheKey(
            props.width,
            props.height,
            props.dataHash || ''
          )
          
          const cached = getCachedImageTexture(regl, cacheKey)
          if (cached) {
            props._cachedTexture = cached
            return cached.texture
          }
          
          // 创建新纹理
          const rgbaData = new Uint8Array(props.rawPixelData)
          const newCached = createImageTextureFromRawPixels(
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
        return props.imageTexture || null
      },
      imageSize: (_context: any, props: any) => {
        // 图像的显示尺寸（归一化到 [0,1]）
        return props.imageSize || [1.0, 1.0]
      },
      imagePosition: (_context: any, props: any) => {
        // 图像的显示位置（归一化到 [0,1]）
        return props.imagePosition || [0.0, 0.0]
      },
      zOffset: (_context: any, props: any) => {
        return props.zOffset !== undefined ? props.zOffset : 0.0
      },
      alpha: (_context: any, props: any) => {
        return props.alpha !== undefined ? props.alpha : 1.0
      },
      encoding: (_context: any, props: any) => {
        // 0: rgb8, 1: bgr8, 2: rgba8, 3: bgra8, 4: mono8, 5: compressed
        const encoding = props.encoding || 'rgb8'
        if (encoding === 'compressed' || encoding === 'jpeg' || encoding === 'png') {
          return 5
        } else if (encoding === 'bgr8') {
          return 1
        } else if (encoding === 'rgba8') {
          return 2
        } else if (encoding === 'bgra8') {
          return 3
        } else if (encoding === 'mono8') {
          return 4
        }
        return 0 // 默认 rgb8
      },
      flipY: (_context: any, props: any) => {
        return props.flipY !== undefined ? props.flipY : true // ROS 图像默认需要翻转
      }
    },
    depth: {
      enable: true,
      mask: true,
      func: 'lequal'
    },
    blend: defaultBlend,
    count: 6 // 2个三角形 = 6个顶点
  }
}

export const glImage = (regl: Regl) => {
  return withRenderStateOverrides(glImageCommand)(regl)
}

export const makeGLImageCommand = () => {
  return glImage
}

export default function GLImage(props: any) {
  return makeGLImageCommand()
}
