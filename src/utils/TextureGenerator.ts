import Phaser from 'phaser';

/**
 * 霓虹深渊 (Neon Abyss) 主题纹理生成器
 * 用程序生成所有游戏素材，无需外部图片文件
 * 风格：深色背景 + 霓虹发光 + 多层细节几何图形
 */
export class TextureGenerator {
  private scene: Phaser.Scene;

  // 主题色板
  static readonly COLORS = {
    bg: 0x0a0a15,
    player: 0x00ffff,
    playerGlow: 0x00ffff,
    playerAccent: 0xff6600,
    enemyNormal: 0x00ff88,
    enemyFast: 0x4488ff,
    enemyTank: 0xff8844,
    enemyRanged: 0xff44ff,
    enemyElite: 0xffaa00,
    enemyBoss: 0xff2244,
    enemySuicider: 0xff5500,
    enemySplitter: 0xcc44ff,
    enemyShielded: 0x88aaff,
    bullet: 0xffffff,
    bulletGlow: 0x00ffff,
    exp: 0x00ffff,
    health: 0xff4466,
    coin: 0xffcc00,
    ui: 0x2a2a40,
    uiBorder: 0x00ffff,
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 生成所有游戏纹理 */
  generateAll(): void {
    this.generatePlayer();
    this.generateEnemies();
    this.generateBullets();
    this.generatePickups();
    this.generateParticles();
    this.generateUI();
    this.generateWeapons();
    this.generateTiles();
    this.generateObstacles();
  }

  // ========== 玩家 ==========
  // 像素风：玩家改为 16x16 像素飞船（scale=4 → 64x64，与原矢量版尺寸/物理/逻辑完全一致，
  // 仅替换观感，避免回炉）。运行时 setRotation 旋转，纹理尖端朝上，头尾分明（白尖/黄尾焰）。
  private static readonly PLAYER_PIXEL = [
    '.....WWCCWW.....',
    '....WCCCCCCW....',
    '...WCCCCCCCCW...',
    '..WCCCCCCCCCCW..',
    '.WCCCCCCCCCCCCW.',
    'CCCCCCCCCCCCCCCC',
    'CCCCWWWWWWWWCCCC',
    'CCCCWCCCCCCWCCCC',
    'CCCCWCCCCCCWCCCC',
    '.CCCCCCCCCCCCCC.',
    '.CCCCCCCCCCCCCC.',
    '..CCCCCCCCCCCC..',
    '...CCCCCCCCCC...',
    '....CCCCCCCC....',
    '.....CCYYCC.....',
    '......YYYY......',
  ];
  private static readonly PLAYER_PALETTE: Record<string, number> = {
    C: 0x00ccff, // 机身青色
    W: 0xffffff, // 高光/驾驶舱
    Y: 0xffcc00, // 尾焰
  };

  /**
   * 像素矩阵绘制：grid 为等宽字符串行，每字符对应调色板颜色（'.'=透明），
   * 按 scale 放大每格生成小尺寸像素纹理。同一像素造型可复用于敌人/子弹等。
   */
  private drawPixelTexture(
    key: string,
    grid: string[],
    palette: Record<string, number>,
    scale: number
  ): void {
    const h = grid.length;
    const w = grid.reduce((max, row) => Math.max(max, row.length), 0);
    const size = Math.max(w, h) * scale;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (let y = 0; y < h; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const color = palette[ch];
        if (color === undefined) continue;
        g.fillStyle(color, 1);
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private generatePlayer(): void {
    this.drawPixelTexture('player', TextureGenerator.PLAYER_PIXEL, TextureGenerator.PLAYER_PALETTE, 4);
  }

  // ========== 敌人 ==========
  // 像素风：9 种敌人统一 16x16 像素网格造型，按各自原纹理尺寸缩放（浮点 scale），
  // 纹理尺寸与碰撞/逻辑保持完全一致（零回炉）。主体用白色（W）+ 深灰暗部（D），
  // 运行时由 Enemy.setTint(config.color) 上色——不同敌人靠形状区分，色板逻辑不变。
  private static readonly ENEMY_PIXELS: Record<string, { grid: string[]; scale: number }> = {
    enemy_normal: {
      scale: 52 / 16,
      grid: [
        '......WWWW......',
        '....WWWWWWWW....',
        '...WWWWWWWWWW...',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '.WWWWWWWWWWWWWW.',
        '.WWWDDWWWWDDWWW.',
        '.WWWDDWWWWDDWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '...WWWWWWWWWW...',
        '....WWWWWWWW....',
        '......WWWW......',
        '................',
      ],
    },
    enemy_fast: {
      scale: 48 / 16,
      grid: [
        '.......WW.......',
        '......WWWW......',
        '.....WWWWWW.....',
        '....WWWWWWWW....',
        '...WWWWWWWWWW...',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '...WWWWWWWWWW...',
        '....WWWWWWWW....',
        '.....WWWWWW.....',
        '......WWWW......',
        '.......WW.......',
      ],
    },
    enemy_tank: {
      scale: 38 / 16,
      grid: [
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWDDDDDDDDDDWW.',
        '.WWDDWWWWWWDDWW.',
        '.WWDDWWWWWWDDWW.',
        '.WWDDWWWWWWDDWW.',
        '.WWDDDDDDDDDDWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWDDDDDDDDDDWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
      ],
    },
    enemy_ranged: {
      scale: 50 / 16,
      grid: [
        '....DDDDDDDD....',
        '..DDWWWWWWWWDD..',
        '.DWWWWWWWWWWWWD.',
        '.DWWWWWWWWWWWWD.',
        '.DWWDDWWWWDDWWD.',
        '.DWWDDWWWWDDWWD.',
        '.DWWWWWWWWWWWWD.',
        '.DWWWWWWWWWWWWD.',
        '.DWWWWWWWWWWWWD.',
        '.DWWWWWWWWWWWWD.',
        '.DWWWWWWWWWWWWD.',
        '..DWWWWWWWWWWD..',
        '...DDWWWWWWDD...',
        '.....DDDDDD.....',
        '................',
        '................',
      ],
    },
    enemy_elite: {
      scale: 66 / 16,
      grid: [
        '......WWWW......',
        '....WWWWWWWW....',
        '...WWWWWWWWWW...',
        '..WWWWWWWWWWWW..',
        '..WWDDWWWWDDWW..',
        '..WWDDWWWWDDWW..',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '...WWWWWWWWWW...',
        '....WWWWWWWW....',
        '......WWWW......',
        '................',
        '................',
        '................',
      ],
    },
    enemy_boss: {
      scale: 80 / 16,
      grid: [
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        'WWWWWWWWWWWWWWWW',
        'WWWWDDWWWWDDWWWW',
        'WWWWDDWWWWDDWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '................',
      ],
    },
    enemy_suicider: {
      scale: 52 / 16,
      grid: [
        '......WWWW......',
        '....WWWWWWWW....',
        '...WWWWWWWWWW...',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '.WWWWWWWWWWWWWW.',
        '.WWWDDWWWWDDWWW.',
        '.WWWDDWWWWDDWWW.',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '...WWWWWWWWWW...',
        '....WWWWWWWW....',
        '.....WWDDWW.....',
        '......DDDD......',
      ],
    },
    enemy_splitter: {
      scale: 60 / 16,
      grid: [
        '................',
        '..WWWW....WWWW..',
        '.WWWWWW..WWWWWW.',
        '.WWWWWW..WWWWWW.',
        '.WWDDWW..WWDDWW.',
        '.WWDDWW..WWDDWW.',
        '.WWWWWW..WWWWWW.',
        '.WWWWWW..WWWWWW.',
        '..WWWW....WWWW..',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
      ],
    },
    enemy_shielded: {
      scale: 60 / 16,
      grid: [
        '...DDDDDDDDDD...',
        '..DWWWWWWWWWWD..',
        '.DWWWWWWWWWWWWD.',
        '.DWWWWWWWWWWWWD.',
        '.DWWDDWWWWDDWWD.',
        '.DWWDDWWWWDDWWD.',
        '.DWWWWWWWWWWWWD.',
        '.DWWWWWWWWWWWWD.',
        '..DWWWWWWWWWWD..',
        '...DDDDDDDDDD...',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
      ],
    },
  };
  private static readonly ENEMY_PALETTE: Record<string, number> = {
    W: 0xffffff, // 主体（运行时 tint 成敌人色）
    D: 0x14141f, // 暗部/眼睛（tint 后保留深色）
  };

  private generateEnemies(): void {
    const pixels = TextureGenerator.ENEMY_PIXELS;
    const palette = TextureGenerator.ENEMY_PALETTE;
    (Object.keys(pixels) as string[]).forEach((key) => {
      this.drawPixelTexture(key, pixels[key].grid, palette, pixels[key].scale);
    });
  }


  // ========== 子弹 ==========
  private generateBullets(): void {
    // 玩家子弹（能量弹：发光核心 + 拖尾）
    const size = 20;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外层光晕
    g.fillStyle(TextureGenerator.COLORS.bulletGlow, 0.3);
    g.fillCircle(cx, cy, 8);
    g.fillStyle(TextureGenerator.COLORS.bulletGlow, 0.5);
    g.fillCircle(cx, cy, 5);

    // 核心
    g.fillStyle(TextureGenerator.COLORS.bullet, 1);
    g.fillCircle(cx, cy, 3);

    // 高光
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 0.5, cy - 0.5, 1.2);

    g.generateTexture('bullet', size, size);
    g.destroy();

    // 敌人子弹（紫红色能量弹）
    const size2 = 18;
    const g2 = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g2.fillStyle(0xff44ff, 0.3);
    g2.fillCircle(size2 / 2, size2 / 2, 7);
    g2.fillStyle(0xff44ff, 0.6);
    g2.fillCircle(size2 / 2, size2 / 2, 4);
    g2.fillStyle(0xffffff, 1);
    g2.fillCircle(size2 / 2, size2 / 2, 2);
    g2.generateTexture('enemy_bullet', size2, size2);
    g2.destroy();
  }

  // ========== 拾取物 ==========
  private generatePickups(): void {
    this.generateGem('pickup_exp', TextureGenerator.COLORS.exp, 20);
    this.generateHealth('pickup_health', 22);
    this.generateCoin('pickup_coin', 18);
  }

  private generateGem(key: string, color: number, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const r = size / 2;

    // 外发光
    g.fillStyle(color, 0.25);
    g.fillCircle(cx, cy, r + 3);

    // 主体菱形（多切面）
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.75, cy - r * 0.2);
    g.lineTo(cx + r * 0.6, cy + r);
    g.lineTo(cx - r * 0.6, cy + r);
    g.lineTo(cx - r * 0.75, cy - r * 0.2);
    g.closePath();
    g.fillPath();

    // 顶部亮面
    g.fillStyle(0xffffff, 0.45);
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.75, cy - r * 0.2);
    g.lineTo(cx, cy - r * 0.1);
    g.lineTo(cx - r * 0.75, cy - r * 0.2);
    g.closePath();
    g.fillPath();

    // 内部切割线
    g.lineStyle(1, 0xffffff, 0.3);
    g.lineBetween(cx - r * 0.6, cy + r, cx, cy - r * 0.1);
    g.lineBetween(cx + r * 0.6, cy + r, cx, cy - r * 0.1);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateHealth(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;

    // 外发光
    g.fillStyle(TextureGenerator.COLORS.health, 0.25);
    g.fillCircle(cx, cy, size / 2 + 3);

    // 主体圆角方
    g.fillStyle(TextureGenerator.COLORS.health, 1);
    g.fillRoundedRect(cx - size / 2, cy - size / 2, size, size, 5);

    // 暗边
    g.lineStyle(2, 0x000000, 0.3);
    g.strokeRoundedRect(cx - size / 2, cy - size / 2, size, size, 5);

    // 白色十字（更粗更醒目）
    g.fillStyle(0xffffff, 1);
    const t = size * 0.24;
    g.fillRoundedRect(cx - t / 2, cy - size * 0.32, t, size * 0.64, 2);
    g.fillRoundedRect(cx - size * 0.32, cy - t / 2, size * 0.64, t, 2);

    // 十字高光
    g.fillStyle(0xffaaaa, 0.5);
    g.fillRoundedRect(cx - t / 2, cy - size * 0.32, t, size * 0.3, 1);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateCoin(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const r = size / 2;

    // 外发光
    g.fillStyle(TextureGenerator.COLORS.coin, 0.25);
    g.fillCircle(cx, cy, r + 3);

    // 外圈
    g.fillStyle(TextureGenerator.COLORS.coin, 1);
    g.fillCircle(cx, cy, r);

    // 内圈暗
    g.fillStyle(0xaa7700, 0.7);
    g.fillCircle(cx, cy, r * 0.75);

    // 内圈亮
    g.fillStyle(0xffdd44, 1);
    g.fillCircle(cx, cy, r * 0.6);

    // 中心符号（$ 用竖线+S曲线模拟）
    g.fillStyle(0xaa7700, 1);
    g.fillRect(cx - 1.5, cy - r * 0.35, 3, r * 0.7);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(cx - r * 0.25, cy - r * 0.25, r * 0.18);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  // ========== 粒子 ==========
  private generateParticles(): void {
    this.generateParticleDot('particle_hit', 0xffff00, 8);
    this.generateParticleDot('particle_death', 0xff4444, 10);
    this.generateParticleDot('particle_exp', 0x00ffff, 8);
    this.generateParticleDot('particle_explosion', 0xff8800, 12);
  }

  private generateParticleDot(key: string, color: number, size: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 0.4);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.fillStyle(color, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 2);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(size / 2 - 1, size / 2 - 1, size / 5);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  // ========== UI ==========
  private generateUI(): void {
    // 摇杆底座
    const baseSize = 120;
    let g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x1a1a2e, 0.7);
    g.fillCircle(baseSize / 2, baseSize / 2, 50);
    g.lineStyle(3, TextureGenerator.COLORS.uiBorder, 0.5);
    g.strokeCircle(baseSize / 2, baseSize / 2, 50);
    g.generateTexture('ui_joystick_base', baseSize, baseSize);
    g.destroy();

    // 摇杆旋钮
    const knobSize = 60;
    g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(TextureGenerator.COLORS.player, 0.8);
    g.fillCircle(knobSize / 2, knobSize / 2, 22);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeCircle(knobSize / 2, knobSize / 2, 22);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(knobSize / 2 - 4, knobSize / 2 - 4, 6);
    g.generateTexture('ui_joystick_knob', knobSize, knobSize);
    g.destroy();

    // 按钮
    const btnW = 160;
    const btnH = 50;
    g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x1a1a2e, 1);
    g.fillRoundedRect(0, 0, btnW, btnH, 8);
    g.lineStyle(2, TextureGenerator.COLORS.uiBorder, 0.6);
    g.strokeRoundedRect(1, 1, btnW - 2, btnH - 2, 7);
    g.generateTexture('ui_button', btnW, btnH);
    g.destroy();
  }

  // ========== 武器 ==========
  private generateWeapons(): void {
    // 剑/近战武器图标
    const size = 48;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;

    // 剑身
    g.fillStyle(0xcccccc, 1);
    g.fillRect(cx - 3, 4, 6, size - 16);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(cx - 1, 4, 2, size - 16);

    // 护手
    g.fillStyle(0xffcc00, 1);
    g.fillRect(cx - 10, size - 14, 20, 4);

    // 剑柄
    g.fillStyle(0x8b4513, 1);
    g.fillRect(cx - 2, size - 10, 4, 8);

    g.generateTexture('weapon_sword', size, size);
    g.destroy();
  }

  // ========== 障碍物纹理 ==========
  private generateObstacles(): void {
    // 岩石障碍物
    this.generateRock('obstacle_rock', 0x556677, 120, 80);
    // 墙体障碍物
    this.generateWall('obstacle_wall', 0x4a4a5e, 160, 40);
    // 水晶障碍物
    this.generateCrystal('obstacle_crystal', 0x8844ff, 60, 90);
  }

  private generateRock(key: string, color: number, w: number, h: number): void {
    const pad = 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = (w + pad * 2) / 2;
    const cy = (h + pad * 2) / 2;

    // 外发光
    g.fillStyle(color, 0.15);
    g.fillRoundedRect(pad - 2, pad - 2, w + 4, h + 4, 8);

    // 主体（不规则岩石，用多边形）
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx - w / 2 + 8, cy - h / 2);
    g.lineTo(cx + w / 2 - 5, cy - h / 2 + 4);
    g.lineTo(cx + w / 2, cy + h / 2 - 8);
    g.lineTo(cx + w / 2 - 12, cy + h / 2);
    g.lineTo(cx - w / 2 + 6, cy + h / 2 - 3);
    g.lineTo(cx - w / 2, cy + h / 2 - 12);
    g.closePath();
    g.fillPath();

    // 暗部
    g.fillStyle(0x000000, 0.25);
    g.beginPath();
    g.moveTo(cx, cy - h / 2);
    g.lineTo(cx + w / 2 - 5, cy - h / 2 + 4);
    g.lineTo(cx + w / 2, cy + h / 2 - 8);
    g.lineTo(cx + w / 2 - 12, cy + h / 2);
    g.lineTo(cx, cy + h / 4);
    g.closePath();
    g.fillPath();

    // 裂纹
    g.lineStyle(1.5, 0x000000, 0.4);
    g.beginPath();
    g.moveTo(cx - w * 0.2, cy - h * 0.3);
    g.lineTo(cx - w * 0.05, cy);
    g.lineTo(cx - w * 0.15, cy + h * 0.25);
    g.strokePath();

    // 高光
    g.fillStyle(0xffffff, 0.15);
    g.beginPath();
    g.moveTo(cx - w / 2 + 8, cy - h / 2);
    g.lineTo(cx, cy - h / 2 + 2);
    g.lineTo(cx - w * 0.2, cy - h * 0.1);
    g.closePath();
    g.fillPath();

    g.generateTexture(key, w + pad * 2, h + pad * 2);
    g.destroy();
  }

