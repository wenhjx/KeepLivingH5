import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { UPGRADE_OPTIONS, FALLBACK_UPGRADES } from '../data/upgrades';
import { applyUpgradeToPlayer } from '../utils/UpgradeApplier';
import { GameConfig } from '../game/GameConfig';
import { UILayout } from '../utils/UILayout';
import type { UpgradeOption } from '../types';
import type { Player } from '../entities/Player';

/** 单个按钮的规格 */
interface BtnSpec {
  text: string;
  fn: () => void;
}

/** 构建出的按钮对象（bg/txt/hit 均为 content 内局部坐标元素） */
interface BtnParts {
  bg: Phaser.GameObjects.Graphics;
  txt: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
}

/**
 * 调试面板
 * 支持快速添加武器/被动、调整等级/经验/血量/拾取范围、AI 托管、视觉主题切换
 * 布局由 UILayout 管理（自动推进、间距统一），内容超出面板高度时支持滚轮滚动
 * 按 ` 键（反引号）切换显示
 */
export class DebugPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private uiRoot: Phaser.GameObjects.Container;
  private visible: boolean = false;
  private autoPlayText: Phaser.GameObjects.Text | null = null;
  private autoPlayBg: Phaser.GameObjects.Graphics | null = null;
  private themeText: Phaser.GameObjects.Text | null = null;
  private themeBg: Phaser.GameObjects.Graphics | null = null;
  private enemyBoostText: Phaser.GameObjects.Text | null = null;

  private readonly panelWidth = 340;
  private readonly btnWidth = 152;
  private readonly btnHeight = 30;
  private readonly btnSpacing = 6;
  private readonly sectionSpacing = 10;
  private readonly padding = 12;

  // ===== 滚动相关 =====
  private content!: Phaser.GameObjects.Container;
  private contentBaseY = 0;
  private scrollOffset = 0;
  private maxScroll = 0;
  private viewportH = 0;
  private panelY = 12;
  private panelX = 0;

  // ===== 触摸/点击防误触 =====
  /** 位移超过该阈值（屏幕像素）判定为拖动滚动，抑制按钮点击 */
  private readonly TAP_THRESHOLD = 12;
  /** 按下的待结算点击（松手时若未拖动则触发） */
  private pendingTap: { fn: () => void; sx: number; sy: number; moved: boolean } | null = null;
  /** 滚动区拖动状态 */
  private scrollDragging = false;
  private dragStartY = 0;
  private dragStartOff = 0;

  constructor(scene: Phaser.Scene, uiRoot: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.uiRoot = uiRoot;
    this.container = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.create();
    this.setupHotkey();
  }

  private create(): void {
    const { width, height } = this.scene.scale;
    this.panelX = width - this.panelWidth - 12;
    this.panelY = 12;

    // 内容总高度估算（决定是否需要滚动；面板高度上限 = 屏幕 3/4 高）
    const contentHeight = this.computeContentHeight();
    // 界面高度不随内容无限变长：内容少时紧凑，内容多时封顶为屏幕高度 3/4，
    // 超出部分在面板内滚动查看（UILayout 排布 + 几何 mask 裁剪）
    const panelHeight = Math.min(contentHeight + this.padding, Math.round(height * 0.75));
    this.viewportH = panelHeight - 40 - this.padding;

    // 半透明背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a0f, 0.94);
    bg.fillRoundedRect(this.panelX, this.panelY, this.panelWidth, panelHeight, 8);
    bg.lineStyle(2, 0xff6b35, 0.5);
    bg.strokeRoundedRect(this.panelX, this.panelY, this.panelWidth, panelHeight, 8);
    this.container.add(bg);

    // 标题
    const title = createUIText(this.scene, this.panelX + this.panelWidth / 2, this.panelY + 14, '🔧 调试面板  (按 ` 切换)', {
        fontSize: '13px',
        color: '#ff6b35',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.container.add(title);

    // 内容容器（滚动对象）——局部坐标以 (panelX+padding, panelY+40) 为原点
    this.content = this.scene.add.container(this.panelX + this.padding, this.panelY + 40);
    this.container.add(this.content);
    this.contentBaseY = this.panelY + 40;

    // 滚动遮罩（几何 mask，覆盖可视区；graphics 本身不渲染）
    // 关键：Phaser 的 GeometryMask 几何按 world/camera 坐标解释，而本面板位于
    // UIScene 的"反向缩放根容器 uiRoot"内（局部坐标 ≠ world 坐标）。
    // 必须把面板可视区经 uiRoot 变换换算成 world 坐标后再画矩形，否则 mask 与
    // content 渲染位置错位——在部分窗口尺寸/高分屏下表现为"面板无内容但可点击"。
    const rm = this.uiRoot.getWorldTransformMatrix();
    const origin = rm.transformPoint(this.panelX + this.padding, this.panelY + 40, new Phaser.Math.Vector2());
    const maskX = origin.x;
    const maskY = origin.y;
    const maskW = (this.panelWidth - this.padding * 2) * rm.scaleX;
    const maskH = this.viewportH * rm.scaleY;
    const maskG = this.scene.add.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(maskX, maskY, maskW, maskH);
    maskG.setVisible(false);
    const mask = maskG.createGeometryMask();
    this.content.setMask(mask);
    this.container.add(maskG);

    // ===== 用 UILayout 排布内容（游标只管理 y，行内两列按钮手动对齐到游标） =====
    const col = new UILayout({ x: 0, y: 0, direction: 'column', spacing: this.btnSpacing, itemSize: this.btnHeight });

    // 快捷操作
    this.addSectionTitle(col, '⚡ 快捷操作');
    this.addRow(col, { text: '❤️ 回满血', fn: () => this.getPlayer()?.heal(9999) }, { text: '⭐ +1 级', fn: () => this.addLevel(1) });
    this.addRow(col, { text: '🌟 +5 级', fn: () => this.addLevel(5) }, { text: '💀 清空敌人', fn: () => this.clearEnemies() });
    this.addRow(col, { text: '🎁 宝箱', fn: () => {
      const p = this.getPlayer();
      const gs = this.scene.scene.get('GameScene') as any;
      if (p && gs?.spawnPickup) {
        gs.spawnPickup({ type: 'chest', texture: 'pickup_chest', value: 0, magnetSpeed: 200 }, p.x + 40, p.y);
      }
    } });
    this.addAutoPlayRow(col);
    this.addThemeRow(col);
    col.step(this.sectionSpacing);

    // 属性调整
    this.addSectionTitle(col, '📊 属性调整');
    this.addRow(col, { text: '🧲 拾取+50', fn: () => this.addPickupRadius(50) }, { text: '🧲 拾取+200', fn: () => this.addPickupRadius(200) });
    this.addRow(col, { text: '🧲 全屏拾取', fn: () => this.setPickupRadius(9999) }, { text: '📈 +1000 经验', fn: () => this.addExp(1000) });
    col.step(this.sectionSpacing);

    // 属性升级（与 UPGRADE_OPTIONS.stat 对齐）
    this.addSectionTitle(col, '📈 属性升级（点击应用）');
    this.addOptionsRows(col, UPGRADE_OPTIONS.filter((o) => o.type === 'stat'));
    col.step(this.sectionSpacing);

    // 武器（与 UPGRADE_OPTIONS.weapon 对齐）
    this.addSectionTitle(col, '🔫 武器（点击获取/升级）');
    this.addOptionsRows(col, UPGRADE_OPTIONS.filter((o) => o.type === 'weapon'));
    col.step(this.sectionSpacing);

    // 被动（与 UPGRADE_OPTIONS.passive 对齐）
    this.addSectionTitle(col, '✨ 被动技能（点击获取/升级）');
    this.addOptionsRows(col, UPGRADE_OPTIONS.filter((o) => o.type === 'passive'));
    col.step(this.sectionSpacing);

    // 商店道具（即时生效，方便测试；不叠加属性，不影响玩家状态）
    this.addSectionTitle(col, '🛒 商店道具（即时生效）');
    this.addOptionsRows(col, FALLBACK_UPGRADES);
    col.step(this.sectionSpacing);

    // 怪物增强（调试测试阈值用；只作用于新生成的敌人，不影响场上现有敌人）
    this.addSectionTitle(col, '👹 怪物增强（新生成生效）');
    const gs = this.getGameScene();
    const curHp = gs?.enemyHpBoost ?? 1;
    const curAtk = gs?.enemyAtkBoost ?? 1;
    this.enemyBoostText = createUIText(this.scene, 0, col.y, `当前：血量×${curHp} · 攻击×${curAtk}`, {
        fontSize: '11px',
        color: '#88ff88',
      })
      .setOrigin(0, 0);
    this.content.add(this.enemyBoostText);
    col.step(this.btnHeight + this.btnSpacing);
    this.addRow(col, { text: '🩸 血量×2', fn: () => this.setEnemyBoost(2, -1) }, { text: '⚔️ 攻击×2', fn: () => this.setEnemyBoost(-1, 2) });
    this.addRow(col, { text: '🩸 血量×4', fn: () => this.setEnemyBoost(4, -1) }, { text: '⚔️ 攻击×4', fn: () => this.setEnemyBoost(-1, 4) });
    this.addRow(col, { text: '🩸 血量×1', fn: () => this.setEnemyBoost(1, -1) }, { text: '⚔️ 攻击×1', fn: () => this.setEnemyBoost(-1, 1) });

    // 计算可滚动上限（内容总高 - 可视区高）
    this.maxScroll = Math.max(0, col.y + this.padding - this.viewportH);
    this.setScroll(0);

    // 滚轮滚动（面板可见时生效）
    // Phaser wheel 事件签名：(pointer, currentlyOver, deltaX, deltaY, deltaZ)。
    // deltaY 为屏幕像素，DebugPanel 布局即 canvas 像素坐标系（uiRoot 局部），故直接使用。
    this.scene.input.on('wheel', (_pointer: any, _over: any, deltaX: number, deltaY: number, deltaZ: number) => {
      if (!this.visible) return;
      const dy = deltaY !== 0 ? deltaY : deltaZ;
      if (dy === 0) return;
      this.setScroll(this.scrollOffset - dy);
    });

    // 触摸拖动滚动 + 点击防误触（移动端在按钮上滑动 = 滚动而非点击）
    this.setupTouchInput();
  }

  // ===== 布局辅助 =====

  /** 估算内容总高（按 UPGRADE_OPTIONS 实际行数动态计算，新增选项自动拓展） */
  private computeContentHeight(): number {
    const rowH = this.btnHeight + this.btnSpacing;
    const sectionH = (rows: number) => 20 + rows * rowH + this.sectionSpacing;
    // 快捷操作 4 行（含 AI/主题全宽）、属性 2 行
    const statRows = Math.ceil(UPGRADE_OPTIONS.filter((o) => o.type === 'stat').length / 2);
    const weaponRows = Math.ceil(UPGRADE_OPTIONS.filter((o) => o.type === 'weapon').length / 2);
    const passiveRows = Math.ceil(UPGRADE_OPTIONS.filter((o) => o.type === 'passive').length / 2);
    // 商店道具（FALLBACK_UPGRADES）2 行
    const shopRows = Math.ceil(FALLBACK_UPGRADES.length / 2);
    return 28 + sectionH(5) + sectionH(2) + sectionH(statRows) + sectionH(weaponRows) + sectionH(passiveRows) + sectionH(shopRows) + sectionH(4) + this.padding;
  }

  /** 分区标题（content 内） */
  private addSectionTitle(col: UILayout, text: string): void {
    const y = col.y;
    const title = createUIText(this.scene, 0, y, text, {
        fontSize: '11px',
        color: '#ffb347',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0);
    this.content.add(title);
    col.step(18);
  }

  /** 排一行两个按钮（可缺省一侧），按钮定位到当前游标后推进 */
  private addRow(col: UILayout, left?: BtnSpec, right?: BtnSpec): void {
    const y = col.y;
    if (left) this.placeButton(this.makeButton(left.text, left.fn, this.btnWidth), 0, y);
    if (right) this.placeButton(this.makeButton(right.text, right.fn, this.btnWidth), this.btnWidth + this.btnSpacing, y);
    col.step(this.btnHeight + this.btnSpacing);
  }

  /** 渲染一组升级选项为两列行 */
  private addOptionsRows(col: UILayout, list: UpgradeOption[]): void {
    for (let i = 0; i < list.length; i += 2) {
      const opt = list[i];
      const right = list[i + 1];
      const toSpec = (o: UpgradeOption): BtnSpec => ({
        text: `${o.icon || '✨'} ${o.name}`,
        fn: () => {
          const player = this.getPlayer();
          if (player) applyUpgradeToPlayer(player, o, this.getGameScene());
        },
      });
      this.addRow(col, toSpec(opt), right ? toSpec(right) : undefined);
    }
  }

  /** 创建单个按钮（content 局部坐标，未定位） */
  private makeButton(text: string, onClick: () => void, width: number): BtnParts {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x252530, 1);
    bg.fillRoundedRect(0, 0, width, this.btnHeight, 4);
    bg.lineStyle(1, 0x444455, 0.6);
    bg.strokeRoundedRect(0, 0, width, this.btnHeight, 4);

    const txt = createUIText(this.scene, width / 2, this.btnHeight / 2, text, {
        fontSize: '11px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    const hit = this.scene.add
      .rectangle(width / 2, this.btnHeight / 2, width, this.btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x353555, 1);
      bg.fillRoundedRect(0, 0, width, this.btnHeight, 4);
      bg.lineStyle(1, 0xff6b35, 0.8);
      bg.strokeRoundedRect(0, 0, width, this.btnHeight, 4);
      txt.setColor('#ffffff');
    });
    hit.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x252530, 1);
      bg.fillRoundedRect(0, 0, width, this.btnHeight, 4);
      bg.lineStyle(1, 0x444455, 0.6);
      bg.strokeRoundedRect(0, 0, width, this.btnHeight, 4);
      txt.setColor('#cccccc');
    });
    // 点击改为"按下记录 + 松手判定"：移动端按下后滑动（超阈值）视为滚动而非误触
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pendingTap = { fn: onClick, sx: p.x, sy: p.y, moved: false };
    });

    return { bg, txt, hit };
  }

  /** 将按钮组定位到 (x, y) 并加入 content */
  private placeButton(b: BtnParts, x: number, y: number): void {
    b.bg.setPosition(x, y);
    b.txt.setPosition(x + this.btnWidth / 2, y + this.btnHeight / 2);
    b.hit.setPosition(x + this.btnWidth / 2, y + this.btnHeight / 2);
    this.content.add([b.bg, b.txt, b.hit]);
  }

  // ===== AI 托管 / 主题切换（状态跟随的全宽按钮） =====

  /** AI 托管按钮（全宽，文字/底色随状态变化） */
  private addAutoPlayRow(col: UILayout): void {
    const y = col.y;
    const fullW = this.btnWidth * 2 + this.btnSpacing;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x252530, 1);
    bg.fillRoundedRect(0, 0, fullW, this.btnHeight, 4);
    bg.lineStyle(1, 0x444455, 0.6);
    bg.strokeRoundedRect(0, 0, fullW, this.btnHeight, 4);

    this.autoPlayText = createUIText(this.scene, fullW / 2, this.btnHeight / 2, '🤖 AI 托管：关闭（点击开启）', {
        fontSize: '11px',
        color: '#cccccc',
      })
      .setOrigin(0.5);
    this.autoPlayBg = bg;

    const hit = this.scene.add
      .rectangle(fullW / 2, this.btnHeight / 2, fullW, this.btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const updateState = (enabled: boolean) => {
      if (this.autoPlayText) {
        this.autoPlayText.setText(enabled ? '🤖 AI 托管：开启中（点击停止）' : '🤖 AI 托管：关闭（点击开启）');
        this.autoPlayText.setColor(enabled ? '#66ff99' : '#cccccc');
      }
      bg.clear();
      bg.fillStyle(enabled ? 0x1a3a2a : 0x252530, 1);
      bg.fillRoundedRect(0, 0, fullW, this.btnHeight, 4);
      bg.lineStyle(1, enabled ? 0x66ff99 : 0x444455, 0.8);
      bg.strokeRoundedRect(0, 0, fullW, this.btnHeight, 4);
    };

    hit.on('pointerover', () => {
      updateState(this.getGameScene()?.isAutoPlay?.() || false);
      this.autoPlayText?.setColor('#ffffff');
    });
    hit.on('pointerout', () => {
      updateState(this.getGameScene()?.isAutoPlay?.() || false);
    });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pendingTap = {
        fn: () => {
          const gs = this.getGameScene();
          if (!gs) return;
          const next = !gs.isAutoPlay?.();
          gs.setAutoPlay?.(next);
          updateState(next);
        },
        sx: p.x,
        sy: p.y,
        moved: false,
      };
    });

    bg.setPosition(0, y);
    this.autoPlayText.setPosition(fullW / 2, y + this.btnHeight / 2);
    hit.setPosition(fullW / 2, y + this.btnHeight / 2);
    this.content.add([bg, this.autoPlayText, hit]);
    col.step(this.btnHeight + this.btnSpacing);
  }

  /** 视觉主题切换按钮（全宽，显示当前主题，点击切换并即时生效） */
  private addThemeRow(col: UILayout): void {
    const y = col.y;
    const fullW = this.btnWidth * 2 + this.btnSpacing;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x252530, 1);
    bg.fillRoundedRect(0, 0, fullW, this.btnHeight, 4);
    bg.lineStyle(1, 0x444455, 0.6);
    bg.strokeRoundedRect(0, 0, fullW, this.btnHeight, 4);

    this.themeText = createUIText(this.scene, fullW / 2, this.btnHeight / 2, '', {
        fontSize: '11px',
        color: '#cccccc',
      })
      .setOrigin(0.5);
    this.themeBg = bg;

    const hit = this.scene.add
      .rectangle(fullW / 2, this.btnHeight / 2, fullW, this.btnHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const updateState = (theme: 'pixel' | 'classic') => {
      if (this.themeText) {
        this.themeText.setText(theme === 'classic' ? '🎨 主题：经典矢量（点击切像素）' : '🎨 主题：像素风（点击切经典）');
      }
      bg.clear();
      const on = theme === 'classic';
      bg.fillStyle(on ? 0x1a2a3a : 0x252530, 1);
      bg.fillRoundedRect(0, 0, fullW, this.btnHeight, 4);
      bg.lineStyle(1, on ? 0x66ccff : 0x444455, 0.8);
      bg.strokeRoundedRect(0, 0, fullW, this.btnHeight, 4);
    };

    hit.on('pointerover', () => {
      updateState(GameConfig.VISUAL_THEME);
      this.themeText?.setColor('#ffffff');
    });
    hit.on('pointerout', () => updateState(GameConfig.VISUAL_THEME));
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pendingTap = {
        fn: () => {
          const next: 'pixel' | 'classic' = GameConfig.VISUAL_THEME === 'classic' ? 'pixel' : 'classic';
          const api = (window as any).__debug;
          if (api?.setTheme) {
            api.setTheme(next);
          } else {
            GameConfig.VISUAL_THEME = next;
          }
          updateState(next);
        },
        sx: p.x,
        sy: p.y,
        moved: false,
      };
    });

    bg.setPosition(0, y);
    this.themeText.setPosition(fullW / 2, y + this.btnHeight / 2);
    hit.setPosition(fullW / 2, y + this.btnHeight / 2);
    this.content.add([bg, this.themeText, hit]);
    updateState(GameConfig.VISUAL_THEME);
    col.step(this.btnHeight + this.btnSpacing);
  }

  // ===== 滚动 =====

  /** 设置内容滚动偏移（负值向上滚），并 clamp 到 [ -maxScroll, 0 ] */
  private setScroll(offset: number): void {
    this.scrollOffset = Phaser.Math.Clamp(offset, -this.maxScroll, 0);
    this.content.setY(this.contentBaseY + this.scrollOffset);
  }

  /**
   * 触摸/鼠标拖动滚动 + 点击防误触
   *
   * 原理：按钮点击不再"按下即触发"，而是"按下记录 + 松手时若位移未超阈值才触发"；
   * 滚动区覆盖一层透明交互矩形，按在其上并拖动（位移超阈值）即滚动内容、抑制点击。
   * 这样移动端手指按住按钮滑动时是滚动而非误触；快速轻点仍是正常点击。
   * 位移量用 Pointer 屏幕坐标差（uiRoot 局部 1 单位 = 屏幕 1 像素，与 wheel 同基准）。
   */
  private setupTouchInput(): void {
    // 内容可视区透明交互层（置于 content 最底，不挡按钮；命中由 Phaser 自动处理局部坐标）
    const scrollRect = this.scene.add
      .rectangle(0, 0, this.panelWidth - this.padding * 2, this.viewportH, 0xffffff, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: false });
    this.content.addAt(scrollRect, 0);

    // 关键：场景默认 topOnly=true，重叠时只触发最顶层对象，导致按在按钮上时滚动区收不到
    // pointerdown。关闭后按钮（记录待结算点击）与滚动区（启动拖动）同时响应，由位移阈值区分行为。
    this.scene.input.setTopOnly(false);

    scrollRect.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.visible || this.maxScroll <= 0) return;
      this.scrollDragging = true;
      this.dragStartY = p.y;
      this.dragStartOff = this.scrollOffset;
    });

    // 场景级 move：既结算点击拖动判定，也持续滚动（避免指针移出滚动区导致拖动中断）
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.visible) return;
      if (this.pendingTap && !this.pendingTap.moved) {
        if (Math.hypot(p.x - this.pendingTap.sx, p.y - this.pendingTap.sy) > this.TAP_THRESHOLD) {
          this.pendingTap.moved = true;
        }
      }
      if (this.scrollDragging && this.maxScroll > 0) {
        this.setScroll(this.dragStartOff + (p.y - this.dragStartY));
      }
    });

    const settle = () => {
      if (this.pendingTap) {
        if (!this.pendingTap.moved) this.pendingTap.fn();
        this.pendingTap = null;
      }
      this.scrollDragging = false;
    };
    this.scene.input.on('pointerup', settle);
    this.scene.input.on('pointerupoutside', settle);
  }

  // ===== 对外/内部方法（保持原语义） =====

  /** 设置怪物增强倍率（-1 表示保持当前值），并刷新状态文字 */
  private setEnemyBoost(hp: number, atk: number): void {
    const gs = this.getGameScene();
    if (!gs) return;
    const curHp = gs.enemyHpBoost ?? 1;
    const curAtk = gs.enemyAtkBoost ?? 1;
    gs.setEnemyBoost(hp === -1 ? curHp : hp, atk === -1 ? curAtk : atk);
    this.enemyBoostText?.setText(`当前：血量×${gs.enemyHpBoost} · 攻击×${gs.enemyAtkBoost}`);
  }

  private getGameScene(): any {
    return this.scene.scene.get('GameScene');
  }

  private setupHotkey(): void {
    this.scene.input.keyboard?.on('keydown-BACKTICK', () => {
      this.toggle();
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }

  private getPlayer(): Player | null {
    const gameScene = this.scene.scene.get('GameScene') as any;
    return gameScene?.getPlayer?.() || null;
  }

  private addLevel(count: number): void {
    const player = this.getPlayer();
    if (!player) return;
    // 走正常升级流程：跨多级由 upgrade:chosen 事件逐个弹出三选一（与真实游戏一致）
    for (let i = 0; i < count; i++) {
      (player as any).stats.exp = (player as any).stats.expToNext;
      (player as any).addExp(0);
    }
  }

  private addExp(amount: number): void {
    this.getPlayer()?.addExp(amount);
  }

  private addPickupRadius(amount: number): void {
    this.getPlayer()?.modifyStat('pickupRadius', amount, false);
  }

  private setPickupRadius(value: number): void {
    const player = this.getPlayer();
    if (!player) return;
    (player as any).stats.pickupRadius = value;
  }

  private clearEnemies(): void {
    const gameScene = this.scene.scene.get('GameScene') as any;
    const enemies = gameScene?.getEnemies?.();
    if (!enemies) return;
    enemies.children.each((enemy: any) => {
      if (enemy.active) {
        enemy.takeDamage?.(99999, false);
      }
      return true;
    });
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}
