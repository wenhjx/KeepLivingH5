import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { setupUICamera } from '../utils/CameraHelper';
import { UILayout } from '../utils/UILayout';
import { UIScrollBar } from '../utils/UIScrollBar';
import { ACHIEVEMENTS, ACHIEVEMENT_SERIES, type AchievementDef, type AchievementSeries } from '../data/achievements';
import { AchievementManager } from '../systems/AchievementManager';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';

/**
 * 成就系统面板（独立叠加场景）
 *
 * 展示全部成就：系列 Tab 切换 + 可滚动列表（图标/名称/描述/进度条/解锁状态）。
 * 隐藏成就未解锁时显示"？？？"；底部汇总永久加成。
 * 从主菜单进入；返回时重建主菜单。
 */
export class AchievementScene extends Phaser.Scene {
  private selectedSeries: AchievementSeries | 'all' | null = null;
  private scrollContent!: Phaser.GameObjects.Container;
  private scrollH = 0;
  private maxScroll = 0;
  private scrollOff = 0;
  private scrollBar!: UIScrollBar;
  private tabTexts: Record<string, Phaser.GameObjects.Text> = {};

  constructor() {
    super('AchievementScene');
  }

  create(): void {
    const { width, height } = setupUICamera(this);
    const cx = width / 2;
    const ach = AchievementManager.getInstance();

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a14, 0.97).setOrigin(0);
    // 顶部深色渐变带
    const topBar = this.add.graphics();
    topBar.fillGradientStyle(0x14142a, 0x14142a, 0x1a1a35, 0x1a1a35, 1);
    topBar.fillRect(0, 0, width, 110);

    // 标题
    createUIText(this, cx, 42, '🏅 成就', {
      fontSize: '32px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // 解锁统计
    createUIText(this, cx, 82, `已解锁 ${ach.unlockedCount} / ${ACHIEVEMENTS.length}`, {
      fontSize: '15px',
      color: '#cccccc',
    }).setOrigin(0.5);

    // 返回按钮
    const backBtn = createUIText(this, 60, 44, '← 返回', {
        fontSize: '18px',
        color: '#e0e0e0',
        backgroundColor: '#1a1a25',
        padding: { left: 16, right: 16, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      this.scene.start('MainMenuScene');
    });

    // Tab 行（7 个 Tab 总宽 7×128+6×6=932 < 960，居中不溢出）
    const tabLayout = new UILayout({ x: cx - 466, y: 128, direction: 'row', spacing: 6, itemSize: 128 });
    const seriesKeys: Array<AchievementSeries | 'all'> = ['all', 'survival', 'hunt', 'weapon', 'wealth', 'hidden', 'meta'];
    const seriesLabel: Record<string, string> = {
      all: '全部',
      survival: '生存',
      hunt: '猎杀',
      weapon: '武器大师',
      wealth: '财迷',
      hidden: '隐藏',
      meta: '里程碑',
    };
    for (const key of seriesKeys) {
      const t = createUIText(this, 0, 0, seriesLabel[key], {
        fontSize: '15px',
        color: '#cccccc',
        backgroundColor: '#1a1a25',
        padding: { left: 12, right: 12, top: 6, bottom: 6 },
      })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      tabLayout.place(t);
      t.on('pointerdown', () => this.setSeries(key));
      this.tabTexts[key] = t;
    }

    // ===== 滚动列表区（mask + 拖拽/滚轮） =====
    const scrollX = 60;
    const scrollY = 168;
    const listW = width - 120;
    const listH = 380;
    const rowH = 64;
    const maskG = this.make.graphics(undefined, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(scrollX, scrollY, listW, listH);
    const mask = maskG.createGeometryMask();

    this.scrollContent = this.add.container(scrollX, scrollY).setDepth(10);
    this.scrollContent.setMask(mask);

    // 滚动条（统一组件：轨道+滑块一体，无可滚动内容时不显示）
    this.scrollBar = new UIScrollBar(this, scrollX + listW + 4, scrollY, 5, listH);

    // 点击 Tab 重绘列表（初始为"全部"）
    this.setSeries('all');

    // 滚轮 / 拖拽滚动
    const zoom = this.cameras.main.zoom;
    this.input.on('wheel', (_p: any, _o: any, _dx: number, dy: number) => {
      if (this.maxScroll <= 0) return;
      this.scrollOff = Phaser.Math.Clamp(this.scrollOff + dy / zoom, 0, this.maxScroll);
      this.applyScroll();
    });
    let dragging = false;
    let dragMoved = false;
    let dragStartY = 0;
    let dragStartOff = 0;
    const DRAG_THRESHOLD = 10;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      dragMoved = false;
      dragStartY = p.y;
      dragStartOff = this.scrollOff;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || this.maxScroll <= 0) return;
      if (!dragMoved && Math.abs(p.y - dragStartY) > DRAG_THRESHOLD) dragMoved = true;
      if (dragMoved) {
        this.scrollOff = Phaser.Math.Clamp(dragStartOff + (dragStartY - p.y) / zoom, 0, this.maxScroll);
        this.applyScroll();
      }
    });
    this.input.on('pointerup', () => {
      dragging = false;
    });

    // ===== 底部：永久加成汇总 =====
    this.renderBonusSummary(cx, height - 26);
  }

