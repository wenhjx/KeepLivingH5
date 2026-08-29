import { createUIText } from '../utils/UIText';
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

  // Boss 血条（唯一 Boss 出现时显示）
  private bossContainer!: Phaser.GameObjects.Container;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossBarBg!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossValueText!: Phaser.GameObjects.Text;

  // 增益列表（武器/被动）
  private buffContainer!: Phaser.GameObjects.Container;
  private buffIcons: Map<string, Phaser.GameObjects.Container> = new Map();
  private lastBuffCount: number = -1;

  // 武器视觉映射（图标 + 背景色）
  private readonly weaponVisuals: Record<string, { icon: string; color: number }> = {
    default_gun: { icon: '🔫', color: 0x444466 },
    machine_gun: { icon: '🔫', color: 0x886600 },
    shotgun: { icon: '💥', color: 0x882222 },
    laser: { icon: '⚡', color: 0x006666 },
    rocket: { icon: '🚀', color: 0x884400 },
    boomerang: { icon: '🪃', color: 0x226622 },
    lightsaber: { icon: '🗡️', color: 0x006688 },
    drone: { icon: '🤖', color: 0x004466 },
  };

  // 被动技能视觉映射（图标 + 背景色）
  private readonly passiveVisuals: Record<string, { icon: string; color: number }> = {
    passive_regen: { icon: '💚', color: 0x226622 },
    passive_thorns: { icon: '🌵', color: 0x664422 },
    passive_exp_boost: { icon: '📈', color: 0x224466 },
    passive_gold_boost: { icon: '💰', color: 0x665500 },
  };

  // 尺寸常量
  private readonly barWidth = 220;
  private readonly barHeight = 16;
  private readonly padding = 16;
  private readonly buffSize = 32;
  private readonly buffSpacing = 6;
  private readonly bossBarWidth = 420;
  private readonly bossBarHeight = 18;

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
    this.healthText = createUIText(this.scene, leftX + this.barWidth / 2, topY + this.barHeight / 2, '100/100', {
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
    this.levelText = createUIText(this.scene, leftX + this.barWidth + 8, expY + 4, 'Lv.1', {
        fontSize: '14px',
        color: '#ffb347',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    // ========== 右上角：波次、击杀、分数 ==========
    const rightX = width - this.padding;

    this.waveText = createUIText(this.scene, rightX, topY, '波次: 1', {
        fontSize: '16px',
        color: '#ff6b35',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);

    this.killsText = createUIText(this.scene, rightX, topY + 24, '击杀: 0', {
        fontSize: '14px',
        color: '#cccccc',
      })
      .setOrigin(1, 0);

    this.scoreText = createUIText(this.scene, rightX, topY + 46, '分数: 0', {
        fontSize: '14px',
        color: '#ffb347',
      })
      .setOrigin(1, 0);

    // ========== 顶部中间：存活时间 ==========
    this.timeText = createUIText(this.scene, width / 2, topY, '00:00', {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    // ========== Boss 血条（唯一 Boss 出现时显示） ==========
    this.bossContainer = this.scene.add.container(width / 2, topY + 40).setDepth(60);
    this.bossContainer.setVisible(false);

    // Boss 名称
    this.bossNameText = createUIText(this.scene, 0, -this.bossBarHeight - 6, 'BOSS', {
        fontSize: '20px',
        color: '#ff3344',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.bossContainer.add(this.bossNameText);

    // 血条背景
    this.bossBarBg = this.scene.add.graphics();
    this.bossBarBg.fillStyle(0x1a1a25, 0.95);
    this.bossBarBg.fillRoundedRect(-this.bossBarWidth / 2, 0, this.bossBarWidth, this.bossBarHeight, 5);
    this.bossBarBg.lineStyle(2, 0xff3344, 0.8);
    this.bossBarBg.strokeRoundedRect(-this.bossBarWidth / 2, 0, this.bossBarWidth, this.bossBarHeight, 5);
    this.bossContainer.add(this.bossBarBg);

    // 血量填充
    this.bossBar = this.scene.add.graphics();
    this.bossContainer.add(this.bossBar);

    // 血量数值
    this.bossValueText = createUIText(this.scene, 0, this.bossBarHeight / 2, '', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.bossContainer.add(this.bossValueText);

    // ========== 左下角：增益列表（武器/被动） ==========
    this.buffContainer = this.scene.add.container(this.padding, 0).setDepth(50);
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
        this.updateBuffs(player);
      }
      // 唯一 Boss 顶部大血条
      this.updateBossBar(gameScene.getActiveBoss?.());
    }
  }

  /** 更新增益列表（武器+被动） */
  private updateBuffs(player: any): void {
    const weapons = player.getWeapons?.() || [];
    const passives = player.getPassives?.() || [];

    // 合并为统一格式
    const allBuffs = [
      ...weapons.map((w: any) => ({
        id: w.id,
        name: w.name,
        level: w.level,
        maxLevel: w.maxLevel,
        ...this.weaponVisuals[w.id],
      })),
      ...passives.map((p: any) => ({
        id: p.id,
        name: p.name,
        level: p.level,
        maxLevel: p.maxLevel,
        ...this.passiveVisuals[p.id],
      })),
    ].filter((b) => b.icon); // 过滤掉没有图标的未知项

    // 数量变化时重建列表
    if (allBuffs.length !== this.lastBuffCount) {
      this.rebuildBuffList(allBuffs);
      this.lastBuffCount = allBuffs.length;
    }

    // 更新等级文字
    allBuffs.forEach((b: any) => {
      const icon = this.buffIcons.get(b.id);
      if (icon) {
        const levelText = icon.getAt(2) as Phaser.GameObjects.Text;
        if (levelText) {
          levelText.setText(`${b.level}`);
        }
      }
    });
  }

  /** 重建增益列表 */
  private rebuildBuffList(buffs: Array<{ id: string; level: number; icon: string; color: number }>): void {
    // 清除旧图标
    this.buffIcons.forEach((icon) => icon.destroy());
    this.buffIcons.clear();

    const startY = this.padding + this.barHeight + 6 + 8 + 20; // 经验条下方

    buffs.forEach((b, index: number) => {
      const x = index * (this.buffSize + this.buffSpacing);

      const container = this.scene.add.container(x, startY).setDepth(51);

      // 背景
      const bg = this.scene.add.graphics();
      bg.fillStyle(b.color, 0.8);
      bg.fillRoundedRect(0, 0, this.buffSize, this.buffSize, 4);
      bg.lineStyle(1, 0xffffff, 0.3);
      bg.strokeRoundedRect(0, 0, this.buffSize, this.buffSize, 4);
      container.add(bg);

      // 图标
      const iconText = createUIText(this.scene, this.buffSize / 2, this.buffSize / 2 - 2, b.icon, {
          fontSize: '16px',
        })
        .setOrigin(0.5);
      container.add(iconText);

      // 等级
      const levelText = createUIText(this.scene, this.buffSize - 2, this.buffSize - 1, `${b.level}`, {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(1, 1);
      container.add(levelText);

      this.buffContainer.add(container);
      this.buffIcons.set(b.id, container);
    });
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

  /** 更新 Boss 顶部大血条（无 Boss 时隐藏） */
  private updateBossBar(boss: any): void {
    if (!boss || !boss.active || !boss.getConfig) {
      this.bossContainer.setVisible(false);
      return;
    }

    const health = boss.getHealth();
    const max = boss.getMaxHealth();
    if (max <= 0) return;

    const percent = Math.max(0, health / max);

    // 名称
    this.bossNameText.setText(boss.getConfig()?.name || 'BOSS');

    // 血条颜色：高血量橙红，低血量暗红
    let color = 0xff5544;
    if (percent < 0.25) color = 0xaa2233;
    else if (percent < 0.5) color = 0xdd3344;

    this.bossBar.clear();
    if (percent > 0) {
      this.bossBar.fillStyle(color, 1);
      this.bossBar.fillRoundedRect(
        -this.bossBarWidth / 2 + 2,
        2,
        (this.bossBarWidth - 4) * percent,
        this.bossBarHeight - 4,
        3
      );
    }

    // 数值
    this.bossValueText.setText(`${Math.ceil(health)} / ${max}`);

    this.bossContainer.setVisible(true);
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
    this.bossContainer?.setVisible(visible && this.bossContainer.visible);
    this.buffContainer?.setVisible(visible);
  }
}
