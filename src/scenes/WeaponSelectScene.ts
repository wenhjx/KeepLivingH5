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
 * 武器强化场景（独立武器系统）
 * 击败 Boss 后弹出：只出武器选项（新武器获取 / 已有武器升级），不占普通升级三选一。
 * 与 UpgradeScene 复用 UpgradePanel，但候选池只含武器。
 */
export class WeaponSelectScene extends Phaser.Scene {
  private upgradePanel!: UpgradePanel;

  constructor() {
    super('WeaponSelectScene');
  }

  create(): void {
    const { width, height } = setupUICamera(this);

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0);

    // 标题（与升级场景区分）
    createUIText(this, width / 2, 70, '⚔ 武器强化', {
        fontSize: '40px',
        color: '#ffb347',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // 提示
    createUIText(this, width / 2, 118, '击败强敌，选择一把武器强化', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    const choices = this.getWeaponChoices();
    this.upgradePanel = new UpgradePanel(this);
    this.upgradePanel.show((option: UpgradeOption) => this.onSelect(option), choices);

    // AI 自动玩：选择一把武器（新武器优先，其次升级核心）
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene?.isAutoPlay?.()) {
      this.time.delayedCall(800, () => {
        const shown = this.upgradePanel.getOptions();
        const best = this.selectBestWeapon(shown, gameScene.getPlayer?.());
        if (best) {
          const idx = shown.indexOf(best);
          if (idx >= 0) {
            console.log(`[AI 托管] 武器选择: ${best.icon} ${best.name}`);
            this.upgradePanel.setSelectedIndex(idx, true);
            this.time.delayedCall(1000, () => {
              if (this.upgradePanel.isVisible() && this.upgradePanel.getSelectedIndex() === idx) {
                console.log(`[AI 托管] 确认武器: ${best.icon} ${best.name}`);
                this.upgradePanel.confirmSelection();
              }
            });
          }
        }
      });
    }
  }

  /** 生成武器候选（新武器 + 已有武器升级，过滤已满级） */
  private getWeaponChoices(): UpgradeOption[] {
    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;

    const weaponOptions = UPGRADE_OPTIONS.filter(
      (o) => o.type === 'weapon' && !UPGRADE_POOL_EXCLUDED.includes(o.id)
    );
    if (!player) return weaponOptions.slice(0, 3);

    const available = weaponOptions.filter(
      (o) => o.effect.weaponId && !player.isWeaponMaxLevel(o.effect.weaponId)
    );
    return available.slice(0, 3);
  }

  /** AI 武器选择：完全随机选一把（无 build 导向，随机贴近真人手感） */
  private selectBestWeapon(options: UpgradeOption[], player: any): UpgradeOption | null {
    if (!options || options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)];
  }

  private onSelect(option: UpgradeOption): void {
    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;

    const isNewWeapon = option.type === 'weapon' && option.effect.weaponId
      ? !player?.hasWeapon(option.effect.weaponId)
      : false;

    if (player) {
      applyUpgradeToPlayer(player, option, gameScene);
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
    }

    // 恢复游戏并通知 GameScene 开始下一波
    GameManager.getInstance().setPaused(false);
    this.scene.stop('WeaponSelectScene');
    EventBus.emit('weaponselect:closed');
  }
}
