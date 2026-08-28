/**
 * 游戏全局配置
 * 所有可调参数集中在此，便于多端适配和平衡性调整
 */
export class GameConfig {
  // ========== 画布与渲染 ==========
  /** 逻辑分辨率宽度（设计基准） */
  static readonly GAME_WIDTH = 960;
  /** 逻辑分辨率高度（设计基准） */
  static readonly GAME_HEIGHT = 640;
  /** 背景色 */
  static readonly BG_COLOR = '#0a0a0f';
  /** 是否像素风模式 */
  static readonly PIXEL_ART = false;
  /** 物理调试模式 */
  static readonly DEBUG_PHYSICS = false;

  // ========== 玩家初始属性 ==========
  static readonly PLAYER = {
    maxHealth: 100,
    moveSpeed: 200,
    pickupRadius: 60,
    invincibleTime: 1000,
    baseAttackPower: 10,
    baseAttackSpeed: 1.0,
    baseCritRate: 0.05,
    baseCritDamage: 1.5,
  };

  // ========== 经验与升级 ==========
  static readonly LEVEL = {
    baseExp: 20,
    expGrowth: 1.5,
    maxLevel: 100,
  };

  // ========== 怪物与波次 ==========
  static readonly WAVE = {
    waveDuration: 30000,
    spawnIntervalBase: 1500,
    spawnIntervalMin: 200,
    maxEnemiesOnScreen: 200,
    bossWaveInterval: 5,
  };

  // ========== 对象池配置 ==========
  static readonly POOL = {
    bulletInitialSize: 50,
    bulletMaxSize: 300,
    enemyInitialSize: 30,
    enemyMaxSize: 250,
    particleInitialSize: 80,
    particleMaxSize: 400,
    pickupInitialSize: 30,
    pickupMaxSize: 150,
  };

  // ========== 性能分级（多端适配） ==========
  static readonly QUALITY = {
    low: {
      maxEnemies: 60,
      particleScale: 0.4,
      resolutionScale: 0.75,
      targetFPS: 30,
      enableShadows: false,
      enablePostFX: false,
    },
    medium: {
      maxEnemies: 120,
      particleScale: 0.7,
      resolutionScale: 1.0,
      targetFPS: 60,
      enableShadows: true,
      enablePostFX: false,
    },
    high: {
      maxEnemies: 200,
      particleScale: 1.0,
      resolutionScale: 1.0,
      targetFPS: 60,
      enableShadows: true,
      enablePostFX: true,
    },
  };

  // ========== 存档 ==========
  static readonly SAVE = {
    localStorageKey: 'keep_living_save_v1',
    autoSaveInterval: 10000,
    cloudSyncEnabled: false,
  };

  // ========== 输入 ==========
  static readonly INPUT = {
    joystickBaseRadius: 50,
    joystickKnobRadius: 25,
    joystickDeadZone: 0.2,
  };
}

/** 画质等级枚举 */
export type QualityLevel = 'low' | 'medium' | 'high';
