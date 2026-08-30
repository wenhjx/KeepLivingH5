import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';

/**
 * 引导提示卡片配置
 */
export interface GuideCardConfig {
  /** 标题 */
  title: string;
  /** 描述文本（支持换行 \n） */
  description: string;
  /** 图标（emoji 字符，如 '🎮' '⚔️'） */
  icon?: string;
  /** 图标纹理 key（可选，优先于 emoji） */
  iconTexture?: string;
  /** 自动消失时长（毫秒），0 或不填 = 不自动消失，需点击关闭 */
  duration?: number;
  /** 主题色（边框/标题颜色），默认青色 */
  color?: number;
  /** 位置：'top' | 'center' | 'bottom'，默认 'top' */
  position?: 'top' | 'center' | 'bottom';
  /** 是否显示"知道了"按钮，默认 true */
  showButton?: boolean;
  /** 按钮文字，默认 '知道了' */
  buttonText?: string;
}

/**
 * 引导提示卡片
 * 单个提示的 UI 渲染和动画
 */
export class GuideCard {
  private scene: Phaser.Scene;
  private config: GuideCardConfig;
  private onClose: () => void;

  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private timer: Phaser.Time.TimerEvent | null = null;

  private readonly cardWidth = 360;
  private readonly cardHeight = 180;
  private readonly padding = 20;

  constructor(scene: Phaser.Scene, config: GuideCardConfig, onClose: () => void) {
    this.scene = scene;
    this.config = config;
    this.onClose = onClose;

    // 高清渲染下 UIScene 有反向缩放根容器（uiRoot），卡片需加入其中保持视觉比例
    const parent = (scene as any).uiRoot || scene;
    this.container = scene.add.container(0, 0).setDepth(500).setAlpha(0);
    parent.add(this.container);
    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.build();
  }

  /**
   * 构建卡片内容
   */
  private build(): void {
    const { width, height } = this.scene.scale;
    const color = this.config.color ?? 0x00ffff;
    const position = this.config.position ?? 'top';

    // 计算位置
    let y: number;
    switch (position) {
      case 'center':
        y = height / 2;
        break;
      case 'bottom':
        y = height - this.cardHeight / 2 - 30;
        break;
      case 'top':
      default:
        y = this.cardHeight / 2 + 20;
        break;
    }
    const x = width / 2;

    this.container.setPosition(x, y);

    // 卡片背景
    this.bg.fillStyle(0x0d0d1a, 0.95);
    this.bg.fillRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    // 边框
    this.bg.lineStyle(2, color, 0.8);
    this.bg.strokeRoundedRect(-this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth, this.cardHeight, 12);
    // 顶部装饰条
    this.bg.fillStyle(color, 0.6);
    this.bg.fillRoundedRect(-this.cardWidth / 2 + 10, -this.cardHeight / 2 + 8, this.cardWidth - 20, 3, 2);

    let contentY = -this.cardHeight / 2 + this.padding + 10;

    // 图标
    if (this.config.iconTexture) {
      const icon = this.scene.add.image(0, contentY + 16, this.config.iconTexture).setOrigin(0.5);
      this.container.add(icon);
    } else if (this.config.icon) {
      const iconText = createUIText(this.scene, 0, contentY + 16, this.config.icon, {
          fontSize: '32px',
        })
        .setOrigin(0.5);
      this.container.add(iconText);
    }

    // 标题
    const titleY = this.config.icon || this.config.iconTexture ? contentY + 42 : contentY + 8;
    const title = createUIText(this.scene, 0, titleY, this.config.title, {
        fontSize: '20px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.container.add(title);

    // 描述
    const descY = titleY + 30;
    const description = createUIText(this.scene, 0, descY, this.config.description, {
        fontSize: '14px',
        color: '#cccccc',
        align: 'center',
        wordWrap: { width: this.cardWidth - this.padding * 2, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    this.container.add(description);

    // 关闭按钮
    const showButton = this.config.showButton ?? true;
    if (showButton) {
      const btnY = this.cardHeight / 2 - this.padding - 4;
      const btnText = this.config.buttonText ?? '知道了';
      const button = createUIText(this.scene, 0, btnY, btnText, {
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
          padding: { left: 24, right: 24, top: 6, bottom: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerover', () => button.setStyle({ color: '#000000' }));
      button.on('pointerout', () => button.setStyle({ color: '#ffffff' }));
      button.on('pointerdown', () => this.hide());

      this.container.add(button);
    }

    // 点击卡片任意位置关闭（如果没有按钮）
    if (!showButton) {
      const hitArea = this.scene.add
        .rectangle(0, 0, this.cardWidth, this.cardHeight, 0xffffff, 0)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.hide());
      this.container.add(hitArea);
    }

    // 自动消失
    if (this.config.duration && this.config.duration > 0) {
      this.timer = this.scene.time.delayedCall(this.config.duration, () => {
        this.hide();
      });
    }
  }

  /**
   * 显示卡片（淡入 + 下滑动画）
   */
  show(): void {
    const startY = this.container.y - 20;
    this.container.setPosition(this.container.x, startY);

    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y + 20,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  /**
   * 隐藏卡片（淡出 + 上移动画）
   * @param callback 动画完成回调
   */
  hide(callback?: () => void): void {
    if (this.timer) {
      this.timer.remove();
      this.timer = null;
    }

    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - 15,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.destroy();
        callback?.();
        this.onClose();
      },
    });
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.timer) {
      this.timer.remove();
    }
    this.container.destroy();
  }
}
