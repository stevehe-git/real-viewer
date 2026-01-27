/**
 * WorldviewContext
 * 完全基于 regl-worldview 的 WorldviewContext.js 实现
 * 这是整个渲染系统的核心，负责管理 regl 上下文、相机、绘制调用和 hitmap
 */
import createREGL from 'regl'
import shallowequal from 'shallowequal'
import type {
  Dimensions,
  RawCommand,
  CompiledReglCommand,
  CameraCommand,
  Vec4,
  MouseEventObject,
  GetChildrenForHitmap,
  AssignNextColorsFn,
  DrawInput,
  PaintFn
} from '../types'
import { getIdFromPixel, intToRGB } from '../commands/utils/commandUtils'
import { getNodeEnv } from '../utils/common'
import HitmapObjectIdManager from '../utils/HitmapObjectIdManager'
import queuePromise from '../utils/queuePromise'
import { getRayFromClick } from '../commands/utils/Raycast'
import { camera, CameraStore, DEFAULT_CAMERA_STATE, type CameraState } from '../camera'

type ConstructorArgs = {
  dimension: Dimensions
  canvasBackgroundColor: Vec4
  cameraState: CameraState
  defaultCameraState?: CameraState
  onCameraStateChange?: (state: CameraState) => void
  contextAttributes?: { [key: string]: any }
}

type InitializedData = {
  _fbo: any
  regl: any
  camera: CameraCommand
}

// Compile instructions with an initialized regl context into a regl command.
// If the instructions are a function, pass the context to the instructions and compile the result
// of the function; otherwise, compile the instructions directly
function compile<T>(regl: any, cmd: RawCommand<T>): CompiledReglCommand<T> {
  const src = cmd(regl)
  return typeof src === 'function' ? src : regl(src)
}

// This is made available to every Command component as `this.context`.
// It contains all the regl interaction code and is responsible for collecting and executing
// draw calls, hitmap calls, and raycasting.
export class WorldviewContext {
  _commands: Set<RawCommand<any>> = new Set()
  _compiled: Map<Function, CompiledReglCommand<any>> = new Map()
  _drawCalls: Map<any, DrawInput> = new Map()
  _frame: number | null = null
  _needsPaint = false
  _paintCalls: Map<PaintFn, PaintFn> = new Map()
  _hitmapObjectIdManager: HitmapObjectIdManager = new HitmapObjectIdManager()
  _cachedReadHitmapCall: {
    arguments: any[]
    result: Array<[MouseEventObject, any]>
  } | null = null
  // store every compiled command object compiled for debugging purposes
  reglCommandObjects: { stats: { count: number } }[] = []
  counters: { paint?: number; render?: number } = {}
  dimension: Dimensions
  cameraStore: CameraStore
  canvasBackgroundColor: Vec4 = [0, 0, 0, 1]
  // group all initialized data together so it can be checked for existence to verify initialization is complete
  initializedData: InitializedData | null = null
  contextAttributes?: { [key: string]: any }
  
  // 性能优化：帧率限制和交互模式检测
  private _lastPaintTime = 0
  private _targetFPS = 60 // 正常模式目标帧率
  private _interactionFPS = 30 // 交互模式目标帧率（降低以节省CPU）
  private _largeMapInteractionFPS = 20 // 大地图交互模式目标帧率（进一步降低）
  private _minFrameInterval = 1000 / this._targetFPS // 最小帧间隔（ms）
  private _interactionFrameInterval = 1000 / this._interactionFPS // 交互模式最小帧间隔（ms）
  private _largeMapInteractionFrameInterval = 1000 / this._largeMapInteractionFPS // 大地图交互模式最小帧间隔（ms）
  private _isInteracting = false // 是否正在交互（旋转/平移）
  private _hasLargeMap = false // 是否有大地图（用于进一步降低帧率）
  private _interactionTimeout: number | null = null // 交互超时定时器
  private _interactionTimeoutMs = 200 // 交互结束后多久恢复正常渲染质量

