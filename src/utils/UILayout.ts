import Phaser from 'phaser';

/**
 * 轻量 UI 布局器（类 UGUI LayoutGroup 的极简版）
 *
 * 核心思想：用"游标"（cursor）维护主轴上次排布位置，每放置一个子节点自动向前推进。
 * 解决两类痛点：
 *  1. 自增长列表（buff 条、技能列表、按钮列）：新增一项自动接在上一个后面，
 *     无需从原点重算总宽/总高与每个元素的坐标。
 *  2. 同级别子节点间距固定：spacing 统一管理，改一个参数全体生效；
 *     换段/换行用 jumpTo 直接跳到新基准，不用从头重新计算。
 *
 * 用法：
 *   const col = new UILayout({ x: w/2, y: h/2, direction: 'column', spacing: 60 });
 *   col.placeCentered(btnA);   // 按钮中心定位到 (w/2, h/2)，游标下移
 *   col.placeCentered(btnB);   // 自动落到 (w/2, h/2+60)
 *   col.step(20);              // 额外留白
 *   col.placeCentered(btnC);
 *
 * 主轴步长优先取对象的 displayWidth/displayHeight（Text/Sprite 自动测）；
 * 对无法自测尺寸的对象（Container/Graphics）传入 itemSize 使用固定步长。
 */

export interface UILayoutConfig {
  /** 起始锚点（主轴起点） */
  x: number;
  y: number;
  /** 主轴方向：'column' 垂直向下 | 'row' 水平向右 */
  direction?: 'column' | 'row';
  /** 相邻子节点主轴间距（不含子节点自身尺寸） */
  spacing?: number;
  /** 固定主轴步长（用于 Container/Graphics 等无法自动测尺寸的对象）；缺省按子对象实际尺寸推进 */
  itemSize?: number;
}

/** 可被布局器定位的对象：具备 Transform 组件的游戏对象（Sprite/Text/Image/Container 等） */
export type UILayoutTarget = Phaser.GameObjects.GameObject & {
  setPosition: (x: number, y: number) => void;
};

export class UILayout {
  private cursorX: number;
  private cursorY: number;
  private direction: 'column' | 'row';
  private spacing: number;
  private itemSize?: number;

  constructor(cfg: UILayoutConfig) {
    this.cursorX = cfg.x;
    this.cursorY = cfg.y;
    this.direction = cfg.direction ?? 'column';
    this.spacing = cfg.spacing ?? 0;
    this.itemSize = cfg.itemSize;
  }

  /** 当前游标（下一个子节点的锚点坐标） */
  get x(): number {
    return this.cursorX;
  }
  get y(): number {
    return this.cursorY;
  }

  /**
   * 放置一个子对象：定位到当前游标（不修改对象 origin，左上角贴齐游标），
   * 可选加入 container，然后沿主轴推进。
   */
  place(obj: UILayoutTarget, container?: Phaser.GameObjects.Container): this {
    obj.setPosition(this.cursorX, this.cursorY);
    if (container) container.add(obj);
    this.advance(obj);
    return this;
  }

  /**
   * 居中放置：先把对象 origin 设为 (0.5, 0.5)（对象中心落在游标上），再 place。
   * 适合 Text/Sprite/Image 这类交互对象；Container 请用 place + itemSize 保持左上角语义。
   */
  placeCentered(obj: UILayoutTarget, container?: Phaser.GameObjects.Container): this {
    if (typeof (obj as any).setOrigin === 'function') {
      (obj as any).setOrigin(0.5, 0.5);
    }
    return this.place(obj, container);
  }

  /** 手动沿主轴推进 n 像素（用于分组留白） */
  step(n: number): this {
    if (this.direction === 'column') this.cursorY += n;
    else this.cursorX += n;
    return this;
  }

  /** 重设锚点到新基准（换段/换行），避免从头重算 */
  jumpTo(x: number, y: number): this {
    this.cursorX = x;
    this.cursorY = y;
    return this;
  }

  // ---- 内部 ----

  private advance(obj: UILayoutTarget): void {
    const step = this.itemSize !== undefined ? this.itemSize : this.objMainSize(obj);
    if (this.direction === 'column') {
      this.cursorY += step + this.spacing;
    } else {
      this.cursorX += step + this.spacing;
    }
  }

  /** 主轴尺寸：column 取高，row 取宽 */
  private objMainSize(obj: UILayoutTarget): number {
    const anyObj = obj as any;
    const size = this.direction === 'column' ? anyObj.displayHeight : anyObj.displayWidth;
    if (size !== undefined && size > 0) return size;
    const raw = this.direction === 'column' ? anyObj.height : anyObj.width;
    return raw !== undefined && raw > 0 ? raw : 0;
  }
}
