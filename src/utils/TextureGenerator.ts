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
    // 经典矢量主题（皮肤）：与像素版并存，供 VISUAL_THEME 切换
    this.generatePlayerClassic();
    this.generateEnemiesClassic();
    this.generateBullets();
    // 经典矢量主题：霓虹能量弹/拾取物（像素化改造前的原始实现），key 加 _classic 后缀
    this.generateBulletsClassic();
    this.generatePickups();
    this.generatePickupsClassic();
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

  /** 像素风障碍物（pixel 主题默认）：岩石/墙体/水晶，格子统一 16 宽、深色描边 + 高光，风格与敌人/拾取物一致 */
  private static readonly OBSTACLE_PIXELS: Record<
    string,
    { grid: string[]; palette: Record<string, number>; scale: number }
  > = {
    obstacle_rock: {
      grid: [
        '......WWWWWW......',
        '....WWWWWWWWW.....',
        '...WWWWWWWWWWW....',
        '..WWWMMWWWWWWW....',
        '..WWMMMMWWWWWW....',
        '.WWMMMMMMWWWWW....',
        '.WWMMMMMMMMWWW....',
        '.WWMMMMMMMWWWW....',
        '..WWWMMWWWWWW.....',
        '...WWWWWWWWW......',
        '....WWWWWWW.......',
        '.....DDDDDD.......',
      ],
      palette: { W: 0x6f8296, M: 0x9fb3c6, D: 0x14141f },
      scale: 4,
    },
    obstacle_wall: {
      grid: [
        'BBBBBBBBBBBBBBBB',
        'BKKKKKKKKBKKKKKKK',
        'BKKKKKKKKBKKKKKKK',
        'BBBBBBBBBBBBBBBB',
        'KKKKBKKKKKKKKBKKK',
        'KKKKBKKKKKKKKBKKK',
        'BBBBBBBBBBBBBBBB',
        'BKKKKKKKKBKKKKKKK',
        'BKKKKKKKKBKKKKKKK',
        'BBBBBBBBBBBBBBBB',
      ],
      palette: { B: 0x6b6b86, K: 0x20202e },
      scale: 4,
    },
    obstacle_crystal: {
      grid: [
        '.......MM.......',
        '......MWWM......',
        '.....MWWWWM.....',
        '....MWWWWWWM....',
        '...MWWMMMMWWM...',
        '..MWWMMDDMMWWM..',
        '..MWMMDDDDMMWM..',
        '.MWMMDDDDDDMMWM.',
        '.MWMMDDDDDDMMWM.',
        '.MWMMWDDDDWMMWM.',
        '..MWMMWDDWMMWM..',
        '...MWMMMMMMWM...',
        '....MMMMMMMM....',
        '.....MMMMMM.....',
      ],
      palette: { M: 0x9a6bff, W: 0xd8baff, D: 0x3d1a66 },
      scale: 4,
    },
  };

  private generateEnemies(): void {
    const pixels = TextureGenerator.ENEMY_PIXELS;
    const palette = TextureGenerator.ENEMY_PALETTE;
    (Object.keys(pixels) as string[]).forEach((key) => {
      this.drawPixelTexture(key, pixels[key].grid, palette, pixels[key].scale);
    });
  }


  // ========== 经典矢量主题（classic 皮肤）==========
  private generatePlayerClassic(): void {
    const size = 64;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 最外层光晕
    g.fillStyle(TextureGenerator.COLORS.playerGlow, 0.12);
    g.fillCircle(cx, cy, 30);
    g.fillStyle(TextureGenerator.COLORS.playerGlow, 0.2);
    g.fillCircle(cx, cy, 24);

    // 引擎尾焰（底部渐变三角形）
    g.fillStyle(TextureGenerator.COLORS.playerAccent, 0.6);
    g.beginPath();
    g.moveTo(cx - 6, cy + 14);
    g.lineTo(cx, cy + 28);
    g.lineTo(cx + 6, cy + 14);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffff00, 0.5);
    g.beginPath();
    g.moveTo(cx - 3, cy + 14);
    g.lineTo(cx, cy + 22);
    g.lineTo(cx + 3, cy + 14);
    g.closePath();
    g.fillPath();

    // 机翼（后掠翼，左右展开）
    g.fillStyle(TextureGenerator.COLORS.player, 0.85);
    g.beginPath();
    g.moveTo(cx, cy - 22);
    g.lineTo(cx + 22, cy + 12);
    g.lineTo(cx + 14, cy + 16);
    g.lineTo(cx, cy + 8);
    g.lineTo(cx - 14, cy + 16);
    g.lineTo(cx - 22, cy + 12);
    g.closePath();
    g.fillPath();

    // 机身主体（尖锐菱形）
    g.fillStyle(TextureGenerator.COLORS.player, 1);
    g.beginPath();
    g.moveTo(cx, cy - 24);
    g.lineTo(cx + 10, cy + 10);
    g.lineTo(cx, cy + 16);
    g.lineTo(cx - 10, cy + 10);
    g.closePath();
    g.fillPath();

    // 机身暗部（右侧阴影，增加立体感）
    g.fillStyle(0x006666, 0.5);
    g.beginPath();
    g.moveTo(cx, cy - 24);
    g.lineTo(cx + 10, cy + 10);
    g.lineTo(cx, cy + 16);
    g.closePath();
    g.fillPath();

    // 驾驶舱（发光椭圆）
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(cx, cy - 6, 5, 8);
    g.fillStyle(TextureGenerator.COLORS.playerGlow, 0.6);
    g.fillEllipse(cx, cy - 6, 7, 10);

    // 机翼尖端发光点
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 20, cy + 11, 2);
    g.fillCircle(cx + 20, cy + 11, 2);

    // 边缘描边
    g.lineStyle(1.5, 0xffffff, 0.6);
    g.beginPath();
    g.moveTo(cx, cy - 24);
    g.lineTo(cx + 10, cy + 10);
    g.lineTo(cx, cy + 16);
    g.lineTo(cx - 10, cy + 10);
    g.closePath();
    g.strokePath();

    g.generateTexture('player_classic', size, size);
    g.destroy();
  }

  // ========== 敌人 ==========
  private generateEnemiesClassic(): void {
    this.generateEnemyBlob('enemy_normal_classic', TextureGenerator.COLORS.enemyNormal, 20);
    this.generateEnemyShard('enemy_fast_classic', TextureGenerator.COLORS.enemyFast, 18);
    this.generateEnemyTank('enemy_tank_classic', TextureGenerator.COLORS.enemyTank, 24);
    this.generateEnemyCaster('enemy_ranged_classic', TextureGenerator.COLORS.enemyRanged, 18);
    this.generateEnemyElite('enemy_elite_classic', TextureGenerator.COLORS.enemyElite, 26);
    this.generateEnemyBoss('enemy_boss_classic', TextureGenerator.COLORS.enemyBoss, 56);
    this.generateEnemySuicider('enemy_suicider_classic', TextureGenerator.COLORS.enemySuicider, 20);
    this.generateEnemySplitter('enemy_splitter_classic', TextureGenerator.COLORS.enemySplitter, 24);
    this.generateEnemyShielded('enemy_shielded_classic', TextureGenerator.COLORS.enemyShielded, 24);
  }

  /** 自爆怪：膨胀的不稳定球体 + 引线火花，危险感 */
  private generateEnemySuicider(key: string, color: number, r: number): void {
    const size = r * 2 + 12;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外发光（红色警告感）
    g.fillStyle(color, 0.25);
    g.fillCircle(cx, cy, r + 6);

    // 膨胀主体（外圈 + 内圈，像要炸开）
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, r);
    g.fillStyle(0xffaa44, 1);
    g.fillCircle(cx - r * 0.1, cy - r * 0.1, r * 0.75);

    // 内部不稳定核心（高亮白热）
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy, r * 0.35);
    g.fillStyle(0xffcc44, 1);
    g.fillCircle(cx, cy, r * 0.2);

    // 引线火花（四周小刺）
    g.fillStyle(0xffff00, 0.9);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      g.fillCircle(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1, 2.5);
    }

    // 警示黑边
    g.lineStyle(2, 0x222222, 0.6);
    g.strokeCircle(cx, cy, r);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** 分裂怪：胶状分裂体（多个小圆粘连 + 分裂线） */
  private generateEnemySplitter(key: string, color: number, r: number): void {
    const size = r * 2 + 14;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外发光
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, r + 6);

    // 胶状主体（多圆粘连）
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, r);
    g.fillCircle(cx - r * 0.7, cy + r * 0.3, r * 0.55);
    g.fillCircle(cx + r * 0.65, cy - r * 0.35, r * 0.5);

    // 分裂裂纹（模拟将要分裂）
    g.lineStyle(2, 0x000000, 0.4);
    g.lineBetween(cx - r * 0.4, cy + r * 0.3, cx + r * 0.4, cy - r * 0.3);
    g.lineBetween(cx - r * 0.5, cy - r * 0.2, cx + r * 0.3, cy + r * 0.4);

    // 黏液高光
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(cx - r * 0.2, cy - r * 0.35, r * 0.2);

    // 小眼睛（两个）
    g.fillStyle(0x000000, 0.9);
    g.fillCircle(cx - r * 0.2, cy - r * 0.05, r * 0.16);
    g.fillCircle(cx + r * 0.3, cy + r * 0.05, r * 0.12);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - r * 0.2, cy - r * 0.05, r * 0.06);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** 护盾怪：装甲核心 + 前方能量盾弧（面向玩家方向） */
  private generateEnemyShielded(key: string, color: number, r: number): void {
    const size = r * 2 + 16;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外发光
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, r + 6);

    // 盾牌弧（右前方，默认朝向 +X）
    g.lineStyle(4, 0x66ccff, 0.9);
    g.beginPath();
    g.arc(cx, cy, r + 4, -0.9, 0.9, false);
    g.strokePath();
    // 盾牌光晕
    g.fillStyle(0x66ccff, 0.15);
    g.beginPath();
    g.arc(cx, cy, r + 4, -0.9, 0.9, false);
    g.lineTo(cx, cy);
    g.closePath();
    g.fillPath();

    // 装甲主体
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, r);

    // 装甲板纹路
    g.lineStyle(2, 0x000000, 0.3);
    g.lineBetween(cx - r * 0.5, cy, cx + r * 0.5, cy);
    g.lineBetween(cx, cy - r * 0.5, cx, cy + r * 0.5);

    // 光学眼（中央）
    g.fillStyle(0x000000, 0.8);
    g.fillCircle(cx, cy, r * 0.25);
    g.fillStyle(0x66ddff, 1);
    g.fillCircle(cx, cy, r * 0.15);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** 普通敌人：感染体（不规则圆形 + 破损边缘 + 眼睛） */
  private generateEnemyBlob(key: string, color: number, radius: number): void {
    const size = radius * 2 + 12;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外发光
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, radius + 6);
    g.fillStyle(color, 0.3);
    g.fillCircle(cx, cy, radius + 2);

    // 主体（不规则圆形，用多个圆叠加模拟感染体）
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, radius);
    g.fillCircle(cx - radius * 0.4, cy - radius * 0.3, radius * 0.5);
    g.fillCircle(cx + radius * 0.35, cy + radius * 0.2, radius * 0.45);

    // 暗部
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(cx + radius * 0.3, cy + radius * 0.3, radius * 0.6);

    // 眼睛（一大一小，诡异感）
    g.fillStyle(0x000000, 1);
    g.fillCircle(cx - radius * 0.25, cy - radius * 0.15, radius * 0.18);
    g.fillCircle(cx + radius * 0.3, cy - radius * 0.05, radius * 0.13);
    // 瞳孔高光
    g.fillStyle(0xff0000, 0.9);
    g.fillCircle(cx - radius * 0.25, cy - radius * 0.15, radius * 0.08);
    g.fillCircle(cx + radius * 0.3, cy - radius * 0.05, radius * 0.06);

    // 嘴（锯齿状）
    g.fillStyle(0x000000, 0.7);
    g.fillRect(cx - radius * 0.3, cy + radius * 0.25, radius * 0.6, radius * 0.12);

    // 高光
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(cx - radius * 0.35, cy - radius * 0.4, radius * 0.2);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** 快速敌人：晶体碎片（锐利菱形 + 速度线） */
  private generateEnemyShard(key: string, color: number, r: number): void {
    const size = r * 2 + 12;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外发光
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, r + 4);

    // 速度线（后方拖影）
    g.fillStyle(color, 0.3);
    g.beginPath();
    g.moveTo(cx, cy + r * 0.3);
    g.lineTo(cx - r * 0.5, cy + r * 1.2);
    g.lineTo(cx + r * 0.5, cy + r * 1.2);
    g.closePath();
    g.fillPath();

    // 主体（锐利晶体，上下不对称）
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.7, cy - r * 0.1);
    g.lineTo(cx + r * 0.5, cy + r * 0.6);
    g.lineTo(cx, cy + r * 0.9);
    g.lineTo(cx - r * 0.5, cy + r * 0.6);
    g.lineTo(cx - r * 0.7, cy - r * 0.1);
    g.closePath();
    g.fillPath();

    // 内部切面（晶体感）
    g.fillStyle(0xffffff, 0.35);
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.3, cy - r * 0.1);
    g.lineTo(cx, cy + r * 0.2);
    g.lineTo(cx - r * 0.3, cy - r * 0.1);
    g.closePath();
    g.fillPath();

    // 核心发光点
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(cx, cy, r * 0.15);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** 重装敌人：装甲方块（多层装甲 + 铆钉 + 红眼） */
  private generateEnemyTank(key: string, color: number, s: number): void {
    const size = s + 14;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;
    const half = s / 2;

    // 外发光
    g.fillStyle(color, 0.18);
    g.fillRoundedRect(cx - half - 4, cy - half - 4, s + 8, s + 8, 6);

    // 主体装甲
    g.fillStyle(color, 1);
    g.fillRoundedRect(cx - half, cy - half, s, s, 5);

    // 装甲板拼接缝
    g.lineStyle(2, 0x000000, 0.35);
    g.lineBetween(cx - half + 3, cy, cx + half - 3, cy);
    g.lineBetween(cx, cy - half + 3, cx, cy + half - 3);

    // 铆钉（四角）
    g.fillStyle(0x333333, 1);
    const rivetR = 2;
    g.fillCircle(cx - half + 5, cy - half + 5, rivetR);
    g.fillCircle(cx + half - 5, cy - half + 5, rivetR);
    g.fillCircle(cx - half + 5, cy + half - 5, rivetR);
    g.fillCircle(cx + half - 5, cy + half - 5, rivetR);

    // 红色光学眼（横向）
    g.fillStyle(0x000000, 0.8);
    g.fillRoundedRect(cx - half * 0.5, cy - half * 0.25, half, half * 0.5, 2);
    g.fillStyle(0xff0000, 1);
    g.fillRect(cx - half * 0.4, cy - half * 0.12, half * 0.8, half * 0.24);
    g.fillStyle(0xff6666, 0.6);
    g.fillRect(cx - half * 0.4, cy - half * 0.12, half * 0.8, half * 0.08);

    // 顶部高光
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(cx - half + 2, cy - half + 2, s - 4, 4, 2);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** 远程敌人：施法者（圆形 + 能量环 + 瞄准核心） */
  private generateEnemyCaster(key: string, color: number, r: number): void {
    const size = r * 2 + 14;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外发光
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, r + 7);

    // 旋转能量环（虚线感，用弧线段）
    g.lineStyle(2, color, 0.6);
    for (let i = 0; i < 8; i++) {
      const a1 = (i / 8) * Math.PI * 2;
      const a2 = a1 + 0.3;
      g.beginPath();
      g.arc(cx, cy, r + 4, a1, a2, false);
      g.strokePath();
    }

    // 主体
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, r);

    // 暗部
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(cx + r * 0.25, cy + r * 0.25, r * 0.7);

    // 瞄准核心（十字准星）
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy, r * 0.25);
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, r * 0.15);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, r * 0.06);

    // 准星十字线
    g.lineStyle(1.5, 0xffffff, 0.7);
    g.lineBetween(cx - r * 0.5, cy, cx - r * 0.3, cy);
    g.lineBetween(cx + r * 0.3, cy, cx + r * 0.5, cy);
    g.lineBetween(cx, cy - r * 0.5, cx, cy - r * 0.3);
    g.lineBetween(cx, cy + r * 0.3, cx, cy + r * 0.5);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** 精英敌人：六边形能量体（旋转纹路 + 核心 + 尖角） */
  private generateEnemyElite(key: string, color: number, r: number): void {
    const size = r * 2 + 14;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 外发光
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, r + 7);
    g.fillStyle(color, 0.12);
    g.fillCircle(cx, cy, r + 4);

    // 尖角（六边形外伸）
    g.fillStyle(color, 0.7);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const innerR = r * 0.85;
      const outerR = r * 1.15;
      g.beginPath();
      g.moveTo(cx + Math.cos(angle - 0.2) * innerR, cy + Math.sin(angle - 0.2) * innerR);
      g.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      g.lineTo(cx + Math.cos(angle + 0.2) * innerR, cy + Math.sin(angle + 0.2) * innerR);
      g.closePath();
      g.fillPath();
    }

    // 主体六边形
    g.fillStyle(color, 1);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();

    // 内部六边形（暗）
    g.fillStyle(0x000000, 0.35);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r * 0.6;
      const py = cy + Math.sin(angle) * r * 0.6;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();

    // 能量核心（脉冲感，用多层圆）
    g.fillStyle(color, 0.5);
    g.fillCircle(cx, cy, r * 0.35);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx, cy, r * 0.2);
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, r * 0.1);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Boss：多层装甲 + 尖刺 + 多眼 + 核心 */
  private generateEnemyBoss(key: string, color: number, s: number): void {
    const size = s + 24;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;
    const r = s / 2;

    // 最外层光环
    g.fillStyle(color, 0.1);
    g.fillCircle(cx, cy, r + 14);
    g.fillStyle(color, 0.15);
    g.fillCircle(cx, cy, r + 8);

    // 外层尖刺（12个）
    g.fillStyle(color, 0.75);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const innerR = r * 0.9;
      const outerR = r * 1.2;
      g.beginPath();
      g.moveTo(cx + Math.cos(angle - 0.1) * innerR, cy + Math.sin(angle - 0.1) * innerR);
      g.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      g.lineTo(cx + Math.cos(angle + 0.1) * innerR, cy + Math.sin(angle + 0.1) * innerR);
      g.closePath();
      g.fillPath();
    }

    // 主体八边形
    g.fillStyle(color, 1);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();

    // 装甲环
    g.lineStyle(3, 0x000000, 0.4);
    g.beginPath();
    g.arc(cx, cy, r * 0.75, 0, Math.PI * 2, false);
    g.strokePath();

    // 内层暗区
    g.fillStyle(0x000000, 0.4);
    g.fillCircle(cx, cy, r * 0.6);

    // 三只眼睛（三角分布，恐怖感）
    const eyePositions = [
      { x: cx, y: cy - r * 0.25 },
      { x: cx - r * 0.25, y: cy + r * 0.15 },
      { x: cx + r * 0.25, y: cy + r * 0.15 },
    ];
    eyePositions.forEach((pos) => {
      g.fillStyle(0x000000, 1);
      g.fillCircle(pos.x, pos.y, r * 0.12);
      g.fillStyle(0xffff00, 1);
      g.fillCircle(pos.x, pos.y, r * 0.07);
      g.fillStyle(0xff0000, 0.8);
      g.fillCircle(pos.x, pos.y, r * 0.04);
    });

    // 中心能量核心
    g.fillStyle(color, 0.6);
    g.fillCircle(cx, cy + r * 0.35, r * 0.15);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(cx, cy + r * 0.35, r * 0.07);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  // ========== 子弹 ==========

  // ========== 子弹 ==========
  /** 像素风子弹（pixel 主题默认）：方块核心 + 递减方块拖尾，棱角分明 */
  private generateBullets(): void {
    // 玩家子弹
    const size = 20;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 拖尾（向后递减方块）
    const trail = [
      { w: 5, h: 5, off: 3, a: 0.45 },
      { w: 4, h: 4, off: 6, a: 0.3 },
      { w: 3, h: 3, off: 8, a: 0.18 },
    ];
    for (const t of trail) {
      g.fillStyle(TextureGenerator.COLORS.bullet, t.a);
      g.fillRect(cx - t.w / 2 - t.off, cy - t.h / 2, t.w, t.h);
    }

    // 核心方块
    g.fillStyle(TextureGenerator.COLORS.bullet, 1);
    g.fillRect(cx - 3, cy - 3, 6, 6);
    // 高光
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(cx - 2, cy - 2, 2, 2);

    g.generateTexture('bullet', size, size);
    g.destroy();

    // 无人机（对称机体，旋转自然）
    this.generateDronePixel('drone', 26);

    // 敌人子弹（紫红色方块）
    const size2 = 18;
    const g2 = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx2 = size2 / 2;
    const cy2 = size2 / 2;

    g2.fillStyle(0xff44ff, 0.5);
    g2.fillRect(cx2 - 3, cy2 - 3, 6, 6);
    g2.fillStyle(0xff44ff, 1);
    g2.fillRect(cx2 - 2, cy2 - 2, 4, 4);
    g2.fillStyle(0xffffff, 1);
    g2.fillRect(cx2 - 1, cy2 - 1, 2, 2);

    g2.generateTexture('enemy_bullet', size2, size2);
    g2.destroy();
  }

  /** 像素无人机：中心机体 + 四角旋翼（对称，旋转时方向自然） */
  private generateDronePixel(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    // 四角旋翼
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(cx - 11, cy - 11, 6, 6);
    g.fillRect(cx + 5, cy - 11, 6, 6);
    g.fillRect(cx - 11, cy + 5, 6, 6);
    g.fillRect(cx + 5, cy + 5, 6, 6);
    // 机臂十字
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 6, cy - 2, 12, 4);
    g.fillRect(cx - 2, cy - 6, 4, 12);
    // 中心高光
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 2, cy - 2, 4, 4);
    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  /** 经典矢量主题子弹（霓虹能量弹：发光核心 + 拖尾），key 加 _classic 后缀 */
  /** 经典矢量无人机：四角旋翼圆 + 圆润机身 */
  private generateDrone(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    // 四角旋翼
    g.fillStyle(0x66ccff, 0.4);
    g.fillCircle(cx - 10, cy - 10, 4);
    g.fillCircle(cx + 10, cy - 10, 4);
    g.fillCircle(cx - 10, cy + 10, 4);
    g.fillCircle(cx + 10, cy + 10, 4);
    // 机身圆盘
    g.fillStyle(0x88ddff, 1);
    g.fillCircle(cx, cy, 8);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(cx, cy, 3);
    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateBulletsClassic(): void {
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

    g.generateTexture('bullet_classic', size, size);
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
    g2.generateTexture('enemy_bullet_classic', size2, size2);
    g2.destroy();

    // 经典无人机
    this.generateDrone('drone_classic', 26);
  }

  // ========== 拾取物 ==========
  /** 像素风拾取物（pixel 主题默认）：方块拼接，棱角分明 */
  private generatePickups(): void {
    this.generateGemPixel('pickup_exp', TextureGenerator.COLORS.exp, 20);
    this.generateHealthPixel('pickup_health', 22);
    this.generateCoinPixel('pickup_coin', 18);
    this.generateChestPixel('pickup_chest', 22);
  }

  /** 像素宝箱：金色方块箱体 + 锁扣 + 高光 */
  private generateChestPixel(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    // 箱体底部暗影
    g.fillStyle(0x6a4510, 1);
    g.fillRect(cx - 8, cy - 3, 16, 10);
    // 箱体
    g.fillStyle(0xc9862a, 1);
    g.fillRect(cx - 8, cy - 5, 16, 10);
    // 箱盖缝
    g.fillStyle(0x5a3a0e, 1);
    g.fillRect(cx - 8, cy - 5, 16, 2);
    // 锁扣
    g.fillStyle(0xffd700, 1);
    g.fillRect(cx - 2, cy - 3, 4, 4);
    // 高光
    g.fillStyle(0xffe9a0, 0.6);
    g.fillRect(cx - 6, cy - 1, 12, 1);
    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  /** 经典矢量主题拾取物（霓虹菱形/十字/金币），key 加 _classic 后缀 */
  private generatePickupsClassic(): void {
    this.generateGem('pickup_exp_classic', TextureGenerator.COLORS.exp, 20);
    this.generateHealth('pickup_health_classic', 22);
    this.generateCoin('pickup_coin_classic', 18);
    this.generateChest('pickup_chest_classic', 22);
  }

  /** 经典宝箱：圆角金色箱体 + 锁扣 */
  private generateChest(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    g.fillStyle(0xc9862a, 1);
    g.fillRoundedRect(cx - 8, cy - 7, 16, 14, 2);
    g.fillStyle(0x5a3a0e, 1);
    g.fillRect(cx - 8, cy - 2, 16, 1);
    g.fillStyle(0xffd700, 1);
    g.fillRoundedRect(cx - 3, cy - 3, 6, 4, 1);
    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  /** 像素宝石：整数方块拼菱形 */
  private generateGemPixel(key: string, color: number, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;

    // 底部暗影（下层方块）
    g.fillStyle(color, 0.35);
    g.fillRect(cx - 5, cy - 3, 10, 10);
    g.fillRect(cx - 3, cy + 1, 6, 10);

    // 主体菱形（逐行方块，上窄下宽）
    g.fillStyle(color, 1);
    g.fillRect(cx - 2, cy - 5, 4, 2);   // 尖端
    g.fillRect(cx - 4, cy - 3, 8, 2);   // 上排
    g.fillRect(cx - 5, cy - 1, 10, 2);  // 中排
    g.fillRect(cx - 4, cy + 1, 8, 2);   // 下排
    g.fillRect(cx - 2, cy + 3, 4, 2);   // 尾端

    // 顶部高光
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(cx - 2, cy - 5, 4, 2);
    g.fillRect(cx - 4, cy - 3, 4, 2);

    // 中心亮线
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(cx - 5, cy - 1, 10, 1);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  /** 像素血包：红色方块 + 像素十字 */
  private generateHealthPixel(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const half = size / 2;

    // 主体红色方块
    g.fillStyle(TextureGenerator.COLORS.health, 1);
    g.fillRect(cx - half, cy - half, size, size);

    // 像素描边（四边暗色）
    g.fillStyle(0x000000, 0.4);
    g.fillRect(cx - half, cy - half, size, 2);
    g.fillRect(cx - half, cy + half - 2, size, 2);
    g.fillRect(cx - half, cy - half, 2, size);
    g.fillRect(cx + half - 2, cy - half, 2, size);

    // 白色像素十字
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 3, cy - 7, 6, 14);
    g.fillRect(cx - 7, cy - 3, 14, 6);

    // 十字高光（左上）
    g.fillStyle(0xffcccc, 1);
    g.fillRect(cx - 3, cy - 7, 6, 3);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  /** 像素金币：方块金币 + 中心符号 */
  private generateCoinPixel(key: string, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const r = size / 2;

    // 外圈方块
    g.fillStyle(TextureGenerator.COLORS.coin, 1);
    g.fillRect(cx - r, cy - r, size, size);

    // 切角（削去四角成八角感）
    g.fillStyle(TextureGenerator.COLORS.coin, 1);
    g.fillRect(cx - r, cy - r, size, 2);
    g.fillRect(cx - r, cy + r - 2, size, 2);
    g.fillRect(cx - r, cy - r, 2, size);
    g.fillRect(cx + r - 2, cy - r, 2, size);
    // 内圈暗
    g.fillStyle(0xaa7700, 1);
    g.fillRect(cx - r + 3, cy - r + 3, size - 6, size - 6);
    // 内圈亮
    g.fillStyle(0xffdd44, 1);
    g.fillRect(cx - r + 5, cy - r + 5, size - 10, size - 10);
    // 中心 $（竖线 + 高光）
    g.fillStyle(0xaa7700, 1);
    g.fillRect(cx - 1, cy - 4, 2, 8);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(cx - 3, cy - 3, 2, 2);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
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
    // ===== pixel 主题（默认）：像素块障碍物，风格与敌人/拾取物统一 =====
    const obsPixels = TextureGenerator.OBSTACLE_PIXELS;
    (Object.keys(obsPixels) as string[]).forEach((key) => {
      this.drawPixelTexture(key, obsPixels[key].grid, obsPixels[key].palette, obsPixels[key].scale);
    });

    // ===== classic 主题（_classic 后缀）：经典矢量霓虹障碍物 =====
    // 岩石障碍物
    this.generateRock('obstacle_rock_classic', 0x556677, 120, 80);
    // 墙体障碍物
    this.generateWall('obstacle_wall_classic', 0x4a4a5e, 160, 40);
    // 水晶障碍物
    this.generateCrystal('obstacle_crystal_classic', 0x8844ff, 60, 90);
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
