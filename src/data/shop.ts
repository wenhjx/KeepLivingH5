import { UPGRADE_OPTIONS } from './upgrades';
import { applyUpgradeToPlayer } from '../utils/UpgradeApplier';
import { FALLBACK_UPGRADES } from './upgrades';
import type { Player } from '../entities/Player';
import type { UpgradeOption } from '../types';

/**
 * 神秘商店商品数据与货架生成
 *
 * 设计目标（防"价值低 + 不能刷新"失落感）：
 * 1. 高级位保底：每次商店 4 格中有 1 格必为高价值（传说武器/复活币）
 * 2. 智能补货：缺武器优先补武器、低血量给血包、已满级/无效项不占货架
 * 3. 可刷新：1 次免费刷新 + 金币付费刷新（由 ShopScene 控制）
 */

export type ShopItemKind = 'weapon' | 'passive' | 'stat' | 'consumable';
/** 消耗品生效时机：immediate=购买即生效；onShopClose=商店关闭（Boss战开打）时生效 */
export type ConsumableTiming = 'immediate' | 'onShopClose';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  kind: ShopItemKind;
  /** 复用升级项时，对应 UPGRADE_OPTIONS 的 id（weapon/passive/stat） */
  upgradeId?: string;
  /** 消耗品生效时机（仅 consumable 有效，默认 immediate） */
  timing?: ConsumableTiming;
  /** 可主动使用的物品 id（进入物品栏，与 USABLE_ITEMS 对应） */
  itemId?: string;
  /** 消耗品类一次性效果（在 GameScene 上下文执行） */
  consumableEffect?: (player: Player, gameScene: any) => void;
}

/** 从升级池提取商品（名称/图标/描述复用） */
function fromUpgrade(upgradeId: string, kind: ShopItemKind, price: number): ShopItem {
  const opt = UPGRADE_OPTIONS.find((u) => u.id === upgradeId);
  if (!opt) {
    throw new Error(`shop: unknown upgrade id ${upgradeId}`);
  }
  return {
    id: `shop_${upgradeId}`,
    name: opt.name,
    icon: opt.icon,
    desc: opt.description,
    price,
    rarity: opt.rarity as ShopItem['rarity'],
    kind,
    upgradeId,
  };
}

// ========== 商品池 ==========

/** 武器类商品（价格档：普通 45 / 稀有 55 / 传说 80） */
const WEAPON_ITEMS: ShopItem[] = [
  fromUpgrade('weapon_shotgun', 'weapon', 45),
  fromUpgrade('weapon_machine_gun', 'weapon', 45),
  fromUpgrade('weapon_boomerang', 'weapon', 55),
  fromUpgrade('weapon_drone', 'weapon', 55),
  fromUpgrade('weapon_lightsaber', 'weapon', 55),
  fromUpgrade('weapon_rocket', 'weapon', 80),
  fromUpgrade('weapon_laser', 'weapon', 80),
];

/** 被动类商品 */
const PASSIVE_ITEMS: ShopItem[] = [
  fromUpgrade('passive_gold_boost', 'passive', 30),
  fromUpgrade('passive_exp_boost', 'passive', 35),
  fromUpgrade('passive_regen', 'passive', 35),
  fromUpgrade('passive_thorns', 'passive', 45),
];

/** 属性类商品 */
const STAT_ITEMS: ShopItem[] = [
  fromUpgrade('max_hp', 'stat', 25),
  fromUpgrade('move_speed', 'stat', 25),
  fromUpgrade('attack_power', 'stat', 35),
  fromUpgrade('attack_speed', 'stat', 35),
  fromUpgrade('crit_rate', 'stat', 35),
  fromUpgrade('crit_damage', 'stat', 40),
  fromUpgrade('pickup_radius', 'stat', 20),
  fromUpgrade('defense', 'stat', 25),
  fromUpgrade('luck', 'stat', 35),
];

/** 消耗品类（一次性） */
const CONSUMABLE_ITEMS: ShopItem[] = [
  {
    id: 'consumable_bomb',
    name: '全屏炸弹',
    icon: '💣',
    desc: '存入物品栏，使用时对全场敌人造成 500 伤害',
    price: 45,
    rarity: 'epic',
    kind: 'consumable',
    timing: 'immediate',
    itemId: 'bomb',
  },
  {
    id: 'consumable_shield',
    name: '能量护盾',
    icon: '🛡️',
    desc: '存入物品栏，使用后获得 8 秒无敌护盾',
    price: 30,
    rarity: 'rare',
    kind: 'consumable',
    timing: 'immediate',
    itemId: 'shield',
  },
  {
    id: 'consumable_rage',
    name: '狂暴药水',
    icon: '⚗️',
    desc: '存入物品栏，使用后 15 秒攻速与攻击力 +50%',
    price: 25,
    rarity: 'rare',
    kind: 'consumable',
    timing: 'immediate',
    itemId: 'rage',
  },
  {
    id: 'consumable_big_heal',
    name: '大血包',
    icon: '🍗',
    desc: '存入物品栏，使用后恢复 50% 最大生命值',
    price: 20,
    rarity: 'common',
    kind: 'consumable',
    timing: 'immediate',
    itemId: 'heal',
  },
  {
    id: 'consumable_revive',
    name: '复活币',
    icon: '🌟',
    desc: '死亡时原地满血复活一次（被动触发）',
    price: 80,
    rarity: 'legendary',
    kind: 'consumable',
    timing: 'immediate',
    consumableEffect: (player) => {
      player.addReviveToken();
    },
  },
];

