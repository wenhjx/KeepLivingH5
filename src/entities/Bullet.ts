import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';
import { GameConfig } from '../game/GameConfig';

/**
 * 子弹实体
 * 玩家和敌人发射的投射物
 * 使用对象池复用，despawn 时隐藏而非销毁
 *
 * 注意：每帧重设速度。项目中存在未知机制会在物理更新后将子弹
 * 速度清零（敌人因每帧在 AI 中重设速度而不受影响），子弹沿
 * 匀速直线飞行，每帧重设速度无副作用且能保证飞行稳定。
 */
export class Bullet extends Phaser.Physics.Arcade.Sprite {
  private damage: number = 0;
  private range: number = 0;
  private traveled: number = 0;
  private startX: number = 0;
  private startY: number = 0;
  private isEnemyBullet: boolean = false;
  private pierceCount: number = 0;
  private hitEnemies: Set<Phaser.GameObjects.GameObject> = new Set();
  /** 缓存速度，每帧重设 */
  private vx: number = 0;
  private vy: number = 0;
  // 武器行为标记
  private explosive: boolean = false;
  private boomerang: boolean = false;
  private aoeRadius: number = 0;
  // 回旋镖状态
  private returning: boolean = false;
  // 追踪弹（Boss 技能）：每帧朝玩家转向
  private homing: boolean = false;
  private homingTurnRate: number = 0; // 弧度/秒

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, GameConfig.themeKey('bullet'));
    scene.add.existing(this);
    scene.physics.add.existing(this, false);
    this.setActive(false);
    this.setVisible(false);
  }

  /** 玩家子弹初始化 */
  spawnPlayerBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    range: number,
    texture: string = 'bullet',
    options?: {
      pierce?: boolean;
      explosive?: boolean;
      boomerang?: boolean;
      aoeRadius?: number;
      color?: number;       // 子弹颜色（tint）
      scaleX?: number;      // 水平缩放
      scaleY?: number;      // 垂直缩放
    }
  ): void {
    this.isEnemyBullet = false;
    this.damage = damage;
    this.range = range;
    this.traveled = 0;
    this.startX = x;
    this.startY = y;
    this.pierceCount = options?.pierce ? 999 : 0;
    this.hitEnemies.clear();
    this.explosive = options?.explosive || false;
    this.boomerang = options?.boomerang || false;
    this.aoeRadius = options?.aoeRadius || 0;
    this.returning = false;

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    // 基础子弹按当前主题解析（classic 用霓虹能量弹）；武器自定义纹理（如 weapon_sword）保持原样
    const tex = texture === 'bullet' ? GameConfig.themeKey('bullet') : texture;
    this.setTexture(tex);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(8);
    this.setCircle(6);
    this.setRotation(angle);
    this.clearTint();
    this.setScale(1);

    // 应用自定义颜色和缩放（武器视觉区分）
    if (options?.color !== undefined) {
      this.setTint(options.color);
    }
    if (options?.scaleX !== undefined || options?.scaleY !== undefined) {
      this.setScale(options?.scaleX || 1, options?.scaleY || 1);
    }

    // 爆炸子弹强制橙色放大（覆盖自定义颜色）
    if (this.explosive) {
      this.setTint(0xff6600);
      this.setScale(1.5);
    } else if (this.boomerang) {
      this.setTint(0x66ff66);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.moves = true;
      body.velocity.set(this.vx, this.vy);
    }
  }

  /** 敌人子弹初始化（options：color 颜色 / homing 追踪 / homingTurnRate 转向速率弧度每秒 / scale 缩放） */
  spawnEnemyBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    options?: { color?: number; homing?: boolean; homingTurnRate?: number; scale?: number }
  ): void {
    this.isEnemyBullet = true;
    this.damage = damage;
    this.range = 800;
    this.traveled = 0;
    this.startX = x;
    this.startY = y;
    this.explosive = false;
    this.boomerang = false;
    this.aoeRadius = 0;
    this.returning = false;
    this.homing = options?.homing || false;
    this.homingTurnRate = options?.homingTurnRate || 0;
    this.setScale(options?.scale ?? 1);

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(7);
    this.setCircle(6);
    this.setTint(options?.color ?? 0xff4444);
    this.setRotation(angle);
    this.clearAlpha();

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.moves = true;
      body.velocity.set(this.vx, this.vy);
    }
  }

  update(time: number, delta: number): void {
    if (!this.active) return;

    // 回旋镖逻辑：飞到最大距离后返回
    if (this.boomerang && !this.returning && this.traveled >= this.range * 0.8) {
      this.returning = true;
    }
    if (this.boomerang && this.returning) {
      // 朝玩家方向飞（通过场景获取玩家位置）
      const scene = this.scene as any;
      const player = scene?.getPlayer?.();
      if (player) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.setRotation(angle);
        // 回到玩家附近时销毁
        if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 30) {
          this.despawn();
          return;
        }
      }
    }

    // 追踪弹：每帧朝玩家方向微调朝向（限速转向）
    if (this.homing) {
      const scene = this.scene as any;
      const player = scene?.getPlayer?.();
      if (player && player.active) {
        const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const curAngle = Math.atan2(this.vy, this.vx);
        let diff = targetAngle - curAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = this.homingTurnRate * (delta / 1000);
        const newAngle = curAngle + (diff > 0 ? Math.min(diff, maxTurn) : Math.max(diff, -maxTurn));
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.vx = Math.cos(newAngle) * speed;
        this.vy = Math.sin(newAngle) * speed;
        this.setRotation(newAngle);
      }
    }

    // 每帧重设速度，确保不被未知机制清零
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.velocity.set(this.vx, this.vy);
    }

    // 计算飞行距离
    const dx = this.x - this.startX;
    const dy = this.y - this.startY;
    this.traveled = Math.sqrt(dx * dx + dy * dy);

    // 超出射程则销毁（回旋镖返回阶段不销毁）
    if (this.traveled >= this.range && !this.boomerang) {
      // 爆炸子弹到达射程尽头自动爆炸，而非静默消失（火箭筒手感）
      if (this.explosive) {
        EventBus.emit('bullet:explode', {
          x: this.x,
          y: this.y,
          damage: this.damage,
          radius: this.aoeRadius || 80,
        });
      }
      this.despawn();
    }
  }

  /** 命中敌人（玩家子弹） */
  hitEnemy(enemy: Phaser.GameObjects.GameObject): boolean {
    if (this.isEnemyBullet) return false;
    if (this.hitEnemies.has(enemy)) return false;

    this.hitEnemies.add(enemy);

    // 爆炸子弹：命中时触发爆炸事件
    if (this.explosive) {
      EventBus.emit('bullet:explode', {
        x: this.x,
        y: this.y,
        damage: this.damage,
        radius: this.aoeRadius || 80,
      });
      this.despawn();
      return true;
    }

    // 穿透子弹（pierceCount > 0）继续飞行，否则消失
    if (this.pierceCount <= 0) {
      this.despawn();
    } else {
      this.pierceCount--;
    }
    return true;
  }

  /** 命中玩家（敌人子弹） */
  hitPlayer(): boolean {
    if (!this.isEnemyBullet) return false;
    this.despawn();
    return true;
  }

  /** 回收到对象池（隐藏而非销毁） */
  despawn(): void {
    if (!this.active) return;
    this.setActive(false);
    this.setVisible(false);
    this.setScale(1);
    this.clearTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = false;
      body.velocity.set(0, 0);
    }
  }

  // ========== Getters ==========

  getDamage(): number {
    return this.damage;
  }

  isFromEnemy(): boolean {
    return this.isEnemyBullet;
  }

  setPierce(count: number): void {
    this.pierceCount = count;
  }

  isExplosive(): boolean {
    return this.explosive;
  }
}
