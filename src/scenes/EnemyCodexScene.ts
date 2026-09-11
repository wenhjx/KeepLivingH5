import Phaser from 'phaser';
import { createUIText } from '../utils/UIText';
import { GameConfig } from '../game/GameConfig';
import { setupUICamera } from '../utils/CameraHelper';
import { AudioManager } from '../systems/AudioManager';
import { SOUND_KEYS } from '../data/sounds';
import { LEVELS, type LevelConfig } from '../data/levels';
import { ENEMY_CONFIGS } from '../data/enemies';
import type { EnemyType } from '../types';

/** 敌人类型 → 中文标签 */
const TYPE_LABEL: Record<string, string> = {
  normal: '近战',
  fast: '疾行',
  tank: '重装',
  ranged: '远程',
  suicider: '自爆',
  splitter: '分裂',
  shielded: '护盾',
  summoner: '召唤',
  charger: '冲锋',
  healer: '治疗',
  elite: '精英',
  boss: 'Boss',
  frost_zombie: '冰霜',
  corrupt_zombie: '腐化',
  boss_summoner: 'Boss·召唤',
  boss_barrage: 'Boss·弹幕',
};


/** Boss 机制一句话说明 */
function describeBossMechanic(type: EnemyType): string {
  if (type === 'boss_summoner') return '机制：持续召唤魔像群增援，先清召唤物再集火本体';
  if (type === 'boss_barrage') return '机制：环形/扇形弹幕密集铺场（伤害 1.3 倍），找缝隙走位';
  return '机制：追击近身 + 阶段技能，保持距离风筝输出';
}

/**
 * 敌方情报页（明日方舟式：左列表 + 右详情）
 * 从选关面板"敌方情报"入口进入；返回时重建主菜单。
 */
export class EnemyCodexScene extends Phaser.Scene {
  private level!: LevelConfig;
  private selectedType: EnemyType | null = null;
  private cellBg: Phaser.GameObjects.Rectangle[] = [];
  private detail!: Phaser.GameObjects.Container;

  constructor() {
    super('EnemyCodexScene');
  }

  init(data: { levelId?: string }): void {
    this.level = LEVELS.find((l) => l.id === data?.levelId) ?? LEVELS[0];
    this.selectedType = null;
    this.cellBg = [];
  }

