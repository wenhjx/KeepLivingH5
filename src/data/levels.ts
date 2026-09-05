import type { TerrainConfig } from './terrain';
import { DEFAULT_TERRAIN, RUINS_TERRAIN, ICE_TERRAIN } from './terrain';
import type { EnemyType } from '../types';

/**
 * 关卡化配置（数据驱动）
 *
 * 每一关 = 地形 + 敌人构成 + 特殊规则(modifier) + 关底 Boss + 直进快速开局包。
 * 以后新增区域只需：
 *   1. terrain.ts 里加一套新 TerrainConfig；
 *   2. enemies.ts 里加新敌人/Boss（可选）；
 *   3. 在本文件追加一个 LevelConfig 条目。
 * 游戏逻辑（GameScene/WaveManager/EndlessChoice）不写死关卡，全部消费本配置。
 */

/** 特殊规则 id */
export type LevelModifierId = 'thirst' | 'frostbite';

/** 特殊规则说明（ModifierSystem 消费参数 + UI 展示文案） */
export const MODIFIER_CONFIGS: Record<
  LevelModifierId,
  { name: string; desc: string; healPercent?: number; dpsPercent?: number }
> = {
  thirst: {
    name: '嗜血',
    desc: '击杀敌人时回复生命',
    healPercent: 0.02, // 每次击杀回 2% 最大生命
  },
  frostbite: {
    name: '霜蚀',
    desc: '全场持续按最大生命百分比流失生命',
    dpsPercent: 0.01, // 每秒流失 1% 最大生命
  },
};

/** 直进模式快速开局包：补偿"跳过前几关直接选关"时缺失的 build 积累 */
export interface QuickStartConfig {
  /** 初始等级（含已分配的点数，通常已折算进 statUpgrades） */
  startLevel?: number;
  /** 初始金币 */
  coins?: number;
  /** 初始武器（id 用 data/weapons.ts 的 WEAPONS 表 key，如 shotgun/machine_gun/laser） */
  weapons?: Array<{ id: string; level: number }>;
  /** 初始被动（passive_* id） */
  passives?: Array<{ id: string; level: number }>;
  /** 初始属性升级（max_hp / attack_power / crit_rate 等 stat id） */
  statUpgrades?: Array<{ id: string; level: number }>;
  /** 初始消耗品（inventory item id） */
  inventory?: Array<{ id: string; count: number }>;
}

export interface LevelConfig {
  /** 关卡 id（存档/解锁用） */
  id: string;
  /** 展示名 */
  name: string;
  /** 序号（0 起，第一关） */
  index: number;
  /** 地形 */
  terrain: TerrainConfig;
  /** 敌人血量倍率（≥1 更肉） */
  enemyHpMultiplier?: number;
  /** 敌人攻击倍率（≥1 更痛） */
  enemyDmgMultiplier?: number;
  /** 敌人构成权重倍率：相对默认 spawn 表加权（如自爆怪更多） */
  enemyOverrides?: Partial<Record<EnemyType, { weightMult?: number }>>;
  /** 特殊规则 id 列表 */
  modifiers?: LevelModifierId[];
  /** 关底 Boss 类型（ENEMY_CONFIGS 的 key） */
  bossType?: EnemyType;
  /** 直进模式快速开局包 */
  quickStart?: QuickStartConfig;
}

export const LEVELS: LevelConfig[] = [
  // ========== 第 1 关：草原（教学/建 build 关） ==========
  {
    id: 'meadow',
    name: '草原',
    index: 0,
    terrain: DEFAULT_TERRAIN,
    modifiers: [],
    bossType: 'boss',
  },
  // ========== 第 2 关：废墟（清场快节奏，嗜血） ==========
  {
    id: 'ruins',
    name: '废墟',
    index: 1,
    terrain: RUINS_TERRAIN,
    enemyHpMultiplier: 1.1,
    enemyOverrides: {
      suicider: { weightMult: 1.6 },
      splitter: { weightMult: 1.6 },
      elite: { weightMult: 1.2 },
    },
    modifiers: ['thirst'],
    bossType: 'boss_summoner',
    // 直进补偿：中等 build，能独立打过本关
    quickStart: {
      startLevel: 6,
      coins: 120,
      weapons: [{ id: 'shotgun', level: 1 }],
      passives: [{ id: 'passive_thorns', level: 1 }],
      statUpgrades: [
        { id: 'max_hp', level: 1 },
        { id: 'attack_power', level: 1 },
      ],
      inventory: [{ id: 'hp_potion', count: 1 }],
    },
  },
  // ========== 第 3 关：冰原（生存高压，霜蚀 + 减速区 + 弹幕 Boss） ==========
  {
    id: 'tundra',
    name: '冰原',
    index: 2,
    terrain: ICE_TERRAIN,
    enemyHpMultiplier: 1.3,
    enemyDmgMultiplier: 1.1,
    enemyOverrides: {
      tank: { weightMult: 1.6 },
      ranged: { weightMult: 1.5 },
      shielded: { weightMult: 1.6 },
    },
    modifiers: ['frostbite'],
    bossType: 'boss_barrage',
    // 直进补偿：更强的 build，配合霜蚀自保能力
    quickStart: {
      startLevel: 12,
      coins: 250,
      weapons: [
        { id: 'machine_gun', level: 1 },
        { id: 'laser', level: 1 },
      ],
      passives: [{ id: 'passive_regen', level: 1 }],
      statUpgrades: [
        { id: 'max_hp', level: 2 },
        { id: 'attack_power', level: 1 },
        { id: 'crit_rate', level: 1 },
      ],
      inventory: [
        { id: 'hp_potion', count: 2 },
        { id: 'rage_potion', count: 1 },
      ],
    },
  },
];

/** 按关卡 id 取配置 */
export const getLevelById = (id: string): LevelConfig | undefined =>
  LEVELS.find((l) => l.id === id);

/** 按序号取配置（越界返回最后一关） */
export const getLevelByIndex = (index: number): LevelConfig =>
  LEVELS[Math.max(0, Math.min(index, LEVELS.length - 1))];

/** 是否有下一关 */
export const hasNextLevel = (index: number): boolean => index + 1 < LEVELS.length;
