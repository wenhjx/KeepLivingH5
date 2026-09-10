import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { AudioManager } from '../systems/AudioManager';
import { SOUND_KEYS } from '../data/sounds';
import { setupUICamera } from '../utils/CameraHelper';
import type { QualityLevel } from '../game/GameConfig';
import { LEVELS } from '../data/levels';

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
  // 关卡选择面板
  private levelSelectOverlay!: Phaser.GameObjects.Container;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    // 真机 UI 缩放：中心放大面板（贴边元素已用 anchor 换算）
    this.cameras.main.setZoom(GameConfig.uiScale);
    // 调试场景常驻保障：主菜单阶段也确保 DebugScene 可用（异常停掉后自动恢复）
    if (!this.scene.isActive('DebugScene')) {
      this.scene.launch('DebugScene');
    }

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

    // 背景：垂直渐变夜空（上深下微蓝紫）+ 星点 + 漂移光点装饰
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a12, 0x0a0a12, 0x151a30, 0x151a30, 1);
    bg.fillRect(0, 0, width, height);
    this.createBackgroundStars(width, height);
    this.createDriftingOrbs(width, height);

    // 标题
    const title = createUIText(this, centerX, height * 0.25, 'KEEP LIVING', {
        fontSize: '56px',
        fontFamily: 'Arial',
        color: '#ff6b35',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 标题发光 + 呼吸动效（纯视觉，不绑定玩法）
    title.setShadow(0, 0, '#ff6b35', 14, true, true);
    this.tweens.add({
      targets: title,
      scale: { from: 1, to: 1.04 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // 标题背后双层光晕（收敛半径，与徽章金色星点风格区分：橙色呼吸晕）
    const halo1 = this.add.circle(centerX, height * 0.25, 120, 0xff6b35, 0.07).setDepth(-1);
    const halo2 = this.add.circle(centerX, height * 0.25, 78, 0xff8844, 0.1).setDepth(-1);
    this.tweens.add({ targets: [halo1, halo2], alpha: 0.035, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // 副标题
    createUIText(this, centerX, height * 0.25 + 50, '2D 割草生存', {
        fontSize: '20px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // 菜单按钮（5 个：开始/继续/设置/成就/试玩场地，整体上移防止底部信息被遮挡）
    const buttonY = height * 0.44;
    const buttonSpacing = 56;

    this.createMenuButton(centerX, buttonY, '开始游戏', () => this.openLevelSelect());
    this.createMenuButton(centerX, buttonY + buttonSpacing, '继续游戏', () => this.continueGame());
    this.createMenuButton(centerX, buttonY + buttonSpacing * 2, '设置', () => this.openSettings());
    this.createMenuButton(centerX, buttonY + buttonSpacing * 3, '🏅 成就', () => this.openAchievements());
    this.createMenuButton(centerX, buttonY + buttonSpacing * 4, '🧪 试玩场地', () => this.enterTestField());

    // 底部信息
    const stats = gm.stats;
    createUIText(this, centerX, GameConfig.anchorY(height - 60, height), `最高分: ${stats.highScore}  |  总击杀: ${stats.totalKills}  |  游戏次数: ${stats.gamesPlayed}`, {
        fontSize: '14px',
        color: '#555555',
      })
      .setOrigin(0.5);

    // 版本号
    createUIText(this, GameConfig.anchorX(width - 10, width), GameConfig.anchorY(height - 10, height), 'v0.1.0', {
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

    // 创建设置面板 + 关卡选择面板（初始隐藏）
    this.createSettingsOverlay();
    this.createLevelSelectOverlay();
  }

  /** 漂移光点：大而朦胧的光团缓慢水平漂移 + 呼吸（与闪烁星点错开，增强背景层次） */
  private createDriftingOrbs(width: number, height: number): void {
    for (let i = 0; i < 7; i++) {
      const r = 14 + Math.random() * 26;
      const orb = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        r,
        i % 2 === 0 ? 0x3355aa : 0xff8844,
        0.05 + Math.random() * 0.04
      ).setDepth(-1);
      const speed = 12 + Math.random() * 18;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const startX = orb.x;
      this.tweens.add({
        targets: orb,
        x: startX + dir * (30 + Math.random() * 40),
        duration: 2600 + Math.random() * 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this.tweens.add({
        targets: orb,
        alpha: 0.02,
        duration: 1500 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  /** 背景星点（纯装饰，轻量，低配设备可承受） */
  private createBackgroundStars(width: number, height: number): void {
    for (let i = 0; i < 26; i++) {
      const star = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        0.6 + Math.random() * 1.2,
        0xffffff,
        0.25 + Math.random() * 0.5
      );
      this.tweens.add({
        targets: star,
        alpha: 0.06,
        duration: 900 + Math.random() * 1400,
        delay: Math.random() * 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
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

    btn.on('pointerdown', () => {
      this.tweens.add({ targets: btn, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true });
    });

    btn.on('pointerover', () => {
      btn.setStyle({ color: '#ff6b35', backgroundColor: '#2a2a35' });
    });
    btn.on('pointerout', () => {
      btn.setStyle({ color: '#e0e0e0', backgroundColor: '#1a1a25' });
    });
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      callback();
    });
  }

  /** 开始对局：levelIndex=0 全新第 1 关；>0 直进模式（附快速开局包补偿 build 积累） */
  private startGame(levelIndex = 0): void {
    const gm = GameManager.getInstance();
    if (levelIndex === 0) {
      // 正常全新对局
      gm.startNewRun(0);
    } else {
      // 直进选关：直接在该关卡开局，应用快速开局包
      const cfg = LEVELS[levelIndex];
      gm.startNewRun(levelIndex);
      if (cfg.quickStart) gm.setQuickStart(cfg.quickStart);
    }
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  /** 打开关卡选择面板（未解锁关卡灰色不可点） */
  private openLevelSelect(): void {
    // 刷新面板内各关卡按钮的可点击/文案状态
    this.refreshLevelSelect();
    this.levelSelectOverlay.setVisible(true);
  }

  /** 进入试玩场地：复用主场景全部战斗逻辑 + 稳定态（无敌+锁升级），不存档/不计统计/不触发成就 */
  private enterTestField(): void {
    const api = (window as any).__debug;
    if (api && typeof api.enterTestField === 'function') {
      api.enterTestField();
    } else {
      console.warn('[debug] __debug.enterTestField 不可用');
    }
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

  /** 打开成就面板（独立场景，返回时重建主菜单） */
  private openAchievements(): void {
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
    this.scene.start('AchievementScene');
  }

  private openSettings(): void {
    // 打开面板前刷新当前值
    this.settingsOverlay.setVisible(true);
  }

  // ========== 关卡选择面板 ==========

  private levelSelectButtons: Phaser.GameObjects.Text[] = [];

  private createLevelSelectOverlay(): void {
    const width = GameConfig.GAME_WIDTH;
    const height = GameConfig.GAME_HEIGHT;
    const cx = width / 2;
    const cy = height / 2;
    const panelW = 520;
    const panelH = 420;

    this.levelSelectOverlay = this.add.container(0, 0).setDepth(200).setVisible(false);

    // 全屏遮罩
    const mask = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive();
    mask.on('pointerdown', () => this.levelSelectOverlay.setVisible(false));
    this.levelSelectOverlay.add(mask);

    // 面板背景
    const bg = this.add.graphics();
    bg.fillStyle(0x16161f, 0.98);
    bg.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    bg.lineStyle(2, 0xff6b35, 0.4);
    bg.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    this.levelSelectOverlay.add(bg);

    // 标题
    this.levelSelectOverlay.add(
      createUIText(this, cx, cy - panelH / 2 + 40, '选择区域', { fontSize: '28px', color: '#ff6b35', fontStyle: 'bold' })
        .setOrigin(0.5)
    );

    // 说明
    this.levelSelectOverlay.add(
      createUIText(this, cx, cy - panelH / 2 + 78, '通关前置区域后解锁；已解锁区域可随时直进（附快速开局包）', {
        fontSize: '13px',
        color: '#888888',
      })
        .setOrigin(0.5)
    );

    // 各关卡按钮（第 1 关恒解锁）
    const startY = cy - panelH / 2 + 130;
    const gm = GameManager.getInstance();
    this.levelSelectButtons = [];
    LEVELS.forEach((lv, i) => {
      const y = startY + i * 80;
      const unlocked = i === 0 || gm.isLevelUnlocked(i);
      const label = `${i === 0 ? '🌿' : i === 1 ? '🏚️' : '❄️'} ${lv.name}  ${unlocked ? '' : '🔒'}`;
      const btn = createUIText(this, cx, y, label, {
          fontSize: '20px',
          color: unlocked ? '#e0e0e0' : '#555555',
          backgroundColor: unlocked ? '#252530' : '#1a1a22',
          padding: { left: 46, right: 46, top: 12, bottom: 12 },
        })
        .setOrigin(0.5);
      if (unlocked) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ color: '#ff6b35', backgroundColor: '#353555' }));
        btn.on('pointerout', () => btn.setStyle({ color: '#e0e0e0', backgroundColor: '#252530' }));
        btn.on('pointerdown', () => {
          this.levelSelectOverlay.setVisible(false);
          this.startGame(i);
        });
      }
      this.levelSelectOverlay.add(btn);
      this.levelSelectButtons.push(btn);
    });

    // 关闭
    const closeBtn = createUIText(this, cx, cy + panelH / 2 - 32, '关闭', {
        fontSize: '18px',
        color: '#e0e0e0',
        backgroundColor: '#1a1a25',
        padding: { left: 36, right: 36, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#ff6b35', backgroundColor: '#2a2a35' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ color: '#e0e0e0', backgroundColor: '#1a1a25' }));
    closeBtn.on('pointerdown', () => this.levelSelectOverlay.setVisible(false));
    this.levelSelectOverlay.add(closeBtn);
  }

  /** 打开前刷新解锁状态（通关后回到主菜单，新区域应变为可点） */
  private refreshLevelSelect(): void {
    const gm = GameManager.getInstance();
    this.levelSelectButtons.forEach((btn, i) => {
      const lv = LEVELS[i];
      if (!lv) return;
      const unlocked = i === 0 || gm.isLevelUnlocked(i);
      btn.setText(`${i === 0 ? '🌿' : i === 1 ? '🏚️' : '❄️'} ${lv.name}  ${unlocked ? '' : '🔒'}`);
      btn.setStyle({ color: unlocked ? '#e0e0e0' : '#555555', backgroundColor: unlocked ? '#252530' : '#1a1a22' });
      if (unlocked && !btn.input?.enabled) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ color: '#ff6b35', backgroundColor: '#353555' }));
        btn.on('pointerout', () => btn.setStyle({ color: '#e0e0e0', backgroundColor: '#252530' }));
        btn.on('pointerdown', () => {
          this.levelSelectOverlay.setVisible(false);
          this.startGame(i);
        });
      }
    });
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
