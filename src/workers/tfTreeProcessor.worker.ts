/**
 * TF 树处理器 Web Worker
 * 负责在后台线程处理耗时的 TF 树更新操作，避免阻塞主线程
 */

export interface TransformFrame {
  name: string
  parent?: string
  timestamp?: number
  lastUpdateTime?: number
  isValid?: boolean
  isStatic?: boolean
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

export interface UpdateTFTreeRequest {
  type: 'updateTFTree'
  dynamicTransforms: Record<string, Record<string, TransformFrame>>
  staticTransforms: Record<string, Record<string, TransformFrame>>
  availableFrames: string[]
  frameTimeout: number
  now: number
}

export interface UpdateTFTreeResult {
  type: 'tfTreeUpdated'
  tfTree: TFTreeNode[]
  error?: string
}

type WorkerRequest = UpdateTFTreeRequest
type WorkerResponse = UpdateTFTreeResult

/**
 * 合并静态和动态变换
 */
function getMergedTransforms(
  staticTransforms: Record<string, Record<string, TransformFrame>>,
  dynamicTransforms: Record<string, Record<string, TransformFrame>>
): Map<string, Map<string, TransformFrame>> {
  const staticMap = new Map<string, Map<string, TransformFrame>>()
  const dynamicMap = new Map<string, Map<string, TransformFrame>>()
  
  // 转换静态变换
  Object.entries(staticTransforms).forEach(([parent, children]) => {
    const childrenMap = new Map<string, TransformFrame>()
    Object.entries(children).forEach(([child, transform]) => {
      childrenMap.set(child, transform)
    })
    staticMap.set(parent, childrenMap)
  })
  
  // 转换动态变换
  Object.entries(dynamicTransforms).forEach(([parent, children]) => {
    const childrenMap = new Map<string, TransformFrame>()
    Object.entries(children).forEach(([child, transform]) => {
      childrenMap.set(child, transform)
    })
    dynamicMap.set(parent, childrenMap)
  })
  
  const merged = new Map<string, Map<string, TransformFrame>>()
  
  // 先添加静态变换（优先级更高）
  staticMap.forEach((children, parent) => {
    if (!merged.has(parent)) {
      merged.set(parent, new Map())
    }
    const parentMap = merged.get(parent)!
    children.forEach((transform, child) => {
      parentMap.set(child, transform)
    })
  })
  
  // 再添加动态变换（不会覆盖静态变换）
  dynamicMap.forEach((children, parent) => {
    if (!merged.has(parent)) {
      merged.set(parent, new Map())
    }
    const parentMap = merged.get(parent)!
    children.forEach((transform, child) => {
      if (!parentMap.has(child)) {
        parentMap.set(child, transform)
      }
    })
  })
  
  return merged
}

/**
 * 更新 TF 树结构
 */
function updateTFTree(request: UpdateTFTreeRequest): UpdateTFTreeResult {
  try {
    const { dynamicTransforms, staticTransforms, availableFrames, frameTimeout, now } = request
    const timeoutMs = frameTimeout * 1000
    
    // 合并静态和动态变换
    const allTransforms = getMergedTransforms(staticTransforms, dynamicTransforms)
    
    // 构建节点映射
    const nodeMap = new Map<string, TFTreeNode>()
    
    // 创建所有节点
    availableFrames.forEach(frameName => {
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
    
    return {
      type: 'tfTreeUpdated',
      tfTree: rootNodes
    }
  } catch (error: any) {
    return {
      type: 'tfTreeUpdated',
      tfTree: [],
      error: error?.message || 'Unknown error'
    }
  }
}

// Worker 消息处理
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  let response: WorkerResponse
  
  try {
    switch (request.type) {
      case 'updateTFTree':
        response = updateTFTree(request)
        break
      default:
        throw new Error(`Unknown request type: ${(request as any).type}`)
    }
    
    self.postMessage(response)
  } catch (error: any) {
    const errorResponse: UpdateTFTreeResult = {
      type: 'tfTreeUpdated',
      tfTree: [],
      error: error?.message || 'Unknown error'
    }
    
    self.postMessage(errorResponse)
  }
})

// 导出类型供主线程使用
export type { WorkerRequest, WorkerResponse }
