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
import { GameManager } from './game/GameManager';

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
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, GameOverScene, UpgradeScene, ShopScene],
  callbacks: {
    postBoot: () => {
      hideLoading();
    },
  },
};

// 启动游戏
new Phaser.Game(config);