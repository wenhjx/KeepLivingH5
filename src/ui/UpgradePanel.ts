import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import type { UpgradeOption } from '../types';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { GameConfig } from '../game/GameConfig';
import { createOptionCard } from './OptionCard';

/**
 * 升级选择面板
 * 玩家升级时弹出，提供3个随机升级选项
 * 交互：点击卡片选中（高亮）→ 点击"确认选择"按钮生效
 * AI 托管：自动选中最优选项，卡片底部显示"即将选择..."，延迟后自动确认
 */
export class UpgradePanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private options: UpgradeOption[] = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private onSelectCallback: ((option: UpgradeOption) => void) | null = null;
  private selectedIndex = -1;
  private confirmBtn: { bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Rectangle } | null = null;

  private readonly cardWidth = 200;
  private readonly cardHeight = 280;
  private readonly cardSpacing = 30;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false);

    // 半透明遮罩
    this.overlay = scene.add
      .rectangle(0, 0, GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    this.container.add(this.overlay);
  }

  /**
   * 显示升级面板
   * @param onSelect 选择回调
   * @param availableOptions 可选升级列表（默认从全部中随机）
   */
  show(onSelect: (option: UpgradeOption) => void, availableOptions?: UpgradeOption[]): void {
    this.onSelectCallback = onSelect;
    this.selectedIndex = -1;
    this.container.setVisible(true);

    // 随机选择3个选项
    const pool = availableOptions || UPGRADE_OPTIONS;
    this.options = this.shuffle([...pool]).slice(0, 3);

    this.renderOptions();
    this.renderConfirmButton();
  }

  /** 隐藏面板 */
  hide(): void {
    this.container.setVisible(false);
    this.onSelectCallback = null;
    this.selectedIndex = -1;
  }

  /** 获取当前显示的3个选项（AI 自动选择时必须从这里选） */
  getOptions(): UpgradeOption[] {
    return this.options;
  }

  /** 当前选中的选项索引（-1 表示未选中） */
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * 选中指定索引的卡片（玩家点击或 AI 自动选中）
   * @param index 选项索引
   * @param auto 是否为 AI 自动选中（true 时卡片底部显示"即将选择..."）
   */
  setSelectedIndex(index: number, auto: boolean = false): void {
    if (index < 0 || index >= this.options.length) return;
    this.selectedIndex = index;
    this.refreshCardHighlights();
    this.updateConfirmButton();

    // AI 自动选中时，在卡片底部显示"即将选择..."
    this.cardContainers.forEach((card, i) => {
      const existing = card.getData('autoLabel');
      if (existing) existing.destroy();
      if (i === index && auto) {
        const label = createUIText(this.scene, 0, this.cardHeight / 2 - 20, '即将选择...', {
            fontSize: '13px',
            color: '#66ff99',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
        card.add(label);
        card.setData('autoLabel', label);
      }
    });
  }

  /** 确认当前选中的选项（玩家点确认按钮或 AI 自动确认） */
  confirmSelection(): void {
    if (this.selectedIndex < 0) return;
    const option = this.options[this.selectedIndex];
    if (this.onSelectCallback) {
      this.onSelectCallback(option);
    }
    this.hide();
  }

  /** 渲染选项卡片 */
  private renderOptions(): void {
    // 清除旧卡片
    this.container.list
      .filter((obj) => obj.getData('isUpgradeCard'))
      .forEach((obj) => obj.destroy());
    this.cardContainers = [];

    const width = GameConfig.GAME_WIDTH;
    const totalWidth = this.options.length * this.cardWidth + (this.options.length - 1) * this.cardSpacing;
    const startX = (width - totalWidth) / 2 + this.cardWidth / 2;
    const cardY = GameConfig.GAME_HEIGHT / 2 - 10;

    this.options.forEach((option, index) => {
      const x = startX + index * (this.cardWidth + this.cardSpacing);
      const card = createOptionCard(this.scene, x, cardY, {
        name: option.name,
        icon: option.icon,
        desc: option.description,
        rarity: option.rarity as 'common' | 'rare' | 'epic' | 'legendary',
        cardWidth: this.cardWidth,
        cardHeight: this.cardHeight,
        onClick: () => this.setSelectedIndex(index, false),
      });
      card.setData('isUpgradeCard', true);
      this.container.add(card);
      this.cardContainers.push(card);
    });
  }

  /** 刷新所有卡片的选中高亮 */
  private refreshCardHighlights(): void {
    this.cardContainers.forEach((card, i) => {
      // 清除旧高亮
      const oldHighlight = card.getData('highlight');
      if (oldHighlight) oldHighlight.destroy();

      if (i === this.selectedIndex) {
        // 选中：加一个绿色高亮外框 + 轻微放大
        const hl = this.scene.add.graphics();
        hl.lineStyle(4, 0x66ff99, 1);
        hl.strokeRoundedRect(-this.cardWidth / 2 - 3, -this.cardHeight / 2 - 3, this.cardWidth + 6, this.cardHeight + 6, 14);
        card.add(hl);
        card.setData('highlight', hl);
        card.setScale(1.05);
      } else {
        card.setScale(1);
      }
    });
  }

  /** 渲染底部确认按钮 */
  private renderConfirmButton(): void {
    // 清除旧按钮
    if (this.confirmBtn) {
      this.confirmBtn.bg.destroy();
      this.confirmBtn.txt.destroy();
      this.confirmBtn.hit.destroy();
    }

    const btnWidth = 200;
    const btnHeight = 44;
    const x = GameConfig.GAME_WIDTH / 2;
    const y = GameConfig.GAME_HEIGHT - 60;

    const bg = this.scene.add.graphics();
    const txt = createUIText(this.scene, x, y, '请先选择一项升级', {
        fontSize: '18px',
        color: '#666666',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const hit = this.scene.add
      .rectangle(x, y, btnWidth, btnHeight, 0xffffff, 0)
      .setOrigin(0.5);

    const drawBtn = (enabled: boolean) => {
      bg.clear();
      bg.fillStyle(enabled ? 0x2a6a4a : 0x252530, 1);
      bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8);
      bg.lineStyle(2, enabled ? 0x66ff99 : 0x444455, 0.8);
      bg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8);
      txt.setColor(enabled ? '#ffffff' : '#666666');
      txt.setText(enabled ? '✓ 确认选择' : '请先选择一项升级');
    };
    drawBtn(false);

    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      if (this.selectedIndex >= 0) {
        bg.clear();
        bg.fillStyle(0x3a8a5a, 1);
        bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8);
        bg.lineStyle(2, 0x88ffbb, 1);
        bg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8);
      }
    });
    hit.on('pointerout', () => drawBtn(this.selectedIndex >= 0));
    hit.on('pointerdown', () => {
      if (this.selectedIndex >= 0) this.confirmSelection();
    });

    this.container.add([bg, txt, hit]);
    this.confirmBtn = { bg, txt, hit };
  }

  /** 更新确认按钮状态 */
  private updateConfirmButton(): void {
    if (!this.confirmBtn) return;
    const enabled = this.selectedIndex >= 0;
    const { bg, txt, hit } = this.confirmBtn;
    const btnWidth = 200;
    const btnHeight = 44;
    const x = GameConfig.GAME_WIDTH / 2;
    const y = GameConfig.GAME_HEIGHT - 60;

    bg.clear();
    bg.fillStyle(enabled ? 0x2a6a4a : 0x252530, 1);
    bg.fillRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8);
    bg.lineStyle(2, enabled ? 0x66ff99 : 0x444455, 0.8);
    bg.strokeRoundedRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 8);
    txt.setColor(enabled ? '#ffffff' : '#666666');
    txt.setText(enabled ? '✓ 确认选择' : '请先选择一项升级');
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
