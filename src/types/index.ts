// ========== 通用类型 ==========

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ========== 实体类型 ==========

export interface EntityStats {
  maxHealth: number;
  health: number;
  moveSpeed: number;
  attackPower: number;
  attackSpeed: number;
  defense: number;
}

export interface PlayerStats extends EntityStats {
  level: number;
  exp: number;
  expToNext: number;
  critRate: number;
  critDamage: number;
  pickupRadius: number;
  luck: number;
}

export type EnemyType = 'normal' | 'fast' | 'tank' | 'ranged' | 'elite' | 'boss';

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  texture: string;
  maxHealth: number;
  moveSpeed: number;
  attackPower: number;
  attackRange: number;
  attackCooldown: number;
  expReward: number;
  scoreReward: number;
  size: number;
  color: number;
}

// ========== 武器与技能 ==========

export type WeaponType = 'melee' | 'ranged' | 'aoe' | 'summon';

export interface WeaponConfig {
  id: string;
  name: string;
  type: WeaponType;
  texture: string;
  damage: number;
  attackSpeed: number;
  range: number;
  projectileSpeed?: number;
  projectileCount?: number;
  aoeRadius?: number;
  description: string;
  maxLevel: number;
  // 行为标记
  pierce?: boolean;       // 穿透敌人
  explosive?: boolean;    // 命中后爆炸范围伤害
  boomerang?: boolean;    // 飞出后返回
  spread?: number;        // 散射角度（弧度），默认 0.3
}

export type UpgradeType = 'weapon' | 'passive' | 'stat';

export interface UpgradeOption {
  id: string;
  name: string;
  type: UpgradeType;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  effect: UpgradeEffect;
}

export interface UpgradeEffect {
  stat?: keyof PlayerStats;
  value?: number;
  isPercent?: boolean;
  weaponId?: string;
  weaponLevel?: number;
}

// ========== 波次 ==========

export interface WaveConfig {
  wave: number;
  duration: number;
  spawnTable: SpawnEntry[];
  boss?: EnemyType;
  difficultyMultiplier: number;
}

export interface SpawnEntry {
  enemyType: EnemyType;
  weight: number;
  minWave: number;
}

// ========== 拾取物 ==========

export type PickupType = 'exp' | 'health' | 'coin' | 'item' | 'chest';

export interface PickupConfig {
  type: PickupType;
  texture: string;
  value: number;
  magnetSpeed: number;
}

// ========== 存档 ==========

export interface GameSaveData {
  version: number;
  timestamp: number;
  stats: SaveStats;
  settings: SaveSettings;
  unlocked?: string[];
}

export interface SaveStats {
  totalKills: number;
  totalPlayTime: number;
  highScore: number;
  gamesPlayed: number;
}

export interface SaveSettings {
  quality: 'low' | 'medium' | 'high';
  soundVolume: number;
  musicVolume: number;
}
