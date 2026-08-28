import type { WaveConfig, EnemyType } from '../types';

/**
 * 波次配置数据
 * 定义每波的持续时间、敌人生成表、难度系数
 */

/** 基础生成表模板 */
const BASE_SPAWN_TABLE = [
  { enemyType: 'normal' as EnemyType, weight: 100, minWave: 1 },
  { enemyType: 'fast' as EnemyType, weight: 0, minWave: 2 },
  { enemyType: 'tank' as EnemyType, weight: 0, minWave: 3 },
  { enemyType: 'ranged' as EnemyType, weight: 0, minWave: 4 },
  { enemyType: 'elite' as EnemyType, weight: 0, minWave: 6 },
];

/**
 * 生成指定波次的配置
 * 难度随波次递增
 */
export const generateWaveConfig = (wave: number): WaveConfig => {
  const difficultyMultiplier = 1 + (wave - 1) * 0.1;

  // 动态构建生成表
  const spawnTable = BASE_SPAWN_TABLE.map((entry) => {
    if (wave < entry.minWave) return { ...entry, weight: 0 };
    // 权重随波次增长
    const growth = (wave - entry.minWave + 1) * 2;
    return {
      enemyType: entry.enemyType,
      weight: entry.enemyType === 'normal' ? 100 : Math.min(50, growth),
      minWave: entry.minWave,
    };
  }).filter((e) => e.weight > 0);

  return {
    wave,
    duration: 30000, // 每波30秒
    spawnTable,
    boss: wave % 5 === 0 ? ('boss' as EnemyType) : undefined,
    difficultyMultiplier,
  };
};

/** 预生成前20波配置 */
export const WAVE_CONFIGS: WaveConfig[] = Array.from({ length: 20 }, (_, i) => generateWaveConfig(i + 1));

/** 获取指定波次配置 */
export const getWaveConfig = (wave: number): WaveConfig => {
  if (wave <= WAVE_CONFIGS.length) {
    return WAVE_CONFIGS[wave - 1];
  }
  // 超过预定义波次，动态生成
  return generateWaveConfig(wave);
};

/** 波次难度总览 */
export const WAVE_DIFFICULTY = {
  earlyGame: { minWave: 1, maxWave: 5, description: '前期：熟悉操作，基础敌人' },
  midGame: { minWave: 6, maxWave: 15, description: '中期：敌人种类增多，需要build' },
  lateGame: { minWave: 16, maxWave: 30, description: '后期：高压力，考验build完整性' },
  endless: { minWave: 31, maxWave: Infinity, description: '无尽：极限生存' },
};
