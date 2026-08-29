import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';

/**
 * UI 场景统一相机设置。
 *
 * 问题背景：Phaser 相机 setZoom 以画布中心为缩放中心，zoom>1 时可视区域
 * 会偏移 (画布宽-逻辑宽)/2，导致用逻辑坐标布局的 UI 整体偏左上、底部被裁。
 * 内置浏览器窗口小（renderScale≈1）时偏移不明显，Chrome 大窗口下暴露。
 *
 * 本函数：setZoom(renderScale) + scroll 补偿，使可视区域恰好从世界 (0,0)
 * 开始，返回逻辑分辨率 960x640 供布局使用。
 *
 * 所有纯 UI 场景（MainMenu/Upgrade/GameOver/Shop/Preload）应调用此函数，
 * 并用返回的 width/height 布局。GameScene 相机跟随玩家，不适用；
 * UIScene 采用反向缩放根容器方案，保持独立。
 */
export function setupUICamera(scene: Phaser.Scene): { width: number; height: number } {
  const zoom = GameConfig.renderScale;
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  cam.setScroll(
    -(cam.width - cam.width / zoom) / 2,
    -(cam.height - cam.height / zoom) / 2
  );
  return { width: GameConfig.GAME_WIDTH, height: GameConfig.GAME_HEIGHT };
}
