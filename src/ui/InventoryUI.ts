import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { EventBus, EventKeys } from '../utils/EventBus';
import { USABLE_ITEMS, INVENTORY_ORDER } from '../data/items';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import type { Player } from '../entities/Player';
import { Layers } from '../constants/Layers';

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
  // 复活币指示器（被动消耗品，仅展示剩余数量）
  private reviveGroup: Phaser.GameObjects.Container | null = null;
  private reviveCount: Phaser.GameObjects.Text | null = null;
  // 槽位命中矩形（uiRoot 局部坐标 = pointer.x/y），手动坐标判定用
  private slotHitRects: Array<{ index: number; x: number; y: number }> = [];
  private pointerDownHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;

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
    this.container = scene.add.container(0, 0).setDepth(Layers.INVENTORY);
    parent.add(this.container);

    // 4 个固定槽位（从右往左排列在右下角，避开 HUD 区域）
    // 注意：加入 uiRoot 的组件须用 scene.scale（渲染尺寸）坐标，逻辑 960 尺寸会偏移到中央。
    // 布局公式按 uiRoot 实际变换推导：世界 = rootPos + 局部×(u/z)，rootPos=(S/2)(1-u/z)，
    // 屏幕 = 世界×z = (S/2)(z-u) + 局部×u（S=画布尺寸，z=renderScale，u=uiScale）。
    // 故贴边目标：局部 = [目标屏幕 - (S/2)(z-u)]/u。
    // 不能用 GameConfig.anchorX/Y（其公式假设纯 uiScale 中心缩放，与 uiRoot 的 u/z 变换
    // 不匹配），移动端 uiScale>1 时槽位会被推出画布底部（2026-09-15 实测 y=899>853）。
    const { width, height } = this.scene.scale;
    const us = GameConfig.uiScale;
    const z = GameConfig.renderScale;
    const slotW = this.slotSize * us;
    const rightScreenX = width - 12 - slotW / 2;
    const bottomScreenY = height - 12 - slotW / 2;
    const startX =
      (rightScreenX - (width / 2) * (z - us) - (INVENTORY_ORDER.length - 1) * (this.slotSize + this.slotSpacing)) /
      us;
    const y = (bottomScreenY - (height / 2) * (z - us)) / us;

    // 点击判定采用手动坐标检测：先把指针世界坐标转成容器局部坐标再比对，
    // 彻底规避嵌套 Container + 父级 scale（uiRoot）时 setInteractive hitArea
    // 命中偏移（曾导致点击区域整体偏上一个槽位高度）。
    // 注意：不能直接用 pointer.x/y 与局部坐标比对——uiScale≠renderScale 时
    // 容器局部坐标 ≠ 屏幕坐标，移动端会整体错位（2026-09-15 实测）。
    this.pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
      // 指针世界坐标 → 容器局部坐标（考虑 uiRoot 位置/scale 与相机变换）
      const out = new Phaser.Math.Vector2();
      this.container.getWorldTransformMatrix().applyInverse(pointer.worldX, pointer.worldY, out);
      for (const r of this.slotHitRects) {
        if (
          out.x >= r.x &&
          out.x <= r.x + this.slotSize &&
          out.y >= r.y &&
          out.y <= r.y + this.slotSize
        ) {
          this.useSlot(r.index);
          return;
        }
      }
    };
    scene.input.on('pointerdown', this.pointerDownHandler);

    INVENTORY_ORDER.forEach((itemId, index) => {
      const x = startX + index * (this.slotSize + this.slotSpacing);
      this.createSlot(x, y, itemId, index);
    });

    // 复活币指示器（物品栏最右槽上方，0 个时隐藏）
    this.createReviveIndicator(startX, y);

    // 监听物品栏变化（保存退订函数，场景关闭时移除，避免残留监听访问已销毁对象导致 texture null 崩溃）
    this.unsubscribe = EventBus.on(EventKeys.PLAYER_INVENTORY_CHANGED, () => this.refresh());
    // 创建时同步一次玩家当前状态：继续游戏/跨关继承的恢复发生在 UIScene 创建前，
    // 那时的 INVENTORY_CHANGED 事件无人接收会丢失，这里兜底保证物品栏与复活币指示器首帧即正确。
    this.refresh();

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
    const icon = createUIText(this.scene, 0, 0, item.icon, { fontSize: this.iconSize }).setOrigin(0.5).setAlpha(0.3);

    // 数量角标
    const count = createUIText(this.scene, this.slotSize / 2 - 4, -this.slotSize / 2 + 4, '', {
      fontSize: this.countSize,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0);

    // 快捷键提示
    const key = createUIText(this.scene, -this.slotSize / 2 + 4, -this.slotSize / 2 + 2, `${index + 1}`, {
      fontSize: this.keySize,
      color: '#888888',
    }).setOrigin(0, 0);

    const slotContainer = this.scene.add.container(x, y);
    slotContainer.add([bg, icon, count, key]);
    // 注意：不再对槽位 Container setInteractive——嵌套 Container + 父级 scale（uiRoot）
    // 的 hitArea 会命中偏移，点击区域整体偏上。改为全局 pointerdown 手动坐标判定
    // （见 constructor 的 pointerDownHandler / slotHitRects）。
    this.slotHitRects.push({ index, x: x - this.slotSize / 2, y: y - this.slotSize / 2 });

    this.container.add(slotContainer);
    this.slots.push({ bg, icon, count, key, itemId });
  }

  /** 复活币指示器（🌟 传说消耗品，死亡时原地满血复活；仅展示剩余数量，0 个隐藏） */
  private createReviveIndicator(anchorX: number, anchorY: number): void {
    const isM = GameManager.getInstance().isMobile;
    const barH = isM ? 26 : 22;
    const iconSize = isM ? '16px' : '15px';
    const y = anchorY - this.slotSize - 8;
    const rbg = this.scene.add.graphics();
    rbg.fillStyle(0x1a1a25, 0.8);
    rbg.fillRoundedRect(-this.slotSize / 2, -barH / 2, this.slotSize, barH, 6);
    rbg.lineStyle(1, 0xffd700, 0.9);
    rbg.strokeRoundedRect(-this.slotSize / 2, -barH / 2, this.slotSize, barH, 6);
    const icon = createUIText(this.scene, -this.slotSize / 2 + 14, 0, '🌟', { fontSize: iconSize }).setOrigin(0.5);
    const count = createUIText(this.scene, this.slotSize / 2 - 6, 0, '', {
      fontSize: this.countSize,
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0.5);
    const group = this.scene.add.container(anchorX, y);
    group.add([rbg, icon, count]);
    group.setVisible(false);
    this.container.add(group);
    this.reviveGroup = group;
    this.reviveCount = count;
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

    // 复活币剩余数量（0 隐藏；复用物品栏刷新事件）
    if (this.reviveGroup && this.reviveCount && this.reviveGroup.scene && this.reviveGroup.active) {
      const rt = player?.getReviveTokens() ?? 0;
      if (rt > 0) {
        this.reviveGroup.setVisible(true);
        this.reviveCount.setText('×' + rt);
      } else {
        this.reviveGroup.setVisible(false);
      }
    }
  }

  destroy(): void {
    this.unsubscribe();
    if (this.pointerDownHandler) {
      this.scene.input.off('pointerdown', this.pointerDownHandler);
      this.pointerDownHandler = null;
    }
    this.slotHitRects = [];
    this.container.destroy();
  }
}
