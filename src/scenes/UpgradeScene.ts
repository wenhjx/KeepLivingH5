import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { UpgradePanel } from '../ui/UpgradePanel';
import { GuideManager } from '../systems/GuideManager';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS, UPGRADE_POOL_EXCLUDED } from '../data/upgrades';
import { applyUpgradeToPlayer } from '../utils/UpgradeApplier';
import { EventBus } from '../utils/EventBus';
import { setupUICamera } from '../utils/CameraHelper';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import type { UpgradeOption } from '../types';
import type { Player } from '../entities/Player';

/**
 * 升级选择场景
 * 玩家升级时弹出，提供3个随机升级选项
 * 与 GameScene 并行运行，暂停游戏逻辑
 */
export class UpgradeScene extends Phaser.Scene {
  private upgradePanel!: UpgradePanel;

  constructor() {
    super('UpgradeScene');
  }

  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0);

    // 标题
    createUIText(this, width / 2, 70, 'LEVEL UP!', {
        fontSize: '42px',
        color: '#ffb347',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 提示文字
    createUIText(this, width / 2, 115, '选择一项升级', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    // 过滤掉玩家已满级的武器选项
    const availableOptions = this.getAvailableOptions();

    // 升级面板
    this.upgradePanel = new UpgradePanel(this);
    this.upgradePanel.show((option: UpgradeOption) => this.onSelect(option), availableOptions);

    // AI 自动玩：从显示的3个选项中智能选择
    // 流程：延迟0.8秒选中（显示"即将选择..."）→ 再延迟1秒自动确认
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene?.isAutoPlay?.()) {
      this.time.delayedCall(800, () => {
        const shownOptions = this.upgradePanel.getOptions();
        const best = this.selectBestUpgrade(shownOptions, gameScene.getPlayer?.());
        if (best) {
          const idx = shownOptions.indexOf(best);
          if (idx >= 0) {
            console.log(`[AI 托管] 选中升级: ${best.icon} ${best.name}`);
            this.upgradePanel.setSelectedIndex(idx, true);
            // 1秒后自动确认
            this.time.delayedCall(1000, () => {
              if (this.upgradePanel.isVisible() && this.upgradePanel.getSelectedIndex() === idx) {
                console.log(`[AI 托管] 确认选择: ${best.icon} ${best.name}`);
                this.upgradePanel.confirmSelection();
              }
            });
          }
        }
      });
    }
  }

  /**
   * AI 升级选择策略：
   * 1. 血量低于 40% → 优先生命强化
   * 2. 已有武器 < 3 把 → 优先解锁新武器（高稀有度优先）
   * 3. 已有武器 >= 3 把 → 优先升级已有武器（高稀有度武器优先升级，打造核心）
   * 4. 都没有 → 按稀有度选属性
   */
  private selectBestUpgrade(options: any[], player: any): any {
    if (!options || options.length === 0) return null;
    if (!player) return options[0];

    const ownedWeapons = (player.getWeapons?.() || []) as any[];
    const ownedIds = new Set(ownedWeapons.map((w: any) => w.id));
    const hpPercent = player.stats?.hp / player.stats?.maxHealth;

    // 血量危急时优先生命强化
    if (hpPercent < 0.4) {
      const heal = options.find(o => o.id === 'max_hp');
      if (heal) return heal;
    }

    // 武器稀有度映射（用于决定哪把是"核心武器"）
    const weaponRarity: Record<string, number> = {
      default_gun: 1, shotgun: 2, machine_gun: 2,
      boomerang: 3, drone: 3, rocket: 4, laser: 4, lightsaber: 3,
    };

    const newWeapons = options.filter(o =>
      o.type === 'weapon' && o.effect?.weaponLevel === 1 && !ownedIds.has(o.effect?.weaponId)
    );
    const weaponUpgrades = options.filter(o =>
      o.type === 'weapon' && o.effect?.weaponLevel > 1
    );

    if (ownedWeapons.length < 3 && newWeapons.length > 0) {
      // 前期：优先解锁新武器，高稀有度优先
      return newWeapons.sort((a, b) => this.rarityScore(b.rarity) - this.rarityScore(a.rarity))[0];
    }

    if (weaponUpgrades.length > 0) {
      // 后期：优先升级已有武器，高稀有度武器（核心）优先
      return weaponUpgrades.sort((a, b) => {
        const ra = weaponRarity[a.effect?.weaponId] || 1;
        const rb = weaponRarity[b.effect?.weaponId] || 1;
        return rb - ra;
      })[0];
    }

    // 还能解锁新武器但已有3把以上：也可以解锁，但优先级低于升级
    if (newWeapons.length > 0) {
      return newWeapons.sort((a, b) => this.rarityScore(b.rarity) - this.rarityScore(a.rarity))[0];
    }

    // 属性升级按稀有度
    const stats = options.filter(o => o.type === 'stat')
      .sort((a, b) => this.rarityScore(b.rarity) - this.rarityScore(a.rarity));
    if (stats.length > 0) return stats[0];

    return options[0];
  }

  private rarityScore(rarity: string): number {
    switch (rarity) {
      case 'legendary': return 4;
      case 'epic': return 3;
      case 'rare': return 2;
      case 'common': return 1;
      default: return 0;
    }
  }

  /** 获取可用的升级选项（过滤已满级武器） */
  private getAvailableOptions(): UpgradeOption[] {
    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;
    if (!player) return UPGRADE_OPTIONS;

    return UPGRADE_OPTIONS.filter((option) => {
      // 从升级候选池中排除的选项（如未实装系统的金币加成）
      if (UPGRADE_POOL_EXCLUDED.includes(option.id)) return false;
      // 非武器选项始终可用
      if (option.type !== 'weapon' || !option.effect.weaponId) return true;
      // 武器选项：已满级则过滤掉
      return !player.isWeaponMaxLevel(option.effect.weaponId);
    });
  }

  /**
   * 选择升级后应用效果并恢复游戏
   */
  private onSelect(option: UpgradeOption): void {
    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;

    // 记录选择前是否已有该武器/被动（用于判断是新获取还是升级）
    const isNewWeapon = option.type === 'weapon' && option.effect.weaponId
      ? !player?.hasWeapon(option.effect.weaponId)
      : false;
    const isNewPassive = option.type === 'passive'
      ? !player?.hasPassive(option.id)
      : false;

    if (player) {
      applyUpgradeToPlayer(player, option);
    }

    // 新武器解锁提示（已有武器升级不提示）
    if (isNewWeapon && option.effect.weaponId) {
      const weapon = WEAPONS[option.effect.weaponId];
      if (weapon) {
        AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_WEAPON_UNLOCK, 1);
        GuideManager.getInstance().show({
          title: `新武器: ${weapon.name}`,
          description: weapon.description + '\n将自动攻击敌人',
          icon: option.icon || '🔫',
          color: 0xff6b35,
          position: 'top-right',
          duration: 4000,
          showButton: false,
        });
      }
    } else if (isNewPassive) {
      // 新被动解锁提示（已有被动升级不提示）
      GuideManager.getInstance().show({
        title: `新技能: ${option.name}`,
        description: option.description,
        icon: option.icon || '✨',
        color: 0xaa44ff,
        position: 'top-right',
        duration: 4000,
        showButton: false,
      });
    }

    // 恢复游戏
    GameManager.getInstance().setPaused(false);
    this.scene.stop('UpgradeScene');
    // 通知 GameScene：本次选择完成，若有剩余升级（跨多级）则继续弹出下一个三选一
    EventBus.emit('upgrade:chosen');
  }
}
