/**
 * TF (Transform) 管理器（重构版）
 * 
 * 参照 RViz 和 regl-worldview 的主流方案重构
 * 
 * 核心设计原则：
 * 1. 统一处理静态和动态TF数据（/tf 和 /tf_static）
 * 2. 维护完整的TF树结构，支持高效的路径查找
 * 3. 提供高效的变换查询接口（getFrameInfo, getTransformMatrix）
 * 4. 区分静态和动态变换，静态变换永不过期
 * 5. 使用纯数学计算，避免外部依赖（移除 THREE.js）
 * 6. 性能优化：缓存变换矩阵，减少重复计算
 */

import * as ROSLIB from 'roslib'
import { ref, toRaw, computed } from 'vue'
import { quat, vec3, mat4 } from 'gl-matrix'
import { tfDebugger } from '@/utils/debug'
import { getTFTreeProcessorWorker } from '@/workers/tfTreeProcessorWorker'

export interface TransformFrame {
  name: string
  parent?: string
  timestamp?: number
  lastUpdateTime?: number
  isValid?: boolean
  isStatic?: boolean  // 是否为静态变换
  translation?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number; w: number }
}

export interface TFTreeNode {
  name: string
  parent: string | null
  children: TFTreeNode[]
  lastUpdateTime: number
  isValid: boolean
  isStatic?: boolean
}

interface SubscriptionStatus {
  subscribed: boolean
  hasData: boolean
  messageCount: number
  lastMessageTime: number | null
}

class TFManager {
  private rosInstance: ROSLIB.Ros | null = null
  private tfTopic: ROSLIB.Topic<any> | null = null
  private tfStaticTopic: ROSLIB.Topic<any> | null = null
  
  // 可用的坐标系列表（响应式）
  private availableFrames = ref<Set<string>>(new Set())
  
  // 坐标系列表（用于下拉框）
  public frames = ref<string[]>([])
  
  // TF 变换数据（parent_frame -> child_frame -> TransformFrame）
  // 区分静态和动态：静态变换存储在单独的Map中
  private dynamicTransforms = ref<Map<string, Map<string, TransformFrame>>>(new Map())
  private staticTransforms = ref<Map<string, Map<string, TransformFrame>>>(new Map())
  
  // TF 树结构（响应式）
  public tfTree = ref<TFTreeNode[]>([])
  
  // 数据更新触发器（用于响应式追踪）
  private dataUpdateTrigger = ref(0)
  
  // Frame 超时时间（秒）- 仅对动态变换有效
  private frameTimeout = 15
  
  // 固定帧（参照 RViz）
  private fixedFrame = ref<string>('map')
  
  // 订阅状态（响应式）
  private subscriptionStatus = ref<SubscriptionStatus>({
    subscribed: false,
    hasData: false,
    messageCount: 0,
    lastMessageTime: null
  })
  
  // 性能优化：缓存变换矩阵（sourceFrame -> targetFrame -> Matrix4）
  private transformMatrixCache = new Map<string, Map<string, { matrix: mat4; timestamp: number }>>()
  private cacheTimeout = 100 // 缓存超时时间（毫秒）
  
  // 数据更新节流
  private dataUpdateThrottleTimer: number | null = null
  private pendingDataUpdate = false
  
  // Worker 管理器
  private tfTreeWorker = getTFTreeProcessorWorker()
  
  // 异步更新标志（防止重复更新）
  private isUpdatingTree = false

  /**
   * 获取所有变换数据（合并静态和动态）
   * 静态变换优先级更高（不会被动态变换覆盖）
   */
  getTransforms(): Map<string, Map<string, TransformFrame>> {
    const merged = new Map<string, Map<string, TransformFrame>>()
    
    // 先添加静态变换（优先级更高）
    this.staticTransforms.value.forEach((children, parent) => {
      if (!merged.has(parent)) {
        merged.set(parent, new Map())
      }
      const parentMap = merged.get(parent)!
      children.forEach((transform, child) => {
        parentMap.set(child, transform)
      })
    })
    
    // 再添加动态变换（不会覆盖静态变换）
    this.dynamicTransforms.value.forEach((children, parent) => {
      if (!merged.has(parent)) {
        merged.set(parent, new Map())
      }
      const parentMap = merged.get(parent)!
      children.forEach((transform, child) => {
        // 只有当该变换不存在时才添加（静态变换优先）
        if (!parentMap.has(child)) {
          parentMap.set(child, transform)
        }
      })
    })
    
    return merged
  }

