/**
 * 地形配置（数据驱动，可扩展）
 *
 * 设计原则：
 * - 地形是纯数据，TerrainManager 消费配置创建物理物体和渲染
 * - 以后新增区域/地图，只需导出新的 TerrainConfig，小地图自动支持
 * - 障碍物类型可扩展：rock（岩石，不可破坏）/ wall（墙，不可破坏）/ crate（木箱，可破坏，预留）
 */

export type ObstacleType = 'rock' | 'wall' | 'crate';

export interface ObstacleConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObstacleType;
  /** 是否可破坏（默认 false） */
  destructible?: boolean;
  /** 可破坏物的血量 */
  health?: number;
  /** 覆盖默认颜色 */
  color?: number;
}

export interface TerrainConfig {
  obstacles: ObstacleConfig[];
}

/** 障碍物类型默认颜色 */
export const OBSTACLE_COLORS: Record<ObstacleType, number> = {
  rock: 0x556677,
  wall: 0x665544,
  crate: 0x886644,
};

/**
 * 默认地形（第一区域：开阔废墟）
 * 地图 3000x3000，中心 (1500,1500) 为玩家出生点，周围留空
 * 障碍物分散分布，不堵死通路
 */
export const DEFAULT_TERRAIN: TerrainConfig = {
  obstacles: [
    // 左上区域
    { id: 'rock_01', x: 500, y: 400, width: 90, height: 90, type: 'rock' },
    { id: 'rock_02', x: 900, y: 700, width: 70, height: 110, type: 'rock' },
    { id: 'wall_01', x: 300, y: 1000, width: 200, height: 40, type: 'wall' },
    // 右上区域
    { id: 'rock_03', x: 2400, y: 500, width: 100, height: 100, type: 'rock' },
    { id: 'rock_04', x: 2100, y: 900, width: 80, height: 80, type: 'rock' },
    { id: 'wall_02', x: 2600, y: 1200, width: 40, height: 180, type: 'wall' },
    // 左下区域
    { id: 'rock_05', x: 600, y: 2200, width: 110, height: 90, type: 'rock' },
    { id: 'rock_06', x: 1000, y: 2500, width: 80, height: 120, type: 'rock' },
    { id: 'wall_03', x: 400, y: 2000, width: 160, height: 40, type: 'wall' },
    // 右下区域
    { id: 'rock_07', x: 2300, y: 2300, width: 100, height: 100, type: 'rock' },
    { id: 'rock_08', x: 2600, y: 1900, width: 90, height: 70, type: 'rock' },
    { id: 'wall_04', x: 2200, y: 2600, width: 200, height: 40, type: 'wall' },
    // 中部偏四周（避开中心出生点）
    { id: 'rock_09', x: 1500, y: 500, width: 120, height: 60, type: 'rock' },
    { id: 'rock_10', x: 1500, y: 2500, width: 120, height: 60, type: 'rock' },
    { id: 'rock_11', x: 500, y: 1500, width: 60, height: 120, type: 'rock' },
    { id: 'rock_12', x: 2500, y: 1500, width: 60, height: 120, type: 'rock' },
    // 可破坏木箱（奖励点：击破掉金币/经验/血包/宝箱，分布在中部与四区之间）
    { id: 'crate_01', x: 1150, y: 900, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'crate_02', x: 1950, y: 1150, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'crate_03', x: 1150, y: 2050, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'crate_04', x: 2050, y: 1950, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
  ],
};