  constructor({
    dimension,
    canvasBackgroundColor,
    cameraState,
    onCameraStateChange,
    contextAttributes
  }: ConstructorArgs) {
    // used for children to call paint() directly
    this.dimension = dimension
    this.canvasBackgroundColor = canvasBackgroundColor
    this.contextAttributes = contextAttributes
    
    // 优化：使用节流机制，避免频繁触发渲染
    // 相机状态变化时，使用 onDirty 而不是直接 paint，这样可以合并多次更新
    this.cameraStore = new CameraStore((cameraState: CameraState) => {
      if (onCameraStateChange) {
        onCameraStateChange(cameraState)
      } else {
        // 使用 onDirty 而不是直接 paint，这样可以节流渲染
        // onDirty 会使用 requestAnimationFrame 来优化渲染频率
        this.onDirty()
      }
    }, cameraState)
  }

  initialize(canvas: HTMLCanvasElement): void {
    if (this.initializedData) {
      throw new Error('can not initialize regl twice')
    }

    const regl = this._instrumentCommands(
      createREGL({
        canvas,
        attributes: this.contextAttributes || {},
        extensions: [
          'angle_instanced_arrays',
          'oes_texture_float',
          'oes_element_index_uint',
          'oes_standard_derivatives'
        ],
        profile: getNodeEnv() !== 'production'
      })
    )

    if (!regl) {
      throw new Error('Cannot initialize regl')
    }

    // compile any components which mounted before regl is initialized
    this._commands.forEach((uncompiledCommand) => {
      const compiledCommand = compile(regl, uncompiledCommand)
      this._compiled.set(uncompiledCommand, compiledCommand)
    })

    const Camera = compile(regl, camera)
    const compiledCameraCommand = new Camera()
    // framebuffer object from regl context
    const fbo = regl.framebuffer({
      width: Math.round(this.dimension.width),
      height: Math.round(this.dimension.height)
    })

    this.initializedData = {
      _fbo: fbo,
      camera: compiledCameraCommand,
      regl
    }
  }