  /**
   * 获取订阅状态
   */
  getSubscriptionStatus(): SubscriptionStatus {
    return this.subscriptionStatus.value
  }

  /**
   * 获取响应式的订阅状态
   */
  getSubscriptionStatusRef() {
    return this.subscriptionStatus
  }

  /**
   * 获取数据更新触发器（用于响应式追踪）
   */
  getDataUpdateTrigger() {
    return computed(() => this.dataUpdateTrigger.value)
  }

  /**
   * 触发数据更新（节流，避免频繁更新）
   */
  private triggerDataUpdateThrottled() {
    if (this.dataUpdateThrottleTimer) {
      this.pendingDataUpdate = true
      return
    }
    
    this.dataUpdateTrigger.value++
    this.pendingDataUpdate = false
    
    // 清除过期的缓存
    this.clearExpiredCache()
    
    this.dataUpdateThrottleTimer = window.setTimeout(() => {
      this.dataUpdateThrottleTimer = null
      if (this.pendingDataUpdate) {
        this.triggerDataUpdateThrottled()
      }
    }, 100)
  }

  /**
   * 清除过期的缓存
   */
  private clearExpiredCache() {
    const now = Date.now()
    for (const [source, targetMap] of this.transformMatrixCache.entries()) {
      for (const [target, cached] of targetMap.entries()) {
        if (now - cached.timestamp > this.cacheTimeout) {
          targetMap.delete(target)
        }
      }
      if (targetMap.size === 0) {
        this.transformMatrixCache.delete(source)
      }
    }
  }

  /**
   * 设置 ROS 实例
   */
  setROSInstance(ros: ROSLIB.Ros | null) {
    this.unsubscribe()
    
    const rawRos = ros ? toRaw(ros) : null
    this.rosInstance = rawRos
    
    if (rawRos) {
      let isConnected = false
      try {
        isConnected = rawRos.isConnected === true
      } catch (error) {
        console.warn('TFManager: Could not check ROS connection status, assuming connected', error)
        isConnected = true
      }
      
      if (isConnected) {
        this.subscribe()
      } else {
        rawRos.on('connection', () => {
          this.subscribe()
        })
      }
    } else {
      this.availableFrames.value.clear()
      this.updateFramesList()
    }
  }

  /**
   * 订阅 TF 话题
   */
  private subscribe() {
    if (!this.rosInstance) {
      this.subscriptionStatus.value = {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null
      }
      return
    }

    try {
      this.subscriptionStatus.value = {
        subscribed: true,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null
      }
      
      // 订阅 /tf 话题（动态坐标变换）
      this.tfTopic = new ROSLIB.Topic({
        ros: this.rosInstance,
        name: '/tf',
        messageType: 'tf2_msgs/TFMessage'
      })

      this.tfTopic.subscribe((message: any) => {
        const now = Date.now()
        
        // 调试：记录动态消息接收
        tfDebugger.recordMessage(false)
        
        this.subscriptionStatus.value = {
          subscribed: true,
          hasData: true,
          messageCount: this.subscriptionStatus.value.messageCount + 1,
          lastMessageTime: now
        }
        
        if (message && message.transforms && Array.isArray(message.transforms)) {
          tfDebugger.log(`Received ${message.transforms.length} dynamic transforms`, 'debug')
          message.transforms.forEach((transform: any) => {
            this.processTransform(transform, false, now) // false = 动态变换
          })
        }
      })

      // 订阅 /tf_static 话题（静态坐标变换）
      this.tfStaticTopic = new ROSLIB.Topic({
        ros: this.rosInstance,
        name: '/tf_static',
        messageType: 'tf2_msgs/TFMessage'
      })

      this.tfStaticTopic.subscribe((message: any) => {
        const now = Date.now()
        
        // 调试：记录静态消息接收
        tfDebugger.recordMessage(true)
        
        this.subscriptionStatus.value = {
          subscribed: true,
          hasData: true,
          messageCount: this.subscriptionStatus.value.messageCount + 1,
          lastMessageTime: now
        }
        
        if (message && message.transforms && Array.isArray(message.transforms)) {
          tfDebugger.log(`Received ${message.transforms.length} static transforms`, 'debug')
          message.transforms.forEach((transform: any) => {
            this.processTransform(transform, true, now) // true = 静态变换
          })
        }
      })

      console.log('TFManager: Subscribed to /tf and /tf_static topics')
    } catch (error) {
      console.error('TFManager: Error subscribing to TF topics:', error)
      this.subscriptionStatus.value = {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null
      }
    }
  }

