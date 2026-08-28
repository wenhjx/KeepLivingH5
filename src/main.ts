import Phaser from 'phaser';
import { GameConfig } from './game/GameConfig';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { UpgradeScene } from './scenes/UpgradeScene';
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

// Phaser 游戏配置
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GameConfig.GAME_WIDTH,
  height: GameConfig.GAME_HEIGHT,
  backgroundColor: GameConfig.BG_COLOR,
  pixelArt: GameConfig.PIXEL_ART,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GameConfig.GAME_WIDTH,
    height: GameConfig.GAME_HEIGHT,
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
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, GameOverScene, UpgradeScene],
  callbacks: {
    postBoot: () => {
      hideLoading();
    },
  },
};

// 启动游戏
new Phaser.Game(config);
