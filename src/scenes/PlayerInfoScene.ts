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
    const bottomY = cy + panelH / 2 - 130;

    createUIText(this, cx - panelW / 2 + 30, bottomY, '📦 持有', {
      fontSize: '15px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0, 0);

    // 收集武器/被动/stat 展示项
    const weapons = (player.getWeapons?.() || []).map((w: any) => ({
      icon: (WEAPONS[w.id] && this.getWeaponIcon(w.id)) || '🔫',
      name: w.name,
      lv: w.level,
    }));
    const passives = (player.getPassives?.() || []).map((p: any) => ({
      icon: (UPGRADE_OPTIONS.find((u) => u.id === p.id)?.icon) || '✨',
      name: p.name,
      lv: p.level,
    }));
    const stats = (player.getStatUpgrades?.() || []).map((st: any) => ({
      icon: UPGRADE_OPTIONS.find((u) => u.id === st.id)?.icon || '✨',
      name: st.name,
      lv: st.level + (player.getBreakthroughLevel?.(st.id) ?? 0), // 升级+突破总等级
    }));

    const holdings = [...weapons, ...passives, ...stats];

    // 每行 4 个，分两行
    const itemPerRow = 4;
    const itemX0 = cx - panelW / 2 + 30;
    const itemY0 = bottomY + 30;
    holdings.forEach((h, i) => {
      const col = i % itemPerRow;
      const row = Math.floor(i / itemPerRow);
      const x = itemX0 + col * 165;
      const y = itemY0 + row * 34;
      createUIText(this, x, y, `${h.icon} ${h.name}  Lv.${h.lv}`, {
        fontSize: '14px',
        color: '#e0e0e0',
      }).setOrigin(0, 0);
    });

    // 底部提示
    createUIText(this, cx, cy + panelH / 2 - 20, '按 C 或点击 ✕ 关闭', {
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
