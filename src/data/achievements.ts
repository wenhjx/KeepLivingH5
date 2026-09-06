import type { SaveStats } from '../types';
import { WEAPONS } from './weapons';

/**
 * 成就系统数据配置（数据驱动）
 *
 * 两类成就：
 *  - 累计型：progress(stats) 从全局统计读进度，达到 target 解锁（击杀/金币/波次等）。
 *            统计字段见 SaveStats 扩展，随全局存档持久化，跨对局累计。
 *  - 单局判定型：check(payload) 在特定事件到达时判定一次（无伤通关/只用初始武器等）。
 *            payload 由 AchievementManager 在事件触发处构造（见各 check 注释）。
 *
 * 奖励：
 *  - bonuses：永久属性加成（Player 开局应用，叠加在基础值上；全成就合计保持在
 *             maxHealth+29 / attackPower+4 / critRate+10% / critDamage+10% /
 *             pickupRadius+13 / luck+4，温和不膨胀，防"未来贷款"式数值失控）。
 *  - title：称号（装饰性，显示在属性面板/结算）。
 */

export type AchievementSeries = 'survival' | 'hunt' | 'weapon' | 'wealth' | 'hidden' | 'meta';

export const ACHIEVEMENT_SERIES: Record<AchievementSeries, { name: string; color: number }> = {
  survival: { name: '生存', color: 0x44dd66 },
  hunt: { name: '猎杀', color: 0xff5544 },
  weapon: { name: '武器大师', color: 0xffaa33 },
  wealth: { name: '财迷', color: 0xffd700 },
  hidden: { name: '隐藏', color: 0xbb88ff },
  meta: { name: '里程碑', color: 0x55ccff },
};

export interface AchievementReward {
  /** 永久属性加成：stat 字段名 → 数值（如 maxHealth: 5 / critRate: 0.02） */
  bonuses?: Record<string, number>;
  /** 称号（装饰性） */
  title?: string;
}

export interface AchievementDef {
  id: string;
  series: AchievementSeries;
  name: string;
  description: string;
  icon: string;
  /** 隐藏成就：未解锁时显示"？？？" */
  hidden?: boolean;
  /** 累计型目标值 */
  target?: number;
  /** 累计型进度读取（从全局统计） */
  progress?: (s: SaveStats) => number;
  /**
   * 单局判定型条件。payload 约定：
   *  - 'run:end'：{ victory, weaponIds, maxWeaponLevel, hitThisRun, bossAlive }
   *  - 'player:coins'：{ coins }
   */
  check?: (payload: any, s: SaveStats) => boolean;
  reward: AchievementReward;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ===== 生存 =====
  {
    id: 'survive_wave_5',
    series: 'survival',
    name: '初出茅庐',
    description: '存活至第 5 波',
    icon: '🌱',
    target: 5,
    progress: (s) => s.maxWaveReached ?? 0,
    reward: { bonuses: { maxHealth: 2 } },
  },
  {
    id: 'survive_wave_10',
    series: 'survival',
    name: '渐入佳境',
    description: '存活至第 10 波',
    icon: '🔥',
    target: 10,
    progress: (s) => s.maxWaveReached ?? 0,
    reward: { bonuses: { maxHealth: 3 } },
  },
  {
    id: 'win_once',
    series: 'survival',
    name: '初战告捷',
    description: '通关任意一关',
    icon: '🏆',
    target: 1,
    progress: (s) => s.wins ?? 0,
    reward: { bonuses: { maxHealth: 4 } },
  },
  {
    id: 'win_all',
    series: 'survival',
    name: '征服三境',
    description: '通关全部 3 个关卡',
    icon: '👑',
    target: 3,
    progress: (s) => s.wins ?? 0,
    reward: { bonuses: { maxHealth: 6 } },
  },

  // ===== 猎杀 =====
  {
    id: 'kill_100',
    series: 'hunt',
    name: '小试牛刀',
    description: '累计击杀 100 只敌人',
    icon: '⚔️',
    target: 100,
    progress: (s) => s.totalKills,
    reward: { bonuses: { attackPower: 1 } },
  },
  {
    id: 'kill_500',
    series: 'hunt',
    name: '杀戮机器',
    description: '累计击杀 500 只敌人',
    icon: '🗡️',
    target: 500,
    progress: (s) => s.totalKills,
    reward: { bonuses: { attackPower: 1 } },
  },
  {
    id: 'kill_1000',
    series: 'hunt',
    name: '死神化身',
    description: '累计击杀 1000 只敌人',
    icon: '💀',
    target: 1000,
    progress: (s) => s.totalKills,
    reward: { bonuses: { attackPower: 2 } },
  },
  {
    id: 'boss_5',
    series: 'hunt',
    name: '猎王初现',
    description: '累计击杀 5 个 Boss',
    icon: '🐲',
    target: 5,
    progress: (s) => s.bossesKilled ?? 0,
    reward: { bonuses: { critRate: 0.02 } },
  },
  {
    id: 'boss_10',
    series: 'hunt',
    name: 'Boss 猎手',
    description: '累计击杀 10 个 Boss',
    icon: '🐉',
    target: 10,
    progress: (s) => s.bossesKilled ?? 0,
    reward: { bonuses: { critRate: 0.03 } },
  },

