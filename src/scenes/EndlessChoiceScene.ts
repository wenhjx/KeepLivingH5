import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';
import { setupUICamera } from '../utils/CameraHelper';

/**
 * 通关结算场景（无尽模式入口）
 * 打完第 victoryWave 波后弹出：选择继续征战无尽模式，或结束征程（结算胜利）。
 * - 继续征战 → emit endlesschoice:continue（GameScene 进入无尽，波次继续增长）
 * - 结束征程 → emit endlesschoice:end（GameScene 结算胜利）
 */
export class EndlessChoiceScene extends Phaser.Scene {
  constructor() {
    super('EndlessChoiceScene');
  }

  create(): void {
    const { width, height } = setupUICamera(this);
    // 场景实例会复用：stop 后再 launch 重新走 create，自动选择标记必须重置
    this.autoTriggered = false;
    const centerX = width / 2;

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0);

    // 标题
    createUIText(this, centerX, height * 0.26, '🎉 通关成功！', {
        fontSize: '46px',
        color: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 副标题
    createUIText(this, centerX, height * 0.26 + 54, '你已打完第 15 波，是否继续征战无尽模式？', {
        fontSize: '18px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    // 说明
    createUIText(this, centerX, height * 0.26 + 92, '无尽模式下怪物将无限增强，考验你的极限', {
        fontSize: '14px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // 两个选择按钮
    this.createChoiceButton(centerX, height * 0.56, '⚔ 继续征战', 0xffb347, 'endlesschoice:continue');
    this.createChoiceButton(centerX, height * 0.68, '🏁 结束征程', 0x556677, 'endlesschoice:end');

    // AI 自动玩：直接选择继续征战（配合调试面板自动游玩跑无尽测试）
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene?.isAutoPlay?.()) {
      this.triggerAutoPlay();
    }
  }

  /** 已触发过自动选择（防重） */
  private autoTriggered = false;

  /** 自动选择逻辑：create 时已开托管，或托管开启时面板已弹出（由 GameScene 广播触发）都会走到这里 */
  triggerAutoPlay(): void {
    if (this.autoTriggered) return;
    this.autoTriggered = true;
    this.time.delayedCall(1500, () => {
      if (this.scene.isActive()) {
        console.log('[AI 托管] 通关结算 → 继续征战无尽模式');
        EventBus.emit('endlesschoice:continue');
      }
    });
  }

  private createChoiceButton(x: number, y: number, label: string, color: number, event: string): void {
    const btn = this.add.graphics();
    btn.fillStyle(color, 1);
    btn.fillRoundedRect(x - 130, y - 22, 260, 44, 8);
    btn.lineStyle(2, 0xffffff, 0.4);
    btn.strokeRoundedRect(x - 130, y - 22, 260, 44, 8);

    createUIText(this, x, y, label, {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const hitArea = this.add
      .rectangle(x, y, 260, 44, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    // 只发事件：暂停/恢复与后续流程由 GameScene 统一处理
    hitArea.on('pointerdown', () => EventBus.emit(event));
  }
}
