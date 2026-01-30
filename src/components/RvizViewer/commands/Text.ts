/**
 * Text 命令
 * 完全基于 regl-worldview 的 Text.js 实现
 * 使用 DOM 元素在 3D 空间中渲染文本
 */
import type { Point, CameraCommand, Dimensions, Color, Pose, Scale, Vec4 } from '../types'
import { getCSSColor, toColor } from './utils/commandUtils'

const BG_COLOR_LIGHT = '#ffffff'
const BG_COLOR_DARK = 'rgba(0,0,0,0.8)'
const BRIGHTNESS_THRESHOLD = 128
const DEFAULT_TEXT_COLOR: Color = { r: 1, g: 1, b: 1, a: 1 }
const DEFAULT_BG_COLOR: Color = { r: 0, g: 0, b: 0, a: 0.8 }

export type TextMarker = {
  name?: string
  pose: Pose
  scale: Scale
  color?: Color | Vec4
  colors?: (Color | Vec4)[]
  text: string
}

let cssHasBeenInserted = false
function insertGlobalCss() {
  if (cssHasBeenInserted) {
    return
  }
  const style = document.createElement('style')
  style.innerHTML = `
    .regl-worldview-text-wrapper {
      position: absolute;
      white-space: nowrap;
      z-index: 100;
      pointer-events: none;
      top: 0;
      left: 0;
      will-change: transform;
    }
    .regl-worldview-text-inner {
      position: relative;
      left: -50%;
      top: -0.5em;
      white-space: pre-line;
    }
  `
  if (document.body) {
    document.body.appendChild(style)
  }
  cssHasBeenInserted = true
}

export function isColorDark({ r, g, b }: Color): boolean {
  // ITU-R BT.709 https://en.wikipedia.org/wiki/Rec._709
  // 0.2126 * 255 * r + 0.7152 * 255 * g + 0.0722 * 255 * b
  const luma = 54.213 * r + 182.376 * g + 18.411 * b
  return luma < BRIGHTNESS_THRESHOLD
}

function isColorEqual(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && (a.a ?? 1) === (b.a ?? 1)
}

class TextElement {
  wrapper = document.createElement('span')
  _inner = document.createElement('span')
  _text = document.createTextNode('')
  // store prev colors to improve perf
  _prevTextColor: Color = DEFAULT_TEXT_COLOR
  _prevBgColor: Color | null = DEFAULT_BG_COLOR
  _prevAutoBackgroundColor: boolean | null = null

  constructor() {
    insertGlobalCss()
    this.wrapper.className = 'regl-worldview-text-wrapper'
    this._inner.className = 'regl-worldview-text-inner'
    this.wrapper.appendChild(this._inner)
    this._inner.appendChild(this._text)
    this.wrapper.style.color = getCSSColor(DEFAULT_TEXT_COLOR)
  }

  update(marker: TextMarker, left: number, top: number, autoBackgroundColor?: boolean) {
    this.wrapper.style.transform = `translate(${left.toFixed()}px,${top.toFixed()}px)`
    const { color, colors = [] } = marker
    const hasBgColor = colors.length >= 2
    const textColor = toColor(hasBgColor ? colors[0] : color || [0, 0, 0, 1])

    if (textColor) {
      const backgroundColor = colors[1] ? toColor(colors[1]) : null
      if (!isColorEqual(this._prevTextColor, textColor)) {
        this._prevTextColor = textColor
        this.wrapper.style.color = getCSSColor(textColor)
      }

      if (!autoBackgroundColor && autoBackgroundColor !== this._prevAutoBackgroundColor) {
        // remove background color if autoBackgroundColor has changed
        this._inner.style.background = 'transparent'
        this._prevBgColor = null
      } else {
        if (
          autoBackgroundColor &&
          (!this._prevBgColor || (this._prevBgColor && !isColorEqual(textColor, this._prevBgColor)))
        ) {
          // update background color with automatic dark/light color
          this._prevBgColor = textColor
          const isTextColorDark = isColorDark(textColor)
          const hexBgColor = isTextColorDark ? BG_COLOR_LIGHT : BG_COLOR_DARK
          this._inner.style.background = hexBgColor
        } else if (hasBgColor && backgroundColor && this._prevBgColor && !isColorEqual(backgroundColor, this._prevBgColor)) {
          // update background color with colors[1] data
          this._prevBgColor = backgroundColor
          this._inner.style.background = getCSSColor(backgroundColor)
        }
      }
    }
    this._prevAutoBackgroundColor = autoBackgroundColor ?? false

    if (this._text.textContent !== marker.text) {
      this._text.textContent = marker.text || ''
    }
  }
}

/**
 * Text 命令工厂函数
 * 返回一个 regl 命令，用于在 3D 场景中渲染文本
 */
export const makeTextCommand = () => (regl: Regl) => {
  return (props: any, isHitmap: boolean = false) => {
    // Text 命令不使用 regl 渲染，而是使用 DOM 元素
    // 实际的渲染逻辑在 WorldviewContext 的 paint 回调中处理
    // 这里只是占位，实际的文本渲染由 Text 组件处理
  }
}

export const text = (regl: Regl) => {
  return makeTextCommand()(regl)
}

export default function Text(props: { children: TextMarker[]; autoBackgroundColor?: boolean }) {
  return makeTextCommand()
}

// 导出 TextElement 类供外部使用
export { TextElement }
