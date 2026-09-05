import Phaser from 'phaser';
import {
  type TerrainConfig,
  type ObstacleConfig,
  type SlowZoneConfig,
} from '../data/terrain';
import { GameConfig } from '../game/GameConfig';

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
  private slowZoneList: SlowZoneConfig[] = [];
  private slowZoneLayer!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, config: TerrainConfig) {
    this.scene = scene;
    this.config = config;
  }

  /** 障碍物类型 → 纹理 key 映射 */
  private static readonly TEXTURE_MAP: Record<string, string> = {
    rock: 'obstacle_rock',
    wall: 'obstacle_wall',
    crate: 'obstacle_crate',
    crystal: 'obstacle_crystal',
  };

  /** 创建所有障碍物 + 减速区（在 GameScene.create 中调用） */
  create(): void {
    this.obstacleGroup = this.scene.physics.add.staticGroup();
    this.createSlowZones();

    for (const obs of this.config.obstacles) {
      const textureKey = GameConfig.themeKey(TerrainManager.TEXTURE_MAP[obs.type] || 'obstacle_rock');
      const img = this.scene.add
        .image(obs.x, obs.y, textureKey)
        .setDisplaySize(obs.width, obs.height)
        .setDepth(1);

      // 可破坏物标记（木箱）
      if (obs.destructible) {
        img.setData('destructible', true);
        img.setData('health', obs.health ?? 30);
        img.setData('obstacleId', obs.id);
      }

      // 加入静态物理组
      this.obstacleGroup.add(img);
      const body = img.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) {
        body.setSize(obs.width, obs.height);
        body.updateFromGameObject();
      }

      this.obstacleList.push(obs);
    }
  }

  /** 创建减速区：半透明色块视觉 + 数据存储（不参与物理，逻辑在 GameScene 每帧查询） */
  private createSlowZones(): void {
    this.slowZoneList = [...(this.config.slowZones ?? [])];
    this.slowZoneLayer = this.scene.add.graphics().setDepth(0.5);
    for (const z of this.slowZoneList) {
      this.slowZoneLayer.fillStyle(z.color ?? 0x3aa6dd, 0.18);
      this.slowZoneLayer.fillRect(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height);
      this.slowZoneLayer.lineStyle(1, z.color ?? 0x3aa6dd, 0.4);
      this.slowZoneLayer.strokeRect(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height);
    }
  }

  /** 查询某点所在减速区的减速系数（不在任何减速区返回 1） */
  getSlowFactorAt(x: number, y: number): number {
    for (const z of this.slowZoneList) {
      if (x > z.x - z.width / 2 && x < z.x + z.width / 2 && y > z.y - z.height / 2 && y < z.y + z.height / 2) {
        return z.slowFactor;
      }
    }
    return 1;
  }

  /** 减速区列表 */
  getSlowZones(): SlowZoneConfig[] {
    return this.slowZoneList;
  }

  /** 障碍物物理组（供 GameScene 设置碰撞） */
  getObstacleGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.obstacleGroup;
  }

  /** 障碍物配置列表（供小地图渲染轮廓） */
  getObstacles(): ObstacleConfig[] {
    return this.obstacleList;
  }

  /**
   * 可破坏障碍物（木箱）受击：扣血；血空销毁并从碰撞组/列表移除（小地图同步消失）。
   * @returns 是否被破坏（血空）
   */
  damageObstacle(img: Phaser.GameObjects.Image, damage: number): boolean {
    if (!img.getData?.('destructible')) return false;
    const hp = (img.getData('health') as number) - damage;
    img.setData('health', hp);
    if (hp > 0) return false;
    // 血空：先取 id（销毁后 data 会被清空），再从列表移除（小地图同步消失）
    const id = img.getData('obstacleId') as string;
    this.obstacleGroup.remove(img, true, true);
    if (id) {
      this.obstacleList = this.obstacleList.filter((o) => o.id !== id);
    }
    return true;
  }

  /** 切换地形（以后新增区域时调用，会销毁旧障碍物并创建新的） */
  setTerrain(config: TerrainConfig): void {
    // 销毁旧障碍物 + 减速区
    this.obstacleGroup?.clear(true, true);
    this.slowZoneLayer?.destroy();
    this.obstacleList = [];
    this.config = config;
    this.create();
  }
}
