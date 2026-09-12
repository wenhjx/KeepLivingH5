import Phaser from 'phaser';
import { EventBus, EventKeys } from '../utils/EventBus';
import { createUIText } from '../utils/UIText';
import { GameConfig } from '../game/GameConfig';
import { Layers } from '../constants/Layers';

/**
 * 游戏演出 / 反馈层（纯表现，与玩法解耦）
 *
 * 设计原则：
 * - 玩法层（WaveManager / GameScene / CollisionSystem 等）只通过 EventBus 发事件，
 *   本系统订阅事件并播放横幅 / 震屏 / 顿帧 / 警报等演出。
 * - 本系统不反向依赖任何玩法细节（波次结构、Boss 类型、数值公式），
 *   未来玩法大改只需保持事件语义不变即可；增强演出也无需改动玩法。
 *
 * 事件契约（本系统订阅）：
 * - 'wave:start'   { wave: number; isBoss: boolean }     任意波次开始时发出
 * - 'boss:spawn'   { x: number; y: number; wave: number } Boss 实际生成时发出
 * - 'combat:crit'  { x: number; y: number; damage: number } 玩家暴击命中时发出
 */
export class GameFeedback {
  private scene: Phaser.Scene;
  private unsubs: Array<() => void> = [];
  private banner: Phaser.GameObjects.Text | null = null;
  private bannerResizeHandler: (() => void) | null = null;
  private lastCritAt = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.unsubs.push(EventBus.on(EventKeys.WAVE_START, (d: any) => this.onWaveStart(d)));
    this.unsubs.push(EventBus.on(EventKeys.BOSS_SPAWN, (d: any) => this.onBossSpawn(d)));
    this.unsubs.push(EventBus.on(EventKeys.COMBAT_CRIT, (d: any) => this.onCrit(d)));
  }

  /** 销毁：取消全部订阅并清理横幅（场景 SHUTDOWN 时调用） */
  destroy(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
    this.clearBanner();
  }

  // ========== 波次横幅 ==========

  private onWaveStart(d: { wave: number; isBoss: boolean }): void {
    this.showWaveBanner(d.wave, d.isBoss);
  }

  private showWaveBanner(wave: number, isBoss: boolean): void {
    const scene = this.scene;
    this.clearBanner();

    const banner = createUIText(
      scene,
      // 屏幕目标位置：用 Scale Manager 权威视口尺寸（宽 50% / 高 18%）。
      // scrollFactor(0) 对象显示位置 = 局部坐标 × zoom，需除以 zoom 才落在目标屏幕位置。
      // 不用 cam.width/height：启动/超宽屏时序下相机参数可能尚未就绪（曾导致横幅被甩到屏幕外）。
      scene.scale.width * 0.5 / (scene.cameras.main.zoom || 1),
      scene.scale.height * 0.18 / (scene.cameras.main.zoom || 1),
      isBoss ? '⚠ BOSS 来袭 ⚠' : `第 ${wave} 波`,
      {
        fontSize: (isBoss ? 44 : 34) * GameConfig.uiScale + 'px',
        color: isBoss ? '#ff4444' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { color: isBoss ? '#ff0000' : '#000000', blur: 8, offsetX: 0, offsetY: 2 },
      }
    )
      .setOrigin(0.5)
      .setScrollFactor(0) // 屏幕固定：不随相机滚动，玩家任意位置都可见（与 GameScene Boss 横幅一致）
      .setDepth(Layers.BANNER)
      .setAlpha(0)
      .setScale(0.7);

    this.banner = banner;

    // 兜底重定位：启动/窗口 resize 时序下相机参数可能尚未就绪，
    // 创建后一帧 + 显示期间每次 resize 都按权威尺寸重算位置，保证任何时序下落在目标屏幕位置
    const relocate = (): void => {
      if (!banner.active) return;
      const z = scene.cameras.main.zoom || 1;
      banner.setPosition(scene.scale.width * 0.5 / z, scene.scale.height * 0.18 / z);
    };
    scene.time.delayedCall(32, relocate);
    if (this.bannerResizeHandler) scene.scale.off(Phaser.Scale.Events.RESIZE, this.bannerResizeHandler);
    this.bannerResizeHandler = relocate;
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.bannerResizeHandler);

    // 入场：淡入 + 弹跳放大
    scene.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 260,
      ease: 'Back.Out',
      onComplete: () => {
        // 停留后淡出，Boss 波停留更久
        scene.tweens.add({
          targets: banner,
          alpha: 0,
          delay: isBoss ? 1000 : 700,
          duration: 350,
          onComplete: () => this.clearBanner(),
        });
      },
    });
  }

  private clearBanner(): void {
    if (this.banner) {
      this.banner.destroy();
      this.banner = null;
    }
    if (this.bannerResizeHandler) {
      this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.bannerResizeHandler);
      this.bannerResizeHandler = null;
    }
  }

  // ========== Boss 出场演出 ==========

  private onBossSpawn(_d: { x: number; y: number; wave: number }): void {
    const cam = this.scene.cameras.main;
    // 红闪 + 震屏 + 短顿帧：制造 Boss 出场的压迫感
    cam.flash(240, 255, 40, 40, true);
    cam.shake(340, 0.012);
    this.hitStop(150);
  }

  // ========== 暴击反馈（震屏 + 重击顿帧） ==========

  private onCrit(d: { x: number; y: number; damage: number }): void {
    const now = this.scene.time.now;
    // 节流：每 140ms 最多触发一次，避免高暴击率时镜头持续抖动
    if (now - this.lastCritAt < 140) return;
    this.lastCritAt = now;

    // 伤害越高震屏越强（轻量，封顶 0.004）
    const strength = Math.min(0.004, 0.001 + d.damage * 0.00001);
    this.scene.cameras.main.shake(60, strength);

    // 重击（≥200 伤害）附带短顿帧，强化"沉"感
    if (d.damage >= 200) this.hitStop(45);
  }

  // ========== 基础工具 ==========

  /** 短顿帧：暂停物理世界一小段时间后恢复（hit-stop 打击感） */
  private hitStop(ms: number): void {
    const scene = this.scene as any;
    // 用 ArcadePhysics 公开的 pause()/resume()（world 属性运行时不可靠）
    if (!scene.physics || typeof scene.physics.pause !== 'function') return;
    scene.physics.pause();
    scene.time.delayedCall(ms, () => {
      if (scene.scene.isActive()) scene.physics.resume();
    });
  }
}
