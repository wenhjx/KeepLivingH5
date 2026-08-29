import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';

/**
 * 启动场景
 * 游戏启动后第一个运行的场景，负责初始化全局设置、检测设备
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  init(): void {
    const gm = GameManager.getInstance();

    // 注：渲染分辨率倍率已由 main.ts 统一配置（GameConfig.renderScale），
    // 并在各场景 create 中通过 camera.setZoom 补偿视觉比例，无需在此处理

    // 禁用右键菜单（防止游戏中弹出）
    this.input.mouse?.disableContextMenu();

    // 屏幕尺寸变化监听
    this.scale.on('resize', this.handleResize, this);
  }

  create(): void {
    // 跳转到预加载场景
    this.scene.start('PreloadScene');
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    // 屏幕尺寸变化时的处理（如重新布局UI）
    this.registry.set('screenWidth', gameSize.width);
    this.registry.set('screenHeight', gameSize.height);
  }
}
