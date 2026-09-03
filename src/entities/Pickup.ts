import Phaser from 'phaser';
import { MathUtils } from '../utils/MathUtils';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import { GameConfig } from '../game/GameConfig';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { applyUpgradeToPlayer } from '../utils/UpgradeApplier';
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
    super(scene, 0, 0, GameConfig.themeKey('pickup_exp'));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
  }

  spawn(config: PickupConfig, x: number, y: number): void {
    this.config = config;
    this.magnetActive = false;
    this.bobOffset = Math.random() * Math.PI * 2;

    // 拾取物纹理按当前主题解析（classic 用霓虹版）
    this.setTexture(GameConfig.themeKey(config.texture || 'pickup_exp'));
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
        this.openChest(player);
        break;
    }

    this.despawn();
  }

  /** 强制进入磁吸状态（大磁铁等效果：全场拾取物吸向玩家） */
  forceMagnet(): void {
    if (this.active) this.magnetActive = true;
  }

  /** 开启宝箱：从奖励池随机开出金币/随机升级/消耗品/大经验 */
  private openChest(player: Player): void {
    const scene = this.scene as any;
    const roll = Math.random();

    if (roll < 0.35) {
      // 大金币堆
      const gold = Phaser.Math.Between(150, 400);
      player.addCoins(gold);
      scene?.spawnEventText?.(player.x, player.y - 30, `+${gold} 金币`, '#ffd700');
    } else if (roll < 0.6) {
      // 随机升级（未满级项直接应用）
      this.grantRandomUpgrade(player, scene);
    } else if (roll < 0.85) {
      // 消耗品礼包（1-2 个进物品栏）
      const pool = ['bomb', 'shield', 'rage', 'heal', 'slow', 'magnet'];
      const n = Math.random() < 0.5 ? 1 : 2;
      let label = '';
      for (let i = 0; i < n; i++) {
        const id = pool[Math.floor(Math.random() * pool.length)];
        player.addItem(id, 1);
        label += `${id} `;
      }
      scene?.spawnEventText?.(player.x, player.y - 30, `获得道具 ×${n}`, '#88ff88');
    } else {
      // 大经验
      const exp = Phaser.Math.Between(200, 600);
      player.addExp(exp);
      scene?.spawnEventText?.(player.x, player.y - 30, `经验 +${exp}`, '#66ccff');
    }

    // 宝箱开启金色冲击波特效
    scene?.getFXManager?.()?.shockwave?.(this.x, this.y, 70, 0xffd700);
  }

  /** 随机应用一个未满级升级项；全部满级则兜底金币 */
  private grantRandomUpgrade(player: Player, scene: any): void {
    const options = UPGRADE_OPTIONS.slice().sort(() => Math.random() - 0.5);
    for (const opt of options) {
      if (opt.type === 'weapon' && opt.effect?.weaponId && player.isWeaponMaxLevel?.(opt.effect.weaponId)) continue;
      if (opt.type === 'passive' && player.isPassiveMaxLevel?.(opt.id)) continue;
      if (opt.type === 'stat' && opt.maxLevel && (player.getStatUpgradeLevel?.(opt.id) ?? 0) >= opt.maxLevel) continue;
      applyUpgradeToPlayer(player, opt, scene);
      scene?.spawnEventText?.(player.x, player.y - 30, `${opt.name} +1`, '#88ff88');
      return;
    }
    player.addCoins(200);
    scene?.spawnEventText?.(player.x, player.y - 30, '金币 +200', '#ffd700');
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
