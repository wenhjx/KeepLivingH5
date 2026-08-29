import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { TextureGenerator } from '../utils/TextureGenerator';

/**
 * 预加载场景
 * 先用程序生成霓虹主题纹理（零外部依赖），再加载 JSON 配置数据
 */
export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;

  constructor() {
    super('PreloadScene');
  }

  create(): void {
    // 渲染分辨率倍率补偿（保持视觉比例，配合高分屏清晰渲染）
    this.cameras.main.setZoom(GameConfig.renderScale);
    this.createLoadingUI();

    // 第一步：用程序生成所有游戏纹理（霓虹深渊主题）
    const generator = new TextureGenerator(this);
    generator.generateAll();

    // 说明：游戏配置（武器/敌人/波次/升级）实际由 src/data/*.ts 提供，
    // 因此无需加载 public/assets/data 下的占位 JSON，避免无效网络请求

    // 音频资源（可选）：当前仓库没有音频素材，故不加载。
    // 若日后放置音频到 public/assets/audio/，请在此处恢复加载，例如：
    // this.load.audio('sfx_hit', 'assets/audio/hit.mp3');

    this.setupLoadEvents();
    this.load.start();
  }

  private createLoadingUI(): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // 标题
    createUIText(this, centerX, centerY - 80, 'KEEP LIVING', {
        fontSize: '42px',
        fontFamily: 'Arial',
        color: '#00ffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 副标题
    createUIText(this, centerX, centerY - 45, 'NEON ABYSS', {
        fontSize: '14px',
        color: '#ff00ff',
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    // 进度条背景
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x1a1a2e, 1);
    this.progressBox.fillRoundedRect(centerX - 160, centerY, 320, 20, 10);
    this.progressBox.lineStyle(1, 0x00ffff, 0.5);
    this.progressBox.strokeRoundedRect(centerX - 160, centerY, 320, 20, 10);

    // 进度条
    this.progressBar = this.add.graphics();

    // 文字
    this.loadingText = createUIText(this, centerX, centerY + 40, '正在生成霓虹纹理...', {
        fontSize: '14px',
        color: '#888888',
      })
      .setOrigin(0.5);

    this.percentText = createUIText(this, centerX, centerY + 10, '0%', {
        fontSize: '12px',
        color: '#00ffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  private setupLoadEvents(): void {
    this.load.on('progress', (value: number) => {
      this.updateProgressBar(value);
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      this.loadingText.setText(`加载: ${file.key}`);
    });

    this.load.on('complete', () => {
      this.percentText.setText('100%');
      this.loadingText.setText('准备就绪');
      this.time.delayedCall(400, () => {
        this.scene.start('MainMenuScene');
      });
    });

    // 资源加载失败时静默处理（音频等可选资源）
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[Preload] 资源未找到（可选）: ${file.key}`);
    });
  }

  private updateProgressBar(value: number): void {
    const { width } = this.scale;
    const centerX = width / 2;
    const percent = Math.round(value * 100);

    this.progressBar.clear();
    // 霓虹渐变进度条
    this.progressBar.fillStyle(0x00ffff, 1);
    this.progressBar.fillRoundedRect(centerX - 156, 4 + this.scale.height / 2, 312 * value, 12, 6);
    // 发光效果
    if (value > 0.05) {
      this.progressBar.fillStyle(0xffffff, 0.5);
      this.progressBar.fillRoundedRect(centerX - 156, 4 + this.scale.height / 2, 312 * value, 4, 4);
    }

    this.percentText.setText(`${percent}%`);
  }
}
