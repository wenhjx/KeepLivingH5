import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { EventBus } from '../utils/EventBus';
import { generateShopStock, applyShopItem, type ShopItem } from '../data/shop';
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
    this.cameras.main.setZoom(GameConfig.renderScale);
    // 使用逻辑分辨率布局（相机已按 renderScale 放大，可视区域 = 960x640）
    const width = GameConfig.GAME_WIDTH;
    const height = GameConfig.GAME_HEIGHT;

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
    const card = this.add.container(x, y).setData('isShopCard', true);

    const rarityColors: Record<string, number> = {
      common: 0x888888,
      rare: 0x3399ff,
      epic: 0xaa44ff,
      legendary: 0xffaa00,
    };
    const borderColor = rarityColors[item.rarity] || 0x888888;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a25, 1);
    bg.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    bg.lineStyle(3, borderColor, 1);
    bg.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    card.add(bg);

    // 稀有度标签
    const rarityText = createUIText(this, 0, -this.cardHeight / 2 + 20, item.rarity.toUpperCase(), {
        fontSize: '12px',
        color: `#${borderColor.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    card.add(rarityText);

    // 图标
    const iconBg = this.add.graphics();
    iconBg.fillStyle(0x2a2a35, 1);
    iconBg.fillCircle(0, -78, 38);
    card.add(iconBg);

    const iconText = createUIText(this, 0, -78, item.icon, { fontSize: '30px' }).setOrigin(0.5);
    card.add(iconText);

    // 名称
    const nameText = createUIText(this, 0, -20, item.name, {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: this.cardWidth - 20 },
      })
      .setOrigin(0.5);
    card.add(nameText);

    // 描述
    const descText = createUIText(this, 0, 18, item.desc, {
        fontSize: '12px',
        color: '#aaaaaa',
        align: 'center',
        wordWrap: { width: this.cardWidth - 30 },
      })
      .setOrigin(0.5, 0);
    card.add(descText);

    // 价格
    const priceText = createUIText(this, 0, this.cardHeight / 2 - 40, `💰 ${item.price}`, {
        fontSize: '20px',
        color: '#ffcc00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    card.add(priceText);

    // 交互区域（整格点击）
    const hitArea = this.add
      .rectangle(0, 0, this.cardWidth, this.cardHeight, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.add(hitArea);

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x2a2a40, 1);
      bg.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
      bg.lineStyle(3, borderColor, 1);
      bg.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    });
    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x1a1a25, 1);
      bg.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
      bg.lineStyle(3, borderColor, 1);
      bg.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    });

    hitArea.on('pointerdown', () => this.tryBuy(item, card));
  }

  // ========== 购买 ==========

  private tryBuy(item: ShopItem, card: Phaser.GameObjects.Container): void {
    const player = this.getPlayer();
    if (!player) return;

    if (!player.spendCoins(item.price)) {
      this.flashInsufficient();
      return;
    }

    applyShopItem(player, item, this.scene.get('GameScene'));
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
