import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { EventBus } from '../utils/EventBus';
import { setupUICamera } from '../utils/CameraHelper';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import { generateShopStock, applyShopItem, type ShopItem } from '../data/shop';
import { createOptionCard } from '../ui/OptionCard';
import type { Player } from '../entities/Player';

/**
 * 神秘商店场景
 * 每 5 波 Boss 战前弹出（战前补给点，GameScene 驱动），暂停游戏
 * 4 格货架：3 常规 + 1 高级位保底；可刷新（1 次免费 + 金币付费）；整格点击购买
 */
export class ShopScene extends Phaser.Scene {
  private stock: ShopItem[] = [];
  private freeRefreshLeft: number = 1;
  private refreshCost: number = 20;
  private coinText!: Phaser.GameObjects.Text;
  private refreshText!: Phaser.GameObjects.Text;

  private readonly cardWidth = 200;
  private readonly cardHeight = 300;
  private readonly cardSpacing = 24;

  constructor() {
    super('ShopScene');
  }

  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.82).setOrigin(0);

    // 标题
    createUIText(this, width / 2, 60, '🛒 神秘商店', {
        fontSize: '40px',
        color: '#ffcc00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    createUIText(this, width / 2, 108, 'Boss 将至，用金币强化自己！', {
        fontSize: '14px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    // 金币余额
    this.coinText = createUIText(this, width / 2, 148, '💰 0', {
        fontSize: '22px',
        color: '#ffcc00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 生成货架并渲染
    this.stock = generateShopStock(this.getPlayer() as Player);
    this.renderStock();
    this.updateCoin();

    // 刷新按钮（左下）
    this.createRefreshButton();

    // 离开按钮（右下）
    this.createLeaveButton();

    // 提示
    createUIText(this, width / 2, height - 34, '点击商品购买 · Boss 战前补给', {
        fontSize: '12px',
        color: '#666666',
      })
      .setOrigin(0.5);

    // AI 自动玩：延迟自动离开商店
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene?.isAutoPlay?.()) {
      this.time.delayedCall(800, () => this.leave());
    }
  }

  private getPlayer(): Player | undefined {
    return (this.scene.get('GameScene') as any)?.getPlayer?.() as Player | undefined;
  }

  // ========== 货架渲染 ==========

  private renderStock(): void {
    // 清除旧卡片
    this.children.list
      .filter((obj) => obj.getData('isShopCard'))
      .forEach((obj) => obj.destroy());

    const width = GameConfig.GAME_WIDTH;
    const height = GameConfig.GAME_HEIGHT;
    const totalWidth = this.stock.length * this.cardWidth + (this.stock.length - 1) * this.cardSpacing;
    const startX = (width - totalWidth) / 2 + this.cardWidth / 2;
    const cardY = height / 2 + 30;

    this.stock.forEach((item, index) => {
      const x = startX + index * (this.cardWidth + this.cardSpacing);
      this.createCard(x, cardY, item, index);
    });
  }

  /** 创建单个商品卡片（整格点击购买） */
  private createCard(x: number, y: number, item: ShopItem, index: number): void {
    const card = createOptionCard(this, x, y, {
      name: item.name,
      icon: item.icon,
      desc: item.desc,
      rarity: item.rarity,
      cardWidth: this.cardWidth,
      cardHeight: this.cardHeight,
      footerText: `💰 ${item.price}`,
      footerColor: '#ffcc00',
      onClick: () => this.tryBuy(item, card),
    });
    card.setData('isShopCard', true);
  }

  // ========== 购买 ==========

  private tryBuy(item: ShopItem, card: Phaser.GameObjects.Container): void {
    const player = this.getPlayer();
    if (!player) return;

    if (!player.spendCoins(item.price)) {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_SHOP_DENY, 0.8);
      this.flashInsufficient();
      return;
    }

    // 可主动使用的消耗品进入物品栏；复活币等无 itemId 的立即生效
    if (item.kind === 'consumable' && item.itemId) {
      player.addItem(item.itemId);
    } else {
      applyShopItem(player, item, this.scene.get('GameScene'));
    }
    this.updateCoin();

    // 该格标记已售
    card.setData('sold', true);
    card.list.forEach((obj) => {
      (obj as any).setAlpha?.(0.35);
    });
    const soldText = createUIText(this, 0, 0, '已购 ✓', {
        fontSize: '22px',
        color: '#44ff88',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    card.add(soldText);
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_SHOP_BUY, 1);
  }

  /** 金币不足提示 */
  private flashInsufficient(): void {
    this.coinText.setColor('#ff4444');
    this.coinText.setText('💰 金币不足！');
    this.time.delayedCall(700, () => {
      this.coinText.setColor('#ffcc00');
      this.updateCoin();
    });
  }

  private updateCoin(): void {
    const player = this.getPlayer();
    this.coinText.setText(`💰 ${player?.getCoins() ?? 0}`);
  }

  // ========== 刷新 ==========

  private createRefreshButton(): void {
    const x = 20;
    const y = GameConfig.GAME_HEIGHT - 70;

    const btn = this.add.graphics();
    btn.fillStyle(0x2a2a40, 1);
    btn.fillRoundedRect(x, y, 170, 44, 8);

    this.refreshText = createUIText(this, x + 85, y + 22, this.getRefreshLabel(), {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const hitArea = this.add
      .rectangle(x + 85, y + 22, 170, 44, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => this.tryRefresh());
  }

  private getRefreshLabel(): string {
    if (this.freeRefreshLeft > 0) return '🔄 免费刷新';
    return `🔄 刷新 ${this.refreshCost}💰`;
  }

  private tryRefresh(): void {
    const player = this.getPlayer();
    if (!player) return;

    if (this.freeRefreshLeft > 0) {
      this.freeRefreshLeft--;
    } else {
      if (!player.spendCoins(this.refreshCost)) {
        this.flashInsufficient();
        return;
      }
      this.refreshCost += 20;
    }

    this.stock = generateShopStock(player);
    this.renderStock();
    this.refreshText.setText(this.getRefreshLabel());
    this.updateCoin();
  }

  // ========== 离开 ==========

  private createLeaveButton(): void {
    const x = GameConfig.GAME_WIDTH - 20;
    const y = GameConfig.GAME_HEIGHT - 70;

    const btn = this.add.graphics();
    btn.fillStyle(0x446644, 1);
    btn.fillRoundedRect(x - 140, y, 140, 44, 8);

    createUIText(this, x - 70, y + 22, '离开 ➜', {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const hitArea = this.add
      .rectangle(x - 70, y + 22, 140, 44, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => this.leave());
  }

  private leave(): void {
    GameManager.getInstance().setPaused(false);
    this.scene.stop('ShopScene');
    // 通知 GameScene：商店关闭，若有 Boss 战前补给待开则开始该波次
    EventBus.emit('shop:closed');
  }
}
