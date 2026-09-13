/**
 * 波次难度曲线（纯函数，可单测）
 *
 * 小怪与 Boss 使用不同成长曲线，全项目统一从此处取值，
 * 禁止在业务模块（WaveManager / GameScene / data 表）内联公式。
 */

/** 小怪难度系数 = 1 + (wave-1)×0.1（wave 20 → ×2.9） */
export function waveDifficulty(wave: number): number {
  return 1 + (wave - 1) * 0.1;
}

/**
 * Boss 难度系数 = max(1, 1.5^((wave - interval)/interval))
 * interval 为 Boss 波间隔（GameConfig.WAVE.bossWaveInterval = 5）：
 * 第 5 波 ×1.0 / 第 10 波 ×1.5 / 第 15 波 ×2.25…，档内平滑连续成长；wave 未到首波时钳制 ×1.0
 */
export function bossDifficulty(wave: number, interval: number = 5): number {
  return Math.max(1, Math.pow(1.5, (wave - interval) / interval));
}
