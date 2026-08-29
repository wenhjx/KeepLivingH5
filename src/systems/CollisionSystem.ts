import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { EventBus } from '../utils/EventBus';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { Bullet } from '../entities/Bullet';
import type { Pickup } from '../entities/Pickup';

/**
 * 碰撞系统
 * 处理游戏中所有实体间的碰撞和重叠事件
 * 由 GameScene 的 overlap/collider 回调调用
 */
export class CollisionSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 玩家与敌人碰撞（玩家受伤）
   */
  playerEnemyCollision(playerObj: any, enemyObj: any): void {
    const player = playerObj as Player;
    const enemy = enemyObj as Enemy;

    if (!player.active || !enemy.active) return;
    if (player.isInvincible()) return;

    const damage = enemy.getConfig()?.attackPower || 10;
    player.takeDamage(damage);

    // 击退玩家
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    player.setVelocity(Math.cos(angle) * 200, Math.sin(angle) * 200);
  }

  /**
   * 子弹与敌人碰撞（敌人受伤）
   */
  bulletEnemyCollision(bulletObj: any, enemyObj: any): void {
    const bullet = bulletObj as Bullet;
    const enemy = enemyObj as Enemy;

    if (!bullet.active || !enemy.active) return;
    if (bullet.isFromEnemy()) return;

    // 检查是否已命中过该敌人（穿透子弹）
    if (!bullet.hitEnemy(enemy)) return;

    const damage = bullet.getDamage();
    const isCrit = Math.random() < 0.05; // 基础暴击率
    const finalDamage = isCrit ? damage * 1.5 : damage;

    enemy.takeDamage(finalDamage, isCrit);

    // 命中粒子
    const gameScene = this.scene as any;
    gameScene.getObjectPool()?.spawnParticle(bullet.x, bullet.y, 0xffff00, 3);

    // 击杀统计
    if (enemy.getHealth() <= 0) {
      GameManager.getInstance().addKill(enemy.getScoreReward());
      gameScene.getObjectPool()?.spawnDeathParticle(enemy.x, enemy.y, enemy.getConfig()?.color || 0xff4444);
    }
  }

  /**
   * 敌人子弹与玩家碰撞
   */
  enemyBulletPlayerCollision(bulletObj: any, playerObj: any): void {
    const bullet = bulletObj as Bullet;
    const player = playerObj as Player;

    if (!bullet.active || !player.active) return;
    if (!bullet.isFromEnemy()) return;
    if (player.isInvincible()) return;

    if (bullet.hitPlayer()) {
      player.takeDamage(bullet.getDamage());
    }
  }

  /**
   * 玩家与拾取物碰撞
   */
  playerPickupCollision(playerObj: any, pickupObj: any): void {
    const player = playerObj as Player;
    const pickup = pickupObj as Pickup;

    if (!player.active || !pickup.active) return;

    pickup.collect(player);

    // 拾取特效
    const gameScene = this.scene as any;
    if (pickup.getType() === 'exp') {
      gameScene.getObjectPool()?.spawnExpParticle(pickup.x, pickup.y);
    }
  }

}
