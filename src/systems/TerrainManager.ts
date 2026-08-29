import Phaser from 'phaser';
import {
  type TerrainConfig,
  type ObstacleConfig,
  OBSTACLE_COLORS,
} from '../data/terrain';

/**
 * 地形管理器
 *
 * 职责：
 * - 消费 TerrainConfig 创建静态物理障碍物
 * - 提供障碍物数据供小地图渲染
 * - 以后扩展：可破坏物、地形效果、区域切换等
 *
 * 不负责碰撞设置（由 GameScene 统一 setupCollider），
 * 不负责玩家/敌人逻辑（保持单一职责）。
 */
export class TerrainManager {
  private scene: Phaser.Scene;
  private config: TerrainConfig;
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private obstacleList: ObstacleConfig[] = [];

  constructor(scene: Phaser.Scene, config: TerrainConfig) {
    this.scene = scene;
    this.config = config;
  }

  /** 创建所有障碍物（在 GameScene.create 中调用） */
  create(): void {
    this.obstacleGroup = this.scene.physics.add.staticGroup();

    for (const obs of this.config.obstacles) {
      const color = obs.color ?? OBSTACLE_COLORS[obs.type];
      const rect = this.scene.add
        .rectangle(obs.x, obs.y, obs.width, obs.height, color)
        .setStrokeStyle(2, 0x222222)
        .setDepth(1);

      // 加入静态物理组
      this.obstacleGroup.add(rect);
      const body = rect.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) {
        body.setSize(obs.width, obs.height);
        body.updateFromGameObject();
      }

      this.obstacleList.push(obs);
    }
  }

  /** 障碍物物理组（供 GameScene 设置碰撞） */
  getObstacleGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.obstacleGroup;
  }

  /** 障碍物配置列表（供小地图渲染轮廓） */
  getObstacles(): ObstacleConfig[] {
    return this.obstacleList;
  }

  /** 切换地形（以后新增区域时调用，会销毁旧障碍物并创建新的） */
  setTerrain(config: TerrainConfig): void {
    // 销毁旧障碍物
    this.obstacleGroup?.clear(true, true);
    this.obstacleList = [];
    this.config = config;
    this.create();
  }
}