  create(): void {
    this.cameras.main.setZoom(GameConfig.uiScale);
    const { width, height } = setupUICamera(this);
    const cx = width / 2;

    // 背景 + 顶部渐变带
    this.add.rectangle(0, 0, width, height, 0x0a0a14, 0.97).setOrigin(0);
    const topBar = this.add.graphics();
    topBar.fillGradientStyle(0x14142a, 0x14142a, 0x1a1a35, 0x1a1a35, 1);
    topBar.fillRect(0, 0, width, 110);

    // 标题
    createUIText(this, cx, 44, `📖 敌方情报 · ${this.level.name}`, {
      fontSize: '32px',
      color: '#ff6b35',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // 返回
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

    // ===== 左侧敌人网格列表（2 列） =====
    const list = this.level.enemyPreview ?? [];
    const listX = 60;
    const listY = 150;
    const cellW = 150;
    const cellH = 76;
    const gap = 10;
    const cols = 2;
    list.forEach((item, i) => {
      const cfg = ENEMY_CONFIGS[item.type];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = listX + col * (cellW + gap);
      const y = listY + row * (cellH + gap);
      const bg = this.add
        .rectangle(x + cellW / 2, y + cellH / 2, cellW, cellH, 0x1a1a28, 1)
        .setStrokeStyle(1, 0x333355)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.select(item.type));
      bg.on('pointerover', () => bg.setFillStyle(0x23233a));
      bg.on('pointerout', () =>
        bg.setFillStyle(this.selectedType === item.type ? 0x2a2a45 : 0x1a1a28),
      );
      const color = '#' + (cfg.color ?? 0x888888).toString(16).padStart(6, '0');
      // 图标：复用游戏内敌人贴图（与关卡实际怪物一致），按主题着色
      const spr = this.add.sprite(x + 26, y + cellH / 2, GameConfig.themeKey(cfg.texture || 'enemy_normal'));
      spr.setDisplaySize(34, 34);
      if (
        GameConfig.VISUAL_THEME === 'pixel' ||
        item.type === 'frost_zombie' ||
        item.type === 'corrupt_zombie'
      ) {
        spr.setTint(cfg.color ?? 0x888888);
      }
      createUIText(this, x + 52, y + cellH / 2 - 10, cfg.name ?? item.type, {
        fontSize: '15px',
        color,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      createUIText(this, x + 52, y + cellH / 2 + 16, TYPE_LABEL[item.type] ?? '', {
        fontSize: '12px',
        color: '#8888aa',
      }).setOrigin(0, 0.5);
      this.cellBg.push(bg);
    });

    // ===== 右侧详情容器 =====
    this.detail = this.add.container(0, 0);
    this.select(list[0]?.type ?? 'normal');
  }

  /** 选中敌人 → 高亮列表 + 重绘详情 */
  private select(type: EnemyType): void {
    this.selectedType = type;
    const list = this.level.enemyPreview ?? [];
    this.cellBg.forEach((bg, i) => {
      bg.setFillStyle(this.selectedType === list[i]?.type ? 0x2a2a45 : 0x1a1a28);
    });

    this.detail.removeAll(true);
    const cfg = ENEMY_CONFIGS[type];
    if (!cfg) return;
    const dx = 400;
    const dy = 140;
    const dw = 500;
    const dh = 440;
    const color = '#' + (cfg.color ?? 0x888888).toString(16).padStart(6, '0');

    // 面板底
    const panel = this.add.graphics();
    panel.fillStyle(0x16161f, 0.98);
    panel.fillRoundedRect(dx, dy, dw, dh, 14);
    panel.lineStyle(2, 0xff6b35, 0.4);
    panel.strokeRoundedRect(dx, dy, dw, dh, 14);
    this.detail.add(panel);

    // 大图标：复用游戏内敌人贴图，与关卡实际怪物一致
    this.detail.add(this.add.circle(dx + 70, dy + 90, 42, cfg.color ?? 0x888888, 0.35));
    const bigSpr = this.add.sprite(dx + 70, dy + 90, GameConfig.themeKey(cfg.texture || 'enemy_normal'));
    bigSpr.setDisplaySize(72, 72);
    if (
      GameConfig.VISUAL_THEME === 'pixel' ||
      type === 'frost_zombie' ||
      type === 'corrupt_zombie'
    ) {
      bigSpr.setTint(cfg.color ?? 0x888888);
    }
    this.detail.add(bigSpr);

    // 名字 + 类型标签
    const name = createUIText(this, dx + 130, dy + 66, cfg.name ?? type, {
      fontSize: '26px',
      color,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.detail.add(name);
    const tag = createUIText(
      this,
      dx + 130,
      dy + 104,
      `${TYPE_LABEL[type] ?? ''}${cfg.type === 'boss' ? ' · 关底 Boss' : ''}`,
      { fontSize: '15px', color: '#ffd700' },
    ).setOrigin(0, 0.5);
    this.detail.add(tag);

    // 属性条
    const stats = [
      { label: '生命', value: cfg.maxHealth, ref: 3000 },
      { label: '速度', value: cfg.moveSpeed, ref: 200 },
      { label: '攻击', value: cfg.attackPower, ref: 100 },
      { label: '击杀分', value: cfg.scoreReward ?? 0, ref: 600 },
    ];
    let sy = dy + 150;
    for (const st of stats) {
      const ratio = Math.min(1, st.value / st.ref);
      const lb = createUIText(this, dx + 40, sy, st.label, {
        fontSize: '15px',
        color: '#c8c8c8',
      }).setOrigin(0, 0.5);
      this.detail.add(lb);
      this.detail.add(this.add.rectangle(dx + 110, sy, 200, 10, 0x2a2a38, 1).setOrigin(0, 0.5));
      if (ratio > 0) {
        this.detail.add(
          this.add.rectangle(dx + 110, sy, 200 * ratio, 10, cfg.color ?? 0x888888, 0.9).setOrigin(0, 0.5),
        );
      }
      const val = createUIText(this, dx + 330, sy, `${st.value}`, {
        fontSize: '15px',
        color: '#e0e0e0',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.detail.add(val);
      sy += 40;
    }

    // 作战提示 + Boss 机制
    const note = (this.level.enemyPreview ?? []).find((i) => i.type === type)?.note ?? '';
    const tipTitle = createUIText(this, dx + 40, sy + 10, '作战提示', {
      fontSize: '15px',
      color: '#ff6b35',
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    this.detail.add(tipTitle);
    const tip = createUIText(this, dx + 40, sy + 40, note, {
      fontSize: '15px',
      color: '#cccccc',
      wordWrap: { width: dw - 80 },
    }).setOrigin(0, 0);
    this.detail.add(tip);
    if (cfg.type === 'boss') {
      const mech = createUIText(this, dx + 40, sy + 86, describeBossMechanic(type), {
        fontSize: '14px',
        color: '#88ccff',
        wordWrap: { width: dw - 80 },
      }).setOrigin(0, 0);
      this.detail.add(mech);
    }
  }
}
