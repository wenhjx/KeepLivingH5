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
import { AchievementScene } from './scenes/AchievementScene';
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

// 真机 UI 缩放：FIT 下画布被压缩到 <0.85 时（横屏手机），整体放大 UI 到可读尺寸。
// 仅"真机横屏"触发（宽高比≥1.5，?mobile=1 桌面近方窗模拟不受影响）；上限 1.35 由最宽面板（PlayerInfo 700px）约束。
{
  const gm = GameManager.getInstance();
  const iw = window.innerWidth;
  const ih = window.innerHeight;
  if (gm.isMobile && iw > ih && iw / ih >= 1.5) {
    const canvasFit = Math.min(iw / RENDER_WIDTH, ih / RENDER_HEIGHT);
    if (canvasFit < 0.85) {
      GameConfig.uiScale = Math.min(Math.max(1 / canvasFit, 1.15), 1.35);
    }
  }
}
// URL 参数覆盖（真机参数验证用）：?uiscale=1.35 强制指定 UI 缩放，不受触发条件限制
{
  const _us = new URLSearchParams(window.location.search).get('uiscale');
  if (_us) GameConfig.uiScale = Math.min(Math.max(parseFloat(_us) || 1, 1), 1.6);
}

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
    // 后台挂机支持已摘除（2026-09-10）：forceSetTimeOut/smoothStep 的覆盖曾导致
    // 切后台击杀数不涨且主循环异常，恢复 Phaser 默认——页面不可见时游戏自动暂停。
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
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, GameOverScene, UpgradeScene, WeaponSelectScene, EndlessChoiceScene, ShopScene, BreakthroughScene, PlayerInfoScene, DebugScene, AchievementScene],
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

