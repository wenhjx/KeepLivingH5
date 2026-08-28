import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { EventBus } from '../utils/EventBus';
import { MathUtils } from '../utils/MathUtils';
import type { PlayerStats, WeaponConfig } from '../types';
import type { InputManager } from '../systems/InputManager';

/**
 * 玩家实体
 * 管理玩家移动、属性、升级、武器、受伤等核心逻辑
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // 属性
  private stats: PlayerStats;
  // 武器列表
  private weapons: Map<string, { config: WeaponConfig; level: number; cooldown: number }> = new Map();
  // 无敌状态
  private invincible = false;
  private invincibleTimer = 0;
  // 朝向
  private facingAngle = 0;
  // 经验特效
  private expFlashTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');

    // 初始化属性
    this.stats = {
      maxHealth: GameConfig.PLAYER.maxHealth,
      health: GameConfig.PLAYER.maxHealth,
      moveSpeed: GameConfig.PLAYER.moveSpeed,
      attackPower: GameConfig.PLAYER.baseAttackPower,
      attackSpeed: GameConfig.PLAYER.baseAttackSpeed,
      defense: 0,
      level: 1,
      exp: 0,
      expToNext: GameConfig.LEVEL.baseExp,
      critRate: GameConfig.PLAYER.baseCritRate,
      critDamage: GameConfig.PLAYER.baseCritDamage,
      pickupRadius: GameConfig.PLAYER.pickupRadius,
      luck: 0,
    };

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 物理设置
    this.setCollideWorldBounds(true);
    this.setCircle(16);
    this.setDepth(10);

    // 初始武器（默认武器）
    this.addWeapon({
      id: 'default_gun',
      name: '基础射击',
      type: 'ranged',
      texture: 'bullet',
      damage: 10,
      attackSpeed: 2,
      range: 400,
      projectileSpeed: 500,
      projectileCount: 1,
      description: '基础远程攻击',
      maxLevel: 8,
    });
  }

  update(time: number, delta: number, input: InputManager): void {
    if (this.active === false) return;

    // 无敌时间
    if (this.invincible) {
      this.invincibleTimer -= delta;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.clearTint();
      } else {
        // 闪烁效果
        this.setAlpha(Math.sin(time / 50) > 0 ? 1 : 0.3);
      }
    } else {
      this.setAlpha(1);
    }

    // 移动
    const moveDir = input.getMoveDirection();
    this.setVelocity(moveDir.x * this.stats.moveSpeed, moveDir.y * this.stats.moveSpeed);

    // 更新朝向（朝最近敌人或移动方向）
    if (moveDir.x !== 0 || moveDir.y !== 0) {
      this.facingAngle = Math.atan2(moveDir.y, moveDir.x);
    }

    // 武器攻击
    this.updateWeapons(time, delta);

    // 经验闪烁
    if (this.expFlashTimer > 0) {
      this.expFlashTimer -= delta;
    }
  }

  private updateWeapons(time: number, delta: number): void {
    this.weapons.forEach((weapon) => {
      weapon.cooldown -= delta;
      if (weapon.cooldown <= 0) {
        this.fireWeapon(weapon.config, weapon.level);
        weapon.cooldown = 1000 / (weapon.config.attackSpeed * this.stats.attackSpeed);
      }
    });
  }

  private fireWeapon(config: WeaponConfig, level: number): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;

    const pool = scene.getObjectPool();
    const damage = config.damage * (1 + level * 0.2) * this.stats.attackPower / 10;

    // 寻找最近敌人作为目标
    const nearestEnemy = this.findNearestEnemy();
    let angle = this.facingAngle;
    if (nearestEnemy) {
      angle = MathUtils.angle(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
    }

    // 发射子弹
    const count = config.projectileCount || 1;
    const spread = count > 1 ? 0.3 : 0;
    for (let i = 0; i < count; i++) {
      const bulletAngle = angle + (i - (count - 1) / 2) * spread;
      pool.spawnBullet(
        this.x,
        this.y,
        bulletAngle,
        config.projectileSpeed || 500,
        damage,
        config.range,
        config.texture || 'bullet'
      );
    }
  }

  private findNearestEnemy(): Phaser.GameObjects.Sprite | null {
    const scene = this.scene as any;
    if (!scene || !scene.getEnemies) return null;
    const enemies = scene.getEnemies();
    let nearest: Phaser.GameObjects.Sprite | null = null;
    let minDist = Infinity;
    enemies.children.each((enemy: any) => {
      if (enemy.active) {
        const dist = MathUtils.distanceSq(this.x, this.y, enemy.x, enemy.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = enemy;
        }
      }
      return true;
    });
    return nearest;
  }

  // ========== 受伤与治疗 ==========

  takeDamage(amount: number): void {
    if (this.invincible || this.stats.health <= 0) return;

    const actualDamage = Math.max(1, amount - this.stats.defense);
    this.stats.health -= actualDamage;
    this.invincible = true;
    this.invincibleTimer = GameConfig.PLAYER.invincibleTime;
    this.setTint(0xff4444);

    EventBus.emit('player:damage', actualDamage);

    if (this.stats.health <= 0) {
      this.stats.health = 0;
      this.die();
    }
  }

  heal(amount: number): void {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
    EventBus.emit('player:heal', amount);
  }

  private die(): void {
    this.setActive(false);
    this.setVisible(false);
    EventBus.emit('player:death');
  }

  // ========== 经验与升级 ==========

  addExp(amount: number): void {
    this.stats.exp += amount;
    this.expFlashTimer = 200;

    while (this.stats.exp >= this.stats.expToNext && this.stats.level < GameConfig.LEVEL.maxLevel) {
      this.stats.exp -= this.stats.expToNext;
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.stats.level++;
    this.stats.expToNext = Math.floor(
      GameConfig.LEVEL.baseExp * Math.pow(GameConfig.LEVEL.expGrowth, this.stats.level - 1)
    );

    // 升级属性提升
    this.stats.maxHealth += 5;
    this.stats.health = this.stats.maxHealth;
    this.stats.attackPower += 2;

    EventBus.emit('player:levelup', this.stats.level);
  }

  // ========== 武器管理 ==========

  addWeapon(config: WeaponConfig): void {
    if (this.weapons.has(config.id)) {
      const w = this.weapons.get(config.id)!;
      if (w.level < config.maxLevel) {
        w.level++;
      }
    } else {
      this.weapons.set(config.id, { config, level: 1, cooldown: 0 });
    }
  }

  upgradeWeapon(weaponId: string): boolean {
    const w = this.weapons.get(weaponId);
    if (!w || w.level >= w.config.maxLevel) return false;
    w.level++;
    return true;
  }

  // ========== 属性修改 ==========

  modifyStat(stat: keyof PlayerStats, value: number, isPercent: boolean = false): void {
    if (isPercent) {
      (this.stats as any)[stat] *= 1 + value;
    } else {
      (this.stats as any)[stat] += value;
    }
    // 确保生命值不超过上限
    if (stat === 'maxHealth') {
      this.stats.health = Math.min(this.stats.health, this.stats.maxHealth);
    }
  }

  // ========== Getters ==========

  getStats(): PlayerStats {
    return { ...this.stats };
  }

  getHealth(): number {
    return this.stats.health;
  }

  getMaxHealth(): number {
    return this.stats.maxHealth;
  }

  getLevel(): number {
    return this.stats.level;
  }

  /** 是否拥有某武器 */
  hasWeapon(weaponId: string): boolean {
    return this.weapons.has(weaponId);
  }

  /** 获取某武器等级（0 表示未拥有） */
  getWeaponLevel(weaponId: string): number {
    const w = this.weapons.get(weaponId);
    return w ? w.level : 0;
  }

  /** 某武器是否已满级 */
  isWeaponMaxLevel(weaponId: string): boolean {
    const w = this.weapons.get(weaponId);
    return w ? w.level >= w.config.maxLevel : false;
  }

  getExp(): number {
    return this.stats.exp;
  }

  getExpToNext(): number {
    return this.stats.expToNext;
  }

  getPickupRadius(): number {
    return this.stats.pickupRadius;
  }

  isInvincible(): boolean {
    return this.invincible;
  }
}
