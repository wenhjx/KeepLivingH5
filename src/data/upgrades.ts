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
  {
    id: 'weapon_nova',
    name: '环形冲击波',
    type: 'weapon',
    description: '获得环形冲击波，周期性释放全向冲击击退周围敌人',
    icon: '💥',
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
    description: '命中后伤害弹射至附近敌人（每级 +1 次，50% 伤害）',
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
    description: '攻击有概率点燃敌人持续灼烧（每级 +10%）',
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
export const getUpgradesByType = (type: string): UpgradeOption[] =>
  UPGRADE_OPTIONS.filter((u) => u.type === type);

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
      list.forEach((e: any) => {
        if (e?.active && e?.takeDamage) {
          e.takeDamage(300, false);
        }
      });
    },
  },
];
