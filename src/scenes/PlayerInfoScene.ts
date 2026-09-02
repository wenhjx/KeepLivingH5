import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { setupUICamera } from '../utils/CameraHelper';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import type { Player } from '../entities/Player';

/**
 * 玩家属性面板（二游式：按 C 打开的角色详情）
 *
 * 展示玩家全部成长数据：等级/经验、战斗属性、生存属性、金币，
 * 以及当前持有的武器/被动/stat 升级（含 Boss 突破次数）。
 * 与 UpgradeScene/BreakthroughScene 一样作为独立叠加场景，暂停游戏逻辑。
 * 关闭后恢复打开前的暂停状态（打开前在游玩中则继续游玩，在暂停菜单则回到暂停）。
 */
export class PlayerInfoScene extends Phaser.Scene {
  private player!: Player;
  // 打开前的暂停状态，由调用方（GameScene C 键 / 暂停菜单按钮）显式传入
  private prevPaused = false;

  constructor() {
    super('PlayerInfoScene');
  }

  create(data?: { prevPaused?: boolean }): void {
    this.prevPaused = data?.prevPaused ?? GameManager.getInstance().isPaused;
    // UI 相机统一设置
    const { width, height } = setupUICamera(this);

    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer?.() as Player | undefined;
    if (!player) {
      this.closePanel();
      return;
    }
    this.player = player;

    // 半透明背景（盖住暂停遮罩与游戏画面）
    this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

    // 中央面板尺寸
    const panelW = 700;
    const panelH = 470;
    const cx = width / 2;
    const cy = height / 2;

    // 面板背景
    const bg = this.add.graphics();
    bg.fillStyle(0x14141f, 0.95);
    bg.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    bg.lineStyle(2, 0x3a3a55, 1);
    bg.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    this.add.existing(bg);

    // 标题
    createUIText(this, cx, cy - panelH / 2 + 32, '🎮 玩家属性', {
      fontSize: '26px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // 关闭按钮（右上角 ×）
    const closeBtn = createUIText(this, cx + panelW / 2 - 20, cy - panelH / 2 + 28, '✕', {
        fontSize: '22px',
        color: '#aaaaaa',
        backgroundColor: '#222233',
        padding: { left: 8, right: 8, top: 2, bottom: 2 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      this.closePanel();
    });

    // ===== 属性数据 =====
    const s = player.getStats();
    const atk = s.attackPower ?? 10;
    const spd = s.attackSpeed ?? 1;
    const crit = s.critRate ?? 0.05;
    const critDmg = s.critDamage ?? 1.5;
    const mspd = s.moveSpeed ?? 100;
    const def = s.defense ?? 0;
    const hp = player.getHealth?.() ?? s.maxHealth;
    const maxHp = s.maxHealth ?? 100;
    const luck = s.luck ?? 0;
    const pick = s.pickupRadius ?? 60;
    const coins = player.getCoins?.() ?? 0;

    // 暴击溢出信息（1:2 转爆伤）
    const critOverflow = Math.max(0, crit - 1);
    const critDisplay = crit >= 1
      ? `${(crit * 100).toFixed(0)}% (溢出 ${(critOverflow * 100).toFixed(0)}% → 爆伤+${(critOverflow * 200).toFixed(0)}%)`
      : `${(crit * 100).toFixed(0)}%`;
    const critDmgDisplay = `${((critDmg + critOverflow * 2) * 100).toFixed(0)}%`;

    // 属性列表（左列：战斗；右列：生存）
    const leftProps: Array<[string, string]> = [
      ['⚔️ 攻击力', atk.toFixed(1)],
      ['⚡ 攻速', `${spd.toFixed(2)}/s`],
      ['🎯 暴击率', critDisplay],
      ['💥 暴击伤害', critDmgDisplay],
      ['👟 移速', mspd.toFixed(0)],
    ];
    const rightProps: Array<[string, string]> = [
      ['❤️ 生命', `${Math.ceil(hp)}/${Math.ceil(maxHp)}`],
      ['🛡️ 防御', def.toFixed(0)],
      ['🍀 幸运', luck.toFixed(0)],
      ['🧲 拾取范围', pick.toFixed(0)],
      ['💰 金币', coins.toFixed(0)],
    ];

    const colX = cx - panelW / 2 + 70;
    const colX2 = cx + 40;
    const startY = cy - panelH / 2 + 85;
    const rowGap = 36;

    const drawCol = (props: Array<[string, string]>, x: number) => {
      props.forEach(([label, value], i) => {
        createUIText(this, x, startY + i * rowGap, label, {
          fontSize: '16px',
          color: '#bbbbbb',
        }).setOrigin(0, 0);
        createUIText(this, x + 150, startY + i * rowGap, value, {
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0, 0);
      });
    };
    drawCol(leftProps, colX);
    drawCol(rightProps, colX2);

    // ===== 底部：武器 / 被动 / stat =====
    // 持有区整体上移，滚动区固定 4 行可视高度（更美观，也避免与底部提示重叠）
    const bottomY = cy + panelH / 2 - 198;

    createUIText(this, cx - panelW / 2 + 30, bottomY, '📦 持有', {
      fontSize: '15px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0, 0);

    // 收集武器/被动/stat 展示项（过滤异常空项，避免显示 "undefined"）
    const weapons = (player.getWeapons?.() || [])
      .map((w: any) => ({
        icon: (WEAPONS[w.id] && this.getWeaponIcon(w.id)) || '🔫',
        name: w.name,
        lv: w.level,
      }))
      .filter((w: any) => w && w.name);
    const passives = (player.getPassives?.() || [])
      .map((p: any) => ({
        icon: (UPGRADE_OPTIONS.find((u) => u.id === p.id)?.icon) || '✨',
        name: p.name,
        lv: p.level,
      }))
      .filter((p: any) => p && p.name);
    const stats = (player.getStatUpgrades?.() || [])
      .map((st: any) => ({
        icon: UPGRADE_OPTIONS.find((u) => u.id === st.id)?.icon || '✨',
        name: st.name,
        lv: st.level + (player.getBreakthroughLevel?.(st.id) ?? 0), // 升级+突破总等级
      }))
      .filter((s: any) => s && s.name);

    const holdings = [...weapons, ...passives, ...stats];

    // ===== 持有列表（可滚动区域：GeometryMask 遮罩 + 滚轮/拖拽滚动 + 滚动条） =====
    // Phaser 3 无内置 UI 滚动容器，采用标准做法：内容放入 Container，
    // 用矩形 GeometryMask 裁剪可视区域，滚轮/拖拽修改容器 y 偏移实现滚动。
    const itemPerRow = 4;
    const itemColW = 165;
    const rowH = 34;
    const itemX0 = cx - panelW / 2 + 30;
    const scrollX = itemX0 - 8;
    const scrollY = bottomY + 28;
    const scrollW = panelW - 60;
    const scrollH = 4 * rowH; // 固定 4 行可视高度
    const barX = scrollX + scrollW + 6; // 滚动条 x

    // 遮罩（不加入显示列表，仅作裁剪几何）
    const maskG = this.make.graphics(undefined, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(scrollX, scrollY, scrollW, scrollH);
    const mask = maskG.createGeometryMask();

    // 内容容器（遮罩内滚动）
    const scrollContent = this.add.container(scrollX, scrollY).setDepth(10);
    scrollContent.setMask(mask);

    holdings.forEach((h, i) => {
      const col = i % itemPerRow;
      const row = Math.floor(i / itemPerRow);
      scrollContent.add(
        createUIText(this, col * itemColW, row * rowH, `${h.icon} ${h.name}  Lv.${h.lv}`, {
          fontSize: '14px',
          color: '#e0e0e0',
        }).setOrigin(0, 0)
      );
    });

    // 滚动范围与状态
    const contentH = Math.ceil(holdings.length / itemPerRow) * rowH;
    const maxScroll = Math.max(0, contentH - scrollH);
    let scrollOff = 0;
    const zoom = this.cameras.main.zoom;

    // 滚动条（轨道 + 滑块）
    const scrollBarTrack = this.add.graphics();
    scrollBarTrack.fillStyle(0xffffff, 0.08);
    scrollBarTrack.fillRoundedRect(barX, scrollY, 5, scrollH, 2);
    const scrollBarThumb = this.add.graphics();
    const applyScroll = () => {
      scrollContent.setY(scrollY - scrollOff);
      scrollBarThumb.clear();
      if (maxScroll > 0) {
        const thumbH = Math.max(24, scrollH * (scrollH / contentH));
        const thumbY = scrollY + (scrollH - thumbH) * (scrollOff / maxScroll);
        scrollBarThumb.fillStyle(0xffffff, 0.35);
        scrollBarThumb.fillRoundedRect(barX, thumbY, 5, thumbH, 2);
      }
    };
    applyScroll();

    // 滚轮滚动（deltaY 除以相机 zoom 换算为逻辑像素，与布局坐标系一致）
    this.input.on('wheel', (_p: any, _o: any, _dx: number, dy: number) => {
      if (maxScroll <= 0) return;
      scrollOff = Phaser.Math.Clamp(scrollOff + dy / zoom, 0, maxScroll);
      applyScroll();
    });

    // 拖拽滚动（按住上下拖动内容区）
    // 位移超阈值才真正滚动：轻点/微移不跳动内容，也为将来滚动区放入可交互组件预留防误触
    let dragging = false;
    let dragMoved = false;
    let dragStartY = 0;
    let dragStartOff = 0;
    const DRAG_THRESHOLD = 12;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      dragMoved = false;
      dragStartY = p.y;
      dragStartOff = scrollOff;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || maxScroll <= 0) return;
      if (!dragMoved && Math.abs(p.y - dragStartY) > DRAG_THRESHOLD) dragMoved = true;
      if (dragMoved) {
        scrollOff = Phaser.Math.Clamp(dragStartOff + (dragStartY - p.y) / zoom, 0, maxScroll);
        applyScroll();
      }
    });
    this.input.on('pointerup', () => {
      dragging = false;
    });

    // 底部提示
    createUIText(this, cx, cy + panelH / 2 - 20, maxScroll > 0 ? '滚轮 / 拖动滚动 · 按 C 或点击 ✕ 关闭' : '按 C 或点击 ✕ 关闭', {
      fontSize: '13px',
      color: '#666688',
    }).setOrigin(0.5);
  }

  private getWeaponIcon(id: string): string {
    // 与 HUD weaponVisuals 保持一致
    const map: Record<string, string> = {
      default_gun: '🔫', machine_gun: '🔫', shotgun: '🔫', laser: '🔆',
      rocket: '🚀', boomerang: '🪃', lightsaber: '🗡️', drone: '🤖',
    };
    return map[id] || '🔫';
  }

  /** 关闭属性面板：恢复打开前的暂停状态（供 GameScene 的 C 键调用） */
  closePanel(): void {
    GameManager.getInstance().setPaused(this.prevPaused);
    this.scene.stop('PlayerInfoScene');
  }
}