  /**
   * 处理单个变换数据
   */
  private processTransform(transform: any, isStatic: boolean, now: number) {
    if (!transform.header || !transform.header.frame_id) return

    const frameId = transform.header.frame_id
    const childFrameId = transform.child_frame_id
    
    if (!childFrameId) return

    // 添加到可用坐标系列表
    this.availableFrames.value.add(frameId)
    this.availableFrames.value.add(childFrameId)
    
    // 选择存储位置（静态或动态）
    const targetMap = isStatic ? this.staticTransforms : this.dynamicTransforms
    
    // 存储变换数据
    if (!targetMap.value.has(frameId)) {
      targetMap.value.set(frameId, new Map())
    }
    const frameTransforms = targetMap.value.get(frameId)!
    
    const transformData: TransformFrame = {
      name: childFrameId,
      parent: frameId,
      timestamp: transform.header.stamp?.secs 
        ? transform.header.stamp.secs * 1000 + (transform.header.stamp.nsecs || 0) / 1000000 
        : now,
      lastUpdateTime: now,
      isValid: true,
      isStatic: isStatic,
      translation: transform.transform?.translation ? {
        x: transform.transform.translation.x || 0,
        y: transform.transform.translation.y || 0,
        z: transform.transform.translation.z || 0
      } : undefined,
      rotation: transform.transform?.rotation ? {
        x: transform.transform.rotation.x || 0,
        y: transform.transform.rotation.y || 0,
        z: transform.transform.rotation.z || 0,
        w: transform.transform.rotation.w !== undefined ? transform.transform.rotation.w : 1
      } : undefined
    }
    
    frameTransforms.set(childFrameId, transformData)
    
    // 清除相关缓存（因为变换数据已更新）
    this.clearCacheForFrame(childFrameId)
    
    // 更新 frames 列表和树结构
    this.updateFramesList()
    this.updateTFTreeAsync()
    
    // 触发数据更新通知（节流）
    this.triggerDataUpdateThrottled()
  }

  /**
   * 清除与指定 frame 相关的缓存
   */
  private clearCacheForFrame(frameName: string) {
    // 清除所有涉及该 frame 的缓存
    for (const [source, targetMap] of this.transformMatrixCache.entries()) {
      if (source === frameName) {
        this.transformMatrixCache.delete(source)
      } else {
        targetMap.delete(frameName)
        if (targetMap.size === 0) {
          this.transformMatrixCache.delete(source)
        }
      }
    }
  }

  /**
   * 取消订阅
   */
  private unsubscribe() {
    this.subscriptionStatus.value = {
      subscribed: false,
      hasData: false,
      messageCount: 0,
      lastMessageTime: null
    }
    
    if (this.tfTopic) {
      try {
        this.tfTopic.unsubscribe()
      } catch (error) {
        console.error('TFManager: Error unsubscribing from /tf:', error)
      }
      this.tfTopic = null
    }

    if (this.tfStaticTopic) {
      try {
        this.tfStaticTopic.unsubscribe()
      } catch (error) {
        console.error('TFManager: Error unsubscribing from /tf_static:', error)
      }
      this.tfStaticTopic = null
    }
  }

  /**
   * 更新坐标系列表
   */
  private updateFramesList() {
    const allFrames = new Set<string>()
    this.availableFrames.value.forEach(frame => allFrames.add(frame))
    this.frames.value = Array.from(allFrames).sort()
  }

  /**
   * 更新 TF 树结构（异步，使用 Worker）
   */
  private async updateTFTreeAsync() {
    // 防止重复更新
    if (this.isUpdatingTree) {
      return
    }
    
    this.isUpdatingTree = true
    
    try {
      const now = Date.now()
      const result = await this.tfTreeWorker.updateTFTree(
        this.dynamicTransforms.value,
        this.staticTransforms.value,
        Array.from(this.availableFrames.value),
        this.frameTimeout,
        now
      )
      
      if (result.error) {
        console.error('TF Worker tree update error:', result.error)
        // 回退到同步更新
        this.updateTFTreeSync()
      } else {
        this.tfTree.value = result.tfTree
      }
    } catch (error) {
      console.error('TF Worker tree update failed, falling back to sync:', error)
      // 回退到同步更新
      this.updateTFTreeSync()
    } finally {
      this.isUpdatingTree = false
    }
  }
  
