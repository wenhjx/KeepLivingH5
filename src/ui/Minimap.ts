import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { TerrainManager } from '../systems/TerrainManager';

/**
 * 小地图 UI 组件
 *
 * 设计原则：
 * - 纯渲染组件，不持有游戏逻辑引用（每帧由外部传入 player/enemies/boss/terrain）
 * - 地图尺寸由构造参数决定，以后新增区域/更大地图只需改参数
 * - 用 Graphics 每帧重绘，性能足够（敌人数量 < 200）
 *
 * 显示内容：障碍物轮廓（灰）、敌人（红点）、Boss（大红点）、玩家（青色三角）
 */
export class Minimap {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private mapWidth: number;
  private mapHeight: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    mapWidth: number,
    mapHeight: number
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.graphics = scene.add.graphics().setDepth(100);
  }

  /** 每帧更新小地图 */
  update(
    player: Player,
    enemies: Phaser.GameObjects.GameObject[],
    boss: Enemy | null,
    terrainManager: TerrainManager | null
  ): void {
    const g = this.graphics;
    g.clear();

    // 背景
    g.fillStyle(0x000000, 0.65);
    g.fillRoundedRect(this.x, this.y, this.width, this.height, 4);
    g.lineStyle(1, 0x445566, 0.8);
    g.strokeRoundedRect(this.x, this.y, this.width, this.height, 4);

    const scaleX = this.width / this.mapWidth;
    const scaleY = this.height / this.mapHeight;

    // 障碍物轮廓
    if (terrainManager) {
      g.fillStyle(0x556677, 0.55);
      for (const obs of terrainManager.getObstacles()) {
        const ox = this.x + obs.x * scaleX;
        const oy = this.y + obs.y * scaleY;
        const ow = Math.max(1, obs.width * scaleX);
        const oh = Math.max(1, obs.height * scaleY);
        g.fillRect(ox - ow / 2, oy - oh / 2, ow, oh);
      }
    }

    // 敌人（红点，Boss 单独用更大的点）
    for (const e of enemies) {
      const enemy = e as Enemy;
      if (!enemy.active) continue;
      if (enemy.isBoss?.()) continue; // Boss 单独绘制
      g.fillStyle(0xff5555, 0.85);
      g.fillCircle(
        this.x + enemy.x * scaleX,
        this.y + enemy.y * scaleY,
        1.5
      );
    }

    // Boss（大红点 + 脉冲感）
    if (boss && boss.active) {
      g.fillStyle(0xff2222, 1);
      g.fillCircle(
        this.x + boss.x * scaleX,
        this.y + boss.y * scaleY,
        4
      );
    }

    // 玩家（青色三角，指向移动方向可选，先用固定三角）
    g.fillStyle(0x00ffff, 1);
    const px = this.x + player.x * scaleX;
    const py = this.y + player.y * scaleY;
    g.fillTriangle(px, py - 3, px - 2.5, py + 2, px + 2.5, py + 2);
  }

  /** 销毁 */
  destroy(): void {
    this.graphics.destroy();
  }
}
