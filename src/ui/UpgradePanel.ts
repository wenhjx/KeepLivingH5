import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import type { UpgradeOption } from '../types';
import { UPGRADE_OPTIONS } from '../data/upgrades';

/**
 * 升级选择面板
 * 玩家升级时弹出，提供3个随机升级选项
 */
export class UpgradePanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private options: UpgradeOption[] = [];
  private onSelectCallback: ((option: UpgradeOption) => void) | null = null;

  private readonly cardWidth = 200;
  private readonly cardHeight = 260;
  private readonly cardSpacing = 30;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);

    // 半透明遮罩
    this.overlay = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    this.container.add(this.overlay);

    // 标题
    const title = createUIText(scene, scene.scale.width / 2, 80, '选择升级', {
        fontSize: '36px',
        color: '#ffb347',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.container.add(title);
  }

  /**
   * 显示升级面板
   * @param onSelect 选择回调
   * @param availableOptions 可选升级列表（默认从全部中随机）
   */
  show(onSelect: (option: UpgradeOption) => void, availableOptions?: UpgradeOption[]): void {
    this.onSelectCallback = onSelect;
    this.container.setVisible(true);

    // 随机选择3个选项
    const pool = availableOptions || UPGRADE_OPTIONS;
    this.options = this.shuffle([...pool]).slice(0, 3);

    this.renderOptions();
  }

  /** 隐藏面板 */
  hide(): void {
    this.container.setVisible(false);
    this.onSelectCallback = null;
  }

  /** 渲染选项卡片 */
  private renderOptions(): void {
    // 清除旧卡片
    this.container.list
      .filter((obj) => obj.getData('isUpgradeCard'))
      .forEach((obj) => obj.destroy());

    const { width } = this.scene.scale;
    const totalWidth = this.options.length * this.cardWidth + (this.options.length - 1) * this.cardSpacing;
    const startX = (width - totalWidth) / 2 + this.cardWidth / 2;
    const cardY = this.scene.scale.height / 2;

    this.options.forEach((option, index) => {
      const x = startX + index * (this.cardWidth + this.cardSpacing);
      this.createCard(x, cardY, option, index);
    });
  }

  /** 创建单个升级卡片 */
  private createCard(x: number, y: number, option: UpgradeOption, index: number): void {
    const cardContainer = this.scene.add.container(x, y).setData('isUpgradeCard', true);

    // 卡片背景
    const bg = this.scene.add.graphics();
    const rarityColors: Record<string, number> = {
      common: 0x444444,
      rare: 0x4488ff,
      epic: 0xaa44ff,
      legendary: 0xffaa00,
    };
    const borderColor = rarityColors[option.rarity] || 0x444444;

    bg.fillStyle(0x1a1a25, 1);
    bg.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    bg.lineStyle(3, borderColor, 1);
    bg.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    cardContainer.add(bg);

    // 稀有度标签
    const rarityText = createUIText(this.scene, 0, -this.cardHeight / 2 + 20, option.rarity.toUpperCase(), {
        fontSize: '12px',
        color: `#${borderColor.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    cardContainer.add(rarityText);

    // 图标区域（占位）
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(0x2a2a35, 1);
    iconBg.fillCircle(0, -40, 35);
    cardContainer.add(iconBg);

    const iconText = createUIText(this.scene, 0, -40, option.icon, {
        fontSize: '28px',
      })
      .setOrigin(0.5);
    cardContainer.add(iconText);

    // 名称
    const nameText = createUIText(this.scene, 0, 10, option.name, {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: this.cardWidth - 20 },
      })
      .setOrigin(0.5);
    cardContainer.add(nameText);

    // 描述
    const descText = createUIText(this.scene, 0, 50, option.description, {
        fontSize: '12px',
        color: '#aaaaaa',
        align: 'center',
        wordWrap: { width: this.cardWidth - 30 },
      })
      .setOrigin(0.5, 0);
    cardContainer.add(descText);

    // 交互区域
    const hitArea = this.scene.add
      .rectangle(0, 0, this.cardWidth, this.cardHeight, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cardContainer.add(hitArea);

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x2a2a40, 1);
      bg.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
      bg.lineStyle(3, borderColor, 1);
      bg.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x1a1a25, 1);
      bg.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
      bg.lineStyle(3, borderColor, 1);
      bg.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    });

    hitArea.on('pointerdown', () => {
      this.selectOption(option);
    });

    this.container.add(cardContainer);
  }

  /** 选择升级 */
  private selectOption(option: UpgradeOption): void {
    if (this.onSelectCallback) {
      this.onSelectCallback(option);
    }
    this.hide();
  }

  /** 洗牌算法 */
  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /** 是否显示中 */
  isVisible(): boolean {
    return this.container.visible;
  }

  /** 销毁 */
  destroy(): void {
    this.container.destroy();
  }
}
