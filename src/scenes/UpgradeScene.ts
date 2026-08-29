import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { UpgradePanel } from '../ui/UpgradePanel';
import { GuideManager } from '../systems/GuideManager';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS, UPGRADE_POOL_EXCLUDED } from '../data/upgrades';
import { applyUpgradeToPlayer } from '../utils/UpgradeApplier';
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
    // 渲染分辨率倍率补偿（保持视觉比例，配合高分屏清晰渲染）
    this.cameras.main.setZoom(GameConfig.renderScale);
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

    // 记录选择前是否已有该武器（用于判断是新获取还是升级）
    const isNewWeapon = option.type === 'weapon' && option.effect.weaponId
      ? !player?.hasWeapon(option.effect.weaponId)
      : false;

    if (player) {
      applyUpgradeToPlayer(player, option);
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
}
