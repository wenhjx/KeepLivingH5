import type { UpgradeOption } from '../types';

/**
 * 升级选项配置数据
 * 玩家升级时可选择的所有升级项
 */
export const UPGRADE_OPTIONS: UpgradeOption[] = [
  // ========== 属性升级 ==========
  // 说明：stat 类升级设有 maxLevel（最多可选次数），满级后从升级三选一与商店候选池移除，
  // 防止 attackPower ×1.2ⁿ / critDamage ×1.5ⁿ 无限乘算叠加导致后期数值爆炸。
  // 封顶战力：攻击力 10→24.9、爆伤 1.5→5.06、暴击率 5%→55%、攻速 1.0→2.01
  {
    id: 'max_hp',
    name: '生命强化',
    type: 'stat',
    description: '最大生命值 +20，并恢复满血',
    icon: '❤️',
    rarity: 'common',
    maxLevel: 5,
    effect: { stat: 'maxHealth', value: 20 },
  },
  {
    id: 'move_speed',
    name: '疾风步',
    type: 'stat',
    description: '移动速度 +15%',
    icon: '👟',
    rarity: 'common',
    maxLevel: 3,
    effect: { stat: 'moveSpeed', value: 0.15, isPercent: true },
  },
  {
    id: 'attack_power',
    name: '力量强化',
    type: 'stat',
    description: '攻击力 +20%',
    icon: '⚔️',
    rarity: 'rare',
    maxLevel: 5,
    effect: { stat: 'attackPower', value: 0.2, isPercent: true },
  },
  {
    id: 'attack_speed',
    name: '急速',
    type: 'stat',
    description: '攻击速度 +15%',
    icon: '⚡',
    rarity: 'rare',
    maxLevel: 5,
    effect: { stat: 'attackSpeed', value: 0.15, isPercent: true },
  },
  {
    id: 'crit_rate',
    name: '暴击精通',
    type: 'stat',
    description: '暴击率 +10%',
    icon: '🎯',
    rarity: 'rare',
    maxLevel: 5,
    effect: { stat: 'critRate', value: 0.1 },
  },
  {
    id: 'crit_damage',
    name: '致命一击',
    type: 'stat',
    description: '暴击伤害 +50%',
    icon: '💥',
    rarity: 'epic',
    maxLevel: 3,
    effect: { stat: 'critDamage', value: 0.5, isPercent: true },
  },
  {
    id: 'pickup_radius',
    name: '磁力',
    type: 'stat',
    description: '拾取范围 +30%',
    icon: '🧲',
    rarity: 'common',
    maxLevel: 5,
    effect: { stat: 'pickupRadius', value: 0.3, isPercent: true },
  },
  {
    id: 'defense',
    name: '护甲',
    type: 'stat',
    description: '防御力 +5',
    icon: '🛡️',
    rarity: 'common',
    maxLevel: 5,
    effect: { stat: 'defense', value: 5 },
  },
  {
    id: 'luck',
    name: '幸运',
    type: 'stat',
    description: '幸运值 +10（影响掉落）',
    icon: '🍀',
    rarity: 'rare',
    maxLevel: 5,
    effect: { stat: 'luck', value: 10 },
  },

  // ========== 武器升级 ==========
  {
    id: 'weapon_default_gun',
    name: '基础射击',
    type: 'weapon',
    description: '强化基础射击，伤害提升且可穿透敌人',
    icon: '🔫',
    iconTexture: 'weapon_icon_default_gun',
    rarity: 'common',
    effect: { weaponId: 'default_gun', weaponLevel: 1 },
  },
  {
    id: 'weapon_shotgun',
    name: '霰弹枪',
    type: 'weapon',
    description: '获得霰弹枪武器，近距离5发散射',
    icon: '🔫',
    iconTexture: 'weapon_icon_shotgun',
    rarity: 'rare',
    effect: { weaponId: 'shotgun', weaponLevel: 1 },
  },
  {
    id: 'weapon_machine_gun',
    name: '机枪',
    type: 'weapon',
    description: '获得机枪武器，极高射速',
    icon: '🔫',
    iconTexture: 'weapon_icon_machine_gun',
    rarity: 'rare',
    effect: { weaponId: 'machine_gun', weaponLevel: 1 },
  },
  {
    id: 'weapon_boomerang',
    name: '回旋镖',
    type: 'weapon',
    description: '获得回旋镖，可穿透敌人',
    icon: '🪃',
    iconTexture: 'weapon_icon_boomerang',
    rarity: 'epic',
    effect: { weaponId: 'boomerang', weaponLevel: 1 },
  },
  {
    id: 'weapon_drone',
    name: '无人机',
    type: 'weapon',
    description: '获得自动攻击无人机',
    icon: '🤖',
    iconTexture: 'weapon_icon_drone',
    rarity: 'epic',
    effect: { weaponId: 'drone', weaponLevel: 1 },
  },
  {
    id: 'weapon_rocket',
    name: '火箭筒',
    type: 'weapon',
    description: '获得火箭筒，范围爆炸伤害',
    icon: '🚀',
    iconTexture: 'weapon_icon_rocket',
    rarity: 'legendary',
    effect: { weaponId: 'rocket', weaponLevel: 1 },
  },
  {
    id: 'weapon_laser',
    name: '激光',
    type: 'weapon',
    description: '获得激光武器，超高速穿透',
    icon: '🔆',
    iconTexture: 'weapon_icon_laser',
    rarity: 'legendary',
    effect: { weaponId: 'laser', weaponLevel: 1 },
  },
  {
    id: 'weapon_lightsaber',
    name: '光剑',
    type: 'weapon',
    description: '获得光剑，近战范围攻击并释放穿透剑气',
    icon: '🗡️',
    iconTexture: 'weapon_icon_lightsaber',
    rarity: 'epic',
    effect: { weaponId: 'lightsaber', weaponLevel: 1 },
  },
  {
    id: 'weapon_nova',
    name: '环形冲击波',
    type: 'weapon',
    description: '获得环形冲击波，周期性释放全向冲击击退周围敌人',
    icon: '💥',
    iconTexture: 'weapon_icon_nova',
    rarity: 'epic',
    effect: { weaponId: 'nova', weaponLevel: 1 },
  },

  // ========== 被动技能 ==========
  {
    id: 'passive_regen',
    name: '生命恢复',
    type: 'passive',
    description: '每秒恢复1点生命值',
    icon: '💚',
    rarity: 'rare',
    effect: {},
  },
  {
    id: 'passive_thorns',
    name: '荆棘',
    type: 'passive',
    description: '受到攻击时反弹20%伤害',
    icon: '🌵',
    rarity: 'epic',
    effect: {},
  },
  {
    id: 'passive_exp_boost',
    name: '经验加成',
    type: 'passive',
    description: '获得经验，加成随等级提升',
    icon: '📈',
    rarity: 'rare',
    effect: {},
  },
  {
    id: 'passive_gold_boost',
    name: '金币加成',
    type: 'passive',
    description: '获得金币，加成随等级提升',
    icon: '💰',
    rarity: 'common',
    effect: {},
  },
  {
    id: 'passive_lifesteal',
    name: '吸血',
    type: 'passive',
    description: '攻击造成伤害时回复生命（每级 3%）',
    icon: '🩸',
    rarity: 'rare',
    effect: {},
  },
  {
    id: 'passive_bounce',
    name: '弹射',
    type: 'passive',
    description: '命中后伤害弹射至附近敌人（每级 +1 次，70% 伤害）',
    icon: '🪩',
    rarity: 'epic',
    maxLevel: 3,
    effect: {},
  },
  {
    id: 'passive_freeze',
    name: '冰冻',
    type: 'passive',
    description: '攻击有概率冰冻敌人减速 2 秒（每级 +8%）',
    icon: '❄️',
    rarity: 'rare',
    effect: {},
  },
  {
    id: 'passive_burn',
    name: '灼烧',
    type: 'passive',
    description: '攻击有概率点燃敌人持续灼烧（每级 +15%）',
    icon: '🔥',
    rarity: 'epic',
    effect: {},
  },
  {
    id: 'passive_chain',
    name: '闪电链',
    type: 'passive',
    description: '攻击有概率释放闪电链连锁伤害（每级 +10%）',
    icon: '⚡',
    rarity: 'epic',
    maxLevel: 3,
    effect: {},
  },
];

