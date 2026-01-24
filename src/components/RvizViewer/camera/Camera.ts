/**
 * Camera 命令
 * 完全基于 regl-worldview 的 camera.js 实现
 */
import { mat4, vec4 } from 'gl-matrix'
import type { Vec3, Vec4, Mat4, CameraCommand, Viewport } from '../types'
import { getOrthographicBounds } from './utils'
import cameraProject from './cameraProject'
import { DEFAULT_CAMERA_STATE, type CameraState } from './CameraStore'
import selectors from './cameraStateSelectors'

const TEMP_MAT = mat4.create() as Mat4

// This is the regl command which encapsulates the camera projection and view matrices.
// It adds the matrices to the regl context so they can be used by other commands.
export default (regl: any) => {
  if (!regl) {
    throw new Error('Invalid regl instance')
  }

  return class Camera implements CameraCommand {
    viewportWidth: number = 0
    viewportHeight: number = 0
    cameraState: CameraState = DEFAULT_CAMERA_STATE

    getProjection(): Mat4 {
      const { near, far, distance, fovy } = this.cameraState
      if (!this.cameraState.perspective) {
        const bounds = getOrthographicBounds(distance, this.viewportWidth, this.viewportHeight)
        const { left, right, bottom, top } = bounds
        return mat4.ortho(
          mat4.create(),
          left,
          right,
          bottom,
          top,
          near,
          far
        ) as Mat4
      }
      const aspect = this.viewportWidth / this.viewportHeight
      return mat4.perspective(mat4.create(), fovy, aspect, near, far) as Mat4
    }

    getView(): Mat4 {
      return selectors.view(this.cameraState)
    }

    // convert a point in 3D space to a point on the screen
    toScreenCoord(viewport: Viewport, point: Vec3): [number, number, number] | undefined {
      const projection = this.getProjection()
      const view = selectors.view(this.cameraState)
      const tempMat = mat4.create()
      const combinedProjView = mat4.multiply(tempMat, projection, view) as Mat4
      const result = cameraProject(vec4.create() as Vec4, point, viewport, combinedProjView)
      const [x, y, z, w] = result
      if (z < 0 || z > 1 || w < 0) {
        // resulting point is outside the window depth range
        return undefined
      }
      const diffY = viewport[3] + viewport[1]
      const diffX = viewport[0]
      // move the x value over based on the left of the viewport
      // and move the y value over based on the bottom of the viewport
      return [x - diffX, diffY - y, z]
    }

    draw = regl({
      // adds context variables to the regl context so they are accessible from commands
      context: {
        // use functions, not lambdas here to make sure we can access
        // the regl supplied this scope: http://regl.party/api#this
        projection(this: Camera, context: any, props: any): Mat4 {
          const { viewportWidth, viewportHeight } = context
          // save these variables on the camera instance
          // because we need them for raycasting
          this.viewportWidth = viewportWidth
          this.viewportHeight = viewportHeight
          this.cameraState = props
          return this.getProjection()
        },

        view(this: Camera, _context: any, _props: any): Mat4 {
          return this.getView()
        },

        // inverse of the view rotation, used for making objects always face the camera
        billboardRotation(this: Camera, _context: any, _props: any): Mat4 {
          return selectors.billboardRotation(this.cameraState)
        },

        isPerspective(this: Camera, _context: any, _props: any): boolean {
          return this.cameraState.perspective
        },

        fovy(this: Camera, _context: any, _props: any): number {
          return this.cameraState.fovy
        }
      },

      // adds view and projection as uniforms to every command
      // and makes them available in the shaders
      uniforms: {
        view: regl.context('view'),
        billboardRotation: regl.context('billboardRotation'),
        projection: regl.context('projection')
      }
    })
  }
}
