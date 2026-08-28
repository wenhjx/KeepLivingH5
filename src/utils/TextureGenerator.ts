import Phaser from 'phaser';

/**
 * 霓虹深渊 (Neon Abyss) 主题纹理生成器
 * 用程序生成所有游戏素材，无需外部图片文件
 * 风格：深色背景 + 霓虹发光 + 几何图形
 */
export class TextureGenerator {
  private scene: Phaser.Scene;

  // 主题色板
  static readonly COLORS = {
    bg: 0x0a0a15,
    player: 0x00ffff,
    playerGlow: 0x00ffff,
    enemyNormal: 0x00ff88,
    enemyFast: 0x4488ff,
    enemyTank: 0xff8844,
    enemyRanged: 0xff44ff,
    enemyElite: 0xffaa00,
    enemyBoss: 0xff2244,
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
  }

  // ========== 玩家 ==========
  private generatePlayer(): void {
    const size = 64;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

    // 外发光
    g.fillStyle(TextureGenerator.COLORS.playerGlow, 0.3);
    g.fillCircle(size / 2, size / 2, 28);

    // 主体三角形（朝上的箭头/飞船）
    g.fillStyle(TextureGenerator.COLORS.player, 1);
    g.beginPath();
    g.moveTo(size / 2, 8);
    g.lineTo(size - 12, size - 10);
    g.lineTo(size / 2, size - 18);
    g.lineTo(12, size - 10);
    g.closePath();
    g.fillPath();

    // 内部高光
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(size / 2, size / 2 + 2, 5);

    // 边缘描边
    g.lineStyle(2, 0xffffff, 0.8);
    g.beginPath();
    g.moveTo(size / 2, 8);
    g.lineTo(size - 12, size - 10);
    g.lineTo(size / 2, size - 18);
    g.lineTo(12, size - 10);
    g.closePath();
    g.strokePath();

    g.generateTexture('player', size, size);
    g.destroy();
  }

  // ========== 敌人 ==========
  private generateEnemies(): void {
    this.generateEnemyCircle('enemy_normal', TextureGenerator.COLORS.enemyNormal, 20);
    this.generateEnemyDiamond('enemy_fast', TextureGenerator.COLORS.enemyFast, 18);
    this.generateEnemySquare('enemy_tank', TextureGenerator.COLORS.enemyTank, 24);
    this.generateEnemyCircle('enemy_ranged', TextureGenerator.COLORS.enemyRanged, 18);
    this.generateEnemyHexagon('enemy_elite', TextureGenerator.COLORS.enemyElite, 26);
    this.generateEnemyBoss('enemy_boss', TextureGenerator.COLORS.enemyBoss, 56);
  }

  private generateEnemyCircle(key: string, color: number, radius: number): void {
    const size = radius * 2 + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = size / 2;
    const cy = size / 2;

    // 发光
    g.fillStyle(color, 0.25);
    g.fillCircle(cx, cy, radius + 4);

    // 主体
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy, radius);

    // 眼睛
    g.fillStyle(0x000000, 1);
    g.fillCircle(cx - radius * 0.3, cy - 2, 3);
    g.fillCircle(cx + radius * 0.3, cy - 2, 3);

