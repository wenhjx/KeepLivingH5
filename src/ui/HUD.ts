import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';

/**
 * HUD 抬头显示
 * 显示血量、经验、等级、波次、击杀数、分数、存活时间等信息
 */
export class HUD {
  private scene: Phaser.Scene;

  // UI 元素
  private healthBarBg!: Phaser.GameObjects.Graphics;
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;

  private expBarBg!: Phaser.GameObjects.Graphics;
  private expBar!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;

  private waveText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;

  // 尺寸常量
  private readonly barWidth = 220;
  private readonly barHeight = 16;
  private readonly padding = 16;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const { width } = this.scene.scale;

    // ========== 左上角：血量和经验 ==========
    const leftX = this.padding;
    const topY = this.padding;

    // 血量条背景
    this.healthBarBg = this.scene.add.graphics();
    this.healthBarBg.fillStyle(0x1a1a25, 1);
    this.healthBarBg.fillRoundedRect(leftX, topY, this.barWidth, this.barHeight, 4);

    // 血量条
    this.healthBar = this.scene.add.graphics();

    // 血量文字
    this.healthText = this.scene.add
      .text(leftX + this.barWidth / 2, topY + this.barHeight / 2, '100/100', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 经验条背景
    const expY = topY + this.barHeight + 6;
    this.expBarBg = this.scene.add.graphics();
    this.expBarBg.fillStyle(0x1a1a25, 1);
    this.expBarBg.fillRoundedRect(leftX, expY, this.barWidth, 8, 4);

    // 经验条
    this.expBar = this.scene.add.graphics();

    // 等级文字
    this.levelText = this.scene.add
      .text(leftX + this.barWidth + 8, expY + 4, 'Lv.1', {
        fontSize: '14px',
        color: '#ffb347',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    // ========== 右上角：波次、击杀、分数 ==========
    const rightX = width - this.padding;

    this.waveText = this.scene.add
      .text(rightX, topY, '波次: 1', {
        fontSize: '16px',
        color: '#ff6b35',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);

    this.killsText = this.scene.add
      .text(rightX, topY + 24, '击杀: 0', {
        fontSize: '14px',
        color: '#cccccc',
      })
      .setOrigin(1, 0);

    this.scoreText = this.scene.add
      .text(rightX, topY + 46, '分数: 0', {
        fontSize: '14px',
        color: '#ffb347',
      })
      .setOrigin(1, 0);

    // ========== 顶部中间：存活时间 ==========
    this.timeText = this.scene.add
      .text(width / 2, topY, '00:00', {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
  }

  /** 每帧更新 HUD */
  update(): void {
    const gm = GameManager.getInstance();
    const runData = gm.runData;

    // 更新波次、击杀、分数
    this.waveText.setText(`波次: ${runData.wave}`);
    this.killsText.setText(`击杀: ${runData.kills}`);
    this.scoreText.setText(`分数: ${runData.score}`);
    this.timeText.setText(this.formatTime(runData.survivalTime));

    // 更新玩家状态（从 GameScene 获取）
    const gameScene = this.scene.scene.get('GameScene') as any;
    if (gameScene && gameScene.getPlayer) {
      const player = gameScene.getPlayer();
      if (player) {
        this.updateHealthBar(player.getHealth(), player.getMaxHealth());
        this.updateExpBar(player.getExp(), player.getExpToNext());
        this.levelText.setText(`Lv.${player.getLevel()}`);
      }
    }
  }

  updateHealth(): void {
    const gameScene = this.scene.scene.get('GameScene') as any;
    if (gameScene && gameScene.getPlayer) {
      const player = gameScene.getPlayer();
      if (player) {
        this.updateHealthBar(player.getHealth(), player.getMaxHealth());
      }
    }
  }

  updateLevel(): void {
    const gameScene = this.scene.scene.get('GameScene') as any;
    if (gameScene && gameScene.getPlayer) {
      const player = gameScene.getPlayer();
      if (player) {
        this.levelText.setText(`Lv.${player.getLevel()}`);
        this.updateExpBar(player.getExp(), player.getExpToNext());
      }
    }
  }

  private updateHealthBar(current: number, max: number): void {
    const percent = Math.max(0, current / max);
    this.healthBar.clear();

    // 血量颜色（低血量变红）
    let color = 0x44ff44;
    if (percent < 0.3) color = 0xff4444;
    else if (percent < 0.6) color = 0xffaa00;

    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRoundedRect(this.padding + 2, this.padding + 2, (this.barWidth - 4) * percent, this.barHeight - 4, 3);

    this.healthText.setText(`${Math.ceil(current)}/${max}`);
  }

  private updateExpBar(current: number, max: number): void {
    const percent = Math.max(0, Math.min(1, current / max));
    this.expBar.clear();
    this.expBar.fillStyle(0x4488ff, 1);
    const expY = this.padding + this.barHeight + 6;
    this.expBar.fillRoundedRect(this.padding + 2, expY + 2, (this.barWidth - 4) * percent, 4, 2);
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /** 显示/隐藏 */
  setVisible(visible: boolean): void {
    this.healthBarBg.setVisible(visible);
    this.healthBar.setVisible(visible);
    this.healthText.setVisible(visible);
    this.expBarBg.setVisible(visible);
    this.expBar.setVisible(visible);
    this.levelText.setVisible(visible);
    this.waveText.setVisible(visible);
    this.killsText.setVisible(visible);
    this.scoreText.setVisible(visible);
    this.timeText.setVisible(visible);
  }
}
