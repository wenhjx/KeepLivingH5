import Phaser from 'phaser';

/**
 * FXManager - 视觉特效统一入口
 *
 * 把所有一次性视觉特效集中管理：命中/暴击、敌人死亡、拾取、爆炸、
 * 玩家死亡消散、升级、枪口闪光。
 *
 * 设计原则（克制、不夸张）：
 * - 所有粒子以 ObjectPool.spawnParticle 的轻量风格为基准：
 *   少量粒子、短寿命（300~500ms）、scale 渐隐、用完即毁。
 * - 不做全屏红闪 / 大幅震屏 / 粒子喷泉等喧宾夺主的效果。
 * - 每个方法自包含创建 + 定时销毁，调用方无需管理生命周期。
 *
 * 由 GameScene 在 initSystems 中创建并暴露 getFXManager()，
 * 碰撞系统 / 玩家 / 敌人通过 scene.getFXManager() 调用。
 */
export class FXManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ========== 底层辅助 ==========

  /**
   * 基础粒子爆发（与 ObjectPool.spawnParticle 同风格，轻量）
   * @param opts 可选：scaleStart/scaleEnd/alphaStart/lifespan/gravityY/angle
   */
  private emit(
    x: number,
    y: number,
    texture: string,
    color: number,
    count: number,
    opts: {
      lifespan?: number;
      speedMin?: number;
      speedMax?: number;
      angleMin?: number;
      angleMax?: number;
      scaleStart?: number;
      scaleEnd?: number;
      gravityY?: number;
    } = {}
  ): void {
    const lifespan = opts.lifespan ?? 400;
    const emitter = this.scene.add.particles(x, y, texture, {
      speed: { min: opts.speedMin ?? 50, max: opts.speedMax ?? 200 },
      angle: { min: opts.angleMin ?? 0, max: opts.angleMax ?? 360 },
      scale: { start: opts.scaleStart ?? 0.5, end: opts.scaleEnd ?? 0 },
      alpha: { start: 1, end: 0 },
      lifespan,
      quantity: count,
      tint: color,
      gravityY: opts.gravityY ?? 0,
      emitting: true,
    });
    this.scene.time.delayedCall(lifespan + 120, () => emitter.destroy());
  }

  /** 一次性圆环（缩放 + 淡出），用于爆炸冲击波 / 升级光环 */
  private ring(x: number, y: number, radius: number, color: number, duration: number, scaleFrom: number, scaleTo: number): void {
    const circle = this.scene.add.circle(x, y, radius, color, 0.5).setDepth(50);
    this.scene.tweens.add({
      targets: circle,
      scale: { from: scaleFrom, to: scaleTo },
      alpha: { from: 0.5, to: 0 },
      duration,
      onComplete: () => circle.destroy(),
    });
  }

  // ========== 特效方法 ==========

  /** 子弹命中：普通黄点小爆，暴击金色更多更大（配合暴击数字） */
  hit(x: number, y: number, isCrit: boolean = false): void {
    if (isCrit) {
      this.emit(x, y, 'particle_hit', 0xffd700, 8, {
        lifespan: 450,
        speedMin: 70,
        speedMax: 240,
        scaleStart: 0.7,
      });
    } else {
      this.emit(x, y, 'particle_hit', 0xffff00, 4, { lifespan: 300 });
    }
  }

  /** 敌人死亡：敌人主题色粒子爆开，轻微上浮 */
  enemyDeath(x: number, y: number, color: number = 0xff4444): void {
    this.emit(x, y, 'particle_death', color, 12, {
      lifespan: 420,
      speedMin: 60,
      speedMax: 200,
      gravityY: -45,
    });
  }

  /** 拾取光点：经验青 / 金币金 / 其他白 */
  pickup(x: number, y: number, type: string = 'exp'): void {
    const color = type === 'exp' ? 0x00ffff : type === 'coin' ? 0xffd700 : 0xffffff;
    this.emit(x, y, 'particle_exp', color, 5, { lifespan: 350, speedMin: 40, speedMax: 150 });
  }

  /**
   * 爆炸：双环冲击波（保留原有观感）+ 少量橙粒
   * 震屏保留轻量（与原 handleExplosion 一致）
   */
  explosion(x: number, y: number, radius: number): void {
    this.ring(x, y, radius, 0xff6600, 300, 0.3, 1.2);
    this.ring(x, y, radius * 0.5, 0xffff00, 200, 0.5, 1);
    this.emit(x, y, 'particle_explosion', 0xff8800, 12, {
      lifespan: 420,
      speedMin: 80,
      speedMax: 260,
      scaleStart: 0.7,
    });
    this.scene.cameras.main.shake(100, 0.005);
  }

  /** 玩家死亡消散：青色粒子上升消散（玩家主题色），无震屏 */
  playerDeath(x: number, y: number): void {
    this.emit(x, y, 'particle_death', 0x00ffff, 15, {
      lifespan: 700,
      speedMin: 60,
      speedMax: 180,
      gravityY: -70,
      scaleStart: 0.7,
    });
  }

  /** 升级：金色粒子向上 + 轻量光环扩散 */
  levelUp(x: number, y: number): void {
    this.emit(x, y, 'particle_hit', 0xffd700, 10, {
      lifespan: 500,
      speedMin: 80,
      speedMax: 200,
      angleMin: 200,
      angleMax: 340,
      gravityY: -80,
      scaleStart: 0.6,
    });
    this.ring(x, y, 40, 0xffd700, 300, 0.4, 2);
  }

  /** 枪口闪光：极短小圆闪光（颜色随武器） */
  muzzleFlash(x: number, y: number, angle: number, color: number = 0xffffff): void {
    const flash = this.scene.add.circle(x, y, 8, color, 0.8).setDepth(50);
    this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0.8, to: 0 },
      scale: { from: 0.6, to: 1.4 },
      duration: 80,
      onComplete: () => flash.destroy(),
    });
  }
}