    // 高光
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private generateEnemyDiamond(key: string, color: number, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;

    g.fillStyle(color, 0.25);
    g.fillCircle(cx, cy, size * 0.7);

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, cy - size / 2);
    g.lineTo(cx + size / 2, cy);
    g.lineTo(cx, cy + size / 2);
    g.lineTo(cx - size / 2, cy);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(cx, cy - 2, 3);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateEnemySquare(key: string, color: number, size: number): void {
    const canvas = size + 8;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const half = size / 2;

    g.fillStyle(color, 0.25);
    g.fillCircle(cx, cy, size * 0.65);

    g.fillStyle(color, 1);
    g.fillRoundedRect(cx - half, cy - half, size, size, 4);

    // 装甲线条
    g.lineStyle(2, 0x000000, 0.4);
    g.lineBetween(cx - half + 4, cy, cx + half - 4, cy);

    g.fillStyle(0xff0000, 1);
    g.fillCircle(cx - 5, cy - 4, 2.5);
    g.fillCircle(cx + 5, cy - 4, 2.5);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateEnemyHexagon(key: string, color: number, size: number): void {
    const canvas = size + 10;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const r = size / 2;

    g.fillStyle(color, 0.3);
    g.fillCircle(cx, cy, r + 4);

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

    // 中心核心
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(cx, cy, r * 0.3);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateEnemyBoss(key: string, color: number, size: number): void {
    const canvas = size + 16;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const r = size / 2;

    // 外层光环
    g.fillStyle(color, 0.2);
    g.fillCircle(cx, cy, r + 10);
    g.fillStyle(color, 0.15);
    g.fillCircle(cx, cy, r + 6);

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

    // 内核
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(cx, cy, r * 0.5);

    // 眼睛
    g.fillStyle(0xffff00, 1);
    g.fillCircle(cx - r * 0.25, cy - r * 0.1, r * 0.12);
    g.fillCircle(cx + r * 0.25, cy - r * 0.1, r * 0.12);

    // 尖刺
    g.fillStyle(color, 0.8);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const innerR = r * 0.9;
      const outerR = r * 1.15;
      g.beginPath();
      g.moveTo(cx + Math.cos(angle - 0.15) * innerR, cy + Math.sin(angle - 0.15) * innerR);
      g.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      g.lineTo(cx + Math.cos(angle + 0.15) * innerR, cy + Math.sin(angle + 0.15) * innerR);
      g.closePath();
      g.fillPath();
    }

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  // ========== 子弹 ==========
  private generateBullets(): void {
    // 玩家子弹
    const size = 16;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(TextureGenerator.COLORS.bulletGlow, 0.4);
    g.fillCircle(size / 2, size / 2, 7);
    g.fillStyle(TextureGenerator.COLORS.bullet, 1);
    g.fillCircle(size / 2, size / 2, 4);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(size / 2 - 1, size / 2 - 1, 1.5);
    g.generateTexture('bullet', size, size);
    g.destroy();
  }

  // ========== 拾取物 ==========
  private generatePickups(): void {
    // 经验宝石
    this.generateGem('pickup_exp', TextureGenerator.COLORS.exp, 20);
    // 血包
    this.generateHealth('pickup_health', 22);
    // 金币
    this.generateCoin('pickup_coin', 18);
  }

  private generateGem(key: string, color: number, size: number): void {
    const canvas = size + 6;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const r = size / 2;

    g.fillStyle(color, 0.3);
    g.fillCircle(cx, cy, r + 2);

    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.7, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r * 0.7, cy);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffffff, 0.6);
    g.fillTriangle(cx - 2, cy - r + 3, cx + 2, cy - r + 3, cx, cy - 2);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateHealth(key: string, size: number): void {
    const canvas = size + 6;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;

    g.fillStyle(TextureGenerator.COLORS.health, 0.3);
    g.fillCircle(cx, cy, size / 2 + 2);

    g.fillStyle(TextureGenerator.COLORS.health, 1);
    g.fillRoundedRect(cx - size / 2, cy - size / 2, size, size, 4);

    // 白色十字
    g.fillStyle(0xffffff, 1);
    const t = size * 0.22;
    g.fillRect(cx - t / 2, cy - size * 0.35, t, size * 0.7);
    g.fillRect(cx - size * 0.35, cy - t / 2, size * 0.7, t);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  private generateCoin(key: string, size: number): void {
    const canvas = size + 6;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = canvas / 2;
    const cy = canvas / 2;
    const r = size / 2;

    g.fillStyle(TextureGenerator.COLORS.coin, 0.3);
    g.fillCircle(cx, cy, r + 2);

    g.fillStyle(TextureGenerator.COLORS.coin, 1);
    g.fillCircle(cx, cy, r);

    g.fillStyle(0xaa7700, 0.6);
    g.fillCircle(cx, cy, r * 0.7);

    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.2);

    g.generateTexture(key, canvas, canvas);
    g.destroy();
  }

  // ========== 粒子 ==========
  private generateParticles(): void {
    this.generateParticleDot('particle_hit', 0xffff00, 8);
    this.generateParticleDot('particle_death', 0xff4444, 10);
    this.generateParticleDot('particle_exp', 0x00ffff, 8);
  }

  private generateParticleDot(key: string, color: number, size: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 1);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(size / 2 - 1, size / 2 - 1, size / 4);
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

  // ========== 地图瓦片 ==========
  private generateTiles(): void {
    const size = 128;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

    // 深色背景
    g.fillStyle(0x0d0d1a, 1);
    g.fillRect(0, 0, size, size);

    // 网格线
    g.lineStyle(1, 0x1a1a30, 0.8);
    g.lineBetween(0, 0, size, 0);
    g.lineBetween(0, 0, 0, size);

    // 随机霓虹点（装饰）
    const dots = [
      { x: 20, y: 30, c: 0x00ffff, a: 0.15 },
      { x: 90, y: 60, c: 0xff00ff, a: 0.1 },
      { x: 50, y: 100, c: 0x00ff88, a: 0.12 },
      { x: 110, y: 20, c: 0xffaa00, a: 0.08 },
    ];
    dots.forEach((d) => {
      g.fillStyle(d.c, d.a);
      g.fillCircle(d.x, d.y, 3);
    });

    g.generateTexture('tile_grass', size, size);
    g.destroy();
  }
}
