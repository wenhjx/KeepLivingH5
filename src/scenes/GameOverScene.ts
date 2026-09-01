import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { setupUICamera } from '../utils/CameraHelper';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';

/**
 * 游戏结束场景
 * 显示本局成绩、统计数据，提供重新开始和返回主菜单选项
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);
    const gm = GameManager.getInstance();
    const runData = gm.runData;
    const stats = gm.stats;
    const centerX = width / 2;

    // 游戏结束音效
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_GAME_OVER, 1);

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a0f).setOrigin(0);

    // 标题
    createUIText(this, centerX, height * 0.2, '游戏结束', {
        fontSize: '52px',
        color: '#ff4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 本局数据
    const dataY = height * 0.35;
    const lineHeight = 40;

    const statsData = [
      { label: '存活时间', value: this.formatTime(runData.survivalTime) },
      { label: '到达波次', value: `${runData.wave}` },
      { label: '击杀数', value: `${runData.kills}` },
      { label: '本局得分', value: `${runData.score}` },
      { label: '历史最高分', value: `${stats.highScore}` },
    ];

    statsData.forEach((item, i) => {
      const y = dataY + i * lineHeight;
      createUIText(this, centerX - 100, y, item.label, {
          fontSize: '20px',
          color: '#888888',
        })
        .setOrigin(0, 0.5);

      createUIText(this, centerX + 100, y, item.value, {
          fontSize: '20px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);
    });

    // 新纪录提示
    if (runData.score >= stats.highScore && runData.score > 0) {
      createUIText(this, centerX, dataY + statsData.length * lineHeight + 20, '新纪录！', {
          fontSize: '24px',
          color: '#ffb347',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    // 按钮
    const buttonY = height * 0.75;
    this.createButton(centerX - 120, buttonY, '再来一局', () => this.restart());
    this.createButton(centerX + 120, buttonY, '主菜单', () => this.toMenu());
  }

  private createButton(x: number, y: number, text: string, callback: () => void): void {
    const btn = createUIText(this, x, y, text, {
        fontSize: '22px',
        color: '#e0e0e0',
        backgroundColor: '#1a1a25',
        padding: { left: 30, right: 30, top: 12, bottom: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      btn.setStyle({ color: '#ff6b35', backgroundColor: '#2a2a35' });
    });
    btn.on('pointerout', () => {
      btn.setStyle({ color: '#e0e0e0', backgroundColor: '#1a1a25' });
    });
    btn.on('pointerdown', callback);
  }

  private restart(): void {
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  private toMenu(): void {
    this.scene.start('MainMenuScene');
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