  /** 切换系列并重绘列表 */
  private setSeries(key: AchievementSeries | 'all'): void {
    if (this.selectedSeries === key) return;
    this.selectedSeries = key;

    // Tab 选中态
    for (const [k, t] of Object.entries(this.tabTexts)) {
      const active = k === key;
      t.setStyle({
        color: active ? '#ffd700' : '#cccccc',
        backgroundColor: active ? '#2a2a45' : '#1a1a25',
      });
    }

    // 重绘列表
    this.scrollContent.removeAll(true);
    const ach = AchievementManager.getInstance();
    const defs = ACHIEVEMENTS.filter((d) => key === 'all' || d.series === key);
    const rowH = 64;
    defs.forEach((def, i) => {
      const row = this.renderRow(def, ach, i);
      this.scrollContent.add(row);
      row.setPosition(0, i * rowH);
    });
    this.scrollH = defs.length * rowH;
    this.maxScroll = Math.max(0, this.scrollH - 380);
    this.scrollOff = 0;
    this.scrollBar.setRange(this.scrollH, 380);
    this.applyScroll();
  }

  /** 渲染一行成就 */
  private renderRow(def: AchievementDef, ach: AchievementManager, index: number): Phaser.GameObjects.Container {
    const row = this.add.container(0, 0);
    const unlocked = ach.isUnlocked(def.id);
    const isHidden = !!def.hidden && !unlocked;

    const icon = createUIText(this, 14, 16, isHidden ? '❓' : def.icon, {
      fontSize: '28px',
    }).setOrigin(0.5);

    const name = createUIText(this, 55, 8, isHidden ? '？？？' : def.name, {
      fontSize: '16px',
      color: unlocked ? '#ffd700' : '#e0e0e0',
      fontStyle: unlocked ? 'bold' : 'normal',
    }).setOrigin(0, 0);

    const desc = createUIText(this, 55, 34, isHidden ? '达成条件保密，继续探索吧' : def.description, {
      fontSize: '13px',
      color: '#8888aa',
    }).setOrigin(0, 0);

    // 状态徽标
    const status = createUIText(this, 800, 20, unlocked ? '✔ 已解锁' : '🔒', {
      fontSize: '14px',
      color: unlocked ? '#ffd700' : '#555577',
      fontStyle: unlocked ? 'bold' : 'normal',
    }).setOrigin(0.5);

    // 进度条（累计型显示进度；单局判定型显示"条件型"）
    if (!unlocked && !isHidden) {
      const prog = ach.getProgress(def);
      if (prog.target > 0) {
        const barW = 120;
        const barH = 8;
        const barX = 660;
        const barY = 18;
        const pct = Math.min(1, prog.current / prog.target);
        const bar = this.add.graphics();
        bar.fillStyle(0xffffff, 0.12);
        bar.fillRoundedRect(barX, barY, barW, barH, 4);
        if (pct > 0) {
          bar.fillStyle(0xffd700, 0.9);
          bar.fillRoundedRect(barX, barY, Math.max(6, barW * pct), barH, 4);
        }
        row.add(bar);
        row.add(
          createUIText(this, barX + barW / 2, barY + 18, `${Math.min(prog.current, prog.target)} / ${prog.target}`, {
            fontSize: '11px',
            color: '#8888aa',
          }).setOrigin(0.5)
        );
      } else {
        // 单局判定型
        row.add(
          createUIText(this, 700, 20, '单局达成', {
            fontSize: '12px',
            color: '#666688',
          }).setOrigin(0.5)
        );
      }
    }

    row.add([icon, name, desc, status]);

    // 行分隔线
    const sep = this.add.graphics();
    sep.fillStyle(0xffffff, 0.06);
    sep.fillRect(0, 62, 830, 1);
    row.add(sep);
    return row;
  }

  /** 底部永久加成汇总 */
  private renderBonusSummary(cx: number, y: number): void {
    const ach = AchievementManager.getInstance();
    const parts: string[] = [];
    const labels: Record<string, string> = {
      maxHealth: '生命',
      attackPower: '攻击',
      critRate: '暴击率',
      critDamage: '爆伤',
      pickupRadius: '拾取范围',
      luck: '幸运',
    };
    for (const [stat, v] of Object.entries(ach.getBonusSummary())) {
      const label = labels[stat] ?? stat;
      const fmt = stat === 'critRate' || stat === 'critDamage'
        ? `${(v * 100).toFixed(0)}%`
        : `${v}`;
      parts.push(`${label}+${fmt}`);
    }
    const titles = ach.titles;
    const titleStr = titles.length > 0 ? `  称号: ${titles.join(' · ')}` : '';
    createUIText(this, cx, y, `永久加成: ${parts.length ? parts.join('  ') : '暂无'}${titleStr}`, {
      fontSize: '13px',
      color: '#666688',
    }).setOrigin(0.5);
  }

  private applyScroll(): void {
    this.scrollContent.setY(168 - this.scrollOff);
    this.scrollBar.update(this.scrollOff);
  }
}
