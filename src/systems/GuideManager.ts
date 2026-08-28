import Phaser from 'phaser';
import { GuideCard, type GuideCardConfig } from '../ui/GuideCard';

/**
 * 引导提示管理器（单例）
 * 统一管理游戏中的操作提示、新功能解锁提示等
 * 支持队列、自动消失、手动关闭，可在任意场景/时机调用
 *
 * 用法：
 *   GuideManager.getInstance().show({ title: '移动', description: 'WASD移动' });
 *   GuideManager.getInstance().queue({ title: '新武器', description: '...' }); // 排队显示
 */
export class GuideManager {
  private static _instance: GuideManager | null = null;

  private scene: Phaser.Scene | null = null;
  private currentCard: GuideCard | null = null;
  private queue: GuideCardConfig[] = [];
  private isShowing: boolean = false;

  // 已展示过的提示 ID（用于"只显示一次"的提示）
  private shownOnceIds: Set<string> = new Set();

  private constructor() {}

  static getInstance(): GuideManager {
    if (!GuideManager._instance) {
      GuideManager._instance = new GuideManager();
    }
    return GuideManager._instance;
  }

  /**
   * 绑定到 UI 场景（必须在 UIScene create 时调用）
   * 重新绑定时会清理上一个场景的残留卡片
   */
  bind(scene: Phaser.Scene): void {
    // 清理上一个场景的残留
    if (this.currentCard) {
      this.currentCard.destroy();
      this.currentCard = null;
      this.isShowing = false;
    }
    this.queue = [];
    this.scene = scene;
  }

  /**
   * 立即显示一个提示（如果当前有提示在显示，则加入队列）
   * @param config 提示配置
   * @param onceId 可选，如果提供且已展示过则跳过（用于"只显示一次"的提示）
   */
  show(config: GuideCardConfig, onceId?: string): void {
    // 只显示一次的提示
    if (onceId && this.shownOnceIds.has(onceId)) {
      return;
    }
    if (onceId) {
      this.shownOnceIds.add(onceId);
    }

    if (this.isShowing) {
      this.queue.push(config);
    } else {
      this.displayCard(config);
    }
  }

  /**
   * 显式加入队列（等价于 show，但语义更清晰）
   */
  enqueue(config: GuideCardConfig, onceId?: string): void {
    this.show(config, onceId);
  }

  /**
   * 批量加入队列
   */
  queueAll(configs: GuideCardConfig[]): void {
    configs.forEach((c, i) => {
      if (i === 0 && !this.isShowing) {
        this.displayCard(c);
      } else {
        this.queue.push(c);
      }
    });
  }

  /**
   * 立即隐藏当前提示
   */
  hide(): void {
    if (this.currentCard) {
      this.currentCard.hide(() => {
        this.currentCard = null;
        this.isShowing = false;
        this.showNext();
      });
    }
  }

  /**
   * 清空队列（不影响当前显示的）
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * 全部清除（当前 + 队列）
   */
  clearAll(): void {
    this.clearQueue();
    if (this.currentCard) {
      this.currentCard.destroy();
      this.currentCard = null;
      this.isShowing = false;
    }
  }

  /**
   * 重置"只显示一次"的记录（用于新一局游戏等场景）
   */
  resetOnceRecords(): void {
    this.shownOnceIds.clear();
  }

  // ========== 内部方法 ==========

  private displayCard(config: GuideCardConfig): void {
    if (!this.scene) {
      console.warn('[GuideManager] 未绑定场景，无法显示提示');
      return;
    }

    this.isShowing = true;
    this.currentCard = new GuideCard(this.scene, config, () => {
      // 关闭回调
      this.currentCard = null;
      this.isShowing = false;
      this.showNext();
    });
    this.currentCard.show();
  }

  private showNext(): void {
    if (this.queue.length > 0) {
      const config = this.queue.shift()!;
      this.displayCard(config);
    }
  }

  // ========== Getters ==========

  get isActive(): boolean {
    return this.isShowing;
  }

  get queueLength(): number {
    return this.queue.length;
  }
}
