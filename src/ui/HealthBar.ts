import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';

/**
 * 血条组件
 * 可用于敌人、Boss 等实体头顶显示血量
 */
export class HealthBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bgBar: Phaser.GameObjects.Graphics;
  private fillBar: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;

  private currentHealth: number = 100;
  private maxHealth: number = 100;
  private showText: boolean;
  private textObj?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number = 60,
    height: number = 6,
    showText: boolean = false
  ) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.showText = showText;

    this.container = scene.add.container(x, y);

    // 背景
    this.bgBar = scene.add.graphics();
    this.bgBar.fillStyle(0x000000, 0.6);
    this.bgBar.fillRoundedRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2, 2);
    this.container.add(this.bgBar);

    // 血量填充
    this.fillBar = scene.add.graphics();
    this.container.add(this.fillBar);

    // 文字
    if (showText) {
      this.textObj = createUIText(scene, 0, 0, '', {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.container.add(this.textObj);
    }

    this.updateBar();
  }

  /** 设置血量 */
  setHealth(current: number, max?: number): void {
    this.currentHealth = Math.max(0, current);
    if (max !== undefined) {
      this.maxHealth = max;
    }
    this.updateBar();
  }

  /** 更新显示 */
  private updateBar(): void {
    const percent = this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 0;

    this.fillBar.clear();

    // 颜色渐变
    let color = 0x44ff44;
    if (percent < 0.3) color = 0xff4444;
    else if (percent < 0.6) color = 0xffaa00;

    this.fillBar.fillStyle(color, 1);
    this.fillBar.fillRoundedRect(
      -this.width / 2,
      -this.height / 2,
      this.width * percent,
      this.height,
      2
    );

    if (this.textObj && this.showText) {
      this.textObj.setText(`${Math.ceil(this.currentHealth)}/${this.maxHealth}`);
    }
  }

  /** 跟随目标 */
  follow(target: Phaser.GameObjects.GameObject, offsetY: number = -30): void {
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
      const obj = target as any;
      if (obj.active) {
        this.container.setPosition(obj.x, obj.y + offsetY);
      } else {
        this.container.setVisible(false);
      }
    });
  }

  /** 设置位置 */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /** 设置可见性 */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /** 设置深度 */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /** 销毁 */
  destroy(): void {
    this.container.destroy();
  }
}
