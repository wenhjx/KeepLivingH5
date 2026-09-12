/**
 * 敌人词缀配置数据
 * 词缀 = 叠加在敌人基础行为之上的强化标签（数值/机制 + 视觉标注）。
 * 设计原则：
 *   1. 可读：词缀怪必须一眼可识别（头顶图标 + 专属 tint）
 *   2. 可应对：每个词缀都有玩家侧反制手段，不是纯数值惩罚
 *   3. 节奏感：低概率出现 + 稀有度分层，让"刷出一只词缀怪"成为情绪事件
 * 接入约定：
 *   - 普通怪只从 common/rare 池抽取（epic 留给精英怪）
 *   - Boss 不挂词缀（已有阶段机制，避免叠加过载）
 *   - 词缀怪掉落/分数加成（在 Enemy 死亡结算中按词缀稀有度加成）
 */
export type AffixRarity = 'common' | 'rare' | 'epic';

export type EnemyAffixId =
  'enrage' | 'shield' | 'swift' | 'thick' | 'split' | 'venom' | 'lifesteal' | 'explosive' | 'frost' | 'summon';

export interface AffixDef {
  id: EnemyAffixId;
  /** 中文名（图鉴/未来 UI 用） */
  name: string;
  /** 头顶图标（跟随敌人，Layers.ENTITY_TAG） */
  icon: string;
  /** 专属 tint 色（覆盖基础色，保证可读） */
  color: number;
  rarity: AffixRarity;
  /** 说明（图鉴用） */
  description: string;
  /** 攻击倍率 */
  atkMult?: number;
  /** 移速倍率 */
  speedMult?: number;
  /** 生命倍率（spawn 时应用，同时回满血） */
  hpMult?: number;
  /** 受到伤害减免（0-1，取整前应用） */
  dmgReduction?: number;
  /** 护盾 = 最大生命百分比（先于本体伤害吸收） */
  shieldPercent?: number;
  /** 死亡分裂（机制词缀） */
  splitOnDeath?: { type: string; count: number };
  /** 命中玩家施加中毒：每秒伤害 = 攻击力 × dpsMult，持续 duration(ms)，绕过无敌帧 */
  poison?: { dpsMult: number; duration: number };
  /** 命中玩家回复生命 = 造成伤害 × lifestealMult（机制词缀） */
  lifestealMult?: number;
  /** 死亡爆炸：对 radius(px) 内玩家造成攻击力 × dmgMult 伤害（机制词缀） */
  explodeOnDeath?: { radius: number; dmgMult: number };
  /** 命中玩家施加减速：移速 × factor，持续 duration(ms)（机制词缀） */
  slowOnHit?: { factor: number; duration: number };
  /** 死亡召唤：生成 type 小怪 count 只（机制词缀） */
  summonOnDeath?: { type: string; count: number };
}

export const AFFIXES: Record<EnemyAffixId, AffixDef> = {
  enrage: {
    id: 'enrage',
    name: '狂暴',
    icon: '🔥',
    color: 0xff8844,
    rarity: 'common',
    description: '攻击 ×1.2、移速 ×1.3，横冲直撞的危险分子',
    atkMult: 1.2,
    speedMult: 1.3,
  },
  shield: {
    id: 'shield',
    name: '护盾',
    icon: '🛡️',
    color: 0x44aaff,
    rarity: 'common',
    description: '额外护盾吸收 60% 最大生命值的伤害',
    shieldPercent: 0.6,
  },
  swift: {
    id: 'swift',
    name: '迅捷',
    icon: '⚡',
    color: 0x88ff44,
    rarity: 'rare',
    description: '移速 ×1.4，难以甩开',
    speedMult: 1.4,
  },
  thick: {
    id: 'thick',
    name: '厚皮',
    icon: '💪',
    color: 0xddaa44,
    rarity: 'rare',
    description: '生命 ×1.5、受到伤害 -20%',
    hpMult: 1.5,
    dmgReduction: 0.2,
  },
  split: {
    id: 'split',
    name: '分裂',
    icon: '💥',
    color: 0xcc88ff,
    rarity: 'epic',
    description: '死亡时分裂成 2 只小怪',
    splitOnDeath: { type: 'normal', count: 2 },
  },
  venom: {
    id: 'venom',
    name: '剧毒',
    icon: '☠️',
    color: 0x66ff66,
    rarity: 'epic',
    description: '命中玩家施加持续中毒（3 秒，每秒造成攻击力 8% 的伤害，无视无敌帧）',
    poison: { dpsMult: 0.08, duration: 3000 },
  },
  lifesteal: {
    id: 'lifesteal',
    name: '吸血',
    icon: '🩸',
    color: 0xdd4466,
    rarity: 'rare',
    description: '命中玩家时回复造成伤害 25% 的生命，越打越难缠',
    lifestealMult: 0.25,
  },
  explosive: {
    id: 'explosive',
    name: '爆炸',
    icon: '💣',
    color: 0xffaa44,
    rarity: 'rare',
    description: '死亡时爆炸：对 130px 内玩家造成攻击力 60% 的伤害',
    explodeOnDeath: { radius: 130, dmgMult: 0.6 },
  },
  frost: {
    id: 'frost',
    name: '冰冻',
    icon: '❄️',
    color: 0x88ddff,
    rarity: 'epic',
    description: '命中玩家减速 30%（2 秒），被黏上就难甩开',
    slowOnHit: { factor: 0.7, duration: 2000 },
  },
  summon: {
    id: 'summon',
    name: '召唤',
    icon: '🌀',
    color: 0xcc88aa,
    rarity: 'epic',
    description: '死亡时召唤 1 只冲锋怪，死了也不消停',
    summonOnDeath: { type: 'charger', count: 1 },
  },
};

/** 普通怪词缀抽取池（epic 留给精英怪，保持稀有度节奏） */
export const COMMON_AFFIX_POOL: EnemyAffixId[] = ['enrage', 'shield', 'swift', 'thick', 'lifesteal', 'explosive'];
/** 精英怪词缀池（全部，含 epic） */
export const ELITE_AFFIX_POOL: EnemyAffixId[] = [
  'enrage',
  'shield',
  'swift',
  'thick',
  'split',
  'venom',
  'lifesteal',
  'explosive',
  'frost',
  'summon',
];
