import Phaser from 'phaser';

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

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this, false);
    this.setActive(false);
    this.setVisible(false);
  }

  /** 玩家子弹初始化（从对象池取出时调用） */
  spawnPlayerBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    range: number,
    texture: string = 'bullet'
  ): void {
    this.isEnemyBullet = false;
    this.damage = damage;
    this.range = range;
    this.traveled = 0;
    this.startX = x;
    this.startY = y;
    this.pierceCount = 0;
    this.hitEnemies.clear();

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.setTexture(texture);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(8);
    this.setCircle(6);
    this.setRotation(angle);
    this.clearTint();

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.moves = true;
      body.velocity.set(this.vx, this.vy);
    }
  }

  /** 敌人子弹初始化（从对象池取出时调用） */
  spawnEnemyBullet(x: number, y: number, angle: number, speed: number, damage: number): void {
    this.isEnemyBullet = true;
    this.damage = damage;
    this.range = 800;
    this.traveled = 0;
    this.startX = x;
    this.startY = y;

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(7);
    this.setCircle(6);
    this.setTint(0xff4444);
    this.setRotation(angle);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = true;
      body.moves = true;
      body.velocity.set(this.vx, this.vy);
    }
  }

  update(time: number, delta: number): void {
    if (!this.active) return;

    // 每帧重设速度，确保不被未知机制清零
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.velocity.set(this.vx, this.vy);
    }

    // 计算飞行距离
    const dx = this.x - this.startX;
    const dy = this.y - this.startY;
    this.traveled = Math.sqrt(dx * dx + dy * dy);

    // 超出射程则回收到对象池
    if (this.traveled >= this.range) {
      this.despawn();
    }
  }

  /** 命中敌人（玩家子弹） */
  hitEnemy(enemy: Phaser.GameObjects.GameObject): boolean {
    if (this.isEnemyBullet) return false;
    if (this.hitEnemies.has(enemy)) return false;

    this.hitEnemies.add(enemy);

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
}
