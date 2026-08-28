import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';

/**
 * 主菜单场景
 * 游戏入口界面，包含开始游戏、设置、存档等功能
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    const gm = GameManager.getInstance();
    const { width, height } = this.scale;
    const centerX = width / 2;

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a0f).setOrigin(0);

    // 标题
    this.add
      .text(centerX, height * 0.25, 'KEEP LIVING', {
        fontSize: '56px',
        fontFamily: 'Arial',
        color: '#ff6b35',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 副标题
    this.add
      .text(centerX, height * 0.25 + 50, '2D 割草生存', {
        fontSize: '20px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // 菜单按钮
    const buttonY = height * 0.5;
    const buttonSpacing = 60;

    this.createMenuButton(centerX, buttonY, '开始游戏', () => this.startGame());
    this.createMenuButton(centerX, buttonY + buttonSpacing, '继续游戏', () => this.continueGame());
    this.createMenuButton(centerX, buttonY + buttonSpacing * 2, '设置', () => this.openSettings());

    // 底部信息
    const stats = gm.stats;
    this.add
      .text(centerX, height - 60, `最高分: ${stats.highScore}  |  总击杀: ${stats.totalKills}  |  游戏次数: ${stats.gamesPlayed}`, {
        fontSize: '14px',
        color: '#555555',
      })
      .setOrigin(0.5);

    // 版本号
    this.add
      .text(width - 10, height - 10, 'v0.1.0', {
        fontSize: '12px',
        color: '#333333',
      })
      .setOrigin(1, 1);

    // 设备标识
    if (gm.isMobile) {
      this.add
        .text(10, height - 10, `移动端 · ${gm.qualityLevel}`, {
          fontSize: '12px',
          color: '#333333',
        })
        .setOrigin(0, 1);
    }
  }

  private createMenuButton(x: number, y: number, text: string, callback: () => void): void {
    const btn = this.add
      .text(x, y, text, {
        fontSize: '24px',
        color: '#e0e0e0',
        backgroundColor: '#1a1a25',
        padding: { left: 40, right: 40, top: 12, bottom: 12 },
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

  private startGame(): void {
    GameManager.getInstance().startNewRun();
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  private continueGame(): void {
    // TODO: 读取存档继续游戏
    this.startGame();
  }

  private openSettings(): void {
    // TODO: 打开设置面板
    console.log('[MainMenu] 打开设置');
  }
}
