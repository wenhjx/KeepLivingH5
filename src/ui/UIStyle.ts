import Phaser from 'phaser';
import { createUIText } from '../utils/UIText';
import { AudioManager } from '../systems/AudioManager';
import { SOUND_KEYS } from '../data/sounds';

/**
 * 全局 UI 风格令牌（2026-09-13 定稿）
 * 约束主菜单 / 选角 / 选关 / 图鉴等「菜单类场景」的视觉一致性。
 * 设计原则：
 *  1. 唯一强调色：橙色 #ff6b35（标题、选中、hover、描边）
 *  2. 场景背景统一为深空蓝黑；面板统一为 0x16161f + 2px 橙色描边 + 圆角 14
 *  3. 文字三级灰度：主 #e0e0e0 / 次 #8a8a99 / 弱 #666677
 *  4. 按钮两档：场景按钮（24px 大）/ 通用按钮（18px）+ 面板内按钮（20px 亮底）
 *  5. 标题字号固定：场景 34 / 面板 28 / 区块 16
 * 新场景一律引用本文件，禁止散落魔法颜色/字号。
 */

/** 颜色令牌 */
export const UIColors = {
  // 背景（十六进制，用于 graphics.fillStyle）
  sceneBg: 0x0a0a12, // 场景背景：深空蓝黑
  sceneBgAlt: 0x0a0a14, // 图鉴/情报类更深背景
  panel: 0x16161f, // 面板底
  card: 0x1a1a28, // 卡片 / 列表格底
  cardHover: 0x23233a, // 卡片 hover
  cardActive: 0x2a2a45, // 卡片选中
  cardBorder: 0x333355, // 卡片描边
  accentDim: 0xff6b35, // 强调橙（十六进制）
  btnBgHex: 0x1a1a25, // 按钮底（十六进制）
  btnPanelBg: '#252530', // 面板内按钮亮底（选关/设置行按钮）
  btnLockedBg: '#1a1a22', // 锁定按钮底
  btnBlueBg: '#1a1a35', // 图鉴/信息类入口蓝调深底
  // 文字/按钮（CSS 字符串，用于 Text style）
  accent: '#ff6b35', // 强调橙
  accentSoft: '#ff9a6b', // 强调橙浅（被动描述等）
  accentBg: 'rgba(255,107,53,0.15)', // 强调色淡底
  text: '#e0e0e0', // 主文字
  textBright: '#ffffff', // 亮文字（标题/数值强调）
  textDim: '#8a8a99', // 次级文字
  textFaint: '#666677', // 弱化文字（版权/版本）
  green: '#7ee0a0', // 增益/正数值
  blue: '#6bd5ff', // 信息/系别
  gold: '#ffd700', // 徽章/Boss 标签
  red: '#ff6b6b', // 减益/危险
} as const;

/** 字号令牌 */
export const UIFonts = {
  titleXL: '56px', // 主菜单大标题
  titleL: '34px', // 场景标题
  titleM: '28px', // 面板标题
  titleS: '22px', // 次级标题
  body: '18px', // 按钮/正文
  label: '16px', // 行标签/设置项/小型按钮
  desc: '15px', // 说明文字
  small: '13px', // 小字
  tiny: '12px', // 微字
} as const;

/** 通用按钮配置（可选覆盖） */
export interface UIButtonOptions {
  fontSize?: string;
  bg?: string;
  bgHover?: string;
  color?: string;
  colorHover?: string;
  padding?: { left: number; right: number; top: number; bottom: number };
}

/**
 * 标准场景标题：34px 加粗强调橙 + 黑描边 + 发光（与主菜单大标题同族）
 */
export function createSceneTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string
): Phaser.GameObjects.Text {
  return createUIText(scene, x, y, text, {
    fontSize: UIFonts.titleL,
    color: UIColors.accent,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5);
}

/**
 * 标准返回按钮：左上角，'← 返回'，通用按钮样式
 */
export function createBackButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onBack: () => void
): Phaser.GameObjects.Text {
  const btn = createUIButton(scene, x, y, '← 返回', onBack, {
    fontSize: UIFonts.body,
    padding: { left: 16, right: 16, top: 8, bottom: 8 },
  });
  btn.setOrigin(0.5);
  return btn;
}

/**
 * 标准按钮：深底 + hover 变橙字亮底 + 点击音效 + 按下缩放反馈
 * 默认 18px 通用档；主菜单大按钮传 fontSize: '24px' 与更宽 padding。
 */
export function createUIButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  callback: () => void,
  options: UIButtonOptions = {}
): Phaser.GameObjects.Text {
  const {
    fontSize = UIFonts.body,
    bg = '#1a1a25',
    bgHover = '#2a2a35',
    color = UIColors.text,
    colorHover = UIColors.accent,
    padding = { left: 40, right: 40, top: 12, bottom: 12 },
  } = options;
  const btn = createUIText(scene, x, y, text, {
    fontSize,
    color,
    backgroundColor: bg,
    padding,
  }).setOrigin(0.5);
  btn.setInteractive({ useHandCursor: true });
  btn.on('pointerdown', () => {
    scene.tweens.add({ targets: btn, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true });
  });
  btn.on('pointerover', () => btn.setStyle({ color: colorHover, backgroundColor: bgHover }));
  btn.on('pointerout', () => btn.setStyle({ color, backgroundColor: bg }));
  btn.on('pointerdown', () => {
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
    callback();
  });
  return btn;
}

/**
 * 标准面板：深底圆角 + 2px 橙色描边（alpha 0.4）+ 可选半透明遮罩
 * 返回 graphics；所有菜单/情报类场景统一用此函数绘制面板。
 */
export function createUIPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 14
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(UIColors.panel, 0.98);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, UIColors.accentDim, 0.4);
  g.strokeRoundedRect(x, y, w, h, radius);
  return g;
}

/** 标准选项卡文本（active 橙色加粗 / inactive 灰） */
export function styleTab(btn: Phaser.GameObjects.Text, active: boolean): void {
  btn.setStyle(active ? { color: UIColors.accent, fontStyle: 'bold' } : { color: '#8a8a99', fontStyle: 'normal' });
}
