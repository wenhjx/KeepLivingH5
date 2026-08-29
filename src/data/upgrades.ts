import type { UpgradeOption } from '../types';

/**
 * 升级选项配置数据
 * 玩家升级时可选择的所有升级项
 */
export const UPGRADE_OPTIONS: UpgradeOption[] = [
  // ========== 属性升级 ==========
  {
    id: 'max_hp',
    name: '生命强化',
    type: 'stat',
    description: '最大生命值 +20，并恢复满血',
    icon: '❤️',
    rarity: 'common',
    effect: { stat: 'maxHealth', value: 20 },
  },
  {
    id: 'move_speed',
    name: '疾风步',
    type: 'stat',
    description: '移动速度 +15%',
    icon: '👟',
    rarity: 'common',
    effect: { stat: 'moveSpeed', value: 0.15, isPercent: true },
  },
  {
    id: 'attack_power',
    name: '力量强化',
    type: 'stat',
    description: '攻击力 +20%',
    icon: '⚔️',
    rarity: 'rare',
    effect: { stat: 'attackPower', value: 0.2, isPercent: true },
  },
  {
    id: 'attack_speed',
    name: '急速',
    type: 'stat',
    description: '攻击速度 +15%',
    icon: '⚡',
    rarity: 'rare',
    effect: { stat: 'attackSpeed', value: 0.15, isPercent: true },
  },
  {
    id: 'crit_rate',
    name: '暴击精通',
    type: 'stat',
    description: '暴击率 +10%',
    icon: '🎯',
    rarity: 'rare',
    effect: { stat: 'critRate', value: 0.1 },
  },
  {
    id: 'crit_damage',
    name: '致命一击',
    type: 'stat',
    description: '暴击伤害 +50%',
    icon: '💥',
    rarity: 'epic',
    effect: { stat: 'critDamage', value: 0.5, isPercent: true },
  },
  {
    id: 'pickup_radius',
    name: '磁力',
    type: 'stat',
    description: '拾取范围 +30%',
    icon: '🧲',
    rarity: 'common',
    effect: { stat: 'pickupRadius', value: 0.3, isPercent: true },
  },
  {
    id: 'defense',
    name: '护甲',
    type: 'stat',
    description: '防御力 +5',
    icon: '🛡️',
    rarity: 'common',
    effect: { stat: 'defense', value: 5 },
  },
  {
    id: 'luck',
    name: '幸运',
    type: 'stat',
    description: '幸运值 +10（影响掉落）',
    icon: '🍀',
    rarity: 'rare',
    effect: { stat: 'luck', value: 10 },
  },

  // ========== 武器升级 ==========
  {
    id: 'weapon_default_gun',
    name: '基础射击',
    type: 'weapon',
    description: '强化基础射击，伤害提升且可穿透敌人',
    icon: '🔫',
    rarity: 'common',
    effect: { weaponId: 'default_gun', weaponLevel: 1 },
  },
  {
    id: 'weapon_shotgun',
    name: '霰弹枪',
    type: 'weapon',
    description: '获得霰弹枪武器，近距离5发散射',
    icon: '🔫',
    rarity: 'rare',
    effect: { weaponId: 'shotgun', weaponLevel: 1 },
  },
  {
    id: 'weapon_machine_gun',
    name: '机枪',
    type: 'weapon',
    description: '获得机枪武器，极高射速',
    icon: '🔫',
    rarity: 'rare',
    effect: { weaponId: 'machine_gun', weaponLevel: 1 },
  },
  {
    id: 'weapon_boomerang',
    name: '回旋镖',
    type: 'weapon',
    description: '获得回旋镖，可穿透敌人',
    icon: '🪃',
    rarity: 'epic',
    effect: { weaponId: 'boomerang', weaponLevel: 1 },
  },
  {
    id: 'weapon_drone',
    name: '无人机',
    type: 'weapon',
    description: '获得自动攻击无人机',
    icon: '🤖',
    rarity: 'epic',
    effect: { weaponId: 'drone', weaponLevel: 1 },
  },
  {
    id: 'weapon_rocket',
    name: '火箭筒',
    type: 'weapon',
    description: '获得火箭筒，范围爆炸伤害',
    icon: '🚀',
    rarity: 'legendary',
    effect: { weaponId: 'rocket', weaponLevel: 1 },
  },
  {
    id: 'weapon_laser',
    name: '激光',
    type: 'weapon',
    description: '获得激光武器，超高速穿透',
    icon: '🔆',
    rarity: 'legendary',
    effect: { weaponId: 'laser', weaponLevel: 1 },
  },
  {
    id: 'weapon_lightsaber',
    name: '光剑',
    type: 'weapon',
    description: '获得光剑，近战范围攻击并释放穿透剑气',
    icon: '🗡️',
    rarity: 'epic',
    effect: { weaponId: 'lightsaber', weaponLevel: 1 },
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
    description: '获得经验值 +25%',
    icon: '📈',
    rarity: 'rare',
    effect: {},
  },
  {
    id: 'passive_gold_boost',
    name: '金币加成',
    type: 'passive',
    description: '获得金币 +50%',
    icon: '💰',
    rarity: 'common',
    effect: {},
  },
];

/** 根据稀有度筛选 */
export const getUpgradesByRarity = (rarity: string): UpgradeOption[] =>
  UPGRADE_OPTIONS.filter((u) => u.rarity === rarity);

/** 根据类型筛选 */
export const getUpgradesByType = (type: string): UpgradeOption[] =>
  UPGRADE_OPTIONS.filter((u) => u.type === type);
