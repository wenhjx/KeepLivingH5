import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';

/**
 * UI 场景统一相机设置。
 *
 * 问题背景：Phaser 相机 setZoom 以画布中心为缩放中心，zoom>1 时可视区域
 * 会偏移 (画布宽-逻辑宽)/2，导致用逻辑坐标布局的 UI 整体偏左上、底部被裁。
 * 内置浏览器窗口小（renderScale≈1）时偏移不明显，Chrome 大窗口下暴露。
 *
 * 本函数：setZoom + scroll 补偿，抵消 setZoom 的画布中心缩放偏移，
 * 使 960x640 布局区域恰好对齐视口（世界 (0,0) 显示在画布左上角），
 * 返回逻辑分辨率 960x640 供布局使用。
 *
 * 补偿量推导：画布恒为 4:3（960×renderScale × 640×renderScale），
 * cam.width/zoom 恒 = 960，故"扩展视野"不存在；(cam.width - cam.width/zoom)/2
 * 即 zoom 缩放中心偏移 (画布宽-逻辑宽)/2，必须用负 scroll 抵消，否则
 * 世界 (0,0) 落在画布 (-150,-100)，UI 整体偏左上、底部元素被裁出视口
 * （2026-09-17 桌面窗口实测：scroll=0 时标题偏左 150px、v0.2.0 被挤离底部）。
 * 此前曾误删该补偿（commit f9909eb），导致桌面端主菜单整体偏左上。
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
  // zoom 缩放中心偏移（画布宽-逻辑宽)/2，用负 scroll 抵消，使世界 (0,0) 对齐画布左上。
  cam.setScroll(-(cam.width - cam.width / zoom) / 2, -(cam.height - cam.height / zoom) / 2);
  return { width: GameConfig.GAME_WIDTH, height: GameConfig.GAME_HEIGHT };
}
