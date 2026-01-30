/**
 * GLTFScene 命令
 * 完全基于 regl-worldview 的 GLTFScene.js 实现
 * 用于渲染 GLTF/GLB 3D 模型
 */
import { mat4 } from 'gl-matrix'
// @ts-ignore - memoize-weak 可能没有类型定义
import memoizeWeak from 'memoize-weak'
import type { Regl, Pose, Scale } from '../types'
import type { GLBModel } from '../utils/parseGLB'
import { defaultBlend, pointToVec3, orientationToVec4 } from './utils/commandUtils'
import parseGLB from '../utils/parseGLB'

function glConstantToRegl(value?: number): string | undefined {
  if (value === undefined) {
    return undefined
  }
  // prettier-ignore
  switch (value) {
    // min/mag filters
    case WebGLRenderingContext.NEAREST: return 'nearest'
    case WebGLRenderingContext.LINEAR: return 'linear'
    case WebGLRenderingContext.NEAREST_MIPMAP_NEAREST: return 'nearest mipmap nearest'
    case WebGLRenderingContext.NEAREST_MIPMAP_LINEAR: return 'nearest mipmap linear'
    case WebGLRenderingContext.LINEAR_MIPMAP_NEAREST: return 'linear mipmap nearest'
    case WebGLRenderingContext.LINEAR_MIPMAP_LINEAR: return 'linear mipmap linear'
    // texture wrapping modes
    case WebGLRenderingContext.REPEAT: return 'repeat'
    case WebGLRenderingContext.CLAMP_TO_EDGE: return 'clamp'
    case WebGLRenderingContext.MIRRORED_REPEAT: return 'mirror'
  }
  throw new Error(`unhandled constant value ${JSON.stringify(value)}`)
}

// Default sampler set based on GLTF recommendations:
// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#texture
const getDefaultSampler = () => ({
  minFilter: WebGLRenderingContext.NEAREST_MIPMAP_LINEAR,
  magFilter: WebGLRenderingContext.LINEAR,
  wrapS: WebGLRenderingContext.REPEAT,
  wrapT: WebGLRenderingContext.REPEAT
})

const getSceneToDraw = ({ json }: { json: any }) => {
  if (json.scene != null) {
    return json.scene
  }
  // Draw the first scene if the scene key is missing.
  const keys = Object.keys(json.scenes ?? {})
  if (keys.length === 0) {
    throw new Error('No scenes to render')
  }
  return keys[0]
}

