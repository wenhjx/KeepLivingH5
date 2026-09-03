import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { UILayout } from '../utils/UILayout';

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
  private coinText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;

  // 底部玩家状态条坐标（create 时计算，update 时复用）
  private barLeftX = 0;
  private barTopY = 0;
  private barCenterY = 0;
  private expBarY = 0;

  // Boss 血条（唯一 Boss 出现时显示）
  private bossContainer!: Phaser.GameObjects.Container;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossBarBg!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossValueText!: Phaser.GameObjects.Text;

  // 增益列表（被动）
  private buffContainer!: Phaser.GameObjects.Container;
  private buffIcons: Map<string, Phaser.GameObjects.Container> = new Map();
  private lastBuffCount: number = -1;

  // 独立武器栏（武器系统分离展示：图标 + 等级；含 nova）
  private weaponIcons: Map<string, Phaser.GameObjects.Container> = new Map();
  private lastWeaponCount: number = -1;

  // buff 点击提示（tooltip）
  private tooltipContainer!: Phaser.GameObjects.Container;
  private activeTooltipId: string | null = null;
  // 松开后延迟消失的定时器（移动端留时间移开手指读完内容）
  private tooltipHideTimer: number | null = null;
  // buff 图标命中区（uiRoot 局部坐标 = canvas 像素坐标；手动判定，避免 Phaser 嵌套
  // Container setInteractive 在 scale 环境下 hitArea 偏移导致"点击左/右半命中不同 buff"）
  private buffHitRects: Array<{ b: any; x: number; y: number }> = [];

  // 武器视觉映射（图标 + 背景色）
  // 注意：图标与 UPGRADE_OPTIONS（升级三选一/商店/解锁提示）保持一致，避免同一武器多处图标不一致
  private readonly weaponVisuals: Record<string, { icon: string; color: number }> = {
    default_gun: { icon: '🔫', color: 0x444466 },
    machine_gun: { icon: '🔫', color: 0x886600 },
    shotgun: { icon: '🔫', color: 0x882222 },
    laser: { icon: '🔆', color: 0x006666 },
    rocket: { icon: '🚀', color: 0x884400 },
    boomerang: { icon: '🪃', color: 0x226622 },
    lightsaber: { icon: '🗡️', color: 0x006688 },
    drone: { icon: '🤖', color: 0x004466 },
    nova: { icon: '💥', color: 0x883355 },
  };

  // 被动技能视觉映射（图标 + 背景色）
  private readonly passiveVisuals: Record<string, { icon: string; color: number }> = {
    passive_regen: { icon: '💚', color: 0x226622 },
    passive_thorns: { icon: '🌵', color: 0x664422 },
    passive_exp_boost: { icon: '📈', color: 0x224466 },
    passive_gold_boost: { icon: '💰', color: 0x665500 },
    passive_lifesteal: { icon: '🩸', color: 0x662244 },
    passive_bounce: { icon: '🪩', color: 0x664466 },
    passive_freeze: { icon: '❄️', color: 0x226688 },
    passive_burn: { icon: '🔥', color: 0x883322 },
    passive_chain: { icon: '⚡', color: 0x886600 },
  };

  // stat 属性升级视觉映射（图标 + 背景色；图标与 UPGRADE_OPTIONS 保持一致）
  // 显示等级进度，让玩家能看到"力量强化 3/5"之类的上限
  private readonly statVisuals: Record<string, { icon: string; color: number }> = {
    max_hp: { icon: '❤️', color: 0x662222 },
    move_speed: { icon: '👟', color: 0x445566 },
    attack_power: { icon: '⚔️', color: 0x664422 },
    attack_speed: { icon: '⚡', color: 0x886622 },
    crit_rate: { icon: '🎯', color: 0x664466 },
    crit_damage: { icon: '💥', color: 0x882222 },
    pickup_radius: { icon: '🧲', color: 0x446666 },
    defense: { icon: '🛡️', color: 0x446688 },
    luck: { icon: '🍀', color: 0x226644 },
  };

  // 尺寸常量
  private readonly barWidth = 380;
  private readonly barHeight = 22;
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
    const { width, height } = this.scene.scale;
    const topY = this.padding; // 顶部基准线（右上角信息、Boss 血条用）

    // ========== 底部中心：血量和经验（大气版） ==========
    const centerX = width / 2;
    const bottomY = height - 40; // 血条中心 y
    const barLeft = centerX - this.barWidth / 2;
    const barTop = bottomY - this.barHeight / 2;

    // 缓存坐标供 update 方法使用
    this.barLeftX = barLeft;
    this.barTopY = barTop;
    this.barCenterY = bottomY;
    this.expBarY = bottomY + this.barHeight / 2 + 6;

    // 血量条背景
    this.healthBarBg = this.scene.add.graphics();
    this.healthBarBg.fillStyle(0x1a1a25, 0.9);
    this.healthBarBg.fillRoundedRect(barLeft, barTop, this.barWidth, this.barHeight, 6);
    this.healthBarBg.lineStyle(2, 0x44ff44, 0.4);
    this.healthBarBg.strokeRoundedRect(barLeft, barTop, this.barWidth, this.barHeight, 6);

    // 血量条
    this.healthBar = this.scene.add.graphics();

    // 血量文字
    this.healthText = createUIText(this.scene, centerX, bottomY, '100/100', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // 经验条背景
    const expY = bottomY + this.barHeight / 2 + 6;
    this.expBarBg = this.scene.add.graphics();
    this.expBarBg.fillStyle(0x1a1a25, 0.9);
    this.expBarBg.fillRoundedRect(barLeft, expY, this.barWidth, 8, 4);
    this.expBarBg.lineStyle(1, 0x4488ff, 0.4);
    this.expBarBg.strokeRoundedRect(barLeft, expY, this.barWidth, 8, 4);

    // 经验条
    this.expBar = this.scene.add.graphics();

    // 等级文字（血条左侧，放大）
    this.levelText = createUIText(this.scene, barLeft - 12, bottomY, 'Lv.1', {
        fontSize: '20px',
        color: '#ffb347',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(1, 0.5);

    // ========== 右上角：波次、击杀、分数（暂停按钮下方，避免重叠） ==========
    const rightX = width - this.padding;
    const infoTop = topY + 44;

    this.waveText = createUIText(this.scene, rightX, infoTop, '波次: 1', {
        fontSize: '16px',
        color: '#ff6b35',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);

    this.killsText = createUIText(this.scene, rightX, infoTop + 24, '击杀: 0', {
        fontSize: '14px',
        color: '#cccccc',
      })
      .setOrigin(1, 0);

    this.scoreText = createUIText(this.scene, rightX, infoTop + 46, '分数: 0', {
        fontSize: '14px',
        color: '#ffb347',
      })
      .setOrigin(1, 0);

    // 金币
    this.coinText = createUIText(this.scene, rightX, infoTop + 68, '💰 0', {
        fontSize: '14px',
        color: '#ffcc00',
        fontStyle: 'bold',
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
    this.buffContainer = this.scene.add.container(0, 0).setDepth(50);

    // buff 点击提示
    this.initTooltip();
  }

  /** 初始化 buff 点击提示（按下增益图标显示详情，松开延迟消失，无需再点一次关闭） */
  private initTooltip(): void {
    this.tooltipContainer = this.scene.add.container(0, 0).setDepth(210).setVisible(false);

    // 采用手动坐标判定（uiRoot 局部坐标 = pointer.x/y），彻底规避 Phaser Container
    // 嵌套 + 父级 scale 时 setInteractive hitArea 命中偏移的问题。
    // 交互：pointerdown 命中 buff 图标 → 显示详情（tooltip 悬浮于图标上方，避开手指遮挡）；
    //      pointerup（松开）→ 延迟 1.5s 消失，移动端移开手指后仍有时间读完；
    //      点击空白处 → 立即关闭。
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // 命中检测：图标 32x32，±4px 宽容便于点中
      for (const r of this.buffHitRects) {
        if (
          pointer.x >= r.x - 4 &&
          pointer.x <= r.x + this.buffSize + 4 &&
          pointer.y >= r.y - 4 &&
          pointer.y <= r.y + this.buffSize + 4
        ) {
          this.showBuffTooltip(r.b, r);
          return;
        }
      }
      // 点击空白：立即关闭并取消延迟消失
      this.hideTooltip();
    });

    // 松开鼠标/手指 → 延迟消失：给移动端玩家移开手指阅读的时间，
    // 不再"移开即消失"（手指遮挡 ↔ 移开消失的死锁）
    this.scene.input.on('pointerup', () => {
      if (this.tooltipContainer.visible) {
        this.scheduleHideTooltip(1500);
      }
    });
  }

  /** 延迟关闭 tooltip（再次按下会重置该计时器） */
  private scheduleHideTooltip(delay: number): void {
    if (this.tooltipHideTimer !== null) {
      clearTimeout(this.tooltipHideTimer);
      this.tooltipHideTimer = null;
    }
    this.tooltipHideTimer = window.setTimeout(() => {
      this.tooltipHideTimer = null;
      if (this.tooltipContainer.visible) this.hideTooltip();
    }, delay);
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
        this.coinText.setText(`💰 ${player.getCoins?.() ?? 0}`);
        this.updateBuffs(player);
        this.updateWeapons(player);
      }
      // 唯一 Boss 顶部大血条
      this.updateBossBar(gameScene.getActiveBoss?.());
    }
  }

  /** 更新被动增益列表（stat 属性在 C 键面板；武器已独立为左侧武器栏） */
  private updateBuffs(player: any): void {
    const passives = player.getPassives?.() || [];

    // 合并为统一格式（附加 desc 描述，供点击提示显示）
    const allBuffs = passives
      .map((p: any) => {
        const opt = UPGRADE_OPTIONS.find((u) => u.id === p.id);
        return {
          id: p.id,
          name: p.name,
          level: p.level,
          maxLevel: p.maxLevel,
          desc: opt?.description || '',
          ...this.passiveVisuals[p.id],
        };
      })
      .filter((b: any) => b.icon); // 过滤掉没有图标的未知项

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
          // 有突破次数时显示 "5+2"（升级满级5 + 突破2），否则仅显示等级
          levelText.setText(b.bt > 0 ? `${b.level}+${b.bt}` : `${b.level}`);
        }
      }
    });
  }

  /** 独立武器栏：显示所有已拥有武器（含 nova），图标 + 等级 */
  private updateWeapons(player: any): void {
    const weapons = player.getWeapons?.() || [];

    let changed = weapons.length !== this.lastWeaponCount;
    if (!changed) {
      for (const w of weapons) {
        const c = this.weaponIcons.get(w.id);
        if (!c || c.getData('level') !== w.level) { changed = true; break; }
      }
    }
    if (changed) {
      this.rebuildWeaponBar(weapons);
      this.lastWeaponCount = weapons.length;
    }

    // 更新等级文字
    weapons.forEach((w: any) => {
      const c = this.weaponIcons.get(w.id);
      if (c) {
        const lv = c.getAt(2) as Phaser.GameObjects.Text;
        if (lv) lv.setText(`${w.level}`);
      }
    });
  }

  /** 重建武器栏（左侧竖排；武器数量固定≤9，逐项向下铺开） */
  private rebuildWeaponBar(weapons: any[]): void {
    this.weaponIcons.forEach((c) => c.destroy());
    this.weaponIcons.clear();

    // 位置：左下角横排（与右下角物品栏对称），避开左上角小地图与底部中央血条；后续可按需求调整
    const barX = this.padding;
    const barTopY = 560;
    const col = new UILayout({ x: barX, y: barTopY, direction: 'row', itemSize: 34, spacing: 6 });

    weapons.forEach((w: any) => {
      const vis = this.weaponVisuals[w.id];
      if (!vis?.icon) return;
      const c = this.scene.add.container(0, 0);
      const bg = this.scene.add.graphics();
      bg.fillStyle(vis.color, 0.9);
      bg.fillRoundedRect(-17, -17, 34, 34, 6);
      bg.lineStyle(1, 0xffffff, 0.35);
      bg.strokeRoundedRect(-17, -17, 34, 34, 6);
      const icon = this.scene.add.text(0, -3, vis.icon, { fontSize: '19px' }).setOrigin(0.5);
      const lv = this.scene.add.text(9, 10, `${w.level}`, {
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      c.add([bg, icon, lv]);
      c.setData('level', w.level);
      this.weaponIcons.set(w.id, c);
      col.place(c);
    });
  }

  /** 重建增益列表（整体居中于血条上方，buff 多时均匀向两侧铺开） */
  private rebuildBuffList(buffs: Array<{ id: string; level: number; icon: string; color: number; name?: string; desc?: string; maxLevel?: number; bt?: number }>): void {
    // 清除旧图标
    this.buffIcons.forEach((icon) => icon.destroy());
    this.buffIcons.clear();
    this.buffHitRects = [];

    // 位置：血条（barTopY）上方居中。居中基准为血条中心（scale.width/2），
    // 保证无论 buff 多少，列表都以屏幕中心对称铺开，不会向左/右单向延伸。
    const buffTop = this.barTopY - this.buffSize - 12; // 血条上方 12px
    const totalW = buffs.length * (this.buffSize + this.buffSpacing) - this.buffSpacing;
    const startX = Math.max(this.padding, (this.scene.scale.width - totalW) / 2);

    // 用 UILayout 水平排布：固定步长 = buffSize，间距 = buffSpacing，
    // 每个图标自动接在上一个右侧（自增长友好，新增 buff 无需重算坐标）
    const buffRow = new UILayout({
      x: startX,
      y: buffTop,
      direction: 'row',
      itemSize: this.buffSize,
      spacing: this.buffSpacing,
    });

    buffs.forEach((b) => {
      // 记录命中区（uiRoot 局部坐标：buffContainer 位于 (0,0)，图标在 (x,buffTop)）
      this.buffHitRects.push({ b, x: buffRow.x, y: buffTop });

      const container = this.scene.add.container(buffRow.x, buffTop).setDepth(51);
      buffRow.place(container, this.buffContainer);
      // 注：container 保持默认 origin(0,0)，左上角贴齐游标，hitRect 左上角语义不变

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

      // 注意：此处不再对图标 Container setInteractive——Phaser 嵌套 Container（uiRoot scale=1/z
      // → buffContainer → 图标）的 hitArea 在 scale 环境下命中偏移（点击左/右半命中不同 buff），
      // 点击判定统一由 initTooltip 的全局 pointerdown 手动坐标检测处理（见 buffHitRects）。
      // （container 已由 buffRow.place(container, this.buffContainer) 加入 buffContainer）

      this.buffIcons.set(b.id, container);
    });
  }

  /** 显示 buff 详情提示（悬浮于 buff 图标正上方，避开手指/鼠标遮挡；越界翻转到图标下方） */
  private showBuffTooltip(
    b: { id: string; name?: string; level: number; icon: string; color: number; desc?: string; maxLevel?: number; bt?: number },
    rect: { b: any; x: number; y: number }
  ): void {
    // 已在显示同一 buff 的提示 → 关闭
    if (this.tooltipContainer.visible && this.activeTooltipId === b.id) {
      this.hideTooltip();
      return;
    }
    // 关闭旧提示后重建
    this.hideTooltip();
    this.activeTooltipId = b.id;

    // 布局坐标系 = uiRoot 反向缩放根容器的局部坐标 = canvas 像素坐标（0~scale.width/height）。
    // 原因：UIScene 相机 zoom=renderScale，UI 全部放入 scale=1/z 的 uiRoot 容器做视觉补偿，
    // 因此 HUD 布局（this.scene.scale.width 基准）与 canvas 像素坐标一一对应。
    // 注意：不能用 pointer.worldX/worldY —— 那是相机 scroll+zoom 公式的世界坐标，z>1 时
    // 与 uiRoot 局部坐标存在偏移（左上角点击会向右下偏），正是此前 tooltip 在系统浏览器偏位的原因。
    const viewW = this.scene.scale.width;
    const viewH = this.scene.scale.height;
    const boxW = 250;
    const boxH = 88;
    const title = b.name || b.id;
    const lvText = b.bt && b.bt > 0 ? `Lv.${b.level}+${b.bt}` : `Lv.${b.level}`;

    // 锚定到 buff 图标中心（而非手指位置）：手指按在图标上时，tooltip 悬浮于图标上方，
    // 不在手指覆盖区内 → 移动端不再遮挡内容。水平居中于图标，垂直位于图标上方 10px。
    const iconCx = rect.x + this.buffSize / 2;
    const iconCy = rect.y + this.buffSize / 2;
    // 描述换行高度自适应：描述超过一行时按行数抬高 tooltip
    const descLines = Math.ceil((b.desc || '').length / 16);
    const boxHTotal = boxH + Math.max(0, descLines - 1) * 16;
    const boxX = Phaser.Math.Clamp(iconCx, boxW / 2 + 4, viewW - boxW / 2 - 4);
    let boxY = iconCy - boxHTotal / 2 - 10;
    // 顶部越界 → 翻转到图标下方
    if (boxY - boxHTotal / 2 < 20) boxY = iconCy + boxHTotal / 2 + 12;

    // 背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0e0e18, 0.96);
    bg.fillRoundedRect(boxX - boxW / 2, boxY - boxHTotal / 2, boxW, boxHTotal, 10);
    bg.lineStyle(2, b.color, 1);
    bg.strokeRoundedRect(boxX - boxW / 2, boxY - boxHTotal / 2, boxW, boxHTotal, 10);
    this.tooltipContainer.add(bg);

    // 标题行：图标 + 名称 + 等级
    const titleText = createUIText(this.scene, boxX - boxW / 2 + 12, boxY - boxHTotal / 2 + 8, `${b.icon}  ${title}`, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    this.tooltipContainer.add(titleText);

    const lvTextObj = createUIText(this.scene, boxX + boxW / 2 - 12, boxY - boxHTotal / 2 + 8, lvText, {
        fontSize: '13px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0);
    this.tooltipContainer.add(lvTextObj);

    // 描述
    const descText = createUIText(this.scene, boxX - boxW / 2 + 12, boxY - boxHTotal / 2 + 34, b.desc || '', {
        fontSize: '13px',
        color: '#bbbbbb',
        wordWrap: { width: boxW - 24 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    this.tooltipContainer.add(descText);

    this.tooltipContainer.setVisible(true);
  }

  /** 关闭 buff 详情提示 */
  private hideTooltip(): void {
    // 取消未触发的延迟消失定时器，避免残留
    if (this.tooltipHideTimer !== null) {
      clearTimeout(this.tooltipHideTimer);
      this.tooltipHideTimer = null;
    }
    this.tooltipContainer.setVisible(false);
    this.activeTooltipId = null;
    // 移除 tooltip 内容。注意必须用数组快照遍历：destroy() 会同步修改
    // container.list（从父容器移除），直接 forEach 会因索引前移跳过元素，
    // 导致快速切换 buff 时旧文本残留（实测 list 长度每次点击递增 4→6→7）。
    this.tooltipContainer.list.slice().forEach((obj) => obj.destroy());
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
    this.healthBar.fillRoundedRect(this.barLeftX + 3, this.barTopY + 3, (this.barWidth - 6) * percent, this.barHeight - 6, 4);

    this.healthText.setText(`${Math.ceil(current)}/${max}`);
  }

  private updateExpBar(current: number, max: number): void {
    const percent = Math.max(0, Math.min(1, current / max));
    this.expBar.clear();
    this.expBar.fillStyle(0x4488ff, 1);
    this.expBar.fillRoundedRect(this.barLeftX + 3, this.expBarY + 2, (this.barWidth - 6) * percent, 4, 2);
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
    this.coinText.setVisible(visible);
    this.timeText.setVisible(visible);
    this.bossContainer?.setVisible(visible && this.bossContainer.visible);
    this.buffContainer?.setVisible(visible);
  }
}
