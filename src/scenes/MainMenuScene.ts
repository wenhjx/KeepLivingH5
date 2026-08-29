import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { AudioManager } from '../systems/AudioManager';
import { setupUICamera } from '../utils/CameraHelper';
import type { QualityLevel } from '../game/GameConfig';

/**
 * 主菜单场景
 * 游戏入口界面，包含开始游戏、继续游戏、设置面板等功能
 */
export class MainMenuScene extends Phaser.Scene {
  // 设置面板状态
  private settingsOverlay!: Phaser.GameObjects.Container;
  private musicVolume = 1;
  private sfxVolume = 1;
  private quality: QualityLevel = 'medium';
  private muted = false;
  // 设置面板文本引用
  private musicVolText!: Phaser.GameObjects.Text;
  private sfxVolText!: Phaser.GameObjects.Text;
  private qualityTexts: Record<QualityLevel, Phaser.GameObjects.Text> = {} as Record<QualityLevel, Phaser.GameObjects.Text>;
  private muteText!: Phaser.GameObjects.Text;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);
    const gm = GameManager.getInstance();
    const centerX = width / 2;

    // 读取当前设置
    const audio = AudioManager.getInstance();
    this.musicVolume = Math.round(audio.getMusicVolume() * 100);
    this.sfxVolume = Math.round(audio.getSfxVolume() * 100);
    this.quality = gm.qualityLevel;
    this.muted = audio.isMuted();

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a0f).setOrigin(0);

    // 标题
    createUIText(this, centerX, height * 0.25, 'KEEP LIVING', {
        fontSize: '56px',
        fontFamily: 'Arial',
        color: '#ff6b35',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 副标题
    createUIText(this, centerX, height * 0.25 + 50, '2D 割草生存', {
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
    createUIText(this, centerX, height - 60, `最高分: ${stats.highScore}  |  总击杀: ${stats.totalKills}  |  游戏次数: ${stats.gamesPlayed}`, {
        fontSize: '14px',
        color: '#555555',
      })
      .setOrigin(0.5);

    // 版本号
    createUIText(this, width - 10, height - 10, 'v0.1.0', {
        fontSize: '12px',
        color: '#333333',
      })
      .setOrigin(1, 1);

    // 设备标识
    if (gm.isMobile) {
      createUIText(this, 10, height - 10, `移动端 · ${gm.qualityLevel}`, {
          fontSize: '12px',
          color: '#333333',
        })
        .setOrigin(0, 1);
    }

    // 创建设置面板（初始隐藏）
    this.createSettingsOverlay();
  }

  private createMenuButton(x: number, y: number, text: string, callback: () => void): void {
    const btn = createUIText(this, x, y, text, {
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
    // startNewRun 会清除进行中存档，确保这是全新对局
    GameManager.getInstance().startNewRun();
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  private continueGame(): void {
    const gm = GameManager.getInstance();
    if (gm.hasSavedRun()) {
      // 有进行中对局存档，进入恢复模式（GameScene 会自动恢复）
      this.scene.start('GameScene');
      this.scene.launch('UIScene');
    } else {
      // 无存档：直接开始新游戏
      this.startGame();
    }
  }

  private openSettings(): void {
    // 打开面板前刷新当前值
    this.settingsOverlay.setVisible(true);
  }

  // ========== 设置面板 ==========

  private createSettingsOverlay(): void {
    const width = GameConfig.GAME_WIDTH;
    const height = GameConfig.GAME_HEIGHT;
    const cx = width / 2;
    const cy = height / 2;
    const panelW = 440;
    const panelH = 380;

    this.settingsOverlay = this.add.container(0, 0).setDepth(200).setVisible(false);

    // 全屏遮罩（点击遮罩也可关闭）
    const mask = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive();
    mask.on('pointerdown', () => this.settingsOverlay.setVisible(false));
    this.settingsOverlay.add(mask);

    // 面板背景
    const bg = this.add.graphics();
    bg.fillStyle(0x16161f, 0.98);
    bg.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    bg.lineStyle(2, 0x00ffff, 0.4);
    bg.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    this.settingsOverlay.add(bg);

    // 标题
    this.settingsOverlay.add(
      createUIText(this, cx, cy - panelH / 2 + 38, '设 置', { fontSize: '28px', color: '#00ffff', fontStyle: 'bold' })
        .setOrigin(0.5)
    );

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = { fontSize: '16px', color: '#cccccc' };

    // ---------- 音乐音量 ----------
    const musicY = cy - panelH / 2 + 96;
    this.settingsOverlay.add(createUIText(this, cx - 170, musicY, '音乐音量', labelStyle).setOrigin(0, 0.5));
    this.musicVolText = createUIText(this, cx - 20, musicY, `${this.musicVolume}%`, { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.settingsOverlay.add(this.musicVolText);
    this.settingsOverlay.add(this.createSmallButton(cx + 40, musicY, '−', () => this.adjustMusic(-10)));
    this.settingsOverlay.add(this.createSmallButton(cx + 90, musicY, '+', () => this.adjustMusic(10)));

    // ---------- 音效音量 ----------
    const sfxY = cy - panelH / 2 + 146;
    this.settingsOverlay.add(createUIText(this, cx - 170, sfxY, '音效音量', labelStyle).setOrigin(0, 0.5));
    this.sfxVolText = createUIText(this, cx - 20, sfxY, `${this.sfxVolume}%`, { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.settingsOverlay.add(this.sfxVolText);
    this.settingsOverlay.add(this.createSmallButton(cx + 40, sfxY, '−', () => this.adjustSfx(-10)));
    this.settingsOverlay.add(this.createSmallButton(cx + 90, sfxY, '+', () => this.adjustSfx(10)));

    // ---------- 画质 ----------
    const qualityY = cy - panelH / 2 + 196;
    this.settingsOverlay.add(createUIText(this, cx - 170, qualityY, '画质', labelStyle).setOrigin(0, 0.5));
    const qLabels: QualityLevel[] = ['low', 'medium', 'high'];
    const qNames: Record<QualityLevel, string> = { low: '低', medium: '中', high: '高' };
    qLabels.forEach((lvl, i) => {
      const text = this.createSmallButton(cx - 40 + i * 70, qualityY, qNames[lvl], () => this.setQuality(lvl));
      this.settingsOverlay.add(text);
      this.qualityTexts[lvl] = text;
    });

    // ---------- 静音 ----------
    const muteY = cy - panelH / 2 + 246;
    this.settingsOverlay.add(createUIText(this, cx - 170, muteY, '静音', labelStyle).setOrigin(0, 0.5));
    this.muteText = createUIText(this, cx, muteY, this.muted ? '开' : '关', { fontSize: '16px', color: this.muted ? '#ff6b35' : '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.toggleMute());
    this.settingsOverlay.add(this.muteText);

    // ---------- 关闭 ----------
    const closeBtn = createUIText(this, cx, cy + panelH / 2 - 30, '关闭', {
        fontSize: '18px',
        color: '#e0e0e0',
        backgroundColor: '#1a1a25',
        padding: { left: 36, right: 36, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#ff6b35', backgroundColor: '#2a2a35' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ color: '#e0e0e0', backgroundColor: '#1a1a25' }));
    closeBtn.on('pointerdown', () => this.settingsOverlay.setVisible(false));
    this.settingsOverlay.add(closeBtn);

    // 初始化画质按钮高亮
    this.refreshQualityHighlight();
  }

  /** 创建小型文本按钮 */
  private createSmallButton(x: number, y: number, label: string, callback: () => void): Phaser.GameObjects.Text {
    const btn = createUIText(this, x, y, label, {
        fontSize: '16px',
        color: '#e0e0e0',
        backgroundColor: '#252530',
        padding: { left: 14, right: 14, top: 6, bottom: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff', backgroundColor: '#353555' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#e0e0e0', backgroundColor: '#252530' }));
    btn.on('pointerdown', callback);
    return btn;
  }

  // ========== 设置操作 ==========

  private adjustMusic(delta: number): void {
    this.musicVolume = Phaser.Math.Clamp(this.musicVolume + delta, 0, 100);
    AudioManager.getInstance().setMusicVolume(this.musicVolume / 100);
    this.musicVolText.setText(`${this.musicVolume}%`);
    GameManager.getInstance().saveProgress();
  }

  private adjustSfx(delta: number): void {
    this.sfxVolume = Phaser.Math.Clamp(this.sfxVolume + delta, 0, 100);
    AudioManager.getInstance().setSfxVolume(this.sfxVolume / 100);
    this.sfxVolText.setText(`${this.sfxVolume}%`);
    GameManager.getInstance().saveProgress();
  }

  private setQuality(level: QualityLevel): void {
    this.quality = level;
    GameManager.getInstance().setQualityLevel(level);
    this.refreshQualityHighlight();
  }

  private refreshQualityHighlight(): void {
    const qLabels: QualityLevel[] = ['low', 'medium', 'high'];
    qLabels.forEach((lvl) => {
      const text = this.qualityTexts[lvl];
      if (lvl === this.quality) {
        text.setStyle({ color: '#000000', backgroundColor: '#00ffff' });
      } else {
        text.setStyle({ color: '#e0e0e0', backgroundColor: '#252530' });
      }
    });
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    AudioManager.getInstance().setMuted(this.muted);
    this.muteText.setText(this.muted ? '开' : '关');
    this.muteText.setStyle({ color: this.muted ? '#ff6b35' : '#ffffff', fontStyle: 'bold' });
    GameManager.getInstance().saveProgress();
  }
}