  private generateWall(key: string, color: number, w: number, h: number): void {
    const pad = 6;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = (w + pad * 2) / 2;
    const cy = (h + pad * 2) / 2;

    // 外发光
    g.fillStyle(color, 0.15);
    g.fillRoundedRect(pad - 1, pad - 1, w + 2, h + 2, 4);

    // 主体
    g.fillStyle(color, 1);
    g.fillRoundedRect(pad, pad, w, h, 3);

    // 砖块纹理（横向分隔线）
    g.lineStyle(1.5, 0x000000, 0.35);
    g.lineBetween(pad, cy, pad + w, cy);
    // 竖向错位分隔
    g.lineBetween(pad + w * 0.25, pad, pad + w * 0.25, cy);
    g.lineBetween(pad + w * 0.7, pad, pad + w * 0.7, cy);
    g.lineBetween(pad + w * 0.45, cy, pad + w * 0.45, pad + h);
    g.lineBetween(pad + w * 0.85, cy, pad + w * 0.85, pad + h);

    // 顶部高光
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(pad + 2, pad + 1, w - 4, 3);

    // 边缘描边
    g.lineStyle(1.5, 0x000000, 0.5);
    g.strokeRoundedRect(pad, pad, w, h, 3);

    g.generateTexture(key, w + pad * 2, h + pad * 2);
    g.destroy();
  }

