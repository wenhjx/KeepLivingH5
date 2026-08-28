import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { GameManager } from '../game/GameManager';
import type { Vector2 } from '../types';

/**
 * 输入管理器
 * 统一处理 PC 键鼠和移动端触屏输入，对外提供一致的输入接口
 * 上层游戏逻辑无需关心设备类型
 */
export class InputManager {
  private scene: Phaser.Scene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;

  // 移动端虚拟摇杆状态（由 UIScene 的 VirtualJoystick 设置）
  private joystickVector: Vector2 = { x: 0, y: 0 };
  private isMobile: boolean;

  // 鼠标/触摸瞄准
  private aimPointer: Vector2 = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isMobile = GameManager.getInstance().isMobile;

    if (!this.isMobile) {
      this.setupKeyboard();
      this.setupMouse();
    }
  }

  private setupKeyboard(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.wasdKeys = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  private setupMouse(): void {
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // 转换为世界坐标
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.aimPointer = { x: worldPoint.x, y: worldPoint.y };
    });
  }

  /**
   * 获取移动方向向量（归一化）
   * PC: 键盘 WASD / 方向键
   * 移动端: 虚拟摇杆
   */
  getMoveDirection(): Vector2 {
    let x = 0;
    let y = 0;

    if (this.isMobile) {
      // 移动端使用虚拟摇杆
      return { ...this.joystickVector };
    }

    // PC 键盘
    if (this.cursors) {
      if (this.cursors.left.isDown) x -= 1;
      if (this.cursors.right.isDown) x += 1;
      if (this.cursors.up.isDown) y -= 1;
      if (this.cursors.down.isDown) y += 1;
    }
    if (this.wasdKeys) {
      if (this.wasdKeys.A.isDown) x -= 1;
      if (this.wasdKeys.D.isDown) x += 1;
      if (this.wasdKeys.W.isDown) y -= 1;
      if (this.wasdKeys.S.isDown) y += 1;
    }

    // 归一化（对角线移动不加速）
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  /** 获取瞄准点（世界坐标） */
  getAimPoint(): Vector2 {
    return { ...this.aimPointer };
  }

  /** 是否按下攻击键（PC） */
  isAttackPressed(): boolean {
    if (this.isMobile) return false;
    return this.scene.input.activePointer.leftButtonDown() || this.spaceKey?.isDown || false;
  }

  /** 是否按下交互键 */
  isInteractPressed(): boolean {
    if (this.isMobile) return false;
    return this.eKey?.isDown || false;
  }

  // ========== 移动端接口（由 VirtualJoystick 调用） ==========

  /** 设置虚拟摇杆向量 */
  setJoystickVector(x: number, y: number): void {
    this.joystickVector = { x, y };
  }

  /** 重置虚拟摇杆 */
  resetJoystick(): void {
    this.joystickVector = { x: 0, y: 0 };
  }

  /** 移动端触摸攻击（由 UI 按钮调用） */
  triggerAttack(): void {
    // TODO: 移动端攻击按钮逻辑
  }

  // ========== 工具方法 ==========

  /** 是否有移动输入 */
  isMoving(): boolean {
    const dir = this.getMoveDirection();
    return dir.x !== 0 || dir.y !== 0;
  }

  /** 销毁时清理 */
  destroy(): void {
    // Phaser 会自动清理键盘事件
  }
}
