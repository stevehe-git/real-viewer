/**
 * Points 命令
 * 完全基于 regl-worldview 的 Points.js 实现
 */
import type { Regl, PointType } from '../types'
import { getVertexColors, pointToVec3, withPose } from './utils/commandUtils'

type PointsProps = {
  useWorldSpaceSize?: boolean
}

type Props = PointsProps & {
  children: ReadonlyArray<PointType>
}

export const makePointsCommand = ({ useWorldSpaceSize }: PointsProps) => {
  return (regl: Regl) => {
    if (!regl) {
      throw new Error('Invalid regl instance')
    }

    const [minLimitPointSize, maxLimitPointSize] = regl.limits.pointSizeDims
    return withPose({
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

    attribute vec3 point;
    attribute vec4 color;
    varying vec4 fragColor;
    void main () {
      vec3 pos = applyPose(point);
      gl_Position = projection * view * vec4(pos, 1);
      fragColor = color;

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
    void main () {
      gl_FragColor = vec4(fragColor.x, fragColor.y, fragColor.z, 1);
    }
    `,
      attributes: {
        point: (_context: any, props: any) => {
          return props.points.map((point: any) => (Array.isArray(point) ? point : pointToVec3(point)))
        },
        color: (_context: any, props: any) => {
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
        maxPointSize: maxLimitPointSize
      },

      count: regl.prop('points.length')
    })
  }
}

export default function Points(props: Props) {
  return makePointsCommand(props)
}
