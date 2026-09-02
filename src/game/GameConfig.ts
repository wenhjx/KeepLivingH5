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
  /** 当前渲染分辨率倍率（main.ts 启动时计算；渲染分辨率 = 逻辑分辨率 × 倍率） */
  static renderScale = 1;
  /** 背景色 */
  static readonly BG_COLOR = '#0a0a0f';
  /** 是否像素风模式（开启后：最近邻采样 + 像素对齐，边缘锐利不模糊） */
  static readonly PIXEL_ART = true;
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
  // 升级需求曲线：expToNext = floor(baseExp × level^expGrowth)
  // 采用温和的超线性(1.25)而非陡峭指数(1.5)，避免后期升级断崖：
  //   前期(1-5级)升级快速有爽感，中期平稳，后期(20级+)每级所需经验缓慢拉长但不至于卡死。
  // 参考同类割草肉鸽：Brotato 用二次多项式 (level+3)²，吸血鬼幸存者用线性增量+成长属性，
  // 社区共识是指数 1.5 会过早导致"升不动"（如 deep-yellow issue#45 即因此调低）。
  static readonly LEVEL = {
    baseExp: 20,
    expGrowth: 1.25,
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
    // 同屏敌人上限：压力测试显示 500 只仍 60fps 流畅（极端贴脸场景），
    // 800 只降到 51fps、1200 只 40fps、1500 只 32fps 开始明显卡顿
    enemyMaxSize: 500,
    particleInitialSize: 80,
    particleMaxSize: 400,
    pickupInitialSize: 30,
    pickupMaxSize: 150,
  };

  // ========== 性能分级（多端适配） ==========
  // 注：resolutionScale 表示"渲染分辨率倍率上限"（低1.25/中1.5/高2）。
  // 画布内部渲染分辨率 = 逻辑分辨率(960x640) × 渲染倍率，配合 camera zoom 补偿视觉比例
  static readonly QUALITY = {
    low: {
      maxEnemies: 60,
      particleScale: 0.4,
      resolutionScale: 1.25,
      targetFPS: 30,
      enableShadows: false,
      enablePostFX: false,
    },
    medium: {
      maxEnemies: 120,
      particleScale: 0.7,
      resolutionScale: 1.5,
      targetFPS: 60,
      enableShadows: true,
      enablePostFX: false,
    },
    high: {
      maxEnemies: 200,
      particleScale: 1.0,
      resolutionScale: 2,
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
