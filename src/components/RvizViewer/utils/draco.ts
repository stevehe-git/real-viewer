/**
 * Draco 压缩解码工具函数
 * 完全基于 regl-worldview 的 draco.js 实现
 * 
 * 注意：需要安装 draco3d 依赖
 * npm install draco3d
 */

// @ts-ignore - draco3d 可能未安装
let draco3d: any

try {
  // @ts-ignore
  draco3d = require('draco3d')
} catch (e) {
  // draco3d 未安装，将在运行时提示
}

interface DracoCompression {
  bufferView: number
  attributes: { [key: string]: number }
  accessors?: any[]
}

interface Primitive {
  extensions?: {
    KHR_draco_mesh_compression?: DracoCompression
  }
}

interface GLBJson {
  bufferViews: Array<{
    byteOffset?: number
    byteLength: number
  }>
  meshes?: Array<{
    primitives: Primitive[]
  }>
  extensionsRequired?: string[]
}

const decodeGeometry = (
  draco: any,
  decoder: any,
  json: GLBJson,
  binary: DataView,
  dracoCompression: DracoCompression
) => {
  const { bufferView: bufferViewIndex } = dracoCompression
  const bufferView = json.bufferViews[bufferViewIndex]
  const buffer = new draco.DecoderBuffer()
  const data = new Int8Array(
    binary.buffer,
    binary.byteOffset + (bufferView.byteOffset || 0),
    bufferView.byteLength
  )
  buffer.Init(data, bufferView.byteLength)
  const geometryType = decoder.GetEncodedGeometryType(buffer)

  let dracoGeometry: any
  let status: any
  if (geometryType === draco.TRIANGULAR_MESH) {
    dracoGeometry = new draco.Mesh()
    status = decoder.DecodeBufferToMesh(buffer, dracoGeometry)
  } else if (geometryType === draco.POINT_CLOUD) {
    dracoGeometry = new draco.PointCloud()
    status = decoder.DecodeBufferToPointCloud(buffer, dracoGeometry)
  } else {
    const errorMsg = 'Error: Unknown geometry type.'
    console.error(errorMsg)
  }

  if (!status || !dracoGeometry || !status.ok() || dracoGeometry?.ptr === 0) {
    throw new Error(`Decoding failed: ${status ? status.error_msg() : 'unknown error'}`)
  }

  draco.destroy(buffer)

  return dracoGeometry
}

const decodeAttributes = (draco: any, decoder: any, dracoGeometry: any, attributes: any) => {
  const accessors: any[] = []
  for (const attributeName in attributes) {
    const attributeId = attributes[attributeName]
    const attribute = decoder.GetAttributeByUniqueId(dracoGeometry, attributeId)

    const numComponents = attribute.num_components()
    const numPoints = dracoGeometry.num_points()
    const numValues = numPoints * numComponents
    const attributeType = Float32Array
    const byteLength = numValues * attributeType.BYTES_PER_ELEMENT
    const dataType = draco.DT_FLOAT32

    // @ts-ignore
    const ptr = draco._malloc(byteLength)

    decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, dataType, byteLength, ptr)
    const array = new attributeType(draco.HEAPF32.buffer, ptr, numValues).slice()

    // @ts-ignore
    draco._free(ptr)

    accessors.push(array)
  }
  return accessors
}

const decodeIndices = (draco: any, decoder: any, dracoGeometry: any) => {
  const numFaces = dracoGeometry.num_faces()
  const numIndices = numFaces * 3
  const byteLength = numIndices * 4

  // @ts-ignore
  const ptr = draco._malloc(byteLength)

  decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, ptr)
  const indices = new Uint32Array(draco.HEAPF32.buffer, ptr, numIndices).slice()

  // @ts-ignore
  draco._free(ptr)

  return indices
}

const decodePrimitive = (
  draco: any,
  decoder: any,
  json: GLBJson,
  binary: DataView,
  primitive: Primitive
) => {
  const { extensions = {} } = primitive
  const dracoCompression = extensions.KHR_draco_mesh_compression
  if (!dracoCompression) {
    return
  }

  const dracoGeometry = decodeGeometry(draco, decoder, json, binary, dracoCompression)

  dracoCompression.accessors = []

  const { attributes } = dracoCompression
  dracoCompression.accessors.push(...decodeAttributes(draco, decoder, dracoGeometry, attributes))

  dracoCompression.accessors.push(decodeIndices(draco, decoder, dracoGeometry))

  draco.destroy(dracoGeometry)
}

async function createDracoModule(): Promise<any> {
  if (!draco3d) {
    throw new Error(
      'draco3d is not installed. Please install it with: npm install draco3d'
    )
  }

  // npm does not work correctly when we try to use `import` to fetch the wasm module,
  // so we need to use `require` here instead. In any case, `draco3dWasm` does not
  // hold the actual wasm module, but the path to it, which we use in the `locateFile`
  // function below.
  // @ts-ignore
  const draco3dWasm = require('draco3d/draco_decoder.wasm')
  return draco3d.createDecoderModule({
    locateFile: () => {
      return draco3dWasm
    }
  })
}

/**
 * 解码压缩的 GLB 文件中的 Draco 数据
 * @param json GLB JSON 数据
 * @param binary GLB 二进制数据
 */
export default async function decodeCompressedGLB(json: GLBJson, binary: DataView): Promise<void> {
  const { extensionsRequired = [] } = json
  if (!extensionsRequired.includes('KHR_draco_mesh_compression')) {
    // 此模型不使用 Draco 压缩
    return
  }

  const draco = await createDracoModule()
  const decoder = new draco.Decoder()

  if (json.meshes) {
    json.meshes.forEach((mesh) => {
      mesh.primitives.forEach((primitive) => {
        decodePrimitive(draco, decoder, json, binary, primitive)
      })
    })
  }

  draco.destroy(decoder)
}
