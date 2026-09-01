import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import type { InputManager } from '../systems/InputManager';

/**
 * 虚拟摇杆
 * 移动端触屏控制，支持两种模式：
 * - fixed:   固定位置（按下摇杆附近区域激活）
 * - dynamic: 动态摇杆（左半屏任意位置触碰即在按下处弹出，避免固定位置误触/触摸困难）
 */
export class VirtualJoystick {
  private scene: Phaser.Scene;
  private inputManager: InputManager | null = null;

  // 摇杆容器（统一挂载底座与旋钮，动态模式移动整体位置）
  private container!: Phaser.GameObjects.Container;
  private base!: Phaser.GameObjects.GameObject;
  private knob!: Phaser.GameObjects.GameObject;

  // 位置
  private baseX: number;
  private baseY: number;
  private baseRadius: number;
  private knobRadius: number;

  // 模式
  private mode: 'fixed' | 'dynamic';

  // 状态
  private active: boolean = false;
  private pointerId: number = -1;
  private currentAngle: number = 0;
  private currentStrength: number = 0;

  // 配置
  private readonly deadZone = GameConfig.INPUT.joystickDeadZone;

  constructor(scene: Phaser.Scene, x: number, y: number, mode: 'fixed' | 'dynamic' = 'dynamic') {
    this.scene = scene;
    this.baseX = x;
    this.baseY = y;
    this.baseRadius = GameConfig.INPUT.joystickBaseRadius;
    this.knobRadius = GameConfig.INPUT.joystickKnobRadius;
    this.mode = mode;

    this.create();
    this.setupInput();
  }

  private create(): void {
    // 容器：统一控制深度、滚动因子、可见性、位置
    this.container = this.scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // 摇杆底座（相对容器中心 0,0 绘制，整体跟随容器移动）
    const baseImg = this.scene.add.image(0, 0, 'ui_joystick_base').setAlpha(0.5).setScrollFactor(0);
    if (!baseImg.texture || baseImg.texture.key === '__MISSING') {
      baseImg.destroy();
      const baseGfx = this.scene.add.graphics().setScrollFactor(0);
      baseGfx.fillStyle(0x333344, 0.6);
      baseGfx.fillCircle(0, 0, this.baseRadius);
      baseGfx.lineStyle(2, 0x555566, 0.8);
      baseGfx.strokeCircle(0, 0, this.baseRadius);
      this.base = baseGfx;
    } else {
      this.base = baseImg;
    }

    // 摇杆旋钮
    const knobImg = this.scene.add.image(0, 0, 'ui_joystick_knob').setAlpha(0.8).setScrollFactor(0);
    if (!knobImg.texture || knobImg.texture.key === '__MISSING') {
      knobImg.destroy();
      const knobGfx = this.scene.add.graphics().setScrollFactor(0);
      knobGfx.fillStyle(0xff6b35, 0.9);
      knobGfx.fillCircle(0, 0, this.knobRadius);
      knobGfx.lineStyle(2, 0xffb347, 1);
      knobGfx.strokeCircle(0, 0, this.knobRadius);
      this.knob = knobGfx;
    } else {
      this.knob = knobImg;
    }

    this.container.add([this.base, this.knob]);

    // 初始位置
    this.setPosition(this.baseX, this.baseY);

    // 动态模式：默认隐藏，左半屏触碰时才在按下处弹出
    if (this.mode === 'dynamic') {
      this.container.setVisible(false);
    }
  }

  private setupInput(): void {
    // 监听指针按下
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.active) return;

      if (this.mode === 'dynamic') {
        // 动态模式：左半屏任意位置触碰，即在按下位置弹出摇杆
        // 注意：pointer 坐标是 world 坐标（相机 zoom 影响），需先转屏幕坐标判断左右半屏
        const cam = this.scene.cameras.main;
        const screenX = (pointer.x - cam.scrollX) * cam.zoom;
        if (screenX < this.scene.scale.width / 2) {
          this.setPosition(pointer.x, pointer.y);
          this.activate(pointer);
        }
      } else {
        // 固定模式：仅在摇杆附近区域按下激活
        const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.baseX, this.baseY);
        if (dist < this.baseRadius * 2) {
          this.activate(pointer);
        }
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
    this.container.setVisible(true);
    (this.base as any).setAlpha?.(0.8);
    (this.knob as any).setAlpha?.(1);
    this.updateKnob(pointer.x, pointer.y);
  }

  private updateKnob(pointerX: number, pointerY: number): void {
    const dx = pointerX - this.baseX;
    const dy = pointerY - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 限制摇杆在底座范围内
    const maxDist = this.baseRadius - this.knobRadius * 0.5;
    let knobDx = dx;
    let knobDy = dy;

    if (dist > maxDist) {
      const ratio = maxDist / dist;
      knobDx = dx * ratio;
      knobDy = dy * ratio;
    }

    // 旋钮相对容器中心位移（容器在 baseX/baseY）
    (this.knob as any).setPosition(knobDx, knobDy);

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
    (this.knob as any).setPosition(0, 0);
    (this.base as any).setAlpha?.(0.5);
    (this.knob as any).setAlpha?.(0.8);

    // 动态模式：松开后隐藏摇杆，等待下一次左半屏触碰
    if (this.mode === 'dynamic') {
      this.container.setVisible(false);
    }

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

  /** 设置位置（动态模式触碰时调用，自动 clamp 在屏幕内；坐标为 world 坐标） */
  setPosition(x: number, y: number): void {
    // 屏幕可见范围（world 坐标）由相机决定，clamp 摇杆底座不超出屏幕边缘
    const cam = this.scene.cameras.main;
    const topLeft = cam.getWorldPoint(0, 0);
    const bottomRight = cam.getWorldPoint(this.scene.scale.width, this.scene.scale.height);
    const minX = topLeft.x + this.baseRadius;
    const maxX = bottomRight.x - this.baseRadius;
    const minY = topLeft.y + this.baseRadius;
    const maxY = bottomRight.y - this.baseRadius;
    this.baseX = Math.max(minX, Math.min(maxX, x));
    this.baseY = Math.max(minY, Math.min(maxY, y));
    this.container.setPosition(this.baseX, this.baseY);
  }

  /** 显示/隐藏 */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /** 销毁 */
  destroy(): void {
    this.container.destroy();
  }
}
