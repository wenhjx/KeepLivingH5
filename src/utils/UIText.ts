import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';

/**
 * 创建带上下内边距的 UI 文本
 * Phaser 对中文字体的度量（metrics）偏小，导致字形顶部超出 Text 对象边界被裁剪
 * （表现为"汉字上方切割了一些像素"）。统一加上下 padding 修复。
 */
export function createUIText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style?: Phaser.Types.GameObjects.Text.TextStyle
): Phaser.GameObjects.Text {
  // 统一文字风格（用户选定的 D 样式）：默认叠加青色发光阴影，各处 color/字号保留。
  // 个别文字如需关闭阴影，显式传 shadow（如 { color:'#000000', blur:0, offsetX:0, offsetY:0 }）覆盖。
  const t = scene.add.text(x, y, text, {
    ...style,
    shadow: style?.shadow ?? { color: '#00ffff', blur: 6, offsetX: 0, offsetY: 2 },
  });
  t.setPadding({ top: 3, bottom: 3 });
  // 高清文字：文字内部按渲染倍率绘制（高分屏不糊）
  t.setResolution(Math.max(1, Math.ceil(GameConfig.renderScale)));
  // 文字纹理用 LINEAR 平滑采样——pixel 主题关闭全局抗锯齿（antialias=false），
  // 若文字也走最近邻会边缘发糊/锯齿；这里让文字独立保持"普通文字"的平滑观感。
  TextSmoothing.apply(t);
  return t;
}


/** 文字纹理平滑工具：让 UI 文字在像素主题下仍使用 LINEAR 采样（普通文字观感） */
export class TextSmoothing {
  static apply(t: Phaser.GameObjects.Text): void {
    const src = (t as any).frame?.source;
    if (src?.setFilter) src.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
