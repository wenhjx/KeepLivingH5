import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Pickup } from '../entities/Pickup';
import type { EnemyConfig, PickupConfig } from '../types';

/**
 * 对象池系统
 * 复用敌人、子弹、拾取物、粒子等高频创建销毁的对象
 * 避免频繁实例化和GC，是割草游戏性能优化的核心
 */
export class ObjectPool {
  private scene: Phaser.Scene;

  // 对象池
  private enemyPool: Enemy[] = [];
  private bulletPool: Bullet[] = [];
  private enemyBulletPool: Bullet[] = [];
  private pickupPool: Pickup[] = [];
  private particlePool: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  // 场景中的组（用于碰撞检测）
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private bulletGroup!: Phaser.Physics.Arcade.Group;
  private pickupGroup!: Phaser.Physics.Arcade.Group;
  private particleGroup!: Phaser.GameObjects.Group;

  // 统计
  private stats = {
    enemiesSpawned: 0,
    bulletsSpawned: 0,
    pickupsSpawned: 0,
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializePools();
  }

  /** 设置场景组（由 GameScene 调用） */
  setGroups(
    enemies: Phaser.Physics.Arcade.Group,
    bullets: Phaser.Physics.Arcade.Group,
    pickups: Phaser.Physics.Arcade.Group,
    particles: Phaser.GameObjects.Group
  ): void {
    this.enemyGroup = enemies;
    this.bulletGroup = bullets;
    this.pickupGroup = pickups;
    this.particleGroup = particles;
  }

  /** 初始化对象池，预创建一定数量的对象 */
  private initializePools(): void {
    // 敌人池
    for (let i = 0; i < GameConfig.POOL.enemyInitialSize; i++) {
      const enemy = new Enemy(this.scene);
      this.enemyPool.push(enemy);
    }

    // 玩家子弹池
    for (let i = 0; i < GameConfig.POOL.bulletInitialSize; i++) {
      const bullet = new Bullet(this.scene);
      this.bulletPool.push(bullet);
    }

    // 敌人子弹池
    for (let i = 0; i < GameConfig.POOL.bulletInitialSize / 2; i++) {
      const bullet = new Bullet(this.scene);
      this.enemyBulletPool.push(bullet);
    }

    // 拾取物池
    for (let i = 0; i < GameConfig.POOL.pickupInitialSize; i++) {
      const pickup = new Pickup(this.scene);
      this.pickupPool.push(pickup);
    }
  }

  // ========== 敌人 ==========

  /** 从池中获取一个敌人 */
  spawnEnemy(config: EnemyConfig, x: number, y: number, difficultyMultiplier: number = 1): Enemy | null {
    let enemy = this.enemyPool.find((e) => !e.active);

    // 池满时动态扩展
    if (!enemy) {
      if (this.enemyPool.length >= GameConfig.POOL.enemyMaxSize) {
        // 达到上限，回收最老的非活跃对象
        enemy = this.enemyPool.find((e) => !e.active);
        if (!enemy) return null;
      } else {
        enemy = new Enemy(this.scene);
        this.enemyPool.push(enemy);
      }
    }

    enemy.spawn(config, x, y, difficultyMultiplier);
    this.enemyGroup?.add(enemy);
    this.stats.enemiesSpawned++;

    return enemy;
  }

  /** 获取当前活跃敌人数 */
  getActiveEnemyCount(): number {
    return this.enemyPool.filter((e) => e.active).length;
  }

  /** 回收所有敌人 */
  despawnAllEnemies(): void {
    this.enemyPool.forEach((e) => {
      if (e.active) e.despawn();
    });
  }

  // ========== 玩家子弹 ==========

  spawnBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    range: number,
    texture: string = 'bullet'
  ): Bullet | null {
    let bullet = this.bulletPool.find((b) => !b.active);

    if (!bullet) {
      if (this.bulletPool.length >= GameConfig.POOL.bulletMaxSize) {
        bullet = this.bulletPool.find((b) => !b.active);
        if (!bullet) return null;
      } else {
        bullet = new Bullet(this.scene);
        this.bulletPool.push(bullet);
      }
    }

    bullet.spawnPlayerBullet(x, y, angle, speed, damage, range, texture);
    this.bulletGroup?.add(bullet);
    this.stats.bulletsSpawned++;

    return bullet;
  }

  // ========== 敌人子弹 ==========

  spawnEnemyBullet(x: number, y: number, angle: number, speed: number, damage: number): Bullet | null {
    let bullet = this.enemyBulletPool.find((b) => !b.active);

    if (!bullet) {
      if (this.enemyBulletPool.length >= GameConfig.POOL.bulletMaxSize / 2) {
        bullet = this.enemyBulletPool.find((b) => !b.active);
        if (!bullet) return null;
      } else {
        bullet = new Bullet(this.scene);
        this.enemyBulletPool.push(bullet);
      }
    }

    bullet.spawnEnemyBullet(x, y, angle, speed, damage);
    this.bulletGroup?.add(bullet);

    return bullet;
  }

  // ========== 拾取物 ==========

  spawnPickup(config: PickupConfig, x: number, y: number): Pickup | null {
    let pickup = this.pickupPool.find((p) => !p.active);

    if (!pickup) {
      if (this.pickupPool.length >= GameConfig.POOL.pickupMaxSize) {
        pickup = this.pickupPool.find((p) => !p.active);
        if (!pickup) return null;
      } else {
        pickup = new Pickup(this.scene);
        this.pickupPool.push(pickup);
      }
    }

    pickup.spawn(config, x, y);
    this.pickupGroup?.add(pickup);
    this.stats.pickupsSpawned++;

    return pickup;
  }

  // ========== 粒子特效 ==========

  /** 创建爆炸/命中粒子效果 */
  spawnParticle(x: number, y: number, color: number = 0xffffff, count: number = 8): void {
    const emitter = this.scene.add.particles(x, y, 'particle_hit', {
      speed: { min: 50, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 400,
      quantity: count,
      tint: color,
      emitting: true,
    });

    // 自动销毁
    this.scene.time.delayedCall(500, () => {
      emitter.destroy();
    });
  }

  /** 创建经验拾取特效 */
  spawnExpParticle(x: number, y: number): void {
    this.spawnParticle(x, y, 0x44ff44, 5);
  }

  /** 创建死亡特效 */
  spawnDeathParticle(x: number, y: number, color: number = 0xff4444): void {
    this.spawnParticle(x, y, color, 12);
  }

  // ========== 统计与调试 ==========

  getPoolStats() {
    return {
      enemyPoolSize: this.enemyPool.length,
      enemyActive: this.getActiveEnemyCount(),
      bulletPoolSize: this.bulletPool.length,
      bulletActive: this.bulletPool.filter((b) => b.active).length,
      pickupPoolSize: this.pickupPool.length,
      pickupActive: this.pickupPool.filter((p) => p.active).length,
      ...this.stats,
    };
  }

  /** 清理所有活跃对象（场景切换时调用） */
  clearAll(): void {
    this.despawnAllEnemies();
    this.bulletPool.forEach((b) => b.active && b.despawn());
    this.enemyBulletPool.forEach((b) => b.active && b.despawn());
    this.pickupPool.forEach((p) => p.active && p.despawn());
  }
}
