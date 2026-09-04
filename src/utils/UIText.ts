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
  const t = scene.add.text(x, y, text, style);
  t.setPadding({ top: 3, bottom: 3 });
  // 高清文字：pixel 主题下全局 antialias=false（最近邻采样），UI 文字若按 1x 绘制会随
  // 相机 zoom 放大而发糊。这里让文字内部按渲染倍率绘制，保证"像素美术锐利、文字清晰"。
  t.setResolution(Math.max(1, Math.ceil(GameConfig.renderScale)));
  return t;
}