/**
 * 从升级三选一候选池中排除的选项 id
 * （数据仍保留在 UPGRADE_OPTIONS 中，调试面板可继续测试；只是不出现在游戏内升级选择里）
 */
export const UPGRADE_POOL_EXCLUDED: string[] = [
  // 预留：暂无不实装项。金币加成已随商店系统实装回归升级池。
];

/** 根据稀有度筛选 */
export const getUpgradesByRarity = (rarity: string): UpgradeOption[] =>
  UPGRADE_OPTIONS.filter((u) => u.rarity === rarity);

/** 根据类型筛选 */
export const getUpgradesByType = (type: string): UpgradeOption[] => UPGRADE_OPTIONS.filter((u) => u.type === type);

/**
 * 兜底升级项（所有可成长项——武器/被动/stat——全部满级后的补充）
 *
 * 设计目标：成长项满级后玩家依然"有得选、有决策"，但不重新制造数值膨胀。
 * 因此兜底项一律：无等级、即时/限时生效、不可叠加（重复选只是刷新效果，不累积属性）。
 *
 * 参考：吸血鬼幸存者满级后三选一退化为金币袋/治疗/护符等资源型保底项。
 */
export const FALLBACK_UPGRADES: UpgradeOption[] = [
  {
    id: 'fallback_coins',
    name: '金币袋',
    type: 'stat',
    description: '立即获得 50 金币',
    icon: '💰',
    rarity: 'common',
    effect: {},
    onApply: (player) => {
      player.addCoins?.(50);
    },
  },
  {
    id: 'fallback_heal',
    name: '大治疗',
    type: 'stat',
    description: '立即恢复全部生命值',
    icon: '💚',
    rarity: 'common',
    effect: {},
    onApply: (player) => {
      player.heal?.(player.getMaxHealth?.() ?? 9999);
    },
  },
  {
    id: 'fallback_rage',
    name: '狂暴药剂',
    type: 'stat',
    description: '15 秒内攻击力与攻速 +50%',
    icon: '⚗️',
    rarity: 'rare',
    effect: {},
    onApply: (player) => {
      player.applyRage?.(15000);
    },
  },
  {
    id: 'fallback_clearscreen',
    name: '清屏冲击波',
    type: 'stat',
    description: '对全场敌人造成 300 点伤害',
    icon: '💥',
    rarity: 'epic',
    effect: {},
    onApply: (_player, scene) => {
      if (!scene) return;
      // getEnemies() 返回 Phaser.Arcade.Group，须用 getChildren() 取数组（Group 无 forEach）
      const enemies = scene.getEnemies?.();
      if (!enemies) return;
      const list = enemies.getChildren() as any[];
      // 清屏伤害随波次成长（× 小怪难度系数）
      const wave = (scene as any)?.waveManager?.getCurrentWave?.() ?? 1;
      const waveFactor = 1 + (wave - 1) * 0.1;
      list.forEach((e: any) => {
        if (e?.active && e?.takeDamage) {
          e.takeDamage(300 * waveFactor, false);
        }
      });
    },
  },
];

