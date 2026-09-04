import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';
import { USABLE_ITEMS, INVENTORY_ORDER } from '../data/items';
import { GameManager } from '../game/GameManager';
import type { Player } from '../entities/Player';

/**
 * 物品栏 UI
 * 显示玩家持有的可主动使用消耗品，点击或按 1-4 快捷键使用
 * 固定 4 槽位，空槽位半透明占位
 */
export class InventoryUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private slotSize = 46;
  private slotSpacing = 8;
  private iconSize = '22px';
  private countSize = '12px';
  private keySize = '10px';
  private slots: Array<{
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Text;
    count: Phaser.GameObjects.Text;
    key: Phaser.GameObjects.Text;
    itemId: string;
  }> = [];
  private unsubscribe: () => void = () => {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // 移动端放大触控目标（手机手指精度低，默认 46px 太小容易点错）
    const gm = GameManager.getInstance();
    if (gm.isMobile) {
      this.slotSize = 62;
      this.slotSpacing = 10;
      this.iconSize = '30px';
      this.countSize = '16px';
      this.keySize = '13px';
    }

    // 加入 UIScene 的反向缩放根容器（uiRoot），保证 960x640 逻辑坐标下视觉位置正确，
    // 否则相机 zoom 后定位会偏移（曾导致物品栏跑到屏幕中央）
    const parent = (scene as any).uiRoot || scene;
    this.container = scene.add.container(0, 0).setDepth(150);
    parent.add(this.container);

    // 4 个固定槽位（从右往左排列在右下角，避开 HUD 区域）
    // 注意：加入 uiRoot 的组件须用 scene.scale（渲染尺寸）坐标，逻辑 960 尺寸会偏移到中央
    const { width, height } = this.scene.scale;
    const totalWidth = INVENTORY_ORDER.length * this.slotSize + (INVENTORY_ORDER.length - 1) * this.slotSpacing;
    const startX = width - 12 - totalWidth + this.slotSize / 2;
    const y = height - 12 - this.slotSize / 2;

    INVENTORY_ORDER.forEach((itemId, index) => {
      const x = startX + index * (this.slotSize + this.slotSpacing);
      this.createSlot(x, y, itemId, index);
    });

    // 监听物品栏变化（保存退订函数，场景关闭时移除，避免残留监听访问已销毁对象导致 texture null 崩溃）
    this.unsubscribe = EventBus.on('player:inventoryChanged', () => this.refresh());

    // 快捷键 1-6（物品栏槽位数）
    const keys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
    keys.forEach((key, index) => {
      if (index >= INVENTORY_ORDER.length) return;
      scene.input.keyboard?.on(`keydown-${key}`, () => this.useSlot(index));
    });
  }

  private createSlot(x: number, y: number, itemId: string, index: number): void {
    const item = USABLE_ITEMS[itemId];

    // 槽位背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a25, 0.7);
    bg.fillRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 6);
    bg.lineStyle(2, item.color, 0.5);
    bg.strokeRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 6);

    // 图标（空时灰色）
    const icon = createUIText(this.scene, 0, 0, item.icon, { fontSize: this.iconSize })
      .setOrigin(0.5)
      .setAlpha(0.3);

    // 数量角标
    const count = createUIText(this.scene, this.slotSize / 2 - 4, -this.slotSize / 2 + 4, '', {
        fontSize: this.countSize,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0);

    // 快捷键提示
    const key = createUIText(this.scene, -this.slotSize / 2 + 4, -this.slotSize / 2 + 2, `${index + 1}`, {
        fontSize: this.keySize,
        color: '#888888',
      })
      .setOrigin(0, 0);

    const slotContainer = this.scene.add.container(x, y);
    slotContainer.add([bg, icon, count, key]);
    slotContainer.setSize(this.slotSize, this.slotSize);
    // 显式 hitArea：以容器原点（槽位中心）为基准的对称矩形，与视觉背景完全对齐。
    // Container 默认 hitArea 为 Rectangle(0,0,w,h)，从原点向右下展开，会让命中区偏离视觉半格
    slotContainer.setInteractive(
      new Phaser.Geom.Rectangle(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize),
      Phaser.Geom.Rectangle.Contains
    );
    if (slotContainer.input) slotContainer.input.cursor = 'pointer';
    slotContainer.on('pointerdown', () => this.useSlot(index));

    this.container.add(slotContainer);
    this.slots.push({ bg, icon, count, key, itemId });
  }

  /** 使用指定槽位的物品 */
  private useSlot(index: number): void {
    const slot = this.slots[index];
    if (!slot) return;
    const player = this.getPlayer();
    if (!player) return;
    player.useItem(slot.itemId, this.scene.scene.get('GameScene'));
  }

  private getPlayer(): Player | undefined {
    return (this.scene.scene.get('GameScene') as any)?.getPlayer?.() as Player | undefined;
  }

  /** 刷新所有槽位显示 */
  refresh(): void {
    const player = this.getPlayer();
    this.slots.forEach((slot) => {
      // 场景已关闭/Text 已销毁时不再刷新（texture 可能已释放为 null，setText 会崩溃）
      if (!slot.icon.scene || !slot.icon.active || !slot.count.scene || !slot.count.active) return;
      const count = player?.getItemCount(slot.itemId) ?? 0;
      if (count > 0) {
        slot.icon.setAlpha(1);
        slot.count.setText(count > 1 ? `${count}` : '');
        // 高亮边框
        slot.bg.clear();
        const item = USABLE_ITEMS[slot.itemId];
        slot.bg.fillStyle(0x1a1a25, 0.9);
        slot.bg.fillRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 6);
        slot.bg.lineStyle(2, item.color, 1);
        slot.bg.strokeRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 6);
      } else {
        slot.icon.setAlpha(0.25);
        slot.count.setText('');
        // 灰色边框
        slot.bg.clear();
        const item = USABLE_ITEMS[slot.itemId];
        slot.bg.fillStyle(0x1a1a25, 0.5);
        slot.bg.fillRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 6);
        slot.bg.lineStyle(2, item.color, 0.3);
        slot.bg.strokeRoundedRect(-this.slotSize / 2, -this.slotSize / 2, this.slotSize, this.slotSize, 6);
      }
    });
  }

  destroy(): void {
    this.unsubscribe();
    this.container.destroy();
  }
}
