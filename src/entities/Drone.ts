import Phaser from 'phaser';
import { MathUtils } from '../utils/MathUtils';
import type { Player } from './Player';
import type { WeaponConfig } from '../types';

/**
 * 无人机实体（接触伤害型）
 * 环绕玩家高速飞行，碰到敌人直接造成伤害，不发射子弹
 * 多个无人机形成"切割环"，玩家移动时扫过敌群
 */
export class Drone extends Phaser.Physics.Arcade.Sprite {
  private player: Player;
  private config: WeaponConfig;
  private level: number;
  private orbitRadius: number = 70;
  private orbitAngle: number = 0;
  private orbitSpeed: number = 3.5; // 弧度/秒，环绕速度
  private damageCooldown: number = 0; // 伤害冷却（毫秒）
  private damageInterval: number = 400; // 每次伤害间隔
  private hitRadius: number = 24; // 接触伤害半径
  private shootCooldown: number = 0; // 自动射击冷却（毫秒）
  private shootInterval: number = 1000; // 自动射击间隔（毫秒）

  constructor(scene: Phaser.Scene, player: Player, config: WeaponConfig, level: number, index: number, total: number) {
    super(scene, player.x, player.y, 'bullet');
    this.player = player;
    this.config = config;
    this.level = level;

    scene.add.existing(this);
    scene.physics.add.existing(this, false);

    this.setDepth(7);
    this.setCircle(10);
    this.setTint(0x66ffff);
    this.setScale(0.9);
    this.setAlpha(0.9);

    // 初始角度均匀分布
    this.orbitAngle = (index / total) * Math.PI * 2;
  }

  update(time: number, delta: number): void {
    if (!this.active) return;

    // 环绕玩家运动
    this.orbitAngle += (this.orbitSpeed * delta) / 1000;
    const targetX = this.player.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetY = this.player.y + Math.sin(this.orbitAngle) * this.orbitRadius;

    // 平滑移动到目标位置
    this.setPosition(
      this.x + (targetX - this.x) * 0.3,
      this.y + (targetY - this.y) * 0.3
    );

    // 旋转视觉效果
    this.setRotation(this.orbitAngle * 2);

    // 伤害冷却
    this.damageCooldown -= delta;
    if (this.damageCooldown <= 0) {
      this.dealContactDamage();
      this.damageCooldown = this.damageInterval;
    }

    // 自动射击：朝最近敌人发射弹道，提供远程救急火力
    this.shootCooldown -= delta;
    if (this.shootCooldown <= 0) {
      this.shootCooldown = this.shootInterval;
      this.autoShoot();
    }
  }

  /** 自动索敌射击：朝最近敌人发射弹道 */
  private autoShoot(): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool || !scene.getEnemies) return;

    const target = this.findNearestEnemy();
    if (!target) return;

    const angle = MathUtils.angle(this.x, this.y, target.x, target.y);
    const damage = this.config.damage * (1 + this.level * 0.2) * this.player.getStats().attackPower / 10;

    scene.getObjectPool().spawnBullet(
      this.x,
      this.y,
      angle,
      460,
      damage,
      340,
      this.config.texture || 'bullet',
      {
        color: 0x66ffff,
        scaleX: 0.65,
        scaleY: 0.65,
      }
    );
  }

  /** 查找最近敌人 */
  private findNearestEnemy(): any {
    const scene = this.scene as any;
    if (!scene || !scene.getEnemies) return null;
    const enemies = scene.getEnemies();
    let nearest: any = null;
    let minDist = Infinity;
    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const d = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (d < minDist) {
        minDist = d;
        nearest = enemy;
      }
      return true;
    });
    return nearest;
  }

  /** 接触伤害：对范围内敌人造成伤害 */
  private dealContactDamage(): void {
    const scene = this.scene as any;
    if (!scene || !scene.getEnemies) return;

    const enemies = scene.getEnemies();
    const damage = this.config.damage * (1 + this.level * 0.2) * this.player.getStats().attackPower / 10;

    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist <= this.hitRadius + (enemy.config?.size || 20) / 2) {
        enemy.takeDamage(damage, false);
        // 命中粒子
        if (scene.getObjectPool) {
          scene.getObjectPool()?.spawnParticle(this.x, this.y, 0x66ffff, 2);
        }
      }
      return true;
    });
  }

  /** 更新无人机等级（武器升级时调用） */
  upgrade(level: number, total: number): void {
    this.level = level;
    // 升级时略微增加环绕速度、伤害半径和射击频率
    this.orbitSpeed = 3.5 + level * 0.3;
    this.hitRadius = 24 + level * 2;
    this.shootInterval = Math.max(600, 1000 - level * 50);
  }

  /** 销毁无人机 */
  destroy(): void {
    super.destroy();
  }
}