  /**
   * 更新 TF 树结构（同步，回退方案）
   */
  private updateTFTreeSync() {
    const now = Date.now()
    const timeoutMs = this.frameTimeout * 1000
    
    // 合并静态和动态变换
    const allTransforms = this.getTransforms()
    
    // 构建节点映射
    const nodeMap = new Map<string, TFTreeNode>()
    
    // 创建所有节点
    this.availableFrames.value.forEach(frameName => {
      if (!nodeMap.has(frameName)) {
        nodeMap.set(frameName, {
          name: frameName,
          parent: null,
          children: [],
          lastUpdateTime: 0,
          isValid: false,
          isStatic: false
        })
      }
    })
    
    // 建立父子关系并更新状态
    allTransforms.forEach((childMap, parentName) => {
      childMap.forEach((transform, childName) => {
        // 静态变换永不过期，动态变换检查超时
        const age = now - (transform.lastUpdateTime || now)
        const isValid = transform.isStatic || age < timeoutMs
        
        // 更新子节点
        if (nodeMap.has(childName)) {
          const childNode = nodeMap.get(childName)!
          childNode.parent = parentName
          childNode.lastUpdateTime = transform.lastUpdateTime || now
          childNode.isValid = isValid
          childNode.isStatic = transform.isStatic
        } else {
          nodeMap.set(childName, {
            name: childName,
            parent: parentName,
            children: [],
            lastUpdateTime: transform.lastUpdateTime || now,
            isValid: isValid,
            isStatic: transform.isStatic
          })
        }
        
        // 更新父节点的子节点列表
        if (nodeMap.has(parentName)) {
          const parentNode = nodeMap.get(parentName)!
          if (!parentNode.children.find(c => c.name === childName)) {
            parentNode.children.push(nodeMap.get(childName)!)
          }
        }
      })
    })
    
    // 找到根节点（没有父节点的节点）
    const rootNodes: TFTreeNode[] = []
    nodeMap.forEach((node) => {
      if (!node.parent) {
        rootNodes.push(node)
      }
    })
    
    // 如果没有根节点，使用 map 作为默认根（参照 RViz）
    if (rootNodes.length === 0 && nodeMap.has('map')) {
      rootNodes.push(nodeMap.get('map')!)
    }
    
    rootNodes.sort((a, b) => a.name.localeCompare(b.name))
    
    this.tfTree.value = rootNodes
  }
  

  /**
   * 获取 TF 树结构
   */
  getTFTree(): TFTreeNode[] {
    return this.tfTree.value
  }

  /**
   * 获取响应式的 TF 树结构
   */
  getTFTreeRef() {
    return this.tfTree
  }

  /**
   * 设置固定帧（参照 RViz）
   */
  setFixedFrame(frameName: string) {
    this.fixedFrame.value = frameName
    // 清除所有缓存，因为固定帧改变了
    this.transformMatrixCache.clear()
  }

  /**
   * 获取固定帧
   */
  getFixedFrame(): string {
    return this.fixedFrame.value
  }

  /**
   * 获取固定帧的响应式引用
   */
  getFixedFrameRef() {
    return this.fixedFrame
  }

  /**
   * 设置 frame 超时时间（秒）
   */
  setFrameTimeout(timeout: number) {
    this.frameTimeout = timeout
    this.updateTFTreeAsync()
  }

  /**
   * 获取帧超时时间
   */
  getFrameTimeout(): number {
    return this.frameTimeout
  }

  /**
   * 检查 frame 是否在 TF 树中
   */
  hasFrame(frameName: string): boolean {
    return this.availableFrames.value.has(frameName)
  }

  /**
   * 获取 frame 的父节点
   */
  getFrameParent(frameName: string): string | null {
    const transforms = this.getTransforms()
    for (const [parent, children] of transforms.entries()) {
      if (children.has(frameName)) {
        return parent
      }
    }
    return null
  }