  private generateCrystal(key: string, color: number, w: number, h: number): void {
    const pad = 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = (w + pad * 2) / 2;
    const cy = (h + pad * 2) / 2;

    // 外发光
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, Math.max(w, h) / 2 + 4);

    // 主体水晶（多面菱形）
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, cy - h / 2);
    g.lineTo(cx + w / 2, cy - h * 0.1);
    g.lineTo(cx + w * 0.35, cy + h / 2);
    g.lineTo(cx - w * 0.35, cy + h / 2);
    g.lineTo(cx - w / 2, cy - h * 0.1);
    g.closePath();
    g.fillPath();

    // 左侧亮面
    g.fillStyle(0xffffff, 0.35);
    g.beginPath();
    g.moveTo(cx, cy - h / 2);
    g.lineTo(cx - w / 2, cy - h * 0.1);
    g.lineTo(cx - w * 0.1, cy);
    g.closePath();
    g.fillPath();

    // 内部切面
    g.lineStyle(1, 0xffffff, 0.3);
    g.lineBetween(cx, cy - h / 2, cx, cy + h / 2);
    g.lineBetween(cx - w / 2, cy - h * 0.1, cx + w / 2, cy - h * 0.1);

    // 核心发光
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(cx, cy - h * 0.05, w * 0.12);

    g.generateTexture(key, w + pad * 2, h + pad * 2);
    g.destroy();
  }

  // ========== 地图瓦片 ==========
  private generateTiles(): void {
    const size = 128;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

    // 深色基底（略带紫调，深渊感）
    g.fillStyle(0x0a0a18, 1);
    g.fillRect(0, 0, size, size);

    // 径向渐变模拟（多层同心圆，中心亮边缘暗）
    for (let i = 6; i >= 1; i--) {
      const r = (size / 2) * (i / 6);
      const alpha = 0.015 * (7 - i);
      g.fillStyle(0x1a1a3a, alpha);
      g.fillCircle(size / 2, size / 2, r);
    }

    // 大网格（64px）
    g.lineStyle(1, 0x2a2a50, 0.5);
    g.lineBetween(0, 0, size, 0);
    g.lineBetween(0, 0, 0, size);
    g.lineBetween(64, 0, 64, size);
    g.lineBetween(0, 64, size, 64);

    // 小网格（32px，增加细节）
    g.lineStyle(1, 0x1e1e38, 0.3);
    for (let x = 32; x < size; x += 32) g.lineBetween(x, 0, x, size);
    for (let y = 32; y < size; y += 32) g.lineBetween(0, y, size, y);

    // 网格交叉点发光
    const ix = [0, 64, 128];
    const iy = [0, 64, 128];
    ix.forEach((x) => iy.forEach((y) => {
      g.fillStyle(0x00ffff, 0.12);
      g.fillCircle(x, y, 2);
    }));

    // 散落霓虹微粒（固定位置保证可平铺）
    const particles = [
      { x: 15, y: 22, c: 0x00ffff, a: 0.25, r: 1.5 },
      { x: 88, y: 45, c: 0xff00ff, a: 0.18, r: 1 },
      { x: 42, y: 95, c: 0x00ff88, a: 0.2, r: 1.2 },
      { x: 105, y: 110, c: 0xffaa00, a: 0.15, r: 1 },
      { x: 70, y: 15, c: 0xff4466, a: 0.12, r: 0.8 },
      { x: 25, y: 75, c: 0x00ffff, a: 0.1, r: 0.8 },
      { x: 115, y: 70, c: 0x8844ff, a: 0.15, r: 1.2 },
    ];
    particles.forEach((p) => {
      g.fillStyle(p.c, p.a * 0.4);
      g.fillCircle(p.x, p.y, p.r * 2.5);
      g.fillStyle(p.c, p.a);
      g.fillCircle(p.x, p.y, p.r);
    });

    g.generateTexture('tile_grass', size, size);
    g.destroy();
  }
}
