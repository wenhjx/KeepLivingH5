import Phaser from "phaser";
import { GameConfig } from "../game/GameConfig";
import { GameManager } from "../game/GameManager";
import { createUIText } from "../utils/UIText";
import { DebugPanel } from "../ui/DebugPanel";

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
  private fpsText!: Phaser.GameObjects.Text;
  private fpsTimer = 0;

  constructor() {
    super("DebugScene");
  }

  create(): void {
    // 真机 UI 缩放：中心放大面板（贴边元素已用 anchor 换算）
    const z = GameConfig.renderScale;
    const u = GameConfig.uiScale;
    this.cameras.main.setZoom(z);
    this.uiRoot = this.add
      .container(
        (this.scale.width / 2) * (1 - u / z),
        (this.scale.height / 2) * (1 - u / z),
      )
      .setScale(u / z);

    // 调试面板（按 ` 键切换）；传入 uiRoot 供滚动遮罩做 world 坐标换算
    this.debugPanel = new DebugPanel(this, this.uiRoot);

    // FPS 显示（设置面板开关，全局生效）：左下角小字，随 UI 缩放
    this.fpsText = createUIText(
      this,
      GameConfig.anchorX(12, this.scale.width),
      GameConfig.anchorY(this.scale.height - 12, this.scale.height),
      "",
      {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.35)",
        padding: { left: 6, right: 6, top: 2, bottom: 2 },
      },
    ).setOrigin(0, 1);
    this.uiRoot.add(this.fpsText);
    this.fpsText.setVisible(GameManager.getInstance().showFps);

    // 将面板创建的全部 UI 对象移入反向缩放根容器（保持视觉位置/比例不变）
    this.children.list.slice().forEach((child) => {
      if (child !== this.uiRoot) this.uiRoot.add(child);
    });
  }

  update(_time: number, delta: number): void {
    const gm = GameManager.getInstance();
    if (!gm.showFps) {
      if (this.fpsText.visible) this.fpsText.setVisible(false);
      return;
    }
    if (!this.fpsText.visible) this.fpsText.setVisible(true);
    this.fpsTimer += delta;
    if (this.fpsTimer >= 200) {
      this.fpsTimer = 0;
      this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    }
  }

  /** 供调试钩子（__debug 等）访问面板 */
  getDebugPanel(): DebugPanel | null {
    return this.debugPanel ?? null;
  }
}