/** 全部商品池 */
export const SHOP_POOL: ShopItem[] = [...WEAPON_ITEMS, ...PASSIVE_ITEMS, ...STAT_ITEMS, ...CONSUMABLE_ITEMS];

/** 高级位候选（高价值：传说武器 + 复活币） */
const HIGH_VALUE_ITEMS: ShopItem[] = [
  fromUpgrade('weapon_laser', 'weapon', 80),
  fromUpgrade('weapon_rocket', 'weapon', 80),
  fromUpgrade('weapon_boomerang', 'weapon', 55),
  fromUpgrade('weapon_drone', 'weapon', 55),
  fromUpgrade('weapon_lightsaber', 'weapon', 55),
  CONSUMABLE_ITEMS.find((c) => c.id === 'consumable_revive')!,
];

// ========== 货架生成 ==========

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 商品对当前玩家是否可买（未满级、有效） */
function isPurchasable(item: ShopItem, player: Player): boolean {
  if (item.kind === 'weapon') {
    const id = item.upgradeId?.replace('weapon_', '');
    if (id && player.isWeaponMaxLevel?.(id)) return false;
    return true;
  }
  if (item.kind === 'passive') {
    if (player.isPassiveMaxLevel?.(item.upgradeId || item.id)) return false;
    return true;
  }
  if (item.kind === 'stat') {
    // stat 属性达 maxLevel 后不再上架（防无限叠加；兜底项不在 UPGRADE_OPTIONS 中 → 永远可买）
    const opt = UPGRADE_OPTIONS.find((u) => u.id === item.upgradeId);
    if (opt?.maxLevel && player.getStatUpgradeLevel?.(item.upgradeId!) >= opt.maxLevel) return false;
    return true;
  }
  return true;
}

/** 兜底升级项转商品（全满级后补货用） */
function fromFallback(f: UpgradeOption, price: number): ShopItem {
  return {
    id: `shop_${f.id}`,
    name: f.name,
    icon: f.icon,
    desc: f.description,
    price,
    rarity: f.rarity as ShopItem['rarity'],
    kind: 'stat',
    upgradeId: f.id,
  };
}

/** 生成一货架 4 件商品（3 常规 + 1 高级位保底） */
export function generateShopStock(player: Player): ShopItem[] {
  // ---------- 高级位：优先玩家缺失的高价值武器，其次复活币 ----------
  const highPool = HIGH_VALUE_ITEMS.filter((it) => isPurchasable(it, player));
  const premium =
    shuffle(highPool).find((it) => it.kind === 'weapon' && !player.hasWeapon?.(it.upgradeId!.replace('weapon_', ''))) ||
    shuffle(highPool)[0];

  // ---------- 常规位：智能补货 ----------
  const lowHealth = player.getHealth() < player.getMaxHealth() * 0.5;
  const weaponPool = WEAPON_ITEMS.filter((it) => isPurchasable(it, player) && it.id !== premium?.id);

  const regularPool = shuffle([
    // 缺失武器加权：每个缺失武器重复出现增加选中概率
    ...weaponPool.filter((w) => !player.hasWeapon?.(w.upgradeId!.replace('weapon_', ''))),
    ...weaponPool.filter((w) => !player.hasWeapon?.(w.upgradeId!.replace('weapon_', ''))),
    ...weaponPool,
    ...PASSIVE_ITEMS.filter((it) => isPurchasable(it, player) && it.id !== premium?.id),
    ...STAT_ITEMS.filter((it) => it.id !== premium?.id),
    ...CONSUMABLE_ITEMS.filter(
      (it) => it.kind !== 'consumable' || (it.id !== premium?.id && (!lowHealth || it.id !== 'consumable_big_heal'))
    ),
    // 低血量时大血包加权
    ...(lowHealth ? [CONSUMABLE_ITEMS.find((c) => c.id === 'consumable_big_heal')!] : []),
    ...(lowHealth ? [CONSUMABLE_ITEMS.find((c) => c.id === 'consumable_big_heal')!] : []),
  ]);

  const regulars: ShopItem[] = [];
  for (const item of regularPool) {
    if (regulars.length >= 3) break;
    if (item.id === premium?.id) continue;
    if (regulars.some((r) => r.id === item.id)) continue;
    regulars.push(item);
  }

  // 常规位不足时用可购商品补齐
  const filler = shuffle(SHOP_POOL.filter((it) => isPurchasable(it, player) && !regulars.some((r) => r.id === it.id) && it.id !== premium?.id));
  for (const item of filler) {
    if (regulars.length >= 3) break;
    regulars.push(item);
  }

  // 仍不足（所有成长项满级 + 消耗品售罄）时用兜底项补位（金币袋/大治疗/狂暴/清屏，无等级不膨胀）
  if (regulars.length < 3) {
    const fallbacks = shuffle(FALLBACK_UPGRADES)
      .map((f) => fromFallback(f, 20))
      .filter((it) => !regulars.some((r) => r.id === it.id) && it.id !== premium?.id);
    for (const item of fallbacks) {
      if (regulars.length >= 3) break;
      regulars.push(item);
    }
  }

  return shuffle([premium, ...regulars].filter(Boolean));
}

/** 应用商品到玩家（购买后调用；返回是否成功） */
export function applyShopItem(player: Player, item: ShopItem, gameScene: any): void {
  if (item.kind === 'consumable') {
    item.consumableEffect?.(player, gameScene);
    return;
  }
  const opt =
    UPGRADE_OPTIONS.find((u) => u.id === item.upgradeId) ||
    FALLBACK_UPGRADES.find((f) => f.id === item.upgradeId);
  if (opt) {
    applyUpgradeToPlayer(player, opt, gameScene);
  }
}