/**
 * 按等级生成被动描述：金币/经验等数值随等级线性增长的被动，返回含当前等级的精确文案；
 * 其余升级项返回原文案（HUD 提示、升级三选一、商店卡片共用，避免静态描述与实际数值不符）。
 * 实际公式见 Player.addGold / Player.addExp / Enemy.applyPlayerEffects / Player 回血回荆棘。
 */
export function passiveDescForLevel(id: string, level: number, fallback: string): string {
  return passiveLevelTexts(id, level)?.current ?? fallback;
}

/** 被动等级化描述（current=当前级效果，next=下一级预览，无等级变化返回 null） */
export interface PassiveLevelDesc {
  current: string;
  next: string | null;
}

/** 各被动的等级效果文案（数值与代码实现一致：Player.addExp/addGold/updatePassives、Enemy.applyPlayerEffects） */
export function passiveLevelTexts(id: string, level: number): PassiveLevelDesc | null {
  switch (id) {
    case 'passive_regen':
      return { current: `每秒恢复 ${1 + level} 点生命`, next: `每秒恢复 ${2 + level} 点生命` };
    case 'passive_thorns':
      return { current: `受击反弹 ${20 + level * 5}% 伤害`, next: `受击反弹 ${25 + level * 5}% 伤害` };
    case 'passive_exp_boost':
      return { current: `获得经验 +${25 + level * 10}%`, next: `获得经验 +${35 + level * 10}%` };
    case 'passive_gold_boost':
      return { current: `获得金币 +${50 + level * 10}%`, next: `获得金币 +${60 + level * 10}%` };
    case 'passive_lifesteal':
      return { current: `攻击回复 ${level * 3}% 伤害`, next: `攻击回复 ${(level + 1) * 3}% 伤害` };
    case 'passive_freeze':
      return { current: `冰冻概率 ${level * 8}%（减速 2 秒）`, next: `冰冻概率 ${(level + 1) * 8}%（减速 2 秒）` };
    case 'passive_burn':
      return { current: `点燃概率 ${level * 15}%`, next: `点燃概率 ${(level + 1) * 15}%` };
    case 'passive_chain':
      return { current: `闪电链概率 ${level * 10}%`, next: `闪电链概率 ${(level + 1) * 10}%` };
    case 'passive_bounce':
      return { current: `弹射 ${level} 次（70% 伤害）`, next: `弹射 ${level + 1} 次（70% 伤害）` };
    default:
      return null;
  }
}
