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

    // 根据画质等级调整渲染参数
    const quality = gm.qualitySettings;

    // 设置像素比（移动端降低分辨率提升性能）
    if (gm.isMobile && quality.resolutionScale < 1) {
      this.scale.setZoom(1 / quality.resolutionScale);
    }

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
