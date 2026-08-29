import Phaser from 'phaser';

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
  return t;
}