  destroy(): void {
    // 取消所有待处理的渲染帧
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame)
      this._frame = null
    }
    // 清除所有绘制调用，避免在销毁时触发渲染
    this._drawCalls.clear()
    this._compiled.clear()
    this._commands.clear()
    this._paintCalls.clear()
    // 清理缓存
    this._cachedSortedDrawCalls = null
    this._drawCallsVersion = 0
    this._lastDrawCallsVersion = -1
    // 销毁 regl 上下文
    if (this.initializedData) {
      try {
        this.initializedData.regl.destroy()
      } catch (e) {
        // 忽略销毁时的错误
        console.warn('Error destroying regl context:', e)
      }
      this.initializedData = null
    }
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame)
    }
  }

  // compile a command when it is first mounted, and try to register in _commands and _compiled maps
  onMount(instance: any, command: RawCommand<any>): void {
    const { initializedData } = this
    // do nothing if regl hasn't been initialized yet
    if (!initializedData || this._commands.has(command)) {
      return
    }
    this._commands.add(command)

    // for components that mount after regl is initialized
    this._compiled.set(command, compile(initializedData.regl, command))
  }

  // unregister children hitmap and draw calls
  onUnmount(instance: any): void {
    this._drawCalls.delete(instance)
    // 标记绘制调用已更新，需要重新排序
    this._drawCallsVersion++
    this._cachedSortedDrawCalls = null
  }

  unregisterPaintCallback(paintFn: PaintFn): void {
    this._paintCalls.delete(paintFn)
  }

  registerDrawCall(drawInput: DrawInput): void {
    this._drawCalls.set(drawInput.instance, drawInput)
    // 标记绘制调用已更新，需要重新排序
    this._drawCallsVersion++
    this._cachedSortedDrawCalls = null
  }

  registerPaintCallback(paintFn: PaintFn): void {
    this._paintCalls.set(paintFn, paintFn)
  }

  setDimension(dimension: Dimensions): void {
    this.dimension = dimension
    if (this.initializedData) {
      this.initializedData._fbo.resize(Math.round(dimension.width), Math.round(dimension.height))
    }
  }

  raycast = (canvasX: number, canvasY: number) => {
    if (!this.initializedData) {
      return undefined
    }

    const { width, height } = this.dimension
    return getRayFromClick(this.initializedData.camera, {
      clientX: canvasX,
      clientY: canvasY,
      width,
      height
    })
  }

  paint(): void {
    try {
      this._paint()
    } catch (error: any) {
      // Regl automatically tries to reconnect when losing the canvas 3d context.
      // We should log this error, but it's not important to throw it.
      if (error.message === '(regl) context lost') {
        console.warn(error)
      } else {
        throw error
      }
    }
  }

  _paint(): void {
    this._needsPaint = false
    this._lastPaintTime = performance.now()
    
    if (!this.initializedData) {
      return
    }
    
    // 优化：只在有统计对象时才重置（使用 for 循环）
    const cmdObjects = this.reglCommandObjects
    for (let i = 0; i < cmdObjects.length; i++) {
      const obj = cmdObjects[i]
      if (obj && obj.stats) {
        obj.stats.count = 0
      }
    }
    
    this._cachedReadHitmapCall = null // clear the cache every time we paint
    const { regl, camera } = this.initializedData
    this._clearCanvas(regl)
    camera.draw(this.cameraStore.state, () => {
      this._drawInput()
    })

    // 优化：只在有回调时才遍历（使用 for...of 循环，性能更好）
    if (this._paintCalls.size > 0) {
      for (const paintCall of this._paintCalls.values()) {
        paintCall()
      }
    }
    
    // More React state updates may have happened while we were painting, since paint happens
    // outside the normal React render flow. If this is the case, we need to paint again.
    // 但在交互模式下，限制连续渲染以避免CPU飙升
    if (this._needsPaint) {
      this._scheduleNextPaint()
    } else {
      this._frame = null
    }
  }
  
  /**
   * 安排下一次渲染（带帧率限制）
   */
  private _scheduleNextPaint(): void {
    if (this._frame !== null) {
      // 已有待处理的渲染请求，标记需要重新渲染
      this._needsPaint = true
      return
    }
    
    const now = performance.now()
    const timeSinceLastPaint = now - this._lastPaintTime
    
    // 根据交互状态和地图大小选择帧率
    let minInterval: number
    if (this._isInteracting) {
      // 交互模式下，如果有大地图，使用更低的帧率
      minInterval = this._hasLargeMap 
        ? this._largeMapInteractionFrameInterval 
        : this._interactionFrameInterval
    } else {
      minInterval = this._minFrameInterval
    }
    
    if (timeSinceLastPaint >= minInterval) {
      // 已达到最小帧间隔，立即安排渲染
      this._frame = requestAnimationFrame(() => this.paint())
    } else {
      // 未达到最小帧间隔，延迟渲染
      const delay = minInterval - timeSinceLastPaint
      this._frame = window.setTimeout(() => {
        this._frame = requestAnimationFrame(() => this.paint())
      }, delay) as any
    }
  }
  
  /**
   * 设置是否有大地图（用于性能优化）
   */
  setHasLargeMap(hasLargeMap: boolean): void {
    this._hasLargeMap = hasLargeMap
  }

  /**
   * 标记需要重新渲染（优化版本：带帧率限制和交互检测）
   */
  onDirty(): void {
    this._needsPaint = true
    
    // 如果没有待处理的渲染请求，安排下一次渲染
    if (this._frame === null) {
      this._scheduleNextPaint()
    }
  }
  
  /**
   * 标记开始交互（旋转/平移）
   */
  markInteractionStart(): void {
    if (!this._isInteracting) {
      this._isInteracting = true
      
      // 清除之前的超时定时器
      if (this._interactionTimeout !== null) {
        clearTimeout(this._interactionTimeout)
        this._interactionTimeout = null
      }
      
      // 如果当前有渲染请求，取消它并重新安排（使用交互模式的帧率）
      if (this._frame !== null) {
        if (typeof this._frame === 'number') {
          cancelAnimationFrame(this._frame)
        } else {
          clearTimeout(this._frame as any)
        }
        this._frame = null
        // 重新安排渲染，使用交互模式的帧率限制
        this._scheduleNextPaint()
      }
    }
  }
  
  /**
   * 标记交互结束
   */
  markInteractionEnd(): void {
    // 延迟标记交互结束，避免在快速连续操作时频繁切换
    if (this._interactionTimeout !== null) {
      clearTimeout(this._interactionTimeout)
    }
    
    this._interactionTimeout = window.setTimeout(() => {
      this._isInteracting = false
      this._interactionTimeout = null
      // 交互结束后触发一次完整渲染
      this.onDirty()
    }, this._interactionTimeoutMs)
  }
  
  /**
   * 检查是否正在交互
   */
  isInteracting(): boolean {
    return this._isInteracting
  }
  
  /**
   * 设置目标帧率（用于性能调优）
   */
  setTargetFPS(fps: number): void {
    this._targetFPS = Math.max(1, Math.min(120, fps)) // 限制在1-120fps之间
    this._minFrameInterval = 1000 / this._targetFPS
  }
  
  /**
   * 设置交互模式目标帧率（用于性能调优）
   */
  setInteractionFPS(fps: number): void {
    this._interactionFPS = Math.max(1, Math.min(60, fps)) // 限制在1-60fps之间
    this._interactionFrameInterval = 1000 / this._interactionFPS
  }

  readHitmap = queuePromise(
    (
      canvasX: number,
      canvasY: number,
      enableStackedObjectEvents: boolean,
      maxStackedObjectCount: number
    ): Promise<Array<[MouseEventObject, any]>> => {
      if (!this.initializedData) {
        return Promise.reject(new Error('regl data not initialized yet'))
      }
      const args = [canvasX, canvasY, enableStackedObjectEvents, maxStackedObjectCount]

      const cachedReadHitmapCall = this._cachedReadHitmapCall
      if (cachedReadHitmapCall) {
        if (shallowequal(cachedReadHitmapCall.arguments, args)) {
          // Make sure that we aren't returning the exact object identity of the mouseEventObject - we don't know what
          // callers have done with it.
          const result = cachedReadHitmapCall.result.map(([mouseEventObject, command]) => [
            { ...mouseEventObject },
            command
          ])
          return Promise.resolve(result)
        }
        this._cachedReadHitmapCall = null
      }

      const { regl, camera, _fbo } = this.initializedData
      const { width, height } = this.dimension

      const x = canvasX
      // 0,0 corresponds to the bottom left in the webgl context, but the top left in window coordinates
      const y = height - canvasY

      // regl will only resize the framebuffer if the size changed
      // it uses floored whole pixel values
      _fbo.resize(Math.floor(width), Math.floor(height))

      return new Promise((resolve) => {
        // tell regl to use a framebuffer for this render
        regl({ framebuffer: _fbo })(() => {
          // clear the framebuffer
          regl.clear({ color: intToRGB(0), depth: 1 })
          let currentObjectId = 0
          const excludedObjects: MouseEventObject[] = []
          const mouseEventsWithCommands: Array<[MouseEventObject, any]> = []
          let counter = 0

          camera.draw(this.cameraStore.state, () => {
            // Every iteration in this loop clears the framebuffer, draws the hitmap objects that have NOT already been
            // seen to the framebuffer, and then reads the pixel under the cursor to find the object on top.
            // If `enableStackedObjectEvents` is false, we only do this iteration once - we only resolve with 0 or 1
            // objects.
            do {
              if (counter >= maxStackedObjectCount) {
                // Provide a max number of layers so this while loop doesn't crash the page.
                console.error(
                  `Hit ${maxStackedObjectCount} iterations. There is either a bug or that number of rendered hitmap layers under the mouse cursor.`
                )
                break
              }
              counter++
              regl.clear({ color: intToRGB(0), depth: 1 })
              this._drawInput(true, excludedObjects)

              // it's possible to get x/y values outside the framebuffer size
              // if the mouse quickly leaves the draw area during a read operation
              // reading outside the bounds of the framebuffer causes errors
              // and puts regl into a bad internal state.
              // https://github.com/regl-project/regl/blob/28fbf71c871498c608d9ec741d47e34d44af0eb5/lib/read.js#L57
              if (x < Math.floor(width) && y < Math.floor(height) && x >= 0 && y >= 0) {
                const pixel = new Uint8Array(4)

                // read pixel value from the frame buffer
                regl.read({
                  x,
                  y,
                  width: 1,
                  height: 1,
                  data: pixel
                })

                currentObjectId = getIdFromPixel(pixel)
                const mouseEventObject = this._hitmapObjectIdManager.getObjectByObjectHitmapId(currentObjectId)

                // Check an error case: if we see an ID/color that we don't know about, it means that some command is
                // drawing a color into the hitmap that it shouldn't be.
                if (currentObjectId > 0 && !mouseEventObject) {
                  console.error(
                    `Clicked on an unknown object with id ${currentObjectId}. This likely means that a command is painting an incorrect color into the hitmap.`
                  )
                }
                // Check an error case: if we've already seen this object, then the getHitmapFromChildren function
                // is not respecting the excludedObjects correctly and we should notify the user of a bug.
                if (
                  excludedObjects.some(
                    ({ object, instanceIndex }) =>
                      object === mouseEventObject.object && instanceIndex === mouseEventObject.instanceIndex
                  )
                ) {
                  console.error(
                    `Saw object twice when reading from hitmap. There is likely an error in getHitmapFromChildren`,
                    mouseEventObject
                  )
                  break
                }

                if (currentObjectId > 0 && mouseEventObject.object) {
                  const command = this._hitmapObjectIdManager.getCommandForObject(mouseEventObject.object)
                  excludedObjects.push(mouseEventObject)
                  if (command) {
                    mouseEventsWithCommands.push([mouseEventObject, command])
                  }
                }
              }
              // If we haven't enabled stacked object events, break out of the loop immediately.
              // eslint-disable-next-line no-unmodified-loop-condition
            } while (currentObjectId !== 0 && enableStackedObjectEvents)

            this._cachedReadHitmapCall = {
              arguments: args,
              result: mouseEventsWithCommands
            }
            resolve(mouseEventsWithCommands)
          })
        })
      })
    }
  )

  // 缓存排序后的绘制调用，避免每帧都排序
  _cachedSortedDrawCalls: DrawInput[] | null = null
  _drawCallsVersion = 0
  _lastDrawCallsVersion = -1

  _drawInput = (isHitmap?: boolean, excludedObjects?: MouseEventObject[]): void => {
    // 如果 regl 上下文已被销毁，直接返回
    if (!this.initializedData || !this.initializedData.regl) {
      return
    }
    
    if (isHitmap) {
      this._hitmapObjectIdManager = new HitmapObjectIdManager()
    }

    // 优化：缓存排序结果，只在绘制调用变化时重新排序
    if (this._cachedSortedDrawCalls === null || this._drawCallsVersion !== this._lastDrawCallsVersion) {
      this._cachedSortedDrawCalls = Array.from(this._drawCalls.values()).sort(
        (a, b) => (a.layerIndex || 0) - (b.layerIndex || 0)
      )
      this._lastDrawCallsVersion = this._drawCallsVersion
    }
    
    const drawCalls = this._cachedSortedDrawCalls
    
    // 优化：使用 for 循环而不是 forEach，性能更好
    for (let i = 0; i < drawCalls.length; i++) {
      const drawInput = drawCalls[i]
      if (!drawInput) continue
      
      const { reglCommand, children, instance, getChildrenForHitmap } = drawInput
      if (!children) {
        continue
      }
      const cmd = this._compiled.get(reglCommand)
      if (!cmd) {
        console.warn(`WorldviewContext: Command not compiled for instance:`, instance?.displayName || instance)
        continue
      }
      // draw hitmap
      if (isHitmap && getChildrenForHitmap) {
        const assignNextColorsFn: AssignNextColorsFn = (...rest) => {
          return this._hitmapObjectIdManager.assignNextColors(instance, ...rest)
        }
        const hitmapProps = getChildrenForHitmap(children, assignNextColorsFn, excludedObjects || [])
        if (hitmapProps) {
          cmd(hitmapProps, true)
        }
      } else if (!isHitmap) {
        // 调试日志
        if (instance?.displayName === 'BatchLaserScans' || instance?.displayName?.includes('LaserScan')) {
          console.log(`WorldviewContext: Rendering ${instance.displayName}, children type:`, Array.isArray(children) ? 'array' : typeof children, 'length:', Array.isArray(children) ? children.length : 'N/A')
        }
        try {
          cmd(children, false)
        } catch (error: any) {
          console.error(`WorldviewContext: Error rendering ${instance?.displayName || 'unknown'}:`, error)
          console.error('Children:', children)
          console.error('Command:', cmd)
        }
      }
    }
  }

  _clearCanvas = (regl: any): void => {
    // Since we aren't using regl.frame and only rendering when we need to,
    // we need to tell regl to update its internal state.
    regl.poll()
    regl.clear({
      color: this.canvasBackgroundColor,
      depth: 1
    })
  }

  _instrumentCommands(regl: any): any {
    if (getNodeEnv() === 'production') {
      return regl
    }
    return new Proxy(regl, {
      apply: (target, thisArg, args) => {
        const command = target(...args)
        if (typeof command.stats === 'object') {
          this.reglCommandObjects.push(command)
        }
        return command
      }
    })
  }
}
