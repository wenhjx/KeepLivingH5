import Phaser from 'phaser';
import { type TerrainConfig, type ObstacleConfig, type SlowZoneConfig, type BoostZoneConfig } from '../data/terrain';
import { GameConfig } from '../game/GameConfig';
import { Layers } from '../constants/Layers';

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
  private boostZoneList: BoostZoneConfig[] = [];
  private boostZoneLayer!: Phaser.GameObjects.Graphics;

  /** 可破坏物被击碎后的默认恢复随机区间 [min, max]（ms）：20~40 秒，防蹲守且保留偶遇感 */
  private static readonly DEFAULT_RESPAWN_RANGE: [number, number] = [20000, 40000];
  /** 待恢复的可破坏物定时任务（切图时统一清理，防止旧关木箱复活到新地图） */
  private pendingRespawns: Phaser.Time.TimerEvent[] = [];

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
    this.createBoostZones();

    for (const obs of this.config.obstacles) {
      this.spawnObstacle(obs);
    }
  }

  /** 创建单个障碍物（初始创建与击碎后恢复共用） */
  private spawnObstacle(obs: ObstacleConfig): void {
    const textureKey = GameConfig.themeKey(TerrainManager.TEXTURE_MAP[obs.type] || 'obstacle_rock');
    const img = this.scene.add
      .image(obs.x, obs.y, textureKey)
      .setDisplaySize(obs.width, obs.height)
      .setDepth(Layers.TERRAIN_BASE);

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

  /** 创建减速区：半透明色块视觉 + 数据存储（不参与物理，逻辑在 GameScene 每帧查询） */
  private createSlowZones(): void {
    this.slowZoneList = [...(this.config.slowZones ?? [])];
    this.slowZoneLayer = this.scene.add.graphics().setDepth(Layers.TERRAIN_ZONE);
    for (const z of this.slowZoneList) {
      this.slowZoneLayer.fillStyle(z.color ?? 0x3aa6dd, 0.18);
      this.slowZoneLayer.fillRect(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height);
      this.slowZoneLayer.lineStyle(1, z.color ?? 0x3aa6dd, 0.4);
      this.slowZoneLayer.strokeRect(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height);
    }
  }

  /** 创建加速区：半透明青色块 + 内部流动线条视觉（不参与物理，逻辑在 GameScene 每帧查询） */
  private createBoostZones(): void {
    this.boostZoneList = [...(this.config.boostZones ?? [])];
    this.boostZoneLayer = this.scene.add.graphics().setDepth(Layers.TERRAIN_ZONE);
    for (const z of this.boostZoneList) {
      const c = z.color ?? 0x55e6a0;
      this.boostZoneLayer.fillStyle(c, 0.28);
      this.boostZoneLayer.fillRect(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height);
      this.boostZoneLayer.lineStyle(2, c, 0.7);
      this.boostZoneLayer.strokeRect(z.x - z.width / 2, z.y - z.height / 2, z.width, z.height);
      // 内部流动线 + 箭头（沿长边方向，暗示风道方向）
      this.boostZoneLayer.lineStyle(2, c, 0.55);
      const drawFlow = (x1: number, y1: number, x2: number, y2: number, horiz: boolean) => {
        this.boostZoneLayer.lineBetween(x1, y1, x2, y2);
        // 箭头尖端（向移动方向）
        const dir = horiz ? 1 : 1;
        const ax = horiz ? x2 : x2;
        const ay = horiz ? y2 : y2;
        if (horiz) {
          this.boostZoneLayer.fillStyle(c, 0.7);
          this.boostZoneLayer.fillTriangle(ax + 8, ay, ax, ay - 5, ax, ay + 5);
          this.boostZoneLayer.lineStyle(2, c, 0.55);
        } else {
          this.boostZoneLayer.fillStyle(c, 0.7);
          this.boostZoneLayer.fillTriangle(ax, ay + 8, ax - 5, ay, ax + 5, ay);
          this.boostZoneLayer.lineStyle(2, c, 0.55);
        }
      };
      if (z.width >= z.height) {
        const y1 = z.y - z.height * 0.15,
          y2 = z.y + z.height * 0.15;
        drawFlow(z.x - z.width / 2 + 10, y1, z.x + z.width / 2 - 10, y1, true);
        drawFlow(z.x - z.width / 2 + 10, y2, z.x + z.width / 2 - 10, y2, true);
      } else {
        const x1 = z.x - z.width * 0.15,
          x2 = z.x + z.width * 0.15;
        drawFlow(x1, z.y - z.height / 2 + 10, x1, z.y + z.height / 2 - 10, false);
        drawFlow(x2, z.y - z.height / 2 + 10, x2, z.y + z.height / 2 - 10, false);
      }
    }
  }
  /**
   * 查询某点所在区域的移速系数（合并减速/加速区，重叠时减速优先：惩罚大于增益）
   * 不在任何区域返回 1
   */
  getSpeedFactorAt(x: number, y: number): number {
    for (const z of this.slowZoneList) {
      if (x > z.x - z.width / 2 && x < z.x + z.width / 2 && y > z.y - z.height / 2 && y < z.y + z.height / 2) {
        return z.slowFactor;
      }
    }
    for (const z of this.boostZoneList) {
      if (x > z.x - z.width / 2 && x < z.x + z.width / 2 && y > z.y - z.height / 2 && y < z.y + z.height / 2) {
        return z.speedFactor;
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
      // 可破坏物击碎后定时恢复（恢复前可从小地图确认已破坏）
      const obs = this.config.obstacles.find((o) => o.id === id);
      if (obs) this.scheduleRespawn(obs);
    }
    return true;
  }

  /** 调度可破坏物恢复：在配置的随机区间内取一次延迟，到点重建（防止玩家掐表蹲守） */
  private scheduleRespawn(obs: ObstacleConfig): void {
    const [min, max] = obs.respawnRange ?? TerrainManager.DEFAULT_RESPAWN_RANGE;
    const delay = min + Math.random() * (max - min);
    const timer = this.scene.time.delayedCall(delay, () => this.respawnObstacle(obs));
    this.pendingRespawns.push(timer);
  }

  /** 恢复被击碎的可破坏物：防重（已存在=已恢复或地图已切换）→ 重建物理与列表 */
  private respawnObstacle(obs: ObstacleConfig): void {
    this.pendingRespawns = this.pendingRespawns.filter((t) => !t.hasDispatched);
    // 该 id 已重新出现在列表中：说明已恢复过，或 setTerrain 换图后旧配置不再适用 → 跳过
    if (this.obstacleList.some((o) => o.id === obs.id)) return;
    this.spawnObstacle(obs);
  }

  /** 切换地形（以后新增区域时调用，会销毁旧障碍物并创建新的） */
  setTerrain(config: TerrainConfig): void {
    // 取消所有待恢复任务（防止旧关木箱复活到新地图）
    for (const t of this.pendingRespawns) t.remove(false);
    this.pendingRespawns = [];
    // 销毁旧障碍物 + 减速区
    this.obstacleGroup?.clear(true, true);
    this.slowZoneLayer?.destroy();
    this.boostZoneLayer?.destroy();
    this.obstacleList = [];
    this.config = config;
    this.create();
  }
}
