import { Layers } from '../constants/Layers';
import { TextSmoothing } from '../utils/UIText';

interface PlayerStatusItem {
  key: string;
  emoji: string;
  flashBefore: number;
  container: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
}

/**
 * 玩家限时状态图标（通用组件，未来限时增益沿用同一套）：
 * - 当前支持减益（剧毒 ☠️，红色圆底 = 减益语义色）
 * - 图标跟随玩家头顶，位置/剩余时间由宿主（Player）每帧驱动
 * - 剩余时间 <= flashBefore 时以 150ms 周期闪烁，警示状态即将结束
 * - 剩余时间驱动而非 wall-clock：游戏暂停时图标与状态一起冻结，天然一致
 */
export class PlayerStatusIcons {
  private items: PlayerStatusItem[] = [];

  constructor(
    private scene: Phaser.Scene,
    private depth: number = Layers.ENTITY_STATUS,
  ) {}

  /** 注册/复用状态图标：已存在同 key 直接复用（时长由外部驱动，无需在此延长） */
  show(key: string, emoji: string, color: number, flashBefore = 0): void {
    if (this.items.some((i) => i.key === key)) return;
    const container = this.scene.add.container(0, 0).setDepth(this.depth);
    const circle = this.scene.add.circle(0, 0, 13, color, 0.92).setStrokeStyle(1.5, 0xffffff, 0.85);
    const text = this.scene.add
      .text(0, 0, emoji, { fontSize: '13px' })
      .setOrigin(0.5);
    TextSmoothing.apply(text);
    container.add([circle, text]);
    this.items.push({ key, emoji, flashBefore, container, text });
  }

  /** 每帧由宿主调用：同步位置 + 剩余时间，到期移除；结束前闪烁 */
  update(key: string, remaining: number, x: number, y: number): void {
    const idx = this.items.findIndex((i) => i.key === key);
    if (idx === -1) return;
    const it = this.items[idx];
    if (remaining <= 0) {
      this.remove(key);
      return;
    }
    // 多图标横向排列（以玩家头顶为轴居中），单图标即居中
    const n = this.items.length;
    it.container.setPosition(x + (idx - (n - 1) / 2) * 30, y);
    if (remaining <= it.flashBefore) {
      const phase = Math.floor(this.scene.time.now / 150) % 2 === 0;
      it.container.setVisible(phase);
    } else {
      it.container.setVisible(true);
    }
  }

  /** 移除单个状态图标（其余图标位置由宿主下一帧 update 自动收敛） */
  remove(key: string): void {
    const idx = this.items.findIndex((i) => i.key === key);
    if (idx === -1) return;
    this.items[idx].container.destroy();
    this.items.splice(idx, 1);
  }

  /** 清空全部（玩家死亡 / 状态重置时调用） */
  clear(): void {
    for (const it of this.items) it.container.destroy();
    this.items = [];
  }

  destroy(): void {
    this.clear();
  }
}
