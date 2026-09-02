import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { DebugPanel } from '../ui/DebugPanel';

/**
 * 调试叠加场景
 *
 * 作为场景列表中最后一个场景常驻运行，渲染顺序天然在所有覆盖场景之上
 * （暂停/升级三选一/神秘商店/突破奖励/玩家属性/结算），保证调试面板永远
 * 清晰可见、随时可点——调试工具的管理员权限。
 *
 * 背景说明：Phaser 的 depth 只在同一场景内生效，此前 DebugPanel 放在 UIScene
 * （depth 1000）压不住后创建的独立覆盖场景（它们渲染在 UIScene 之上），导致
 * 多个灰度遮罩叠加后调试面板内容被盖暗、看不清。拆到独立场景后无需再依赖 depth。
 */
export class DebugScene extends Phaser.Scene {
  private debugPanel!: DebugPanel;
  private uiRoot!: Phaser.GameObjects.Container;

  constructor() {
    super('DebugScene');
  }

  create(): void {
    const z = GameConfig.renderScale;
    // 与 UIScene 一致的高清渲染：camera zoom 提高渲染像素密度，
    // 反向缩放根容器抵消 zoom，使 UI 的视觉位置与尺寸保持逻辑基准下的效果
    this.cameras.main.setZoom(z);
    this.uiRoot = this.add
      .container((this.scale.width / 2) * (1 - 1 / z), (this.scale.height / 2) * (1 - 1 / z))
      .setScale(1 / z);

    // 调试面板（按 ` 键切换）；传入 uiRoot 供滚动遮罩做 world 坐标换算
    this.debugPanel = new DebugPanel(this, this.uiRoot);

    // 将面板创建的全部 UI 对象移入反向缩放根容器（保持视觉位置/比例不变）
    this.children.list.slice().forEach((child) => {
      if (child !== this.uiRoot) this.uiRoot.add(child);
    });
  }

  /** 供调试钩子（__debug 等）访问面板 */
  getDebugPanel(): DebugPanel | null {
    return this.debugPanel ?? null;
  }
}
