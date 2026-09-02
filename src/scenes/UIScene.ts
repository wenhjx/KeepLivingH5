import { createUIText } from '../utils/UIText';
import { UILayout } from '../utils/UILayout';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { HUD } from '../ui/HUD';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { Minimap } from '../ui/Minimap';
import { InventoryUI } from '../ui/InventoryUI';
import { GuideManager } from '../systems/GuideManager';
import { EventBus } from '../utils/EventBus';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';

/**
 * UI 叠加场景
 * 与 GameScene 并行运行，负责显示 HUD、虚拟摇杆、暂停菜单等 UI 元素
 * 使用独立场景避免 UI 受游戏世界相机影响
 */
export class UIScene extends Phaser.Scene {
  private hud!: HUD;
  private joystick!: VirtualJoystick;
  private minimap!: Minimap;
  private inventoryUI!: InventoryUI;
  private pauseButton!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private uiRoot!: Phaser.GameObjects.Container;
  // EventBus 监听器取消函数（场景关闭时统一清理）
  private eventUnsubscribers: Array<() => void> = [];

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

    // 小地图（左上角，数据驱动：以后新增区域/更大地图自动适配）
    const gameScene = this.scene.get('GameScene') as any;
    const mapSize = gameScene?.getMapSize?.() || { width: 3000, height: 3000 };
    this.minimap = new Minimap(this, 10, 10, 160, 120, mapSize.width, mapSize.height);

    // 物品栏（右下角，点击或按 1-4 使用消耗品）
    this.inventoryUI = new InventoryUI(this);

    // 移动端显示虚拟摇杆（动态模式：左半屏触碰即在按下处弹出，避免固定位置误触）
    if (gm.isMobile) {
      this.joystick = new VirtualJoystick(this, 100, this.scale.height - 100, 'dynamic');
      // 绑定到 GameScene 的输入管理器
      const gameScene = this.scene.get('GameScene') as any;
      if (gameScene && gameScene.getInputManager) {
        this.joystick.setInputManager(gameScene.getInputManager());
      }
    }

    // 暂停按钮（右上角，HUD 波次信息下移让位，避免重叠）
    this.pauseButton = createUIText(this, this.scale.width - 16, 16, '⏸️', {
        fontSize: '20px',
        backgroundColor: '#1a1a25',
        padding: { left: 10, right: 10, top: 5, bottom: 5 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.pauseButton.on('pointerdown', () => {
      const gm = GameManager.getInstance();
      const pausing = !gm.isPaused;
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_PAUSE, 0.6);
      gm.setPaused(pausing);
    });

    // 按 C 打开玩家属性面板的逻辑放在 GameScene（其键盘监听可靠生效），
    // 此处不重复监听，避免双触发。

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
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      GameManager.getInstance().setPaused(false);
    });
    this.pauseOverlay.add(resumeBtn);

    // 玩家属性按钮（暂停时也可查看角色详情，方便移动端无键盘用户）
    // 与"返回主菜单"同级风格保持一致：纯文字、无 emoji、同字号同色
    // 间距由 UILayout 统一管理（60px 中心距，按钮间 20px 留白），新增按钮自动拓展
    const infoBtn = createUIText(this, width / 2, height / 2 + 60, '玩家属性', {
        fontSize: '20px',
        color: '#aaaaaa',
        backgroundColor: '#1a1a25',
        padding: { left: 30, right: 30, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    infoBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      if (this.scene.isActive('PlayerInfoScene')) return;
      // 暂停菜单中打开：prevPaused=true，关闭后回到暂停菜单
      this.scene.launch('PlayerInfoScene', { prevPaused: GameManager.getInstance().isPaused });
    });
    this.pauseOverlay.add(infoBtn);

    // 返回主菜单按钮
    const menuBtn = createUIText(this, width / 2, height / 2 + 120, '返回主菜单', {
        fontSize: '20px',
        color: '#aaaaaa',
        backgroundColor: '#1a1a25',
        padding: { left: 30, right: 30, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      // 存档由 GameScene SHUTDOWN 统一处理（saveRun + exitRun，保留进行中对局）
      // 此处不调用 endRun，否则会 clearSavedRun 导致"继续游戏"失效
      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
    this.pauseOverlay.add(menuBtn);

    // 用 UILayout 统一重排三按钮：center 起点 = 屏幕中心，垂直列、60px 中心距
    // 按钮顺序从"继续游戏"开始，逐一自动向下排布（自增长友好）
    const menuLayout = new UILayout({ x: width / 2, y: height / 2, direction: 'column', spacing: 60 });
    menuLayout.placeCentered(resumeBtn);
    menuLayout.placeCentered(infoBtn);
    menuLayout.placeCentered(menuBtn);
  }

  private setupEventListeners(): void {
    const sub = (fn: () => void) => this.eventUnsubscribers.push(fn);

    sub(EventBus.on('run:pause', (paused: boolean) => {
      this.pauseOverlay.setVisible(paused);
      this.pauseButton.setVisible(!paused);
    }));

    sub(EventBus.on('run:kill', () => {
      this.hud.update();
    }));

    sub(EventBus.on('run:wave', () => {
      this.hud.update();
    }));

    sub(EventBus.on('player:damage', () => {
      this.hud.updateHealth();
    }));

    sub(EventBus.on('player:heal', () => {
      this.hud.updateHealth();
    }));

    sub(EventBus.on('player:levelup', () => {
      this.hud.updateLevel();
    }));

    // 场景关闭时清理所有 EventBus 监听器
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.eventUnsubscribers.forEach((unsub) => unsub());
      this.eventUnsubscribers = [];
    });
  }

  update(time: number, delta: number): void {
    // 每帧更新 HUD
    this.hud.update();

    // 每帧更新小地图（玩家/敌人/Boss/地形）
    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene && this.minimap) {
      this.minimap.update(
        gameScene.getPlayer(),
        gameScene.getEnemies().getChildren(),
        gameScene.getActiveBoss(),
        gameScene.getTerrainManager()
      );
    }
  }
}