  /**
   * 查找从 sourceFrame 到 targetFrame 的路径（优化的 BFS）
   * 参照 RViz 的实现方式
   */
  getTransformPath(sourceFrame: string, targetFrame: string): string[] | null {
    if (sourceFrame === targetFrame) {
      return [sourceFrame]
    }

    const transforms = this.getTransforms()
    const visited = new Set<string>()
    const queue: { frame: string; path: string[] }[] = [{ frame: sourceFrame, path: [sourceFrame] }]

    while (queue.length > 0) {
      const { frame: currentFrame, path: currentPath } = queue.shift()!

      if (currentFrame === targetFrame) {
        return currentPath
      }

      if (visited.has(currentFrame)) {
        continue
      }
      visited.add(currentFrame)

      // 查找子节点（向下）
      const children = transforms.get(currentFrame)
      if (children) {
        for (const childName of children.keys()) {
          if (!visited.has(childName)) {
            queue.push({ frame: childName, path: [...currentPath, childName] })
          }
        }
      }

      // 查找父节点（向上）
      for (const [parentName, parentChildren] of transforms.entries()) {
        if (parentChildren.has(currentFrame) && !visited.has(parentName)) {
          queue.push({ frame: parentName, path: [...currentPath, parentName] })
        }
      }
    }
    return null
  }

  /**
   * 计算从 sourceFrame 到 targetFrame 的变换矩阵
   * 参照 RViz 和 regl-worldview 的实现方式
   * 使用纯数学计算（gl-matrix），避免 THREE.js 依赖
   */
  getTransformMatrix(sourceFrame: string, targetFrame: string): mat4 | null {
    if (sourceFrame === targetFrame) {
      return mat4.identity(mat4.create())
    }

    // 检查缓存
    const cached = this.transformMatrixCache.get(sourceFrame)?.get(targetFrame)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.matrix
    }

    const path = this.getTransformPath(sourceFrame, targetFrame)
    if (!path) {
      return null
    }

    const transforms = this.getTransforms()
    
    // 累积变换矩阵
    // TF 数据存储的是 parent → child 的变换，表示 child 在 parent 中的位置
    // 我们需要计算 sourceFrame 在 targetFrame 中的位置
    let resultMatrix = mat4.identity(mat4.create())

    // 反向遍历路径：从 targetFrame 向下到 sourceFrame
    // 这样我们可以累积每个 child 在 parent 中的位置
    for (let i = path.length - 1; i > 0; i--) {
      const parent = path[i]      // 当前 frame（更接近 targetFrame，是 parent）
      const child = path[i - 1]    // 前一个 frame（更接近 sourceFrame，是 child）

      if (!parent || !child) {
        console.warn(`TFManager: Invalid path segment at index ${i}`)
        continue
      }

      // 尝试查找从 parent 到 child 的变换（parent → child）
      let transform: TransformFrame | null = null
      const parentTransforms = transforms.get(parent)
      if (parentTransforms && parentTransforms.has(child)) {
        transform = parentTransforms.get(child) || null
      }

      // 如果没找到正向变换，尝试反向变换（从child到parent，然后取逆）
      if (!transform) {
        const childTransforms = transforms.get(child)
        if (childTransforms && childTransforms.has(parent)) {
          const inverseTransform = childTransforms.get(parent)
          if (inverseTransform && inverseTransform.translation && inverseTransform.rotation) {
            // 计算逆变换
            const transformMat = mat4.create()
            const pos = vec3.fromValues(
              inverseTransform.translation.x,
              inverseTransform.translation.y,
              inverseTransform.translation.z
            )
            const rot = quat.fromValues(
              inverseTransform.rotation.x,
              inverseTransform.rotation.y,
              inverseTransform.rotation.z,
              inverseTransform.rotation.w
            )
            mat4.fromRotationTranslation(transformMat, rot, pos)
            
            // 计算逆矩阵
            mat4.invert(transformMat, transformMat)
            
            const invPos = vec3.create()
            const invRot = quat.create()
            mat4.getTranslation(invPos, transformMat)
            mat4.getRotation(invRot, transformMat)
            
            transform = {
              name: child,
              parent: parent,
              translation: { x: invPos[0], y: invPos[1], z: invPos[2] },
              rotation: { x: invRot[0], y: invRot[1], z: invRot[2], w: invRot[3] }
            }
          }
        }
      }

      if (transform && transform.translation && transform.rotation) {
        // 构建变换矩阵
        const transformMat = mat4.create()
        const pos = vec3.fromValues(
          transform.translation.x,
          transform.translation.y,
          transform.translation.z
        )
        const rot = quat.fromValues(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w
        )
        mat4.fromRotationTranslation(transformMat, rot, pos)
        
        // 累积变换（右乘：先应用当前变换，再应用累积的变换）
        mat4.multiply(resultMatrix, resultMatrix, transformMat)
      } else {
        console.warn(`TFManager: Could not find transform from ${parent} to ${child}`)
        return null
      }
    }

