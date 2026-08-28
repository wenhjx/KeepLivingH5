import type { Vector2 } from '../types';

/**
 * 数学工具类
 * 游戏中常用的数学计算
 */
export class MathUtils {
  /** 角度转弧度 */
  static degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /** 弧度转角度 */
  static radToDeg(rad: number): number {
    return (rad * 180) / Math.PI;
  }

  /** 两点间距离 */
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 两点间距离的平方（避免开方，性能更优） */
  static distanceSq(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  /** 两点间角度（弧度） */
  static angle(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  /** 归一化向量 */
  static normalize(x: number, y: number): Vector2 {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  }

  /** 数值限制在范围内 */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /** 线性插值 */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /** 随机浮点数 [min, max) */
  static randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /** 随机整数 [min, max] */
  static randomInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  /** 随机选择数组中的一个元素 */
  static randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** 带权重的随机选择 */
  static weightedRandom<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** 角度差（-PI 到 PI） */
  static angleDiff(a: number, b: number): number {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  /** 平滑朝向目标角度 */
  static rotateTowards(current: number, target: number, maxDelta: number): number {
    const diff = this.angleDiff(current, target);
    if (Math.abs(diff) <= maxDelta) return target;
    return current + Math.sign(diff) * maxDelta;
  }

  /** 圆周上的点 */
  static pointOnCircle(cx: number, cy: number, radius: number, angle: number): Vector2 {
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  }

  /** 矩形内随机点 */
  static randomInRect(x: number, y: number, w: number, h: number): Vector2 {
    return {
      x: x + Math.random() * w,
      y: y + Math.random() * h,
    };
  }

  /** 判断概率是否触发（0-1） */
  static chance(probability: number): boolean {
    return Math.random() < probability;
  }
}
