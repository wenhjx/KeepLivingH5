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
  /** 自动消失时长（毫秒），0 = 不自动消失需点击关闭；默认 3500 */
  duration?: number;
  /** 主题色（边框/标题/进度条颜色），默认青色 */
  color?: number;
  /** 位置：'top-right' | 'top' | 'center' | 'bottom'，默认 'top-right'（右上角） */
  position?: 'top-right' | 'top' | 'center' | 'bottom';
  /** 是否显示"知道了"按钮，默认 false（自动流转为主，无需手动点击） */
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
  /** 倒计时进度条（外框进度，逐渐变短） */
  private progressBar: Phaser.GameObjects.Rectangle | null = null;

  private readonly cardWidth = 300;
  private readonly cardHeight = 132;
  private readonly padding = 16;

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
    const position = this.config.position ?? 'top-right';

    // 计算位置
    const margin = 16;
    let x: number;
    let y: number;
    switch (position) {
      case 'center':
        x = width / 2;
        y = height / 2;
        break;
      case 'bottom':
        x = width / 2;
        y = height - this.cardHeight / 2 - 30;
        break;
      case 'top':
        x = width / 2;
        y = this.cardHeight / 2 + 20;
        break;
      case 'top-right':
      default:
        // 右上角弹出，不遮挡中央战场
        x = width - this.cardWidth / 2 - margin;
        y = this.cardHeight / 2 + margin;
        break;
    }

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

    // 图标 + 标题（水平一行，左上角）
    const contentX = -this.cardWidth / 2 + this.padding;
    let iconX = contentX;
    if (this.config.iconTexture) {
      const icon = this.scene.add.image(0, 0, this.config.iconTexture).setOrigin(0.5, 0.5);
      icon.setPosition(contentX + 14, -this.cardHeight / 2 + this.padding + 16);
      this.container.add(icon);
      iconX = contentX + 36;
    } else if (this.config.icon) {
      const iconText = createUIText(this.scene, 0, 0, this.config.icon, {
          fontSize: '24px',
        })
        .setOrigin(0.5, 0.5);
      iconText.setPosition(contentX + 14, -this.cardHeight / 2 + this.padding + 16);
      this.container.add(iconText);
      iconX = contentX + 38;
    }

    const titleY = -this.cardHeight / 2 + this.padding + 15;
    const title = createUIText(this.scene, 0, 0, this.config.title, {
        fontSize: '18px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0, 0.5);
    title.setPosition(iconX, titleY);
    this.container.add(title);

    // 描述（标题下方，居中）
    const descY = -this.cardHeight / 2 + this.padding + 38;
    const description = createUIText(this.scene, 0, 0, this.config.description, {
        fontSize: '13px',
        color: '#cccccc',
        align: 'center',
        wordWrap: { width: this.cardWidth - this.padding * 2, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);
    description.setPosition(0, descY);
    this.container.add(description);

    // 关闭按钮（可选，默认不显示，自动流转）
    const showButton = this.config.showButton ?? false;
    if (showButton) {
      const btnY = this.cardHeight / 2 - this.padding - 14;
      const btnText = this.config.buttonText ?? '知道了';
      const button = createUIText(this.scene, 0, 0, btnText, {
          fontSize: '13px',
          color: '#ffffff',
          backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
          padding: { left: 20, right: 20, top: 5, bottom: 5 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      button.setPosition(0, btnY);

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

    // 底部倒计时进度条（外框进度，随时间从左到右变短）
    const barY = this.cardHeight / 2 - this.padding + 2;
    const barWidth = this.cardWidth - this.padding * 2;
    const barBg = this.scene.add
      .rectangle(-this.cardWidth / 2 + this.padding, barY, barWidth, 4, 0x000000, 0.55)
      .setOrigin(0, 0.5);
    this.container.add(barBg);
    this.progressBar = this.scene.add
      .rectangle(-this.cardWidth / 2 + this.padding, barY, barWidth, 4, color, 0.9)
      .setOrigin(0, 0.5);
    this.container.add(this.progressBar);

    // 自动消失：进度条变短 + 到时自动 hide（队列自动进入下一条）
    const duration = this.config.duration ?? 3500;
    if (duration > 0) {
      this.timer = this.scene.time.delayedCall(duration, () => {
        this.hide();
      });
      this.scene.tweens.add({
        targets: this.progressBar,
        width: 0,
        duration,
        ease: 'Linear',
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
