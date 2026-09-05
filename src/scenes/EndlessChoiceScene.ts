import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';
import { setupUICamera } from '../utils/CameraHelper';
import { GameManager } from '../game/GameManager';
import { LEVELS, hasNextLevel } from '../data/levels';

/**
 * 通关结算场景（无尽模式入口 / 关卡推进入口）
 * 打完第 victoryWave 波后弹出，按当前关卡动态显示选项：
 * - 还有下一关：进入下一关（跨关继承）/ 继续征战无尽 / 结束征程
 * - 已是最后一关：继续征战无尽 / 结束征程（通关胜利）
 * 事件：endlesschoice:nextlevel / endlesschoice:continue / endlesschoice:end
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

    // 当前关卡信息
    const levelIndex = GameManager.getInstance().currentLevelIndex;
    const level = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
    const hasNext = hasNextLevel(levelIndex);
    const nextName = hasNext ? LEVELS[levelIndex + 1].name : '';

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0);

    // 标题
    createUIText(this, centerX, height * 0.22, '🎉 通关成功！', {
        fontSize: '46px',
        color: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 副标题
    const subtitle = hasNext
      ? `你已打通「${level.name}」，可前往下一区域「${nextName}」`
      : '你已打通所有区域！';
    createUIText(this, centerX, height * 0.22 + 54, subtitle, {
        fontSize: '18px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    // 说明
    const note = hasNext
      ? '进入下一关将保留全部成长，怪物会更强并出现全新规则'
      : '无尽模式下怪物将无限增强，考验你的极限';
    createUIText(this, centerX, height * 0.22 + 92, note, {
        fontSize: '14px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // 选项按钮（有下一关时多一个"进入下一关"）
    if (hasNext) {
      this.createChoiceButton(centerX, height * 0.50, '➡ 进入「' + nextName + '」', 0x44cc88, 'endlesschoice:nextlevel');
      this.createChoiceButton(centerX, height * 0.62, '⚔ 继续征战', 0xffb347, 'endlesschoice:continue');
      this.createChoiceButton(centerX, height * 0.74, '🏁 结束征程', 0x556677, 'endlesschoice:end');
    } else {
      this.createChoiceButton(centerX, height * 0.56, '⚔ 继续征战', 0xffb347, 'endlesschoice:continue');
      this.createChoiceButton(centerX, height * 0.68, '🏁 结束征程', 0x556677, 'endlesschoice:end');
    }

    // AI 自动玩：有下一关优先推进，否则继续征战（配合调试面板自动游玩跑全流程）
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
    const levelIndex = GameManager.getInstance().currentLevelIndex;
    const hasNext = hasNextLevel(levelIndex);
    const event = hasNext ? 'endlesschoice:nextlevel' : 'endlesschoice:continue';
    this.time.delayedCall(1500, () => {
      if (this.scene.isActive()) {
        console.log(`[AI 托管] 通关结算 → ${hasNext ? '进入下一关' : '继续征战无尽模式'}`);
        EventBus.emit(event);
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
