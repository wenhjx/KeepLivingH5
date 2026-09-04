import Phaser from 'phaser';
import { GameConfig } from './game/GameConfig';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { ShopScene } from './scenes/ShopScene';
import { BreakthroughScene } from './scenes/BreakthroughScene';
import { PlayerInfoScene } from './scenes/PlayerInfoScene';
import { WeaponSelectScene } from './scenes/WeaponSelectScene';
import { EndlessChoiceScene } from './scenes/EndlessChoiceScene';
import { DebugScene } from './scenes/DebugScene';
import { GameManager } from './game/GameManager';
import { initDebugAPI } from './utils/DebugAPI';

// 隐藏加载界面
const hideLoading = () => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 600);
  }
};

// 初始化游戏管理器
GameManager.getInstance().init();

/**
 * 计算渲染分辨率倍率，解决高分屏 / 大窗口画面模糊问题。
 * 游戏以逻辑分辨率(960x640)设计；canvas 内部渲染分辨率 = 逻辑 × 倍率，
 * 并配合各场景 camera.setZoom(倍率) 保持视野与物体视觉大小不变。
 * 渲染倍率 = max(1, 窗口拉伸比) × min(设备像素比, 2)，并按画质分级封顶。
 */
function computeRenderScale(): number {
  const quality = GameManager.getInstance().qualityLevel;
  const cap = GameConfig.QUALITY[quality].resolutionScale;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Phaser Scale.FIT 下 canvas 的显示放大倍数（相对逻辑分辨率）
  const fit = Math.min(
    window.innerWidth / GameConfig.GAME_WIDTH,
    window.innerHeight / GameConfig.GAME_HEIGHT
  );
  return Math.min(Math.max(fit, 1) * dpr, Math.max(1, cap));
}

// 设置全局渲染倍率（供各场景 camera.setZoom 使用）
GameConfig.renderScale = computeRenderScale();

// 渲染分辨率（内部画布像素）
const RENDER_WIDTH = Math.round(GameConfig.GAME_WIDTH * GameConfig.renderScale);
const RENDER_HEIGHT = Math.round(GameConfig.GAME_HEIGHT * GameConfig.renderScale);

// Phaser 游戏配置
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: RENDER_WIDTH,
  height: RENDER_HEIGHT,
  backgroundColor: GameConfig.BG_COLOR,
  pixelArt: GameConfig.PIXEL_ART,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
  },
  fps: {
    target: 60,
    // 关键：后台运行支持。默认 Phaser 用 requestAnimationFrame 驱动主循环，
    // 页面切走(不可见)时浏览器会停止 RAF，导致游戏时间/波次不再推进。
    // forceSetTimeOut 让主循环改用 setTimeout 驱动——后台页面仍会以低频继续
    // 执行，实现挂机/自动游玩后台持续运行；切回前台恢复满帧。
    forceSetTimeOut: true,
    // 关键：禁用 delta 平滑。Phaser 的 smoothDelta 会在页面失焦(!inFocus)或
    // delta 过大时把每帧 delta 钳制到 ~16.7ms（_target/_min），导致后台虽然
    // 主循环在跑，但游戏内时间/波次几乎不走（"数据流转但时间不动"）。
    // smoothStep=false 后 delta 直接用真实原始值——后台 1 秒/帧 → delta=1000ms，
    // 游戏时间照常推进，实现真正的后台挂机。
    smoothStep: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: GameConfig.DEBUG_PHYSICS,
    },
  },
  render: {
    antialias: !GameConfig.PIXEL_ART,
    roundPixels: GameConfig.PIXEL_ART,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, GameOverScene, UpgradeScene, WeaponSelectScene, EndlessChoiceScene, ShopScene, BreakthroughScene, PlayerInfoScene, DebugScene],
  callbacks: {
    postBoot: (game) => {
      hideLoading();
      initDebugAPI(game);
    },
  },
};

// 启动游戏
const game = new Phaser.Game(config);

// 暴露游戏实例到全局，便于调试（Boss 战验证/压力测试等通过控制台驱动）
(window as any).__game = game;

// 禁用"页面不可见/窗口失焦时自动暂停"：让游戏支持后台运行（切窗不暂停），
// 方便后台挂机/自动游玩持续进行。Phaser 3.80 已移除 disableVisibilityChange 配置。
// 关键：Phaser 的 HIDDEN/VISIBLE/BLUR/FOCUS 暂停监听是在 Game.start() 中注册的，
// 而 start() 由异步纹理加载(texturesReady)触发，所以 new Phaser.Game() 后立刻 off()
// 时机太早、监听尚未注册，导致失焦仍会暂停。这里改为等 READY 事件后再于下一 tick 移除。
// 游戏内暂停仍由 GameManager.setPaused 控制，不受影响。
game.events.once(Phaser.Core.Events.READY, () => {
  setTimeout(() => {
    game.events.off(Phaser.Core.Events.HIDDEN);
    game.events.off(Phaser.Core.Events.VISIBLE);
    game.events.off(Phaser.Core.Events.BLUR);
    game.events.off(Phaser.Core.Events.FOCUS);
  }, 0);
});