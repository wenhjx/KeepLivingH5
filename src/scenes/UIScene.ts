import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { HUD } from '../ui/HUD';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { DebugPanel } from '../ui/DebugPanel';
import { GuideManager } from '../systems/GuideManager';
import { EventBus } from '../utils/EventBus';

/**
 * UI 叠加场景
 * 与 GameScene 并行运行，负责显示 HUD、虚拟摇杆、暂停菜单等 UI 元素
 * 使用独立场景避免 UI 受游戏世界相机影响
 */
export class UIScene extends Phaser.Scene {
  private hud!: HUD;
  private joystick!: VirtualJoystick;
  private debugPanel!: DebugPanel;
  private pauseButton!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private uiRoot!: Phaser.GameObjects.Container;

  constructor() {
    super('UIScene');
  }

  create(): void {
    const z = GameConfig.renderScale;
    // 高清渲染：camera zoom 提高渲染像素密度。
    // UI 元素多为角落/绝对坐标定位，直接 zoom 会围绕画布中心外扩错位，
    // 故创建"反向缩放根容器"（位置 = 中心×(1-1/z)、scale = 1/z）抵消 zoom，
    // 使 UI 的视觉位置与尺寸保持逻辑基准下的效果。
    this.cameras.main.setZoom(z);
    this.uiRoot = this.add
      .container((this.scale.width / 2) * (1 - 1 / z), (this.scale.height / 2) * (1 - 1 / z))
      .setScale(1 / z);
    const gm = GameManager.getInstance();

    // 绑定引导提示管理器到 UI 场景
    GuideManager.getInstance().bind(this);

    // HUD
    this.hud = new HUD(this);

    // 调试面板（按 ` 键切换）
    this.debugPanel = new DebugPanel(this);

    // 移动端显示虚拟摇杆
    if (gm.isMobile) {
      this.joystick = new VirtualJoystick(this, 100, this.scale.height - 100);
      // 绑定到 GameScene 的输入管理器
      const gameScene = this.scene.get('GameScene') as any;
      if (gameScene && gameScene.getInputManager) {
        this.joystick.setInputManager(gameScene.getInputManager());
      }
    }

    // 暂停按钮
    this.pauseButton = createUIText(this, this.scale.width - 20, 20, 'II', {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#1a1a25',
        padding: { left: 12, right: 12, top: 6, bottom: 6 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.pauseButton.on('pointerdown', () => {
      const game = this.scene.get('GameScene') as any;
      if (game && game.inputManager) {
        // 切换暂停
      }
      GameManager.getInstance().setPaused(!GameManager.getInstance().isPaused);
    });

    // 暂停遮罩
    this.createPauseOverlay();

    // 事件监听
    this.setupEventListeners();

    // 将场景已创建的全部 UI 对象移入反向缩放根容器（保持视觉位置/比例不变）
    this.children.list.slice().forEach((child) => {
      if (child !== this.uiRoot) this.uiRoot.add(child);
    });
  }

  private createPauseOverlay(): void {
    const { width, height } = this.scale;

    this.pauseOverlay = this.add.container(0, 0);
    this.pauseOverlay.setVisible(false);
    this.pauseOverlay.setDepth(100);

    // 半透明背景
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);
    this.pauseOverlay.add(bg);

    // 暂停文字
    const title = createUIText(this, width / 2, height / 2 - 60, '游戏暂停', {
        fontSize: '48px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pauseOverlay.add(title);

    // 继续按钮
    const resumeBtn = createUIText(this, width / 2, height / 2, '继续游戏', {
        fontSize: '24px',
        color: '#e0e0e0',
        backgroundColor: '#1a1a25',
        padding: { left: 40, right: 40, top: 12, bottom: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerdown', () => {
      GameManager.getInstance().setPaused(false);
    });
    this.pauseOverlay.add(resumeBtn);

    // 返回主菜单按钮
    const menuBtn = createUIText(this, width / 2, height / 2 + 60, '返回主菜单', {
        fontSize: '20px',
        color: '#aaaaaa',
        backgroundColor: '#1a1a25',
        padding: { left: 30, right: 30, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => {
      // 返回主菜单前保存本局数据（否则本局击杀/分数会丢失）
      const gm = GameManager.getInstance();
      if (!gm.isGameOver) {
        gm.endRun();
      }
      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
    this.pauseOverlay.add(menuBtn);
  }

  private setupEventListeners(): void {
    EventBus.on('run:pause', (paused: boolean) => {
      this.pauseOverlay.setVisible(paused);
      this.pauseButton.setVisible(!paused);
    });

    EventBus.on('run:kill', () => {
      this.hud.update();
    });

    EventBus.on('run:wave', () => {
      this.hud.update();
    });

    EventBus.on('player:damage', () => {
      this.hud.updateHealth();
    });

    EventBus.on('player:heal', () => {
      this.hud.updateHealth();
    });

    EventBus.on('player:levelup', () => {
      this.hud.updateLevel();
    });
  }

  update(time: number, delta: number): void {
    // 每帧更新 HUD
    this.hud.update();
  }
}
