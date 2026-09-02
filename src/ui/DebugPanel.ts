import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { UPGRADE_OPTIONS } from '../data/upgrades';
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
  private visible: boolean = false;
  private autoPlayText: Phaser.GameObjects.Text | null = null;
  private autoPlayBg: Phaser.GameObjects.Graphics | null = null;
  private themeText: Phaser.GameObjects.Text | null = null;
  private themeBg: Phaser.GameObjects.Graphics | null = null;

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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.create();
    this.setupHotkey();
  }

  private create(): void {
    const { width, height } = this.scene.scale;
    this.panelX = width - this.panelWidth - 12;
    this.panelY = 12;

    // 内容总高度估算（用于面板背景高度；超出屏高的部分由滚动处理）
    const contentHeight = this.computeContentHeight();
    const panelHeight = Math.min(contentHeight + this.padding, height - 24);
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
    const maskG = this.scene.add.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(this.panelX + this.padding, this.panelY + 40, this.panelWidth - this.padding * 2, this.viewportH);
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

    // 计算可滚动上限（内容总高 - 可视区高）
    this.maxScroll = Math.max(0, col.y + this.padding - this.viewportH);
    this.setScroll(0);

    // 滚轮滚动（仅面板区域 + 面板可见时）
    this.scene.input.on('wheel', (_pointer: any, _x: number, y: number, _dx: number, dy: number) => {
      if (!this.visible) return;
      if (y < this.panelY || y > this.panelY + panelHeight) return;
      this.setScroll(this.scrollOffset - dy);
    });
  }

  // ===== 布局辅助 =====

  /** 估算内容总高（行数 × 行高 + 标题 + 间隔） */
  private computeContentHeight(): number {
    const rowH = this.btnHeight + this.btnSpacing;
    const sectionH = (rows: number) => 20 + rows * rowH + this.sectionSpacing;
    // 快捷操作 4 行（含 AI/主题全宽）、属性 2 行、属性升级 5 行、武器 3 行、被动 2 行
    return 28 + sectionH(4) + sectionH(2) + sectionH(5) + sectionH(3) + sectionH(2) + this.padding;
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
    col.step(this.btnHeight);
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
    hit.on('pointerdown', onClick);

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
    hit.on('pointerdown', () => {
      const gs = this.getGameScene();
      if (!gs) return;
      const next = !gs.isAutoPlay?.();
      gs.setAutoPlay?.(next);
      updateState(next);
    });

    bg.setPosition(0, y);
    this.autoPlayText.setPosition(fullW / 2, y + this.btnHeight / 2);
    hit.setPosition(fullW / 2, y + this.btnHeight / 2);
    this.content.add([bg, this.autoPlayText, hit]);
    col.step(this.btnHeight);
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
    hit.on('pointerdown', () => {
      const next: 'pixel' | 'classic' = GameConfig.VISUAL_THEME === 'classic' ? 'pixel' : 'classic';
      const api = (window as any).__debug;
      if (api?.setTheme) {
        api.setTheme(next);
      } else {
        GameConfig.VISUAL_THEME = next;
      }
      updateState(next);
    });

    bg.setPosition(0, y);
    this.themeText.setPosition(fullW / 2, y + this.btnHeight / 2);
    hit.setPosition(fullW / 2, y + this.btnHeight / 2);
    this.content.add([bg, this.themeText, hit]);
    updateState(GameConfig.VISUAL_THEME);
    col.step(this.btnHeight);
  }

  // ===== 滚动 =====

  /** 设置内容滚动偏移（负值向上滚），并 clamp 到 [ -maxScroll, 0 ] */
  private setScroll(offset: number): void {
    this.scrollOffset = Phaser.Math.Clamp(offset, -this.maxScroll, 0);
    this.content.setY(this.contentBaseY + this.scrollOffset);
  }

  // ===== 对外/内部方法（保持原语义） =====

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