  // ===== 武器大师 =====
  {
    id: 'weapon_all',
    series: 'weapon',
    name: '军火库',
    description: '收集全部 8 种武器',
    icon: '🧰',
    target: 8,
    progress: (s) => (s.weaponsCollected ?? []).length,
    reward: { bonuses: { critRate: 0.03 } },
  },
  {
    id: 'weapon_max',
    series: 'weapon',
    name: '登峰造极',
    description: '任意武器升至满级',
    icon: '💎',
    check: (p) => (p?.maxWeaponLevel ?? 0) >= 1,
    reward: { bonuses: { critDamage: 0.1 } },
  },
  {
    id: 'starter_only',
    series: 'weapon',
    name: '初心者',
    description: '仅用初始武器通关一关',
    icon: '🔫',
    hidden: true,
    check: (p) => !!p?.victory && (p?.weaponIds ?? []).every((id: string) => id === 'default_gun') && (p?.weaponIds ?? []).length > 0,
    reward: { bonuses: { critRate: 0.02 }, title: '初心者' },
  },

  // ===== 财迷 =====
  {
    id: 'coins_500',
    series: 'wealth',
    name: '小有积蓄',
    description: '累计获得 500 金币',
    icon: '💰',
    target: 500,
    progress: (s) => s.totalCoinsEarned ?? 0,
    reward: { bonuses: { pickupRadius: 5 } },
  },
  {
    id: 'coins_2000',
    series: 'wealth',
    name: '富甲一方',
    description: '累计获得 2000 金币',
    icon: '🤑',
    target: 2000,
    progress: (s) => s.totalCoinsEarned ?? 0,
    reward: { bonuses: { pickupRadius: 8 } },
  },
  {
    id: 'hoard_300',
    series: 'wealth',
    name: '守财奴',
    description: '单局持有 300 金币',
    icon: '🪙',
    check: (p) => (p?.coins ?? 0) >= 300,
    reward: { bonuses: { luck: 2 }, title: '守财奴' },
  },
  {
    id: 'shop_500',
    series: 'wealth',
    name: '挥金如土',
    description: '商店累计消费 500 金币',
    icon: '🛒',
    target: 500,
    progress: (s) => s.totalCoinsSpent ?? 0,
    reward: { bonuses: { luck: 2 } },
  },

  // ===== 隐藏（测试用，后续可扩充） =====
  {
    id: 'hidden_90',
    series: 'hidden',
    name: '???' ,
    description: '达成条件保密',
    icon: '❓',
    hidden: true,
    target: 90,
    progress: (s) => s.maxWaveReached ?? 0,
    reward: { bonuses: { maxHealth: 8 } },
  },
  {
    id: 'hidden_nohit',
    series: 'hidden',
    name: '无伤主义者',
    description: '未受任何伤害通关一关',
    icon: '🛡️',
    hidden: true,
    check: (p) => !!p?.victory && !p?.hitThisRun,
    reward: { bonuses: { critDamage: 0.1 }, title: '无伤主义者' },
  },
  {
    id: 'hidden_bossdeath',
    series: 'hidden',
    name: '陨落者',
    description: '被 Boss 击败',
    icon: '☠️',
    hidden: true,
    check: (p) => !p?.victory && !!p?.bossAlive,
    reward: { title: '陨落者' },
  },

  // ===== 里程碑（成就的成就） =====
  {
    id: 'meta_5',
    series: 'meta',
    name: '小有成就',
    description: '解锁 5 个成就',
    icon: '⭐',
    check: (p, s) => p?.unlockedCount >= 5,
    reward: { bonuses: { maxHealth: 2 } },
  },
  {
    id: 'meta_10',
    series: 'meta',
    name: '成就达人',
    description: '解锁 10 个成就',
    icon: '🌟',
    check: (p, s) => p?.unlockedCount >= 10,
    reward: { bonuses: { maxHealth: 4 } },
  },
  {
    id: 'meta_all',
    series: 'meta',
    name: '成就猎手',
    description: '解锁全部成就',
    icon: '🏅',
    check: (p) => (p?.unlockedCount ?? 0) >= ACHIEVEMENTS.length,
    reward: { title: '成就猎手' },
  },
];

/** 按 id 取成就定义 */
export function getAchievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** 全部武器 id（用于"收集全部武器"对照；收集计数用去重后的存档列表） */
export const TOTAL_WEAPON_COUNT = Object.keys(WEAPONS).length;
