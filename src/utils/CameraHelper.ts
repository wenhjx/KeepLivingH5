import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';

/**
 * UI 场景统一相机设置。
 *
 * 问题背景：Phaser 相机 setZoom 以画布中心为缩放中心，zoom>1 时可视区域
 * 会偏移 (画布宽-逻辑宽)/2，导致用逻辑坐标布局的 UI 整体偏左上、底部被裁。
 * 内置浏览器窗口小（renderScale≈1）时偏移不明显，Chrome 大窗口下暴露。
 *
 * 本函数：setZoom + scroll 补偿，使 960x640 布局区域在扩展世界中居中
 * （世界区域 = [cam.width/zoom × cam.height/zoom]，恒 ≥ 960x640，多出部分为
 * 宽屏/竖屏的扩展视野），返回逻辑分辨率 960x640 供布局使用。
 *
 * 旧实现 scroll = -(cam.width - cam.width/zoom)/2 会把布局区整体推出视口：
 * 宽屏真机（如 16:9，世界宽 1138）时布局左侧被裁，底部/右侧元素（确认按钮、
 * 道具栏等）不可见或不可点（2026-09-15 移动端实测）。
 *
 * zoom 必须等于 renderScale（含 dpr 的渲染倍率）：相机视口基于画布内部
 * 像素（960×renderScale），只有 zoom=renderScale 时视野才恒为 960x640 世界。
 * 不能直接用 FIT 比例 min(innerW/960, innerH/640)——桌面 dpr=1 时二者相等
 * （renderScale = fit×dpr），但移动端真机 dpr>1 时 renderScale≈dpr 远大于
 * fit，若 zoom=fit 则视野 = 960×renderScale/fit，会被放大数倍（如 844×390
 * 真机视野约 3153），UI 缩成 1/3 不可读（2026-09-14 实测回归）。
 *
 * 所有纯 UI 场景（MainMenu/Upgrade/GameOver/Shop/Preload 等）应调用此函数，
 * 并用返回的 width/height 布局。GameScene 相机跟随玩家，不适用；
 * UIScene 采用反向缩放根容器方案，保持独立。
 */
export function setupUICamera(scene: Phaser.Scene): { width: number; height: number } {
  const zoom = GameConfig.renderScale;
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  // 世界区域（画布物理像素 / zoom），恒 ≥ 960x640；把多出部分左右/上下均分，
  // 让 960x640 布局区在视口中居中（4:3 时世界恰为 960x640，scroll=0 无影响）。
  const worldW = cam.width / zoom;
  const worldH = cam.height / zoom;
  cam.setScroll((worldW - GameConfig.GAME_WIDTH) / 2, (worldH - GameConfig.GAME_HEIGHT) / 2);
  return { width: GameConfig.GAME_WIDTH, height: GameConfig.GAME_HEIGHT };
}
