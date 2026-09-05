/**
 * 地形配置（数据驱动，可扩展）
 *
 * 设计原则：
 * - 地形是纯数据，TerrainManager 消费配置创建物理物体和渲染
 * - 以后新增区域/地图，只需导出新的 TerrainConfig，小地图自动支持
 * - 障碍物类型可扩展：rock（岩石，不可破坏）/ wall（墙，不可破坏）/ crate（木箱，可破坏，预留）
 */

export type ObstacleType = 'rock' | 'wall' | 'crate' | 'crystal';

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

/** 减速区（冰原等特殊地形）：玩家进入后移动速度乘以 slowFactor */
export interface SlowZoneConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 减速系数（0-1，0.6 = 减速 40%） */
  slowFactor: number;
  /** 覆盖默认颜色 */
  color?: number;
}

export interface TerrainConfig {
  obstacles: ObstacleConfig[];
  /** 减速区（可选，数据驱动） */
  slowZones?: SlowZoneConfig[];
}

/** 障碍物类型默认颜色 */
export const OBSTACLE_COLORS: Record<ObstacleType, number> = {
  rock: 0x556677,
  wall: 0x665544,
  crate: 0x886644,
  crystal: 0x66ccff,
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

/** 废墟地形（第二区域）：墙体多、通道窄，考验走位与 AOE 清场 */
export const RUINS_TERRAIN: TerrainConfig = {
  obstacles: [
    // 竖向长墙，形成狭长通道（左右两片）
    { id: 'r_wall_01', x: 700, y: 500, width: 40, height: 300, type: 'wall' },
    { id: 'r_wall_02', x: 700, y: 1000, width: 40, height: 300, type: 'wall' },
    { id: 'r_wall_03', x: 2300, y: 500, width: 40, height: 300, type: 'wall' },
    { id: 'r_wall_04', x: 2300, y: 1000, width: 40, height: 300, type: 'wall' },
    { id: 'r_wall_05', x: 700, y: 2000, width: 40, height: 300, type: 'wall' },
    { id: 'r_wall_06', x: 700, y: 2500, width: 40, height: 300, type: 'wall' },
    { id: 'r_wall_07', x: 2300, y: 2000, width: 40, height: 300, type: 'wall' },
    { id: 'r_wall_08', x: 2300, y: 2500, width: 40, height: 300, type: 'wall' },
    // 横向断墙，制造"绕行"路线
    { id: 'r_wall_09', x: 1000, y: 1500, width: 260, height: 40, type: 'wall' },
    { id: 'r_wall_10', x: 1900, y: 1500, width: 260, height: 40, type: 'wall' },
    // 中部散落断壁 + 可破坏废墟（木箱）
    { id: 'r_rock_01', x: 1200, y: 700, width: 90, height: 90, type: 'rock' },
    { id: 'r_rock_02', x: 1800, y: 700, width: 90, height: 90, type: 'rock' },
    { id: 'r_rock_03', x: 1200, y: 2300, width: 90, height: 90, type: 'rock' },
    { id: 'r_rock_04', x: 1800, y: 2300, width: 90, height: 90, type: 'rock' },
    { id: 'r_crate_01', x: 1200, y: 1200, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'r_crate_02', x: 1800, y: 1200, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'r_crate_03', x: 1200, y: 1800, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'r_crate_04', x: 1800, y: 1800, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
  ],
  slowZones: [],
};

/** 冰原地形（第三区域）：水晶障碍 + 减速区，配合霜蚀规则制造生存压力 */
export const ICE_TERRAIN: TerrainConfig = {
  obstacles: [
    // 四角大片水晶群
    { id: 'i_crystal_01', x: 600, y: 600, width: 80, height: 140, type: 'crystal' },
    { id: 'i_crystal_02', x: 800, y: 400, width: 70, height: 120, type: 'crystal' },
    { id: 'i_crystal_03', x: 2400, y: 600, width: 80, height: 140, type: 'crystal' },
    { id: 'i_crystal_04', x: 2200, y: 400, width: 70, height: 120, type: 'crystal' },
    { id: 'i_crystal_05', x: 600, y: 2400, width: 80, height: 140, type: 'crystal' },
    { id: 'i_crystal_06', x: 800, y: 2600, width: 70, height: 120, type: 'crystal' },
    { id: 'i_crystal_07', x: 2400, y: 2400, width: 80, height: 140, type: 'crystal' },
    { id: 'i_crystal_08', x: 2200, y: 2600, width: 70, height: 120, type: 'crystal' },
    // 中部散落冰晶（留出出生点 1500,1500 周边空档）
    { id: 'i_crystal_09', x: 1100, y: 1100, width: 60, height: 100, type: 'crystal' },
    { id: 'i_crystal_10', x: 1900, y: 1100, width: 60, height: 100, type: 'crystal' },
    { id: 'i_crystal_11', x: 1100, y: 1900, width: 60, height: 100, type: 'crystal' },
    { id: 'i_crystal_12', x: 1900, y: 1900, width: 60, height: 100, type: 'crystal' },
    { id: 'i_crystal_13', x: 1500, y: 900, width: 70, height: 90, type: 'crystal' },
    { id: 'i_crystal_14', x: 1500, y: 2100, width: 70, height: 90, type: 'crystal' },
    // 可破坏冰晶（击破掉落）
    { id: 'i_crate_01', x: 1300, y: 1300, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'i_crate_02', x: 1700, y: 1300, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'i_crate_03', x: 1300, y: 1700, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
    { id: 'i_crate_04', x: 1700, y: 1700, width: 70, height: 70, type: 'crate', destructible: true, health: 30 },
  ],
  // 两片大面积减速区（避开出生点），踩上减速 40%
  slowZones: [
    { id: 'slow_01', x: 1000, y: 1000, width: 400, height: 400, slowFactor: 0.6, color: 0x3aa6dd },
    { id: 'slow_02', x: 1600, y: 1600, width: 400, height: 400, slowFactor: 0.6, color: 0x3aa6dd },
  ],
};
