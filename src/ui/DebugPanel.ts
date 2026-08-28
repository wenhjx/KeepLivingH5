import Phaser from 'phaser';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import type { Player } from '../entities/Player';

/**
 * 调试面板
 * 支持快速添加武器/被动、调整等级/经验/血量/拾取范围
 * 按 ` 键（反引号）切换显示
 */
export class DebugPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible: boolean = false;
  private readonly panelWidth = 340;
  private readonly btnWidth = 152;
  private readonly btnHeight = 30;
  private readonly btnSpacing = 6;
  private readonly sectionSpacing = 10;
  private readonly padding = 12;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.create();
    this.setupHotkey();
  }

  private create(): void {
    const { width } = this.scene.scale;
    const x = width - this.panelWidth - 12;
    const y = 12;

    // 计算内容总高度
    let contentHeight = 0;
    const measure = (rows: number) => rows * (this.btnHeight + this.btnSpacing);

    // 标题
    contentHeight += 28;
    // 快捷操作：2行
    contentHeight += 20 + measure(2) + this.sectionSpacing;
    // 属性调整：2行
    contentHeight += 20 + measure(2) + this.sectionSpacing;
    // 武器：4行（8个武器 / 2列）
    contentHeight += 20 + measure(4) + this.sectionSpacing;
    // 被动：2行（4个 / 2列）
    contentHeight += 20 + measure(2);
    contentHeight += this.padding;

    const panelHeight = Math.min(contentHeight + this.padding, this.scene.scale.height - 24);

    // 半透明背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a0f, 0.94);
    bg.fillRoundedRect(x, y, this.panelWidth, panelHeight, 8);
    bg.lineStyle(2, 0xff6b35, 0.5);
    bg.strokeRoundedRect(x, y, this.panelWidth, panelHeight, 8);
    this.container.add(bg);

    // 标题
    const title = this.scene.add
      .text(x + this.panelWidth / 2, y + 14, '🔧 调试面板  (按 ` 切换)', {
        fontSize: '13px',
        color: '#ff6b35',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.container.add(title);

    // 内容区域
    let curY = y + 36;
    const col1X = x + this.padding;
    const col2X = x + this.padding + this.btnWidth + this.btnSpacing;

    // ===== 快捷操作 =====
    curY = this.addSectionTitle(col1X, curY, '⚡ 快捷操作');
    curY = this.addButton(col1X, curY, '❤️ 回满血', () => this.getPlayer()?.heal(9999));
    curY = this.addButton(col2X, curY - (this.btnHeight + this.btnSpacing), '⭐ +1 级', () => this.addLevel(1));
    curY = this.addButton(col1X, curY, '🌟 +5 级', () => this.addLevel(5));
    curY = this.addButton(col2X, curY - (this.btnHeight + this.btnSpacing), '💀 清空敌人', () => this.clearEnemies());

    curY += this.sectionSpacing;

    // ===== 属性调整 =====
    curY = this.addSectionTitle(col1X, curY, '📊 属性调整');
    curY = this.addButton(col1X, curY, '🧲 拾取+50', () => this.addPickupRadius(50));
    curY = this.addButton(col2X, curY - (this.btnHeight + this.btnSpacing), '🧲 拾取+200', () => this.addPickupRadius(200));
    curY = this.addButton(col1X, curY, '🧲 全屏拾取', () => this.setPickupRadius(9999));
    curY = this.addButton(col2X, curY - (this.btnHeight + this.btnSpacing), '📈 +1000 经验', () => this.addExp(1000));

    curY += this.sectionSpacing;

    // ===== 武器列表 =====
    curY = this.addSectionTitle(col1X, curY, '🔫 武器（点击添加/升级）');
    const weaponList = Object.values(WEAPONS);
    weaponList.forEach((weapon, i) => {
      const colX = i % 2 === 0 ? col1X : col2X;
      if (i % 2 === 0) {
        curY = this.addButton(colX, curY, weapon.name, () => {
          this.getPlayer()?.addWeapon(weapon as any);
        });
      } else {
        this.addButton(colX, curY - (this.btnHeight + this.btnSpacing), weapon.name, () => {
          this.getPlayer()?.addWeapon(weapon as any);
        });
      }
    });

    curY += this.sectionSpacing;

    // ===== 被动列表 =====
    curY = this.addSectionTitle(col1X, curY, '✨ 被动技能（点击添加/升级）');
    const passiveList = UPGRADE_OPTIONS.filter((o) => o.type === 'passive');
    passiveList.forEach((passive, i) => {
      const colX = i % 2 === 0 ? col1X : col2X;
      if (i % 2 === 0) {
        curY = this.addButton(colX, curY, `${passive.icon} ${passive.name}`, () => {
          this.getPlayer()?.addPassive(passive.id, passive.name, 5);
        });
      } else {
        this.addButton(colX, curY - (this.btnHeight + this.btnSpacing), `${passive.icon} ${passive.name}`, () => {
          this.getPlayer()?.addPassive(passive.id, passive.name, 5);
        });
      }
    });
  }

  /** 添加分区标题 */
  private addSectionTitle(x: number, y: number, text: string): number {
    const title = this.scene.add
      .text(x, y, text, {
        fontSize: '11px',
        color: '#ffb347',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    this.container.add(title);
    return y + 18;
  }

  /** 添加按钮 */
  private addButton(x: number, y: number, text: string, onClick: () => void): number {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x252530, 1);
    bg.fillRoundedRect(x, y, this.btnWidth, this.btnHeight, 4);
    bg.lineStyle(1, 0x444455, 0.6);
    bg.strokeRoundedRect(x, y, this.btnWidth, this.btnHeight, 4);

    const txt = this.scene.add
      .text(x + this.btnWidth / 2, y + this.btnHeight / 2, text, {
        fontSize: '11px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    const hitArea = this.scene.add
      .rectangle(x + this.btnWidth / 2, y + this.btnHeight / 2, this.btnWidth, this.btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x353555, 1);
      bg.fillRoundedRect(x, y, this.btnWidth, this.btnHeight, 4);
      bg.lineStyle(1, 0xff6b35, 0.8);
      bg.strokeRoundedRect(x, y, this.btnWidth, this.btnHeight, 4);
      txt.setColor('#ffffff');
    });
    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x252530, 1);
      bg.fillRoundedRect(x, y, this.btnWidth, this.btnHeight, 4);
      bg.lineStyle(1, 0x444455, 0.6);
      bg.strokeRoundedRect(x, y, this.btnWidth, this.btnHeight, 4);
      txt.setColor('#cccccc');
    });
    hitArea.on('pointerdown', onClick);

    this.container.add([bg, txt, hitArea]);
    return y + this.btnHeight + this.btnSpacing;
  }

  /** 设置快捷键 */
  private setupHotkey(): void {
    this.scene.input.keyboard?.on('keydown-BACKTICK', () => {
      this.toggle();
    });
  }

  /** 切换显示 */
  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }

  /** 获取玩家实例 */
  private getPlayer(): Player | null {
    const gameScene = this.scene.scene.get('GameScene') as any;
    return gameScene?.getPlayer?.() || null;
  }

  /** 增加等级 */
  private addLevel(count: number): void {
    const player = this.getPlayer();
    if (!player) return;
    for (let i = 0; i < count; i++) {
      (player as any).stats.exp = (player as any).stats.expToNext;
      (player as any).addExp(0);
    }
  }

  /** 增加经验 */
  private addExp(amount: number): void {
    this.getPlayer()?.addExp(amount);
  }

  /** 增加拾取范围 */
  private addPickupRadius(amount: number): void {
    this.getPlayer()?.modifyStat('pickupRadius', amount, false);
  }

  /** 设置拾取范围 */
  private setPickupRadius(value: number): void {
    const player = this.getPlayer();
    if (!player) return;
    (player as any).stats.pickupRadius = value;
  }

  /** 清空所有敌人 */
  private clearEnemies(): void {
    const gameScene = this.scene.scene.get('GameScene') as any;
    const enemies = gameScene?.getEnemies?.();
    if (!enemies) return;
    enemies.children.each((enemy: any) => {
      if (enemy.active) {
        enemy.takeDamage?.(99999, false);
      }
      return true;
    });
  }

  /** 显示/隐藏 */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.setVisible(visible);
  }

  /** 销毁 */
  destroy(): void {
    this.container.destroy();
  }
}
