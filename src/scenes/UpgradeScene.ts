import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { UpgradePanel } from '../ui/UpgradePanel';
import { GuideManager } from '../systems/GuideManager';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS } from '../data/upgrades';
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
    const { width, height } = this.scale;

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0);

    // 标题
    this.add
      .text(width / 2, 70, 'LEVEL UP!', {
        fontSize: '42px',
        color: '#ffb347',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 提示文字
    this.add
      .text(width / 2, 115, '选择一项升级', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    // 过滤掉玩家已满级的武器选项
    const availableOptions = this.getAvailableOptions();

    // 升级面板
    this.upgradePanel = new UpgradePanel(this);
    this.upgradePanel.show((option: UpgradeOption) => this.onSelect(option), availableOptions);
  }

  /** 获取可用的升级选项（过滤已满级武器） */
  private getAvailableOptions(): UpgradeOption[] {
    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;
    if (!player) return UPGRADE_OPTIONS;

    return UPGRADE_OPTIONS.filter((option) => {
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

    // 记录选择前是否已有该武器（用于判断是新获取还是升级）
    const isNewWeapon = option.type === 'weapon' && option.effect.weaponId
      ? !player?.hasWeapon(option.effect.weaponId)
      : false;

    if (player) {
      this.applyUpgrade(player, option);
    }

    // 新武器解锁提示（已有武器升级不提示）
    if (isNewWeapon && option.effect.weaponId) {
      const weapon = WEAPONS[option.effect.weaponId];
      if (weapon) {
        GuideManager.getInstance().show({
          title: `新武器: ${weapon.name}`,
          description: weapon.description + '\n将自动攻击敌人',
          icon: '🔫',
          color: 0xff6b35,
          position: 'top',
          duration: 4000,
          showButton: false,
        });
      }
    } else if (option.type === 'passive') {
      GuideManager.getInstance().show({
        title: `新技能: ${option.name}`,
        description: option.description,
        icon: option.icon || '✨',
        color: 0xaa44ff,
        position: 'top',
        duration: 4000,
        showButton: false,
      });
    }

    // 恢复游戏
    GameManager.getInstance().setPaused(false);
    this.scene.stop('UpgradeScene');
  }

  /**
   * 应用升级效果
   */
  private applyUpgrade(player: Player, option: UpgradeOption): void {
    const effect = option.effect;

    // 属性升级
    if (effect.stat && effect.value !== undefined) {
      player.modifyStat(effect.stat, effect.value, effect.isPercent);
    }

    // 武器升级/获取
    if (effect.weaponId) {
      const weaponConfig = this.getWeaponConfig(effect.weaponId);
      if (weaponConfig) {
        player.addWeapon(weaponConfig);
      }
    }

    // 被动技能（TODO: 实现被动技能系统）
    if (option.type === 'passive') {
      console.log(`[Upgrade] 获得被动技能: ${option.name}`);
    }
  }

  /**
   * 获取武器配置
   */
  private getWeaponConfig(weaponId: string): any {
    return WEAPONS[weaponId];
  }
}
