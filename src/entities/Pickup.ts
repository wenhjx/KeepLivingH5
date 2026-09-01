import Phaser from 'phaser';
import { MathUtils } from '../utils/MathUtils';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import type { PickupConfig, PickupType } from '../types';
import type { Player } from './Player';

/**
 * 拾取物实体
 * 经验宝石、血包、金币等可拾取物品，支持磁吸效果
 */
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  private config!: PickupConfig;
  private magnetActive: boolean = false;
  private bobOffset: number = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'pickup_exp');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
  }

  spawn(config: PickupConfig, x: number, y: number): void {
    this.config = config;
    this.magnetActive = false;
    this.bobOffset = Math.random() * Math.PI * 2;

    this.setTexture(config.texture || 'pickup_exp');
    // 先启用物理体并 reset 到正确位置
    if (this.body) {
      this.body.enable = true;
      this.body.reset(x, y);
    }
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(6);
    this.setCircle(12);
    this.setAlpha(1);

    // 初始随机散开
    const angle = Math.random() * Math.PI * 2;
    const speed = MathUtils.randomRange(30, 80);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    // 0.5秒后停止散开
    this.scene.time.delayedCall(500, () => {
      if (this.active) {
        this.setVelocity(0, 0);
      }
    });
  }

  update(time: number, delta: number, player: Player): void {
    if (!this.active) return;

    // 上下浮动效果
    this.setY(this.y + Math.sin(time / 300 + this.bobOffset) * 0.3);

    // 检测磁吸范围
    const dist = MathUtils.distance(this.x, this.y, player.x, player.y);
    if (dist < player.getPickupRadius()) {
      this.magnetActive = true;
    }

    // 磁吸移动
    if (this.magnetActive) {
      const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
      const speed = this.config.magnetSpeed * (1 + (1 - dist / player.getPickupRadius()) * 2);
      this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  /** 被玩家拾取 */
  collect(player: Player): void {
    if (!this.active) return;

    switch (this.config.type) {
      case 'exp':
        player.addExp(this.config.value);
        AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PICKUP_EXP, 0.5);
        break;
      case 'health':
        player.heal(this.config.value);
        AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PICKUP_HEALTH, 0.7);
        break;
      case 'coin':
        player.addCoins(this.config.value);
        AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PICKUP_COIN, 0.6);
        break;
      case 'item':
        // TODO: 道具系统
        break;
      case 'chest':
        // TODO: 宝箱系统
        break;
    }

    this.despawn();
  }

  despawn(): void {
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    if (this.body) {
      this.body.enable = false;
      this.body.reset(0, 0);
    }
  }

  // ========== Getters ==========

  getType(): PickupType {
    return this.config?.type || 'exp';
  }

  getValue(): number {
    return this.config?.value || 0;
  }
}
