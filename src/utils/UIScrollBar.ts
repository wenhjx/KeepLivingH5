import Phaser from 'phaser';

/**
 * 统一滚动条（轨道 + 滑块一体）
 *
 * - 无滚动内容时不渲染任何东西（避免"孤立长条"误导）
 * - 滑块嵌在轨道内（两端留 3px inset），视觉贴近常见滚动条
 * - 两个场景共用，避免重复实现：
 *   AchievementScene（成就列表）、PlayerInfoScene（持有列表）
 *
 * 用法：
 *   const bar = new UIScrollBar(scene, x, y, width, height);
 *   bar.setRange(contentHeight, viewHeight);  // 内容高、可视高
 *   ...滚动时...
 *   bar.update(scrollOffset);
 */
export class UIScrollBar {
  private track: Phaser.GameObjects.Graphics;
  private thumb: Phaser.GameObjects.Graphics;
  private barX: number;
  private barY: number;
  private barH: number;
  private trackInset = 3;
  private contentH = 0;
  private maxScroll = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, _width: number, height: number) {
    this.track = scene.add.graphics();
    this.thumb = scene.add.graphics();
    this.barX = x;
    this.barY = y;
    this.barH = height;
  }

  /** 设置内容总高与可视高（决定是否可滚动与滑块比例） */
  setRange(contentH: number, viewH: number): void {
    this.contentH = contentH;
    this.maxScroll = Math.max(0, contentH - viewH);
    this.update(0);
  }

  /** 是否可滚动 */
  get scrollable(): boolean {
    return this.maxScroll > 0;
  }

  /** 滚动偏移更新（无可滚动内容时轨道与滑块都不渲染） */
  update(offset: number): void {
    this.track.clear();
    this.thumb.clear();
    if (this.maxScroll <= 0) return;

    // 轨道：比可视区略内缩，形成"槽"
    const innerH = this.barH - this.trackInset * 2;
    const trackX = this.barX;
    this.track.fillStyle(0xffffff, 0.08);
    this.track.fillRoundedRect(trackX, this.barY + this.trackInset, 5, innerH, 2.5);

    // 滑块：按内容/可视比例 + 当前偏移定位，嵌在轨道内
    const thumbH = Math.max(24, innerH * (innerH / this.contentH));
    const thumbY = this.barY + this.trackInset + (innerH - thumbH) * (offset / this.maxScroll);
    this.thumb.fillStyle(0xffffff, 0.35);
    this.thumb.fillRoundedRect(trackX, thumbY, 5, thumbH, 2.5);
  }

  destroy(): void {
    this.track.destroy();
    this.thumb.destroy();
  }
}
