import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';

/**
 * 通用选项卡片（升级三选一 / 神秘商店共用）
 *
 * 统一处理：稀有度边框、图标圆、名称、描述背景条、hover 高亮、点击回调。
 * 中文换行强制 useAdvancedWrap，避免无空格文本不换行导致溢出。
 */
export interface OptionCardConfig {
  name: string;
  icon: string;
  desc: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** 底部附加文字（如价格），不传则不显示 */
  footerText?: string;
  footerColor?: string;
  cardWidth?: number;
  cardHeight?: number;
  onClick?: () => void;
}

const RARITY_COLORS: Record<string, number> = {
  common: 0x888888,
  rare: 0x3399ff,
  epic: 0xaa44ff,
  legendary: 0xffaa00,
};

/** 中文文本样式：强制高级换行 + 居中对齐 */
function chineseTextStyle(
  fontSize: string,
  color: string,
  wrapWidth: number,
  extra?: Partial<Phaser.Types.GameObjects.Text.TextStyle>
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontSize,
    color,
    align: 'center',
    wordWrap: { width: wrapWidth, useAdvancedWrap: true },
    ...extra,
  };
}

/**
 * 创建一个选项卡片 Container
 * @returns 卡片容器，调用方可继续往里面 add 自定义元素（如"已售"标记）
 */
export function createOptionCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: OptionCardConfig
): Phaser.GameObjects.Container {
  const cardWidth = config.cardWidth ?? 200;
  const cardHeight = config.cardHeight ?? 280;
  const borderColor = RARITY_COLORS[config.rarity] ?? RARITY_COLORS.common;
  const borderColorHex = `#${borderColor.toString(16).padStart(6, '0')}`;

  const card = scene.add.container(x, y);

  // 卡片背景（可被 hover 重绘）
  const bg = scene.add.graphics();
  const drawBg = (fillColor: number) => {
    bg.clear();
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
    bg.lineStyle(3, borderColor, 1);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
  };
  drawBg(0x1a1a25);
  card.add(bg);

  // 稀有度标签
  const rarityLabel = createUIText(
    scene,
    0,
    -cardHeight / 2 + 20,
    config.rarity.toUpperCase(),
    { fontSize: '11px', color: borderColorHex, fontStyle: 'bold' }
  ).setOrigin(0.5);
  card.add(rarityLabel);

  // 图标圆底
  const iconBg = scene.add.graphics();
  iconBg.fillStyle(0x2a2a35, 1);
  iconBg.fillCircle(0, -cardHeight / 2 + 78, 34);
  card.add(iconBg);

  // 图标
  const iconText = createUIText(scene, 0, -cardHeight / 2 + 78, config.icon, {
    fontSize: '28px',
  }).setOrigin(0.5);
  card.add(iconText);

  // 名称
  const nameText = createUIText(
    scene,
    0,
    -cardHeight / 2 + 130,
    config.name,
    chineseTextStyle('18px', '#ffffff', cardWidth - 24, { fontStyle: 'bold' })
  ).setOrigin(0.5);
  card.add(nameText);

  // 描述背景条
  const descBoxH = 58;
  const descBoxW = cardWidth - 20;
  const descBoxY = -cardHeight / 2 + 178;
  const descBg = scene.add.graphics();
  descBg.fillStyle(0x000000, 0.35);
  descBg.fillRoundedRect(-descBoxW / 2, descBoxY - descBoxH / 2, descBoxW, descBoxH, 6);
  card.add(descBg);

  // 描述文字（背景条内垂直居中）
  const descText = createUIText(
    scene,
    0,
    descBoxY,
    config.desc,
    chineseTextStyle('12px', '#cccccc', descBoxW - 16)
  ).setOrigin(0.5);
  card.add(descText);

  // 底部附加文字（价格等）
  if (config.footerText) {
    const footerText = createUIText(
      scene,
      0,
      cardHeight / 2 - 34,
      config.footerText,
      { fontSize: '20px', color: config.footerColor ?? '#ffcc00', fontStyle: 'bold' }
    ).setOrigin(0.5);
    card.add(footerText);
  }

  // 交互区域
  const hitArea = scene.add
    .rectangle(0, 0, cardWidth, cardHeight, 0xffffff, 0)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  card.add(hitArea);

  hitArea.on('pointerover', () => drawBg(0x2a2a40));
  hitArea.on('pointerout', () => drawBg(0x1a1a25));
  if (config.onClick) {
    hitArea.on('pointerdown', config.onClick);
  }

  return card;
}
