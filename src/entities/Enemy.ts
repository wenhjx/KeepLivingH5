import Phaser from 'phaser';
import { MathUtils } from '../utils/MathUtils';
import { EventBus } from '../utils/EventBus';
import type { EnemyConfig, EnemyType } from '../types';
import type { Player } from './Player';

/**
 * 敌人实体基类
 * 所有敌人类型继承此类，实现AI移动、攻击、死亡掉落等逻辑
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private config!: EnemyConfig;
  private health: number = 0;
  private maxHealth: number = 0;
  private attackCooldown: number = 0;
  private isDead: boolean = false;
  private hitFlashTimer: number = 0;
  private difficultyMultiplier: number = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'enemy_normal');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
  }

  /** 从对象池取出时初始化 */
  spawn(config: EnemyConfig, x: number, y: number, difficultyMultiplier: number = 1): void {
    this.config = config;
    this.difficultyMultiplier = difficultyMultiplier;
    this.maxHealth = Math.floor(config.maxHealth * difficultyMultiplier);
    this.health = this.maxHealth;
    this.attackCooldown = 0;
    this.isDead = false;
    this.hitFlashTimer = 0;

    this.setTexture(config.texture || 'enemy_normal');
    // 先启用物理体并 reset 到正确位置
    if (this.body) {
      this.body.enable = true;
      this.body.reset(x, y);
    }
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setCircle(config.size / 2 || 16);
    this.setDepth(5);
    this.clearTint();
    this.setAlpha(1);

    // 根据类型设置颜色（占位素材时区分）
    if (config.color) {
      this.setTint(config.color);
    }

    EventBus.emit('enemy:spawn', this);
  }

  /** 回收对象池 */
  despawn(): void {
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.setVelocity(0, 0);
      this.body.enable = false;
      this.body.reset(0, 0);
    }
  }

  update(time: number, delta: number, player: Player): void {
    if (!this.active || this.isDead) return;

    // 受击闪烁
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.clearTint();
        if (this.config?.color) this.setTint(this.config.color);
      }
    }

    // AI 行为
    this.updateAI(time, delta, player);

    // 攻击冷却
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
  }

  private updateAI(time: number, delta: number, player: Player): void {
    const dist = MathUtils.distance(this.x, this.y, player.x, player.y);

    switch (this.config.type) {
      case 'ranged':
        this.rangedAI(delta, player, dist);
        break;
      case 'boss':
        this.bossAI(delta, player, dist);
        break;
      case 'fast':
        this.fastAI(delta, player, dist);
        break;
      default:
        this.normalAI(delta, player, dist);
        break;
    }
  }

  /** 普通敌人：直接冲向玩家 */
  private normalAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier;
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    // 接触攻击
    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.attackPlayer(player);
    }
  }

  /** 快速敌人：速度快但血量低，Z字移动 */
  private fastAI(delta: number, player: Player, dist: number): void {
    const baseAngle = MathUtils.angle(this.x, this.y, player.x, player.y);
    // 加入正弦波动实现Z字
    const wobble = Math.sin(this.scene.time.now / 200 + this.x * 0.01) * 0.5;
    const angle = baseAngle + wobble;
    const speed = this.config.moveSpeed * this.difficultyMultiplier;
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.attackPlayer(player);
    }
  }

  /** 远程敌人：保持距离并射击 */
  private rangedAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier;
    const preferredDist = 250;

    if (dist > preferredDist + 50) {
      // 靠近
      this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else if (dist < preferredDist - 50) {
      // 远离
      this.setVelocity(-Math.cos(angle) * speed, -Math.sin(angle) * speed);
    } else {
      // 横向移动
      this.setVelocity(-Math.sin(angle) * speed * 0.5, Math.cos(angle) * speed * 0.5);
    }

    // 远程攻击
    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.rangedAttack(player);
    }
  }

  /** Boss：多种攻击模式 */
  private bossAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier;

    // Boss 缓慢追击
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    // 接触伤害
    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.attackPlayer(player);
    }

    // 周期性弹幕（每3秒）
    if (Math.floor(this.scene.time.now / 3000) !== Math.floor((this.scene.time.now - delta) / 3000)) {
      this.bossBarrage();
    }
  }

  private bossBarrage(): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;
    const pool = scene.getObjectPool();
    // 8方向弹幕
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      pool.spawnEnemyBullet(this.x, this.y, angle, 200, this.config.attackPower * 0.5);
    }
  }

  private attackPlayer(player: Player): void {
    player.takeDamage(this.config.attackPower * this.difficultyMultiplier);
    this.attackCooldown = this.config.attackCooldown;
  }

  private rangedAttack(player: Player): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;
    const pool = scene.getObjectPool();
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    pool.spawnEnemyBullet(this.x, this.y, angle, 300, this.config.attackPower * this.difficultyMultiplier);
    this.attackCooldown = this.config.attackCooldown;
  }

  // ========== 受伤与死亡 ==========

  takeDamage(amount: number, isCrit: boolean = false): void {
    if (this.isDead) return;

    this.health -= amount;
    this.hitFlashTimer = 100;
    this.setTint(0xffffff);

    // 击退效果
    // TODO: 根据攻击方向添加击退

    if (this.health <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.isDead = true;
    const scene = this.scene as any;

    // 掉落经验（随波次难度成长，避免后期"需求指数涨、获取固定"导致升级断崖）
    if (scene && scene.spawnPickup) {
      scene.spawnPickup(
        {
          type: 'exp',
          texture: 'pickup_exp',
          value: Math.max(1, Math.floor(this.config.expReward * this.difficultyMultiplier)),
          magnetSpeed: 300,
        },
        this.x,
        this.y
      );
    }

    // 概率掉落血包
    if (MathUtils.chance(0.05)) {
      scene?.spawnPickup?.(
        {
          type: 'health',
          texture: 'pickup_health',
          value: 20,
          magnetSpeed: 300,
        },
        this.x + 20,
        this.y
      );
    }

    // 金币掉落（按敌人类型配置掉率与数量）
    const coinDrop = this.getCoinDrop();
    if (coinDrop && MathUtils.chance(coinDrop.chance)) {
      scene?.spawnPickup?.(
        {
          type: 'coin',
          texture: 'pickup_coin',
          value: MathUtils.randomInt(coinDrop.min, coinDrop.max),
          magnetSpeed: 300,
        },
        this.x - 20,
        this.y
      );
    }

    // 死亡粒子
    // TODO: 粒子特效

    EventBus.emit('enemy:death', this.config);
    this.despawn();
  }

  // ========== Getters ==========

  getConfig(): EnemyConfig {
    return this.config;
  }

  getEnemyType(): EnemyType {
    return this.config?.type || 'normal';
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  getExpReward(): number {
    return this.config?.expReward || 0;
  }

  getScoreReward(): number {
    return this.config?.scoreReward || 10;
  }

  /** 金币掉落配置（chance 0-1，min/max 金币数）；不掉的类型返回 null */
  private getCoinDrop(): { chance: number; min: number; max: number } | null {
    switch (this.config?.type) {
      case 'normal':
        return { chance: 0.3, min: 2, max: 5 };
      case 'fast':
        return { chance: 0.3, min: 2, max: 4 };
      case 'tank':
        return { chance: 0.5, min: 4, max: 7 };
      case 'ranged':
        return { chance: 0.35, min: 3, max: 5 };
      case 'elite':
        return { chance: 1, min: 15, max: 25 };
      case 'boss':
        return { chance: 1, min: 80, max: 150 };
      default:
        return { chance: 0.3, min: 2, max: 5 };
    }
  }

  isBoss(): boolean {
    return this.config?.type === 'boss';
  }
}