    // 缓存结果
    if (!this.transformMatrixCache.has(sourceFrame)) {
      this.transformMatrixCache.set(sourceFrame, new Map())
    }
    this.transformMatrixCache.get(sourceFrame)!.set(targetFrame, {
      matrix: resultMatrix,
      timestamp: Date.now()
    })
    
    return resultMatrix
  }

  /**
   * 获取可用的坐标系列表
   */
  getFrames(): string[] {
    return this.frames.value.length > 0 
      ? this.frames.value 
      : ['map', 'odom', 'base_link', 'base_footprint'] // 默认 frames
  }

  /**
   * 获取响应式的坐标系列表
   */
  getFramesRef() {
    return this.frames
  }

  /**
   * 获取 frame 的详细信息（相对于 fixedFrame）
   * 参照 RViz 的实现方式
   */
  getFrameInfo(frameName: string, fixedFrame: string = this.fixedFrame.value): {
    parent: string | null
    position: { x: number; y: number; z: number } | null
    orientation: { x: number; y: number; z: number; w: number } | null
    relativePosition: { x: number; y: number; z: number } | null
    relativeOrientation: { x: number; y: number; z: number; w: number } | null
  } {
    const transforms = this.getTransforms()
    
    // 查找 frame 的父节点和相对变换
    let parent: string | null = null
    let relativePosition: { x: number; y: number; z: number } | null = null
    let relativeOrientation: { x: number; y: number; z: number; w: number } | null = null
    
    for (const [parentName, children] of transforms.entries()) {
      const transform = children.get(frameName)
      if (transform) {
        parent = parentName
        if (transform.translation) {
          relativePosition = {
            x: transform.translation.x,
            y: transform.translation.y,
            z: transform.translation.z
          }
        }
        if (transform.rotation) {
          relativeOrientation = {
            x: transform.rotation.x,
            y: transform.rotation.y,
            z: transform.rotation.z,
            w: transform.rotation.w
          }
        }
        break
      }
    }
    
    // 计算相对于固定帧的绝对位置和方向（使用矩阵变换）
    let position: { x: number; y: number; z: number } | null = null
    let orientation: { x: number; y: number; z: number; w: number } | null = null
    
    if (frameName === fixedFrame) {
      position = { x: 0, y: 0, z: 0 }
      orientation = { x: 0, y: 0, z: 0, w: 1 }
    } else {
      const transformMatrix = this.getTransformMatrix(frameName, fixedFrame)
      if (transformMatrix) {
        const pos = vec3.create()
        const rot = quat.create()
        
        mat4.getTranslation(pos, transformMatrix)
        mat4.getRotation(rot, transformMatrix)
        
        position = { x: pos[0], y: pos[1], z: pos[2] }
        orientation = { x: rot[0], y: rot[1], z: rot[2], w: rot[3] }
      } else {
        position = null
        orientation = null
      }
    }
    
    return {
      parent,
      position,
      orientation,
      relativePosition,
      relativeOrientation
    }
  }

  /**
   * 移除超时的动态帧（仅对动态变换有效）
   */
  private removeExpiredFrames() {
    const now = Date.now()
    const timeoutMs = this.frameTimeout * 1000
    
    // 只清理动态变换，静态变换永不过期
    for (const [parent, children] of this.dynamicTransforms.value.entries()) {
      for (const [child, transform] of children.entries()) {
        if (!transform.isStatic && transform.lastUpdateTime) {
          const age = now - transform.lastUpdateTime
          if (age > timeoutMs) {
            children.delete(child)
            // 清除相关缓存
            this.clearCacheForFrame(child)
          }
        }
      }
      if (children.size === 0) {
        this.dynamicTransforms.value.delete(parent)
      }
    }
    
    // 更新树结构
    this.updateTFTreeAsync()
  }

  /**
   * 启动定期清理超时帧
   */
  startCleanupTimer(interval: number = 1000) {
    setInterval(() => {
      this.removeExpiredFrames()
    }, interval)
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.unsubscribe()
    this.availableFrames.value.clear()
    this.frames.value = []
    this.dynamicTransforms.value.clear()
    this.staticTransforms.value.clear()
    this.transformMatrixCache.clear()
    if (this.dataUpdateThrottleTimer) {
      clearTimeout(this.dataUpdateThrottleTimer)
      this.dataUpdateThrottleTimer = null
    }
  }
}

// 导出单例
export const tfManager = new TFManager()

// 启动清理定时器（定期清理超时的动态变换）
tfManager.startCleanupTimer()
