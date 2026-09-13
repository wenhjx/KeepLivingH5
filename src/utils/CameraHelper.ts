import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';

/**
 * UI 场景统一相机设置。
 *
 * 问题背景：Phaser 相机 setZoom 以画布中心为缩放中心，zoom>1 时可视区域
 * 会偏移 (画布宽-逻辑宽)/2，导致用逻辑坐标布局的 UI 整体偏左上、底部被裁。
 * 内置浏览器窗口小（renderScale≈1）时偏移不明显，Chrome 大窗口下暴露。
 *
 * 本函数：setZoom + scroll 补偿，使可视区域恰好从世界 (0,0) 开始，
 * 返回逻辑分辨率 960x640 供布局使用。
 *
 * zoom 必须等于 Phaser FIT 的 canvas 缩放比例（窗口 contain 逻辑分辨率的
 * 比例）：Math.min(innerWidth/GAME_WIDTH, innerHeight/GAME_HEIGHT)。
 * 不能用 renderScale（含 dpr）——dpr>1（如内置浏览器 1.25）时 zoom 偏大、
 * 视野缩小到不足 960x640，UI 元素错位/被裁；也不能用 create 时的 cam.width
 * （相机在 resize 前尺寸为初始 960x640，会算出 zoom=1、视野=画布尺寸）。
 *
 * 所有纯 UI 场景（MainMenu/Upgrade/GameOver/Shop/Preload 等）应调用此函数，
 * 并用返回的 width/height 布局。GameScene 相机跟随玩家，不适用；
 * UIScene 采用反向缩放根容器方案，保持独立。
 */
export function setupUICamera(scene: Phaser.Scene): { width: number; height: number } {
  const zoom = Math.min(
    window.innerWidth / GameConfig.GAME_WIDTH,
    window.innerHeight / GameConfig.GAME_HEIGHT
  );
  const canvasW = GameConfig.GAME_WIDTH * zoom;
  const canvasH = GameConfig.GAME_HEIGHT * zoom;
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  cam.setScroll(-(canvasW - GameConfig.GAME_WIDTH) / 2, -(canvasH - GameConfig.GAME_HEIGHT) / 2);
  return { width: GameConfig.GAME_WIDTH, height: GameConfig.GAME_HEIGHT };
}
