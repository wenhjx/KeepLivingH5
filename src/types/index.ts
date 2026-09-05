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
  coins: number;
}

export type EnemyType = 'normal' | 'fast' | 'tank' | 'ranged' | 'elite' | 'boss' | 'suicider' | 'splitter' | 'shielded' | 'boss_summoner' | 'boss_barrage';

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
  // ===== 特殊敌人行为参数（可选） =====
  /** 自爆怪：爆炸半径（px），接近玩家该距离内自爆 */
  explodeRadius?: number;
  /** 自爆怪：爆炸伤害 */
  explodeDamage?: number;
  /** 盾牌怪：正面减伤比例（0-1，来自玩家方向的攻击减免） */
  shieldFrontReduction?: number;
  /** 分裂怪：死亡后分裂成的敌人类型与数量 */
  splitInto?: { type: EnemyType; count: number };
  /** 精英词缀（固定指定用）：enrage 狂暴 / shield 护盾 / split 分裂；不填则精英怪随机分配 */
  affix?: string;
  /** Boss 行为风格参数（type 为 boss 时生效）：差异化各技能 CD/召唤，驱动召唤型/弹幕型 Boss */
  bossTuning?: BossTuning;
}

/** Boss 行为调参（关卡差异化：召唤型 / 弹幕型 / 均衡型） */
export interface BossTuning {
  /** 行为风格标识（信息性） */
  style?: 'generic' | 'summoner' | 'barrage';
  /** 各技能基础 CD（ms），覆盖默认值 */
  ringCd?: number;
  fanCd?: number;
  homingCd?: number;
  chargeCd?: number;
  summonCd?: number;
  aoeCd?: number;
  /** 每次召唤的小怪数量（默认 2） */
  summonCount?: number;
  /** 召唤的小怪类型池（默认 normal/fast/elite） */
  summonTypes?: EnemyType[];
  /** 弹幕类技能伤害额外倍率（弹幕型强化） */
  barrageAtkMult?: number;
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
  extraProjectilesPerLevel?: number; // 每升一级额外增加的弹丸数（如霰弹枪）
  nova?: boolean;                    // 环形冲击波：360° 全向范围伤害 + 击退（被围堵时的救急脱困）
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
  /** 该升级项最多可选次数（stat 类满级后不再出现在升级/商店候选池，防止无限叠加数值爆炸） */
  maxLevel?: number;
  /** 自定义应用逻辑（兜底项等特殊效果用；优先级高于 effect，scene 为 GameScene） */
  onApply?: (player: any, scene?: any) => void;
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
  /** 进行中的对局存档（用于"继续游戏"） */
  run?: SavedRun;
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
  muted: boolean;
}

// ========== 进行中对局存档 ==========

export interface SavedRun {
  wave: number;
  score: number;
  kills: number;
  survivalTime: number;
  /** 当前关卡序号（0 起；旧存档无此字段时默认第 1 关） */
  level?: number;
  player: {
    stats: PlayerStats;
    weapons: Array<{ id: string; level: number }>;
    passives: Array<{ id: string; name: string; level: number }>;
    statUpgrades?: Array<{ id: string; name: string; level: number }>;
    /** Boss 突破奖励记录（已满级 stat 的额外成长，突破上限=原 maxLevel，受 Boss 数量硬限制） */
    breakthroughs?: Array<{ id: string; name: string; level: number }>;
    /** 背包道具（商店购买的鸡腿/护盾/炸弹等，随存档保留） */
    inventory?: Array<{ id: string; count: number }>;
  };
}
