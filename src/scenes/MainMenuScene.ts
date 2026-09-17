import { createUIText } from '../utils/UIText';
import { UIColors, UIFonts, createUIButton, createUIPanel } from '../ui/UIStyle';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { AudioManager } from '../systems/AudioManager';
import { SOUND_KEYS } from '../data/sounds';
import { setupUICamera } from '../utils/CameraHelper';
import type { QualityLevel } from '../game/GameConfig';
import { LEVELS } from '../data/levels';
import type { LevelConfig } from '../data/levels';
import { ENEMY_CONFIGS } from '../data/enemies';
import { Layers } from '../constants/Layers';

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
  private qualityTexts: Record<QualityLevel, Phaser.GameObjects.Text> = {} as Record<
    QualityLevel,
    Phaser.GameObjects.Text
  >;
  private muteText!: Phaser.GameObjects.Text;
  private showFpsText!: Phaser.GameObjects.Text;
  private fullscreenText!: Phaser.GameObjects.Text;
  // 关卡选择面板
  private levelSelectOverlay!: Phaser.GameObjects.Container;

  constructor() {
    super('MainMenuScene');
  }
  create(data?: { openLevelSelect?: boolean }): void {
    // 真机 UI 缩放：中心放大面板（贴边元素已用 anchor 换算）
    this.cameras.main.setZoom(GameConfig.uiScale);
    // 从选角场景点「开始冒险」进入时：自动打开选关面板
    if (data?.openLevelSelect) {
      this.time.delayedCall(120, () => this.openLevelSelect());
    }
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
    }).setOrigin(0.5);
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
    const halo1 = this.add.circle(centerX, height * 0.25, 120, 0xff6b35, 0.07).setDepth(Layers.BACKGROUND);
    const halo2 = this.add.circle(centerX, height * 0.25, 78, 0xff8844, 0.1).setDepth(Layers.BACKGROUND);
    this.tweens.add({
      targets: [halo1, halo2],
      alpha: 0.035,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    // 副标题
    createUIText(this, centerX, height * 0.25 + 50, '2D 割草生存', {
      fontSize: UIFonts.body,
      color: UIColors.textDim,
    }).setOrigin(0.5);
    // 菜单按钮（5 个：开始游戏/继续/设置/成就/试玩场地；开始游戏 = 新游戏入口，先进选角再选关）
    // 布局：避开副标题（0.25H+50），也远离底部统计（H-60）
    const buttonSpacing = 56;
    const buttonY = height * 0.44 - buttonSpacing / 2;
    this.createMenuButton(centerX, buttonY, '开始游戏', () => this.scene.start('CharacterSelectScene'));
    this.createMenuButton(centerX, buttonY + buttonSpacing, '继续游戏', () => this.continueGame());
    this.createMenuButton(centerX, buttonY + buttonSpacing * 2, '设置', () => this.openSettings());
    this.createMenuButton(centerX, buttonY + buttonSpacing * 3, '🏅 成就', () => this.openAchievements());
    this.createMenuButton(centerX, buttonY + buttonSpacing * 4, '🧪 试玩场地', () => this.enterTestField());
    // 底部信息
    const stats = gm.stats;
    createUIText(
      this,
      centerX,
      height - 60,
      `最高分: ${stats.highScore}  |  总击杀: ${stats.totalKills}  |  游戏次数: ${stats.gamesPlayed}`,
      {
        fontSize: UIFonts.small,
        color: UIColors.textFaint,
      }
    ).setOrigin(0.5);
    // 版本号
    createUIText(this, width - 10, height - 10, 'v0.2.0', {
      fontSize: UIFonts.tiny,
      color: UIColors.textFaint,
    }).setOrigin(1, 1);

    // 版本更新检测：与上次游玩版本对比，变化时提示（识别缓存旧版/确认已加载新版）
    try {
      const UI_VERSION = 'v0.2.0';
      const lastVer = localStorage.getItem('keep_living_ui_version');
      if (lastVer && lastVer !== UI_VERSION) {
        createUIText(this, width - 10, height - 38, '⚡ 已更新至 ' + UI_VERSION, {
          fontSize: UIFonts.small,
          color: UIColors.blue,
          backgroundColor: 'rgba(20,20,40,0.7)',
          padding: { left: 8, right: 8, top: 3, bottom: 3 },
        }).setOrigin(1, 1);
      }
      localStorage.setItem('keep_living_ui_version', UI_VERSION);
    } catch {
      /* 隐私模式等场景忽略 */
    }
    // 设备标识
    if (gm.isMobile) {
      createUIText(this, 10, height - 10, `移动端 · ${gm.qualityLevel}`, {
        fontSize: UIFonts.tiny,
        color: UIColors.textFaint,
      }).setOrigin(0, 1);
    }
    // 创建设置面板 + 关卡选择面板（初始隐藏）
    this.createSettingsOverlay();
    this.createLevelSelectOverlay();
  }
  /** 漂移光点：大而朦胧的光团缓慢水平漂移 + 呼吸（与闪烁星点错开，增强背景层次） */

  private createDriftingOrbs(width: number, height: number): void {
    for (let i = 0; i < 7; i++) {
      const r = 14 + Math.random() * 26;
      const orb = this.add
        .circle(
          Math.random() * width,
          Math.random() * height,
          r,
          i % 2 === 0 ? 0x3355aa : 0xff8844,
          0.05 + Math.random() * 0.04
        )
        .setDepth(Layers.BACKGROUND);
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
    createUIButton(this, x, y, text, callback, {
      fontSize: '24px',
      padding: { left: 40, right: 40, top: 12, bottom: 12 },
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
  private levelInfoButtons: Phaser.GameObjects.Text[] = [];
  private previewLevelIndex = 0;
  private levelPreviewRows: {
    name: Phaser.GameObjects.Text;
    note: Phaser.GameObjects.Text;
  }[] = [];

  private createLevelSelectOverlay(): void {
    const width = GameConfig.GAME_WIDTH;
    const height = GameConfig.GAME_HEIGHT;
    const cx = width / 2;
    const cy = height / 2;
    const panelW = 800;
    const panelH = 480;
    this.levelSelectOverlay = this.add.container(0, 0).setDepth(Layers.MENU_OVERLAY).setVisible(false);
    // 全屏遮罩
    const mask = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setInteractive();
    mask.on('pointerdown', () => this.levelSelectOverlay.setVisible(false));
    this.levelSelectOverlay.add(mask);
    // 面板背景
    const bg = createUIPanel(this, cx - panelW / 2, cy - panelH / 2, panelW, panelH);
    this.levelSelectOverlay.add(bg);
    // 标题
    this.levelSelectOverlay.add(
      createUIText(this, cx, cy - panelH / 2 + 40, '选择区域', {
        fontSize: UIFonts.titleM,
        color: UIColors.accent,
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );
    // 说明
    this.levelSelectOverlay.add(
      createUIText(this, cx, cy - panelH / 2 + 78, '通关前置区域后解锁；已解锁区域可随时直进（附快速开局包）', {
        fontSize: UIFonts.small,
        color: UIColors.textDim,
      }).setOrigin(0.5)
    );
    // 各关卡按钮（第 1 关恒解锁）
    const startY = cy - panelH / 2 + 130;
    const gm = GameManager.getInstance();
    this.levelInfoButtons = [];
    this.levelSelectButtons = [];
    LEVELS.forEach((lv, i) => {
      const y = startY + i * 80;
      const unlocked = i === 0 || gm.isLevelUnlocked(i);
      const label = `${i === 0 ? '🌿' : i === 1 ? '🏚️' : '❄️'} ${lv.name}  ${unlocked ? '' : '🔒'}`;
      const btn = createUIText(this, cx - 210, y, label, {
        fontSize: '20px',
        color: unlocked ? UIColors.text : UIColors.textFaint,
        backgroundColor: unlocked ? UIColors.btnPanelBg : UIColors.btnLockedBg,
        padding: { left: 46, right: 46, top: 12, bottom: 12 },
      }).setOrigin(0.5);
      if (unlocked) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => {
          btn.setStyle({ color: UIColors.accent, backgroundColor: '#353555' });
          this.updateLevelPreview(LEVELS[i]);
        });
        btn.on('pointerout', () => btn.setStyle({ color: UIColors.text, backgroundColor: UIColors.btnPanelBg }));
        btn.on('pointerdown', () => {
          this.levelSelectOverlay.setVisible(false);
          this.startGame(i);
        });
      }
      this.levelSelectOverlay.add(btn);
      // 感叹号按钮：移动端无 hover，点击查看该关敌人图鉴（桌面端 hover 保留）
      if (unlocked) {
        const infoBtn = createUIText(this, cx - 110, y, '!', {
          fontSize: UIFonts.label,
          color: UIColors.blue,
          backgroundColor: UIColors.btnBlueBg,
          padding: { left: 10, right: 10, top: 6, bottom: 6 },
        })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        infoBtn.on('pointerdown', () => {
          AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
          this.updateLevelPreview(LEVELS[i]);
        });
        infoBtn.on('pointerover', () => infoBtn.setStyle({ backgroundColor: '#2a2a55' }));
        infoBtn.on('pointerout', () => this.applyLevelInfoHighlight());
        this.levelSelectOverlay.add(infoBtn);
        this.levelInfoButtons.push(infoBtn);
      }
      this.levelSelectButtons.push(btn);
    });
    // 关闭
    // ===== 本关敌人图鉴（数据驱动：LEVELS[i].enemyPreview） =====
    const gx = cx + 55;
    const gy = cy - panelH / 2 + 130;
    this.levelSelectOverlay.add(
      createUIText(this, gx, gy - 26, '本关敌人', {
        fontSize: UIFonts.body,
        color: UIColors.accent,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5)
    );
    // 敌方情报入口（打开独立图鉴页，明日方舟式左列表右详情）
    const codexBtn = createUIText(this, gx + 212, gy - 26, '📖 敌方情报', {
      fontSize: UIFonts.desc,
      color: UIColors.blue,
      backgroundColor: UIColors.btnBlueBg,
      padding: { left: 12, right: 12, top: 5, bottom: 5 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    codexBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      // launch 叠加而非 start：返回时只关情报页，保留选关面板
      this.scene.launch('EnemyCodexScene', {
        levelId: LEVELS[this.previewLevelIndex ?? 0].id,
      });
    });
    codexBtn.on('pointerover', () => codexBtn.setStyle({ backgroundColor: '#2a2a55' }));
    codexBtn.on('pointerout', () => codexBtn.setStyle({ backgroundColor: '#1a1a35' }));
    this.levelSelectOverlay.add(codexBtn);
    this.levelPreviewRows = [];
    for (let r = 0; r < 5; r++) {
      const nameT = createUIText(this, gx, gy + r * 34, '', {
        fontSize: UIFonts.small,
        color: UIColors.textDim,
      }).setOrigin(0, 0.5);
      const noteT = createUIText(this, gx + 88, gy + r * 34, '', {
        fontSize: UIFonts.small,
        color: UIColors.textDim,
      }).setOrigin(0, 0.5);
      this.levelSelectOverlay.add(nameT);
      this.levelSelectOverlay.add(noteT);
      this.levelPreviewRows.push({ name: nameT, note: noteT });
    }
    this.updateLevelPreview(LEVELS[0]);
    const closeBtn = createUIButton(this, cx, cy + panelH / 2 - 32, '关闭', () => this.levelSelectOverlay.setVisible(false), {
      fontSize: UIFonts.body,
      padding: { left: 36, right: 36, top: 10, bottom: 10 },
    });
    this.levelSelectOverlay.add(closeBtn);
  }
  /** 打开前刷新解锁状态（通关后回到主菜单，新区域应变为可点） */
  /** 更新选关面板的本关敌人图鉴（数据驱动：enemyPreview + ENEMY_CONFIGS） */

  private updateLevelPreview(level: LevelConfig): void {
    const list = level.enemyPreview ?? [];
    for (let r = 0; r < this.levelPreviewRows.length; r++) {
      const item = list[r];
      const row = this.levelPreviewRows[r];
      if (item) {
        const cfg = ENEMY_CONFIGS[item.type];
        const color = '#' + (cfg.color ?? 0x888888).toString(16).padStart(6, '0');
        row.name
          .setText('◆ ' + (cfg.name ?? item.type))
          .setColor(color)
          .setVisible(true);
        row.note.setText(item.note.length > 12 ? item.note.slice(0, 12) + '…' : item.note).setVisible(true);
      } else {
        row.name.setVisible(false);
        row.note.setVisible(false);
      }
    }
    // 高亮当前图鉴来源关卡（感叹号按钮）
    const idx = LEVELS.findIndex((lv) => lv.id === level.id);
    this.previewLevelIndex = idx;
    this.applyLevelInfoHighlight();
  }
  /** 感叹号按钮高亮：高亮当前图鉴来源关卡，其余恢复默认 */

  private applyLevelInfoHighlight(): void {
    this.levelInfoButtons.forEach((b, k) => {
      const active = k === this.previewLevelIndex;
      b.setStyle({
        color: active ? UIColors.gold : UIColors.blue,
        backgroundColor: active ? '#35355a' : UIColors.btnBlueBg,
      });
    });
  }

  private refreshLevelSelect(): void {
    const gm = GameManager.getInstance();
    this.levelSelectButtons.forEach((btn, i) => {
      const lv = LEVELS[i];
      if (!lv) return;
      const unlocked = i === 0 || gm.isLevelUnlocked(i);
      btn.setText(`${i === 0 ? '🌿' : i === 1 ? '🏚️' : '❄️'} ${lv.name}  ${unlocked ? '' : '🔒'}`);
      btn.setStyle({
        color: unlocked ? UIColors.text : UIColors.textFaint,
        backgroundColor: unlocked ? UIColors.btnPanelBg : UIColors.btnLockedBg,
      });
      if (unlocked && !btn.input?.enabled) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ color: UIColors.accent, backgroundColor: '#353555' }));
        btn.on('pointerout', () => btn.setStyle({ color: UIColors.text, backgroundColor: UIColors.btnPanelBg }));
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
    const panelH = 420;
    this.settingsOverlay = this.add.container(0, 0).setDepth(Layers.MENU_OVERLAY).setVisible(false);
    // 全屏遮罩（点击遮罩也可关闭）
    const mask = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setInteractive();
    mask.on('pointerdown', () => this.settingsOverlay.setVisible(false));
    this.settingsOverlay.add(mask);
    // 面板背景
    const bg = createUIPanel(this, cx - panelW / 2, cy - panelH / 2, panelW, panelH);
    this.settingsOverlay.add(bg);
    // 标题
    this.settingsOverlay.add(
      createUIText(this, cx, cy - panelH / 2 + 38, '设 置', {
        fontSize: UIFonts.titleM,
        color: UIColors.accent,
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: UIFonts.label,
      color: UIColors.text,
    };
    // ---------- 音乐音量 ----------
    const musicY = cy - panelH / 2 + 96;
    this.settingsOverlay.add(createUIText(this, cx - 170, musicY, '音乐音量', labelStyle).setOrigin(0, 0.5));
    this.musicVolText = createUIText(this, cx - 20, musicY, `${this.musicVolume}%`, {
      fontSize: UIFonts.label,
      color: UIColors.textBright,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.settingsOverlay.add(this.musicVolText);
    this.settingsOverlay.add(this.createSmallButton(cx + 40, musicY, '−', () => this.adjustMusic(-10)));
    this.settingsOverlay.add(this.createSmallButton(cx + 90, musicY, '+', () => this.adjustMusic(10)));
    // ---------- 音效音量 ----------
    const sfxY = cy - panelH / 2 + 146;
    this.settingsOverlay.add(createUIText(this, cx - 170, sfxY, '音效音量', labelStyle).setOrigin(0, 0.5));
    this.sfxVolText = createUIText(this, cx - 20, sfxY, `${this.sfxVolume}%`, {
      fontSize: UIFonts.label,
      color: UIColors.textBright,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.settingsOverlay.add(this.sfxVolText);
    this.settingsOverlay.add(this.createSmallButton(cx + 40, sfxY, '−', () => this.adjustSfx(-10)));
    this.settingsOverlay.add(this.createSmallButton(cx + 90, sfxY, '+', () => this.adjustSfx(10)));
    // ---------- 画质 ----------
    const qualityY = cy - panelH / 2 + 196;
    this.settingsOverlay.add(createUIText(this, cx - 170, qualityY, '画质', labelStyle).setOrigin(0, 0.5));
    const qLabels: QualityLevel[] = ['low', 'medium', 'high'];
    const qNames: Record<QualityLevel, string> = {
      low: '低',
      medium: '中',
      high: '高',
    };
    qLabels.forEach((lvl, i) => {
      const text = this.createSmallButton(cx - 40 + i * 70, qualityY, qNames[lvl], () => this.setQuality(lvl));
      this.settingsOverlay.add(text);
      this.qualityTexts[lvl] = text;
    });
    // ---------- 静音 ----------
    const muteY = cy - panelH / 2 + 246;
    this.settingsOverlay.add(createUIText(this, cx - 170, muteY, '静音', labelStyle).setOrigin(0, 0.5));
    this.muteText = createUIText(this, cx, muteY, this.muted ? '开' : '关', {
      fontSize: UIFonts.label,
      color: this.muted ? UIColors.accent : UIColors.textBright,
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => this.toggleMute());
    this.settingsOverlay.add(this.muteText);
    // ---------- 显示 FPS ----------
    const showFpsY = cy - panelH / 2 + 296;
    this.settingsOverlay.add(createUIText(this, cx - 170, showFpsY, '显示FPS', labelStyle).setOrigin(0, 0.5));
    const gmFps = GameManager.getInstance();
    this.showFpsText = createUIText(this, cx, showFpsY, gmFps.showFps ? '开' : '关', {
      fontSize: UIFonts.label,
      color: gmFps.showFps ? UIColors.accent : UIColors.textBright,
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.showFpsText.on('pointerdown', () => this.toggleShowFps());
    this.settingsOverlay.add(this.showFpsText);
    // ---------- 全屏 ----------
    const fullscreenY = cy - panelH / 2 + 346;
    this.settingsOverlay.add(createUIText(this, cx - 170, fullscreenY, '全屏', labelStyle).setOrigin(0, 0.5));
    const fsSupported =
      typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
    this.fullscreenText = createUIText(
      this,
      cx,
      fullscreenY,
      fsSupported ? (document.fullscreenElement ? '开' : '关') : '添加到主屏幕',
      {
        fontSize: UIFonts.label,
        color: fsSupported ? UIColors.textBright : UIColors.text,
        fontStyle: 'bold',
      },
    )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.fullscreenText.on('pointerdown', () => this.toggleFullscreen());
    this.settingsOverlay.add(this.fullscreenText);
    // ---------- 关闭 ----------
    const closeBtn = createUIButton(this, cx, cy + panelH / 2 - 30, '关闭', () => this.settingsOverlay.setVisible(false), {
      fontSize: UIFonts.body,
      padding: { left: 36, right: 36, top: 10, bottom: 10 },
    });
    this.settingsOverlay.add(closeBtn);
    // 初始化画质按钮高亮
    this.refreshQualityHighlight();
  }
  /** 创建小型文本按钮 */

  private createSmallButton(x: number, y: number, label: string, callback: () => void): Phaser.GameObjects.Text {
    const btn = createUIText(this, x, y, label, {
      fontSize: UIFonts.label,
      color: UIColors.text,
      backgroundColor: UIColors.btnPanelBg,
      padding: { left: 14, right: 14, top: 6, bottom: 6 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: UIColors.textBright, backgroundColor: '#353555' }));
    btn.on('pointerout', () => btn.setStyle({ color: UIColors.text, backgroundColor: UIColors.btnPanelBg }));
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
        text.setStyle({ color: '#000000', backgroundColor: UIColors.accent });
      } else {
        text.setStyle({ color: UIColors.text, backgroundColor: UIColors.btnPanelBg });
      }
    });
  }

  private toggleShowFps(): void {
    const gm = GameManager.getInstance();
    gm.setShowFps(!gm.showFps);
    this.showFpsText.setText(gm.showFps ? '开' : '关');
    this.showFpsText.setColor(gm.showFps ? UIColors.accent : UIColors.textBright);
  }

  /**
   * 切换全屏；不支持全屏 API 的环境（如 iOS Safari）提示添加到主屏幕（PWA display:fullscreen）
   */
  private toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => void;
    };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      const exit = document.exitFullscreen?.bind(document) ?? (doc as any).webkitExitFullscreen?.bind(doc);
      exit?.();
      this.fullscreenText.setText('关');
      this.fullscreenText.setColor(UIColors.textBright);
    } else if (el.requestFullscreen || el.webkitRequestFullscreen) {
      const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      try {
        const p = req?.();
        // 乐观更新；失败时回滚状态
        this.fullscreenText.setText('开');
        this.fullscreenText.setColor(UIColors.accent);
        if (p && typeof p.then === 'function') {
          p.catch(() => {
            this.fullscreenText.setText('关');
            this.fullscreenText.setColor(UIColors.textBright);
          });
        }
      } catch {
        /* 用户手势限制等，忽略 */
      }
    } else {
      // 不支持全屏 API：直接开启 PWA 提示
      this.fullscreenText.setText('添加到主屏幕');
      this.fullscreenText.setColor(UIColors.text);
    }
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    AudioManager.getInstance().setMuted(this.muted);
    this.muteText.setText(this.muted ? '开' : '关');
    this.muteText.setStyle({
      color: this.muted ? UIColors.accent : UIColors.textBright,
      fontStyle: 'bold',
    });
    GameManager.getInstance().saveProgress();
  }
}
