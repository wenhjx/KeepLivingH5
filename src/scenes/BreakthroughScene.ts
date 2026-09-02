import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { UpgradePanel } from '../ui/UpgradePanel';
import { GuideManager } from '../systems/GuideManager';
import { setupUICamera } from '../utils/CameraHelper';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import type { UpgradeOption } from '../types';
import type { Player } from '../entities/Player';

/**
 * Boss 突破奖励场景
 *
 * 击败 Boss 后弹出：从已满级的 stat 属性中选一个突破 +1 级（效果再叠加一次，超过原 maxLevel）。
 * 设计目标：把早期版本"无限叠加突破极限"的爽感，变成受控的 Boss 战利品——
 * 突破上限 = 原 maxLevel，受 Boss 数量硬限制（每 5 波一个 Boss），不会无限叠加导致数值爆炸。
 * 与 UpgradeScene 并行运行，复用 UpgradePanel 卡片组件，避免重复造轮子。
 */
export class BreakthroughScene extends Phaser.Scene {
  private upgradePanel!: UpgradePanel;

  constructor() {
    super('BreakthroughScene');
  }

  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0);

    // 标题
    createUIText(this, width / 2, 62, '✨ BOSS 突破奖励 ✨', {
      fontSize: '34px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // 副标题
    createUIText(this, width / 2, 105, '选择一项战斗属性，突破其极限', {
      fontSize: '15px',
      color: '#cccccc',
    }).setOrigin(0.5);

    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;
    const available = player?.getAvailableBreakthroughs?.() ?? [];

    // 无可突破项（防御：正常流程在触发前已判断，走到这里直接关闭）
    if (available.length === 0) {
      this.closePanel();
      return;
    }

    this.upgradePanel = new UpgradePanel(this);
    // 传入候选即"已满级 stat"列表；UpgradePanel 内部随机取最多 3 个，不足则只显示已有的
    this.upgradePanel.show((option: UpgradeOption) => this.onSelect(option), available);

    // AI 自动玩：突破选择策略简单（选第一个可突破项即可），延迟 0.8s 选中 + 1s 后确认
    if (gameScene?.isAutoPlay?.()) {
      this.time.delayedCall(800, () => {
        const shown = this.upgradePanel.getOptions();
        if (shown.length > 0 && this.upgradePanel.isVisible()) {
          this.upgradePanel.setSelectedIndex(0, true);
          this.time.delayedCall(1000, () => {
            if (this.upgradePanel.isVisible() && this.upgradePanel.getSelectedIndex() === 0) {
              this.upgradePanel.confirmSelection();
            }
          });
        }
      });
    }
  }

  /** 选择突破项：应用突破 + 顶部提示 + 关闭面板 */
  private onSelect(option: UpgradeOption): void {
    const gameScene = this.scene.get('GameScene') as any;
    const player = gameScene?.getPlayer() as Player | undefined;
    if (player) {
      const ok = player.breakthroughStat(option);
      if (ok) {
        const level = player.getBreakthroughLevel(option.id);
        AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_LEVEL_UP, 1);
        GuideManager.getInstance().show({
          title: `突破成功: ${option.name}`,
          description: `${option.name} 突破至 Lv.${level}（已突破原上限）`,
          icon: option.icon || '✨',
          color: 0xffd54f,
          position: 'top-right',
          duration: 3500,
          showButton: false,
        });
      }
    }
    this.closePanel();
  }

  /** 关闭突破面板并恢复游戏 */
  private closePanel(): void {
    GameManager.getInstance().setPaused(false);
    this.scene.stop('BreakthroughScene');
  }
}
