/**
 * regl-worldview 适配器
 * 提取 regl-worldview 的核心命令系统，适配 Vue 使用
 */
import type regl from 'regl'

/**
 * Grid 命令（基于 regl-worldview 的 Grid.js）
 */
export function createGridCommand(reglContext: regl.Regl): regl.DrawCommand {
  return reglContext({
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      attribute vec3 point;
      attribute vec4 color;
      varying vec4 fragColor;

      void main () {
        fragColor = color;
        vec3 p = point;
        gl_Position = projection * view * vec4(p, 1);
      }
    `,
    frag: `
      precision mediump float;
      varying vec4 fragColor;
      void main () {
        gl_FragColor = fragColor;
      }
    `,
    primitive: 'lines',
    attributes: {
      point: reglContext.prop<any, 'points'>('points'),
      color: reglContext.prop<any, 'colors'>('colors')
    },
    uniforms: {
      projection: reglContext.prop<any, 'projection'>('projection'),
      view: reglContext.prop<any, 'view'>('view')
    },
    count: reglContext.prop<any, 'count'>('count'),
    depth: {
      enable: false // 禁用深度测试，确保坐标轴始终可见
    },
  })
}

/**
 * Axes 命令（基于 regl-worldview 的 Axes.js）
 * 优化版本：使用外部传入的 buffer，避免重复创建
 */
export function createAxesCommand(reglContext: regl.Regl): regl.DrawCommand {
  return reglContext({
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      attribute vec3 point;
      attribute vec4 color;
      varying vec4 fragColor;

      void main () {
        fragColor = color;
        gl_Position = projection * view * vec4(point, 1);
      }
    `,
    frag: `
      precision mediump float;
      varying vec4 fragColor;
      void main () {
        gl_FragColor = fragColor;
      }
    `,
    primitive: 'lines',
    attributes: {
      point: reglContext.prop<any, 'points'>('points'),
      color: reglContext.prop<any, 'colors'>('colors')
    },
    uniforms: {
      projection: reglContext.prop<any, 'projection'>('projection'),
      view: reglContext.prop<any, 'view'>('view')
    },
    count: reglContext.prop<any, 'count'>('count'),
    depth: {
      enable: false // 禁用深度测试，确保坐标轴始终可见
    }
  })
}

/**
 * Points 命令（基于 regl-worldview 的 Points.js，优化版本）
 */
export function createPointsCommand(reglContext: regl.Regl): regl.DrawCommand {
  const [minLimitPointSize, maxLimitPointSize] = reglContext.limits.pointSizeDims

  return reglContext({
    primitive: 'points',
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      uniform float pointSize;
      uniform float viewportWidth;
      uniform float viewportHeight;
      uniform float minPointSize;
      uniform float maxPointSize;

      attribute vec3 point;
      attribute vec4 color;
      varying vec4 fragColor;
      
      void main () {
        gl_Position = projection * view * vec4(point, 1);
        fragColor = color;
        gl_PointSize = min(maxPointSize, max(minPointSize, pointSize));
      }
    `,
    frag: `
      precision mediump float;
      varying vec4 fragColor;
      
      void main () {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = fragColor.a * (1.0 - smoothstep(0.0, 0.5, dist));
        gl_FragColor = vec4(fragColor.rgb, alpha);
      }
    `,
    attributes: {
      point: reglContext.prop<any, 'points'>('points'),
      color: reglContext.prop<any, 'colors'>('colors')
    },
    uniforms: {
      projection: reglContext.prop<any, 'projection'>('projection'),
      view: reglContext.prop<any, 'view'>('view'),
      pointSize: reglContext.prop<any, 'pointSize'>('pointSize'),
      viewportWidth: reglContext.context('viewportWidth'),
      viewportHeight: reglContext.context('viewportHeight'),
      minPointSize: minLimitPointSize,
      maxPointSize: maxLimitPointSize
    },
    count: reglContext.prop<any, 'count'>('count'),
    depth: {
      enable: true,
      func: 'less',
      mask: true
    }
  })
}

/**
 * Lines 命令（基于 regl-worldview 的 Lines.js）
 */
export function createLinesCommand(reglContext: regl.Regl): regl.DrawCommand {
  return reglContext({
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      attribute vec3 point;
      attribute vec4 color;
      varying vec4 fragColor;

      void main () {
        fragColor = color;
        gl_Position = projection * view * vec4(point, 1);
      }
    `,
    frag: `
      precision mediump float;
      varying vec4 fragColor;
      void main () {
        gl_FragColor = fragColor;
      }
    `,
    primitive: 'line strip',
    attributes: {
      point: reglContext.prop<any, 'points'>('points'),
      color: reglContext.prop<any, 'colors'>('colors')
    },
    uniforms: {
      projection: reglContext.prop<any, 'projection'>('projection'),
      view: reglContext.prop<any, 'view'>('view')
    },
    count: reglContext.prop<any, 'count'>('count')
  })
}
