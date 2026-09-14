import Phaser from 'phaser';
import { MODIFIER_CONFIGS, type LevelModifierId } from '../data/levels';
import type { Player } from '../entities/Player';

/**

 * 关卡特殊规则系统（数据驱动，与具体关卡解耦）

 *

 * 现有关卡规则：

 * - thirst 嗜血：击杀敌人回血（废墟主题，配合清场）

 * - frostbite 霜蚀：全场持续按最大生命百分比流失（冰原主题，逼走位）

 *

 * 新增规则只需：在 levels.ts 的 MODIFIER_CONFIGS 注册 + 在本类 update/onEnemyKilled 加分支。

 * GameScene 每帧调用 update，敌人死亡回调 onEnemyKilled。

 */

export class ModifierSystem {
  private scene: Phaser.Scene;

  private modifiers: LevelModifierId[] = [];

  private frostTick = 0;

  private frostCount = 0;

  
  /** 火盆安全区（由 GameScene 注入本关地形数据）：处于半径内时霜蚀不流失生命 */
  private fireZones: Array<{ x: number; y: number; radius: number }> = [];
constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 设置本关特殊规则（关卡切换时调用） */

  setModifiers(mods: LevelModifierId[]): void {
    this.modifiers = [...(mods ?? [])];

    this.frostTick = 0;

    this.frostCount = 0;
  }

  /** 注入火盆安全区（本关地形配置，霜蚀豁免判定用） */
  setFireZones(zones: Array<{ x: number; y: number; radius: number }>): void {
    this.fireZones = [...(zones ?? [])];
  }

  has(id: LevelModifierId): boolean {
    return this.modifiers.includes(id);
  }

  getActiveModifiers(): LevelModifierId[] {
    return [...this.modifiers];
  }

  /** 每帧更新（霜蚀掉血） */

  update(delta: number, player: Player): void {
    if (!player || player.getHealth() <= 0) return;

    if (!this.has('frostbite')) return;

    

    // 火盆安全区：玩家在火盆半径内不掉血（霜蚀的缓冲点，配合走位节奏）
    for (const z of this.fireZones) {
      const dx = player.x - z.x;
      const dy = player.y - z.y;
      if (dx * dx + dy * dy <= z.radius * z.radius) return;
    }const cfg = MODIFIER_CONFIGS.frostbite;

    this.frostTick += delta;

    const interval = 1000; // 每秒结算一次

    if (this.frostTick >= interval) {
      this.frostTick -= interval;

      this.frostCount++;

      const dmg = Math.max(1, Math.round(player.getMaxHealth() * (cfg.dpsPercent ?? 0.01)));

      player.damageFromHazard(dmg);

      // 霜蚀视觉反馈（每 3 次飘一次文字，避免刷屏）

      if (this.frostCount % 3 === 0) {
        (this.scene as any).spawnDamageText?.(player.x, player.y - 20, dmg, false);
      }
    }
  }

  /** 敌人被击杀（嗜血回血） */

  onEnemyKilled(player: Player): void {
    if (!player || player.getHealth() <= 0) return;

    if (!this.has('thirst')) return;

    const cfg = MODIFIER_CONFIGS.thirst;

    const heal = Math.max(1, Math.round(player.getMaxHealth() * (cfg.healPercent ?? 0.02)));

    player.heal(heal);
  }
}
