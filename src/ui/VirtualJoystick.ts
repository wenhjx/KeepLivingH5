import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import type { InputManager } from '../systems/InputManager';

/**
 * 虚拟摇杆
 * 移动端触屏控制，支持固定位置和跟随手指两种模式
 */
export class VirtualJoystick {
  private scene: Phaser.Scene;
  private inputManager: InputManager | null = null;

  // 摇杆元素
  private base!: Phaser.GameObjects.Image;
  private knob!: Phaser.GameObjects.Image;

  // 位置
  private baseX: number;
  private baseY: number;
  private baseRadius: number;
  private knobRadius: number;

  // 状态
  private active: boolean = false;
  private pointerId: number = -1;
  private currentAngle: number = 0;
  private currentStrength: number = 0;

  // 配置
  private readonly deadZone = GameConfig.INPUT.joystickDeadZone;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.baseX = x;
    this.baseY = y;
    this.baseRadius = GameConfig.INPUT.joystickBaseRadius;
    this.knobRadius = GameConfig.INPUT.joystickKnobRadius;

    this.create();
    this.setupInput();
  }

  private create(): void {
    // 摇杆底座
    this.base = this.scene.add
      .image(this.baseX, this.baseY, 'ui_joystick_base')
      .setAlpha(0.5)
      .setDepth(200)
      .setScrollFactor(0);

    // 如果没有图片素材，用图形替代
    if (!this.base.texture || this.base.texture.key === '__MISSING') {
      this.base.destroy();
      const baseGfx = this.scene.add.graphics();
      baseGfx.fillStyle(0x333344, 0.6);
      baseGfx.fillCircle(this.baseX, this.baseY, this.baseRadius);
      baseGfx.lineStyle(2, 0x555566, 0.8);
      baseGfx.strokeCircle(this.baseX, this.baseY, this.baseRadius);
      baseGfx.setDepth(200).setScrollFactor(0);
      this.base = baseGfx as any;
    }

    // 摇杆旋钮
    this.knob = this.scene.add
      .image(this.baseX, this.baseY, 'ui_joystick_knob')
      .setAlpha(0.8)
      .setDepth(201)
      .setScrollFactor(0);

    if (!this.knob.texture || this.knob.texture.key === '__MISSING') {
      this.knob.destroy();
      const knobGfx = this.scene.add.graphics();
      knobGfx.fillStyle(0xff6b35, 0.9);
      knobGfx.fillCircle(this.baseX, this.baseY, this.knobRadius);
      knobGfx.lineStyle(2, 0xffb347, 1);
      knobGfx.strokeCircle(this.baseX, this.baseY, this.knobRadius);
      knobGfx.setDepth(201).setScrollFactor(0);
      this.knob = knobGfx as any;
    }
  }

  private setupInput(): void {
    // 监听指针按下（在摇杆区域内）
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.active) return;
      // 检查是否在摇杆区域附近按下
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.baseX, this.baseY);
      if (dist < this.baseRadius * 2) {
        this.activate(pointer);
      }
    });

    // 监听指针移动
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.active || pointer.id !== this.pointerId) return;
      this.updateKnob(pointer.x, pointer.y);
    });

    // 监听指针释放
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.active || pointer.id !== this.pointerId) return;
      this.deactivate();
    });

    this.scene.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
      if (!this.active || pointer.id !== this.pointerId) return;
      this.deactivate();
    });
  }

  private activate(pointer: Phaser.Input.Pointer): void {
    this.active = true;
    this.pointerId = pointer.id;
    this.base.setAlpha(0.8);
    this.knob.setAlpha(1);
    this.updateKnob(pointer.x, pointer.y);
  }

  private updateKnob(pointerX: number, pointerY: number): void {
    const dx = pointerX - this.baseX;
    const dy = pointerY - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 限制摇杆在底座范围内
    const maxDist = this.baseRadius - this.knobRadius * 0.5;
    let knobX = pointerX;
    let knobY = pointerY;

    if (dist > maxDist) {
      const ratio = maxDist / dist;
      knobX = this.baseX + dx * ratio;
      knobY = this.baseY + dy * ratio;
    }

    this.knob.setPosition(knobX, knobY);

    // 计算方向和强度
    this.currentAngle = Math.atan2(dy, dx);
    this.currentStrength = Math.min(1, dist / maxDist);

    // 死区处理
    if (this.currentStrength < this.deadZone) {
      this.currentStrength = 0;
    }

    // 通知输入管理器
    if (this.inputManager) {
      const moveX = Math.cos(this.currentAngle) * this.currentStrength;
      const moveY = Math.sin(this.currentAngle) * this.currentStrength;
      this.inputManager.setJoystickVector(moveX, moveY);
    }
  }

  private deactivate(): void {
    this.active = false;
    this.pointerId = -1;
    this.currentStrength = 0;
    this.knob.setPosition(this.baseX, this.baseY);
    this.base.setAlpha(0.5);
    this.knob.setAlpha(0.8);

    // 通知输入管理器重置
    this.inputManager?.resetJoystick();
  }

  // ========== 公共接口 ==========

  /** 绑定输入管理器 */
  setInputManager(manager: InputManager): void {
    this.inputManager = manager;
  }

  /** 获取摇杆方向向量（归一化） */
  getDirection(): { x: number; y: number } {
    if (this.currentStrength === 0) return { x: 0, y: 0 };
    return {
      x: Math.cos(this.currentAngle),
      y: Math.sin(this.currentAngle),
    };
  }

  /** 获取摇杆强度（0-1） */
  getStrength(): number {
    return this.currentStrength;
  }

  /** 是否激活 */
  isActive(): boolean {
    return this.active;
  }

  /** 设置位置 */
  setPosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.base.setPosition(x, y);
    this.knob.setPosition(x, y);
  }

  /** 显示/隐藏 */
  setVisible(visible: boolean): void {
    this.base.setVisible(visible);
    this.knob.setVisible(visible);
  }

  /** 销毁 */
  destroy(): void {
    this.base.destroy();
    this.knob.destroy();
  }
}
