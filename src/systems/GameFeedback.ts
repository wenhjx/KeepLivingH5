import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';
import { createUIText } from '../utils/UIText';

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
  private lastCritAt = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.unsubs.push(EventBus.on('wave:start', (d: any) => this.onWaveStart(d)));
    this.unsubs.push(EventBus.on('boss:spawn', (d: any) => this.onBossSpawn(d)));
    this.unsubs.push(EventBus.on('combat:crit', (d: any) => this.onCrit(d)));
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
      scene.cameras.main.width / 2,
      132,
      isBoss ? '⚠ BOSS 来袭 ⚠' : `第 ${wave} 波`,
      {
        fontSize: isBoss ? '44px' : '34px',
        color: isBoss ? '#ff4444' : '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { color: isBoss ? '#ff0000' : '#000000', blur: 8, offsetX: 0, offsetY: 2 },
      }
    )
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0)
      .setScale(0.7);

    this.banner = banner;

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
