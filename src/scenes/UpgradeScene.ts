import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { UpgradePanel } from '../ui/UpgradePanel';
import { GuideManager } from '../systems/GuideManager';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS, UPGRADE_POOL_EXCLUDED, FALLBACK_UPGRADES } from '../data/upgrades';
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

    // 过滤掉玩家已满级的选项，不足时用兜底项补位
    const availableOptions = this.getAvailableOptions();
    const choices = this.getChoices(availableOptions);

    // 升级面板
    this.upgradePanel = new UpgradePanel(this);
    this.upgradePanel.show((option: UpgradeOption) => this.onSelect(option), choices);

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
   * AI 升级选择策略：完全随机 + 一条保命兜底
   * 说明：当前没有明确的 build 导向（无羁绊/流派），玩家也未必知道"最高战力"，
   * 硬编码稀有度/核心武器优先级反而可能选错。改为随机贴近真人手感，
   * 仅保留血量危急时优先生命强化，避免 AI 无脑送死、局局早夭。
   */
  private selectBestUpgrade(options: any[], player: any): any {
    if (!options || options.length === 0) return null;
    if (!player) return options[Math.floor(Math.random() * options.length)];

    const hpPercent = player.stats?.hp / player.stats?.maxHealth;
    // 血量危急时优先生命强化（唯一保命兜底，其余完全随机）
    if (hpPercent < 0.4) {
      const heal = options.find((o) => o.id === 'max_hp');
      if (heal) return heal;
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  /** 获取可用的升级选项（过滤已满级武器/被动/stat 属性） */
  private getAvailableOptions(): UpgradeOption[] {
    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;
    if (!player) return UPGRADE_OPTIONS;

    return UPGRADE_OPTIONS.filter((option) => {
      // 从升级候选池中排除的选项（如未实装系统的金币加成）
      if (UPGRADE_POOL_EXCLUDED.includes(option.id)) return false;
      // 武器已独立为武器系统（商店/宝箱/击败 Boss 后的武器强化三选一获取），
      // 不再出现在普通升级三选一（升级专注被动/属性成长词条）
      if (option.type === 'weapon') return false;
      // 被动选项：满级后不再出现（让出位置，避免玩家白选）
      if (option.type === 'passive') {
        return !player.isPassiveMaxLevel(option.id);
      }
      // stat 属性选项：达 maxLevel 上限后不再出现（防止无限叠加数值爆炸）
      if (option.type === 'stat' && option.maxLevel) {
        return player.getStatUpgradeLevel(option.id) < option.maxLevel;
      }
      return true;
    });
  }

  /**
   * 生成三选一候选：可用升级项不足时用兜底项补位，
   * 保证玩家在所有成长项（武器/被动/stat）满级后依然有得选。
   */
  private getChoices(availableOptions: UpgradeOption[]): UpgradeOption[] {
    // 所有成长项已满级：直接全部用兜底项（金币袋/大治疗/狂暴/清屏，无等级不膨胀）
    if (availableOptions.length === 0) {
      return this.shuffleUpgrades([...FALLBACK_UPGRADES]).slice(0, 3);
    }
    const choices = this.shuffleUpgrades([...availableOptions]).slice(0, 3);
    // 用兜底项补齐不足的空位（兜底项无等级、不膨胀）
    if (choices.length < 3) {
      const fillers = this.shuffleUpgrades([...FALLBACK_UPGRADES]).filter(
        (f) => !choices.some((c) => c.id === f.id)
      );
      for (const f of fillers) {
        if (choices.length >= 3) break;
        choices.push(f);
      }
    }
    return choices;
  }

  private shuffleUpgrades<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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