const drawModel = (regl: Regl) => {
  if (!regl) {
    throw new Error('Invalid regl instance')
  }

  const command = regl({
    primitive: 'triangles',
    blend: defaultBlend,
    uniforms: {
      globalAlpha: regl.context('globalAlpha'),
      poseMatrix: regl.context('poseMatrix'),

      baseColorTexture: regl.prop('baseColorTexture'),
      baseColorFactor: regl.prop('baseColorFactor'),
      nodeMatrix: regl.prop('nodeMatrix'),
      'light.direction': [0, 0, -1],
      'light.ambientIntensity': 0.5,
      'light.diffuseIntensity': 0.5,
      hitmapColor: regl.context('hitmapColor'),
      isHitmap: regl.context('isHitmap')
    },
    attributes: {
      position: regl.prop('positions'),
      normal: regl.prop('normals'),
      texCoord: regl.prop('texCoords')
    },
    elements: regl.prop('indices'),
    vert: `
  uniform mat4 projection, view;
  uniform mat4 nodeMatrix;
  uniform mat4 poseMatrix;
  attribute vec3 position, normal;
  varying vec3 vNormal;
  attribute vec2 texCoord;
  varying vec2 vTexCoord;

  void main() {
    // using the projection matrix for normals breaks lighting for orthographic mode
    mat4 mv = view * poseMatrix * nodeMatrix;
    vNormal = normalize((mv * vec4(normal, 0)).xyz);
    vTexCoord = texCoord;
    gl_Position = projection * mv * vec4(position, 1);
  }
  `,
    frag: `
  precision mediump float;
  uniform bool isHitmap;
  uniform vec4 hitmapColor;
  uniform float globalAlpha;
  uniform sampler2D baseColorTexture;
  uniform vec4 baseColorFactor;
  varying mediump vec2 vTexCoord;
  varying mediump vec3 vNormal;

  // Basic directional lighting from:
  // http://ogldev.atspace.co.uk/www/tutorial18/tutorial18.html
  struct DirectionalLight {
    mediump vec3 direction;
    lowp float ambientIntensity;
    lowp float diffuseIntensity;
  };
  uniform DirectionalLight light;

  void main() {
    vec4 baseColor = texture2D(baseColorTexture, vTexCoord) * baseColorFactor;
    float diffuse = light.diffuseIntensity * max(0.0, dot(vNormal, -light.direction));
    gl_FragColor = isHitmap ? hitmapColor : vec4((light.ambientIntensity + diffuse) * baseColor.rgb, baseColor.a * globalAlpha);
  }
  `
  })

  // default values for when baseColorTexture is not specified
  const singleTexCoord = regl.buffer([0, 0])
  const whiteTexture = regl.texture({
    data: [255, 255, 255, 255],
    width: 1,
    height: 1
  })

  // build the draw calls needed to draw the model. This will happen whenever the model changes.
  const getDrawCalls = memoizeWeak((model: GLBModel) => {
    // upload textures to the GPU
    const { accessors } = model
    const textures =
      model.json.textures &&
      model.json.textures.map((textureInfo: any) => {
        const sampler = textureInfo.sampler ? model.json.samplers[textureInfo.sampler] : getDefaultSampler()
        const bitmap = model.images && model.images[textureInfo.source]
        const texture = regl.texture({
          data: bitmap,
          min: glConstantToRegl(sampler.minFilter),
          mag: glConstantToRegl(sampler.magFilter),
          wrapS: glConstantToRegl(sampler.wrapS),
          wrapT: glConstantToRegl(sampler.wrapT)
        })
        return texture
      })
    if (model.images) {
      model.images.forEach((bitmap: ImageBitmap) => bitmap.close())
    }

    const drawCalls: any[] = []
    // helper to draw the primitives comprising a mesh
    function drawMesh(mesh: any, nodeMatrix: mat4) {
      for (const primitive of mesh.primitives) {
        const material = model.json.materials[primitive.material]
        const texInfo = material.pbrMetallicRoughness.baseColorTexture

        let primitiveAccessors = accessors
        const { extensions = {} } = primitive
        const dracoCompressionEXT = extensions.KHR_draco_mesh_compression
        if (dracoCompressionEXT) {
          // If mesh contains compressed data, accessors will be available inside
          // the draco extension. See `parseGLB.ts` and `draco.ts` files.
          primitiveAccessors = dracoCompressionEXT.accessors
        }
        if (!primitiveAccessors) {
          throw new Error('Error decoding GLB model: Missing `accessors` in JSON data')
        }

        drawCalls.push({
          indices: primitiveAccessors[primitive.indices],
          positions: primitiveAccessors[primitive.attributes.POSITION],
          normals: primitiveAccessors[primitive.attributes.NORMAL],
          texCoords: texInfo
            ? primitiveAccessors[primitive.attributes[`TEXCOORD_${texInfo.texCoord || 0}`]]
            : { divisor: 1, buffer: singleTexCoord },
          baseColorTexture: texInfo ? textures?.[texInfo.index] : whiteTexture,
          baseColorFactor: material.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1],
          nodeMatrix
        })
      }
    }

    // helper to draw all the meshes contained in a node and its child nodes
    function drawNode(node: any, parentMatrix: mat4) {
      const nodeMatrix = node.matrix
        ? mat4.clone(node.matrix)
        : mat4.fromRotationTranslationScale(
            mat4.create(),
            node.rotation || [0, 0, 0, 1],
            node.translation || [0, 0, 0],
            node.scale || [1, 1, 1]
          )
      mat4.mul(nodeMatrix, parentMatrix, nodeMatrix)
      if (node.mesh != null) {
        drawMesh(model.json.meshes[node.mesh], nodeMatrix)
      }
      if (node.children) {
        for (const childIdx of node.children) {
          drawNode(model.json.nodes[childIdx], nodeMatrix)
        }
      }
    }

    // finally, draw each of the main scene's nodes. Use the first scene if one isn't specified
    // explicitly.
    for (const nodeIdx of model.json.scenes[getSceneToDraw(model)].nodes) {
      const rootTransform = mat4.create()
      mat4.rotateX(rootTransform, rootTransform, Math.PI / 2)
      mat4.rotateY(rootTransform, rootTransform, Math.PI / 2)
      drawNode(model.json.nodes[nodeIdx], rootTransform)
    }
    return drawCalls
  })

  // create a regl command to set the context for each draw call
  const withContext = regl({
    context: {
      poseMatrix: (_context: any, props: any) =>
        mat4.fromRotationTranslationScale(
          mat4.create(),
          orientationToVec4(props.pose.orientation),
          pointToVec3(props.pose.position),
          props.scale ? pointToVec3(props.scale) : [1, 1, 1]
        ),
      globalAlpha: (_context: any, props: any) => (props.alpha == null ? 1 : props.alpha),
      hitmapColor: (_context: any, props: any) => props.color || [0, 0, 0, 1],
      isHitmap: (_context: any, props: any) => !!props.isHitmap
    }
  })

  return (props: any, isHitmap: boolean = false) => {
    const drawCalls = getDrawCalls(props.model)
    withContext(isHitmap ? { ...props, isHitmap } : props, () => {
      command(drawCalls)
    })
  }
}

export const makeGLTFSceneCommand = () => {
  return drawModel
}

export const gltfScene = (regl: Regl) => {
  return makeGLTFSceneCommand()(regl)
}

export default function GLTFScene(props: {
  model: string | (() => Promise<GLBModel>)
  children: {
    pose: Pose
    scale: Scale
    alpha?: number
  }
}) {
  return makeGLTFSceneCommand()
}

// 导出 parseGLB 供外部使用
export { parseGLB }
