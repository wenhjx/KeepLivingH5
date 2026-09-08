/**
 * balance-audit.ts — 静态数值审计脚本（方案 A）
 *
 * 直接复用游戏数据配置（src/data/*、src/game/GameConfig.ts），
 * 用确定性公式 + 平均假设计算各数值曲线，秒级输出：
 *   1. 敌人强度曲线（HP/攻击/移速，含波次难度 × 关卡倍率 × 全局1.3系数）
 *   2. Boss 血量曲线与击杀时间（典型 build）
 *   3. 武器 DPS 排行（含平均命中目标数假设）
 *   4. 玩家升级曲线（经验需求）
 *   5. 经济曲线（每波金币期望 vs 商店价格）
 *   6. 关卡对比（三关同波次强度差异）
 *   7. 坎检测（自动标注危险波次）
 *
 * 运行：
 *   node node_modules\esbuild\bin\esbuild scripts\balance-audit.ts --bundle --platform=node --format=esm --outfile=scripts\.audit.mjs
 *   node scripts\.audit.mjs
 * （package.json 已配 npm run audit 一键执行）
 *
 * 公式来源（与游戏源码保持一致）：
 *   - Enemy.spawn: maxHealth = base × diff × 关卡hpMult × 1.3（Enemy.ts L74）
 *   - Enemy 攻击 = base × diff × 关卡dmgMult（Enemy.ts L658/L799）；移速 = base × diff（L437）
 *   - Boss diff = 2.2^(tier-1)（WaveManager L213-214）
 *   - 普通敌人 diff = 1 + (wave-1)×0.1（WaveManager L172）
 *   - 武器伤害 = config.damage × (1+level×0.2) × attackPower/10（Player.ts L233）
 *   - 射速 cooldown = 1000/(attackSpeed × stats.attackSpeed)（Player.ts L220）
 *   - 经验需求 = floor(20 × level^1.25)（GameConfig.LEVEL）
 *   - 生成间隔 = max(200, 1500 - wave×50) ms，每次生成 1 只（WaveManager L131-139）
 *   - 金币掉落：normal 45%/3-6、fast 40%/3-5、tank 50%/4-7、ranged 35%/3-5、elite 100%/15-25、boss 100%/80-150（Enemy.ts L1008-1026）
 *
 * 平均假设（动态因素取均值，见"假设"节，可在报告头部复核）：
 *   - 命中率 70%；穿透武器平均命中 1.5-2.5 目标；AOE 平均命中 2.5-5 目标
 *   - 玩家走位损失忽略；典型 build 场景见下
 */

import { ENEMY_CONFIGS } from '../src/data/enemies';
import { WEAPONS } from '../src/data/weapons';
import { LEVELS, MODIFIER_CONFIGS } from '../src/data/levels';
import { GameConfig } from '../src/game/GameConfig';

// ============================================================
// 0. 常量与假设
// ============================================================

/** 敌人血量全局系数（Enemy.spawn 硬编码 ×1.3） */
const HP_GLOBAL_MULT = 1.3;
/** 平均命中率（单发子弹击中目标的概率，走位/射偏取均值） */
const HIT_RATE = 0.7;
/** 暴击期望系数：1 + critRate×(critDamage-1)，默认 5%/1.5 → 1.025 */
const CRIT_EXPECT = 1 + 0.05 * (1.5 - 1);
/** 每波时长（ms） */
const WAVE_DURATION = GameConfig.WAVE.waveDuration;
/** 审计采样波次 */
const WAVES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
/** Boss 波 */
const BOSS_WAVES = [5, 10, 15, 20, 25, 30, 40, 50];

/** 各武器平均命中目标数（穿透/AOE/多弹丸的均值假设，按武器特性估算） */
const WEAPON_HIT_TARGETS: Record<string, number> = {
  default_gun: 1.5, // 穿透，弹道线上平均 1.5 只
  shotgun: 3.5,     // 5 弹丸散射，近距离平均 3.5 弹丸命中
  machine_gun: 1.2, // 单发，略受穿透影响
  boomerang: 2.0,   // 往返各命中 1 只
  drone: 3.0,       // 双轨机制：接触伤害（260ms 判定）+ 自动射击（800ms），等效 3 目标命中
  lightsaber: 2.0,  // 近战 120 范围：需贴脸输出、实战兑现率低（玩家不会贴着敌群站桩），保守取 2 只；纸面满输出可到 3+
  rocket: 3.0,      // 爆炸半径 100，平均炸中 3 只
  laser: 2.5,       // 超高速穿透，弹道上平均 2.5 只
  nova: 5.0,        // 环形 180 范围，被围时平均 5 只
};

/** 典型 build 场景（坎检测用）：
 *  A=基础枪为主（新手默认成长路径）；B=激光成型（输出天花板参考） */
interface BuildSpec {
  name: string;
  weaponId: string;
  weaponLevel: number;
  attackPower: number;    // 攻击力（默认 10，力量强化 5 级 → 10×1.2^5≈24.9）
  attackSpeedMult: number; // 攻速倍率（急速 5 级 → 1.75）
  critRate: number;
  critDamage: number;
}
const BUILDS: BuildSpec[] = [
  { name: '基础枪·初期', weaponId: 'default_gun', weaponLevel: 2, attackPower: 10, attackSpeedMult: 1.0, critRate: 0.05, critDamage: 1.5 },
  { name: '基础枪·成型', weaponId: 'default_gun', weaponLevel: 8, attackPower: 24.9, attackSpeedMult: 1.75, critRate: 0.55, critDamage: 5.06 },
  { name: '激光·成型', weaponId: 'laser', weaponLevel: 6, attackPower: 24.9, attackSpeedMult: 1.75, critRate: 0.55, critDamage: 5.06 },
];

// ============================================================
// 1. 基础公式（与源码一致）
// ============================================================

const diffFor = (wave: number) => 1 + (wave - 1) * 0.1;
const bossDiffFor = (wave: number) => {
  const tier = Math.max(1, Math.floor(wave / GameConfig.WAVE.bossWaveInterval));
  return Math.pow(2.2, tier - 1);
};
const levelHpMult = (levelIdx: number) => LEVELS[levelIdx]?.enemyHpMultiplier ?? 1;
const levelDmgMult = (levelIdx: number) => LEVELS[levelIdx]?.enemyDmgMultiplier ?? 1;

/** 指定波次/关卡下某敌人的 HP（含全局 1.3） */
function enemyHp(type: string, wave: number, levelIdx = 0): number {
  const cfg = ENEMY_CONFIGS[type as keyof typeof ENEMY_CONFIGS];
  return cfg.maxHealth * diffFor(wave) * levelHpMult(levelIdx) * HP_GLOBAL_MULT;
}
/** 指定波次/关卡下某敌人的攻击力 */
function enemyAtk(type: string, wave: number, levelIdx = 0): number {
  const cfg = ENEMY_CONFIGS[type as keyof typeof ENEMY_CONFIGS];
  return cfg.attackPower * diffFor(wave) * levelDmgMult(levelIdx);
}
/** 指定波次下某敌人的移速 */
function enemySpeed(type: string, wave: number): number {
  return ENEMY_CONFIGS[type as keyof typeof ENEMY_CONFIGS].moveSpeed * diffFor(wave);
}
/** 指定波次 Boss 血量（关卡专属 Boss 类型） */
function bossHp(levelIdx: number, wave: number): number {
  const level = LEVELS[levelIdx];
  const cfg = ENEMY_CONFIGS[level.bossType as keyof typeof ENEMY_CONFIGS];
  return cfg.maxHealth * bossDiffFor(wave) * levelHpMult(levelIdx) * HP_GLOBAL_MULT;
}
/** 武器单发伤害（不含攻击力/10 与暴击，attackPower 默认 10 时 /10=1） */
function weaponBaseDmg(weaponId: string, level: number): number {
  const w = WEAPONS[weaponId];
  return w.damage * (1 + level * 0.2);
}
/** 武器 DPS（含命中目标数 × 命中率 × 暴击期望 × 攻速倍率） */
function calcWeaponDps(weaponId: string, level: number, atkPower = 10, atkSpeedMult = 1): number {
  const w = WEAPONS[weaponId];
  const perShot = weaponBaseDmg(weaponId, level) * (atkPower / 10) * CRIT_EXPECT;
  return perShot * w.attackSpeed * atkSpeedMult * (WEAPON_HIT_TARGETS[weaponId] ?? 1) * HIT_RATE;
}
/** 单波可生成敌人数（受同屏上限影响；取 medium 画质 120 上限） */
function waveSpawnCount(wave: number, maxEnemies = 120): number {
  const interval = Math.max(GameConfig.WAVE.spawnIntervalMin, GameConfig.WAVE.spawnIntervalBase - wave * 50);
  return Math.min(Math.floor(WAVE_DURATION / interval), maxEnemies);
}
/** 经验需求（GameConfig.LEVEL 曲线） */
function expToNext(level: number): number {
  return Math.floor(GameConfig.LEVEL.baseExp * Math.pow(level, GameConfig.LEVEL.expGrowth));
}
/** 指定波次平均敌人经验（normal 5×diff） */
const avgExpPerKill = (wave: number) => 6 * diffFor(wave);
/** 指定波次平均金币/只（按生成权重简单平均） */
function avgCoinsPerKill(wave: number): number {
  // 前期(≤5波)以 normal/fast 为主；中期混入 tank/ranged；后期混入 elite
  const table: Array<[number, number, number]> = [
    [0.45, 4.5, 1],  // normal chance/minmax均值
    [0.4, 4, 1],
    [0.5, 5.5, 1],
    [0.35, 4, 1],
    [1, 20, 1],
  ];
  // 简化：权重按波次渐进（normal 从 100% 递减），取期望
  const eliteW = wave >= 6 ? 0.08 : 0;
  const tankW = wave >= 3 ? 0.15 : 0;
  const rangedW = wave >= 4 ? 0.12 : 0;
  const fastW = wave >= 2 ? 0.15 : 0;
  const normalW = Math.max(0.2, 1 - eliteW - tankW - rangedW - fastW);
  return (
    normalW * 0.45 * 4.5 +
    fastW * 0.4 * 4 +
    tankW * 0.5 * 5.5 +
    rangedW * 0.35 * 4 +
    eliteW * 1 * 20
  );
}

// ============================================================
// 1b. 被动收益分析（公式与 Enemy.applyPlayerEffects 一致）
// ============================================================
/** 成型 build：基础枪 Lv8、力量5级(攻击24.9)、急速5级(攻速1.75)、双爆成型(55%/506%) */
const PASSIVE_BUILD = { attackPower: 24.9, attackSpeedMult: 1.75, critRate: 0.55, critDamage: 5.06 };
/** 单发伤害（含攻击力/10 与暴击期望） */
const passivePerHit = weaponBaseDmg('default_gun', 8) * (PASSIVE_BUILD.attackPower / 10) * (1 + PASSIVE_BUILD.critRate * (PASSIVE_BUILD.critDamage - 1));
/** 每秒命中事件（群战命中 1.5 目标 / Boss 单目标） */
const passiveEventsGroup = WEAPONS.default_gun.attackSpeed * PASSIVE_BUILD.attackSpeedMult * HIT_RATE * 1.5;
const passiveEventsSingle = WEAPONS.default_gun.attackSpeed * PASSIVE_BUILD.attackSpeedMult * HIT_RATE;
/** 邻近敌人假设：群战 5 只（弹射/闪电链最多 lv 跳，源目标外 4 跳），Boss 战 1 只（断链） */
const GROUP_ENEMIES = 5;

interface PassiveAuditRow {
  id: string;
  name: string;
  /** 1/3/5 级群战期望收益（伤害类=dps，生存类=等效值） */
  group: [number, number, number];
  /** 1/3/5 级 Boss 战期望收益 */
  boss: [number, number, number];
  note: string;
}

function calcPassiveRows(): PassiveAuditRow[] {
  const p = passivePerHit;
  const g = passiveEventsGroup;
  const s = passiveEventsSingle;
  const dotDps = (lv: number, targets: number) => (0.15 * lv) * (0.15 * lv) * p * (7 / 3) * targets;
  const bounceDps = (lv: number, events: number) => 0.7 * p * Math.min(lv, GROUP_ENEMIES - 1) * events;
  const chainDps = (lv: number, events: number) => (0.1 * lv) * 0.6 * p * Math.min(lv, GROUP_ENEMIES - 1) * events;
  const freezeE = (lv: number) => (0.08 * lv) * 0.6 * (2 / 3);
  const lifestealHps = (lv: number, events: number) => (0.03 * lv) * p * events;
  return [
    { id: 'passive_bounce', name: '弹射', group: [bounceDps(1, g), bounceDps(3, g), bounceDps(5, g)], boss: [0, 0, 0], note: '群怪爆发·Boss断链' },
    { id: 'passive_burn', name: '灼烧', group: [dotDps(1, GROUP_ENEMIES), dotDps(3, GROUP_ENEMIES), dotDps(5, GROUP_ENEMIES)], boss: [dotDps(1, 1), dotDps(3, 1), dotDps(5, 1)], note: '持续DOT·Boss战稳定' },
    { id: 'passive_chain', name: '闪电链', group: [chainDps(1, g), chainDps(3, g), chainDps(5, g)], boss: [0, 0, 0], note: '群怪爆发·Boss断链' },
    { id: 'passive_freeze', name: '冰冻', group: [freezeE(1), freezeE(3), freezeE(5)], boss: [freezeE(1), freezeE(3), freezeE(5)], note: '生存·等效减伤%' },
    { id: 'passive_lifesteal', name: '吸血', group: [lifestealHps(1, g), lifestealHps(3, g), lifestealHps(5, g)], boss: [lifestealHps(1, s), lifestealHps(3, s), lifestealHps(5, s)], note: '生存·每秒回血' },
  ];
}

// ============================================================
// 2. 输出工具
// ============================================================

const fmt = (n: number, digits = 0) =>
  n >= 100000 ? n.toExponential(1) : n.toLocaleString('zh-CN', { maximumFractionDigits: digits });

/** 生成 HTML 报告（自包含，内联 SVG，无外部依赖） */
function buildHtml(rows: {
  waves: number[];
  enemyCurves: Array<{ label: string; values: number[]; color: string }>;
  bossCurves: Array<{ label: string; values: number[] }>;
  weaponDps: Array<{ id: string; name: string; lv1: number; lv3: number; max: number; maxLevel: number }>;
  economy: Array<{ wave: number; coins: number; shopMin: number; shopMax: number }>;
  levelCurve: Array<{ level: number; exp: number }>;
  levelCompare: Array<{ wave: number; meadow: number; ruins: number; tundra: number }>;
  passiveTable: PassiveAuditRow[];
  conclusions: string[];
}): string {
  const { waves, enemyCurves, bossCurves, weaponDps, economy, levelCurve, levelCompare, passiveTable, conclusions } = rows;

  // SVG 折线图生成器（简单归一化）
  const lineChart = (series: Array<{ label: string; values: number[]; color?: string }>, w = 620, h = 220) => {
    const max = Math.max(...series.flatMap((s) => s.values), 1);
    const px = (i: number) => 40 + (i / (waves.length - 1)) * (w - 60);
    const py = (v: number) => h - 28 - (v / max) * (h - 48);
    const paths = series
      .map((s) => {
        const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
        return `<path d="${d}" fill="none" stroke="${s.color ?? '#4aa3df'}" stroke-width="2"/>`;
      })
      .join('\n');
    const labels = waves.map((wv, i) => `<text x="${px(i).toFixed(1)}" y="${h - 10}" font-size="9" text-anchor="middle" fill="#888">${wv}</text>`).join('');
    const legend = series.map((s) => `<span style="margin-right:12px;font-size:11px;color:#ccc;"><i style="display:inline-block;width:10px;height:3px;background:${s.color ?? '#4aa3df'};margin-right:4px;vertical-align:middle;"></i>${s.label}</span>`).join('');
    return `<div style="margin:8px 0;"><div style="font-size:11px;color:#888;">${legend}</div><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#10131a" rx="6"/>${paths}${labels}</svg></div>`;
  };

  const barChart = (items: Array<{ name: string; lv1: number; lv3: number; max: number }>) => {
    const max = Math.max(...items.flatMap((i) => [i.lv1, i.lv3, i.max]), 1);
    const rowsHtml = items
      .map((i) => {
        const bar = (v: number, color: string, label: string) =>
          `<div style="display:flex;align-items:center;margin:2px 0;"><div style="width:${(v / max) * 320}px;height:12px;background:${color};border-radius:2px;"></div><span style="font-size:10px;color:#aaa;margin-left:6px;min-width:70px;">${label} ${fmt(v, 1)}</span></div>`;
        return `<div style="margin:8px 0;"><div style="font-size:12px;color:#eee;margin-bottom:2px;">${i.name}</div>${bar(i.lv1, '#5b8fb0', 'Lv1')}${bar(i.lv3, '#4aa3df', 'Lv3')}${bar(i.max, '#e8a33d', `Lv${WEAPONS[i.name] ? '' : ''}满`)}</div>`;
      })
      .join('');
    return `<div style="background:#10131a;padding:10px;border-radius:6px;">${rowsHtml}</div>`;
  };

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>KEEP LIVING 数值审计报告</title></head>
<body style="margin:0;background:#0d0f14;color:#ddd;font-family:'Segoe UI',system-ui,sans-serif;">
<div style="max-width:980px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;color:#fff;margin:0 0 4px;">KEEP LIVING 数值审计报告</h1>
<p style="font-size:12px;color:#888;margin:0 0 16px;">生成时间：${new Date().toLocaleString('zh-CN')} ｜ 数据来源：src/data/* 与 GameConfig ｜ 公式见 scripts/balance-audit.ts 头部</p>

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">结论与风险提示</h2>
<ul style="font-size:12px;line-height:1.7;">${conclusions.map((c) => `<li>${c}</li>`).join('')}</ul>

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">敌人强度曲线（HP，含全局×1.3）</h2>
${lineChart(enemyCurves)}

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">Boss 血量曲线（每5波，指数 2.2^tier）</h2>
${lineChart(bossCurves.map((b, i) => ({ ...b, color: ['#e05252', '#e8a33d', '#7bd88f'][i % 3] })))}

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">武器 DPS 排行（含命中/暴击均值假设）</h2>
${barChart(weaponDps)}

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">被动收益分析（成型 build：基础枪Lv8 / 攻击24.9 / 攻速1.75 / 暴击55%·506%）</h2>
<p style="font-size:11px;color:#888;margin:6px 0;">伤害类=dps 期望；冰冻=等效敌人输出降低%；吸血=每秒回血。群战按 5 只邻近敌人、Boss 战 1 只（弹射/闪电链断链）。公式与 Enemy.applyPlayerEffects 一致。</p>
<table style="width:100%;border-collapse:collapse;font-size:12px;">
<tr style="color:#888;"><th style="text-align:left;padding:4px;">被动</th><th>群战1级</th><th>群战3级</th><th>群战5级</th><th>Boss1级</th><th>Boss5级</th><th>定位</th></tr>
${passiveTable.map((r) => '<tr style="border-top:1px solid #223;"><td style="padding:4px;color:#eee;">' + r.name + '</td><td style="text-align:right;">' + fmt(r.group[0]) + '</td><td style="text-align:right;">' + fmt(r.group[1]) + '</td><td style="text-align:right;color:#e8a33d;">' + fmt(r.group[2]) + '</td><td style="text-align:right;">' + fmt(r.boss[0]) + '</td><td style="text-align:right;color:#e8a33d;">' + fmt(r.boss[2]) + '</td><td style="color:#888;">' + r.note + '</td></tr>').join('')}
</table>

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">升级经验曲线（expToNext = 20×L^1.25）</h2>
${lineChart([{ label: '每级所需经验', values: levelCurve.map((l) => l.exp) }])}

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">经济曲线（每波金币期望 vs 商店价格区间）</h2>
${lineChart([
  { label: '每波金币收入', values: economy.map((e) => e.coins), color: '#e8c33d' },
  { label: '商店最低价', values: economy.map((e) => e.shopMin), color: '#5b8fb0' },
  { label: '商店最高价(传说)', values: economy.map((e) => e.shopMax), color: '#e05252' },
])}

<h2 style="font-size:15px;color:#4aa3df;border-bottom:1px solid #223;padding-bottom:4px;">关卡对比（同波次普通敌人总强度，草原=1）</h2>
${lineChart([
  { label: '草原', values: levelCompare.map((c) => c.meadow), color: '#7bd88f' },
  { label: '废墟(×1.1+嗜血)', values: levelCompare.map((c) => c.ruins), color: '#e8a33d' },
  { label: '冰原(×1.3+霜蚀)', values: levelCompare.map((c) => c.tundra), color: '#6db3f2' },
])}

<h2 style="font-size:13px;color:#888;">假设说明</h2>
<ul style="font-size:11px;color:#888;line-height:1.6;">
<li>命中率 70%；穿透/AOE 按武器特性取平均命中目标数（见脚本 WEAPON_HIT_TARGETS）</li>
<li>暴击按默认 5%/1.5 折算期望系数 1.025；典型 build 用各自暴击参数</li>
<li>金币期望按波次权重近似（elite/tank/ranged/fast/normal 占比渐进）</li>
<li>同屏敌人上限按 medium 画质 120 只估算</li>
</ul>
</div></body></html>`;
}

// ============================================================
// 3. 计算主体
// ============================================================

function main(): void {
  const enemyCurves: Array<{ label: string; values: number[]; color: string }> = [];
  const types = ['normal', 'fast', 'tank', 'ranged', 'elite', 'suicider', 'splitter', 'shielded'];
  const typeColors = ['#7bd88f', '#6db3f2', '#e8a33d', '#b78be8', '#e05252', '#ff8855', '#cc55ff', '#88bbff'];
  types.forEach((t, i) => {
    enemyCurves.push({
      label: `${ENEMY_CONFIGS[t].name}(${t})`,
      values: WAVES.map((w) => enemyHp(t, w)),
      color: typeColors[i],
    });
  });

  const bossCurves = LEVELS.map((lv, idx) => ({
    label: `${lv.name}·${ENEMY_CONFIGS[lv.bossType as keyof typeof ENEMY_CONFIGS].name}`,
    values: BOSS_WAVES.map((w) => bossHp(idx, w)),
  }));

  const weaponDpsTable = Object.keys(WEAPONS).map((id) => {
    const w = WEAPONS[id];
    return {
      id,
      name: w.name,
      lv1: calcWeaponDps(id, 1),
      lv3: calcWeaponDps(id, 3),
      max: calcWeaponDps(id, w.maxLevel),
      maxLevel: w.maxLevel,
    };
  });

  const levelCurve = Array.from({ length: 30 }, (_, i) => ({ level: i + 1, exp: expToNext(i + 1) }));

  const passiveRows = calcPassiveRows();

  // 经济：每波击杀数（假设清怪效率足以清完生成量 → 用生成数 × 击杀率0.9）
  const economy = WAVES.map((w) => {
    const kills = waveSpawnCount(w) * 0.9;
    return { wave: w, coins: Math.round(kills * avgCoinsPerKill(w)), shopMin: 20, shopMax: 80 };
  });

  // 关卡对比：普通敌人 HP 之比
  const levelCompare = WAVES.map((w) => ({
    wave: w,
    meadow: enemyHp('normal', w, 0),
    ruins: enemyHp('normal', w, 1),
    tundra: enemyHp('normal', w, 2),
  }));

  // ===== 坎检测 =====
  const conclusions: string[] = [];
  // 1) Boss 击杀时间（跨波机制：Boss 波结束不清怪，可带 Boss 打多波；按"需扛几波"评估）
  BUILDS.forEach((b) => {
    const dps = calcWeaponDps(b.weaponId, b.weaponLevel, b.attackPower, b.attackSpeedMult) * (1 + b.critRate * (b.critDamage - 1)) / CRIT_EXPECT;
    BOSS_WAVES.forEach((w) => {
      const hp = bossHp(0, w); // 草原 Boss
      const secs = hp / dps;
      const wavesNeeded = Math.ceil(secs / (WAVE_DURATION / 1000));
      if (wavesNeeded >= 3) conclusions.push(`⚠️ 草原 ${w} 波 Boss（${fmt(hp)} 血）用「${b.name}」需 ${fmt(secs, 0)}s ≈ ${wavesNeeded} 波才能击杀——要长时间承受 Boss 火力，配合召唤/弹幕压力大`);
      else if (wavesNeeded >= 2) conclusions.push(`ℹ️ 草原 ${w} 波 Boss 用「${b.name}」约 ${wavesNeeded} 波击杀，需边躲边输出（可接受）`);
    });
  });
  // 1b) Boss 单次攻击力（接触伤害，未乘关卡）——评估"挨一下掉多少"
  const bossAtkInfo = BOSS_WAVES.map((w) => `wave${w}:${fmt(ENEMY_CONFIGS.boss.attackPower * diffFor(w))}`).join(' ');
  conclusions.push(`ℹ️ 草原 Boss 接触伤害（随波次）：${bossAtkInfo}——玩家 100 血时约 2-3 下倒，需走位/护盾`);
  // 2) 敌人 HP 增长速度 vs 武器成长
  const g1 = enemyHp('normal', 1), g15 = enemyHp('normal', 15);
  const w1 = calcWeaponDps('default_gun', 1), w15 = calcWeaponDps('default_gun', 8, 24.9, 1.75);
  if (g15 / g1 > w15 / w1 * 1.5) conclusions.push(`⚠️ 普通敌人血量 1→15 波增长 ${fmt(g15 / g1, 1)}×，超过基础枪成长 ${fmt(w15 / w1, 1)}×，中后期清怪会越来越吃力`);
  // 3) 冰原霜蚀压力：每秒 1% 最大生命 → 若最大生命 200，每波掉 30s×2=60 血，需击杀回血/血包对冲
  conclusions.push(`ℹ️ 冰原「霜蚀」：200 血时每波流失约 ${fmt(200 * 0.01 * 30)} 血（30s），三关合计 45 波流失 ${fmt(200 * 0.01 * 45 * 3)} 血——需要吸血/嗜血/血包支撑`);
  // 4) 经济：第 5 波商店可负担
  const eco5 = economy.find((e) => e.wave === 5)?.coins ?? 0;
  conclusions.push(`ℹ️ 第 5 波商店前累计金币约 ${fmt(eco5)}（仅本波），加上前几波累积；武器最低价 45——${eco5 * 3 >= 45 ? '大概率买得起 1 件武器' : '可能买不起武器（风险）'}`);
  // 5) 无尽高波
  const boss50 = bossHp(0, 50);
  conclusions.push(`ℹ️ 无尽 50 波草原 Boss 血量 ${fmt(boss50)}（2.2^9），需 50w+ 级别 DPS——验证后期 build 是否跟得上`);
  // 6) 被动定位（成型 build）
  const b5 = passiveRows.find((r) => r.id === 'passive_bounce')!;
  const bn5 = passiveRows.find((r) => r.id === 'passive_burn')!;
  const ch5 = passiveRows.find((r) => r.id === 'passive_chain')!;
  const fr5 = passiveRows.find((r) => r.id === 'passive_freeze')!;
  const ls5 = passiveRows.find((r) => r.id === 'passive_lifesteal')!;
  conclusions.push(`ℹ️ 被动定位（成型build）：群战伤害 弹射≈${fmt(b5.group[2])} > 灼烧≈${fmt(bn5.group[2])} > 闪电链≈${fmt(ch5.group[2])} dps；Boss 战弹射/闪电链断链归零，灼烧≈${fmt(bn5.boss[2])}dps、吸血≈${fmt(ls5.boss[2])}hp/s 仍有效——印证'弹射吃怪群密度、灼烧吃目标血量'`);
  conclusions.push(`ℹ️ 冰冻满级等效降低敌人输出约 ${Math.round(fr5.group[2] * 100)}%，吸血满级群战每秒回血约 ${fmt(ls5.group[2])}——生存向被动价值主要在高压波`);

  // ===== 控制台输出 =====
  console.log('════════════════════════════════════════════════════════');
  console.log('KEEP LIVING 数值审计（静态 + 平均假设）');
  console.log('════════════════════════════════════════════════════════');

  console.log('\n【1】敌人 HP 曲线（基础 × 波次难度 × 关卡倍率 × 1.3）');
  console.log('波次\t' + types.map((t) => t.padEnd(10)).join(''));
  WAVES.forEach((w) => {
    console.log(String(w).padEnd(6) + types.map((t) => fmt(enemyHp(t, w)).padEnd(10)).join(''));
  });

  console.log('\n【2】Boss 血量（关卡专属 Boss）');
  BOSS_WAVES.forEach((w) => {
    const row = LEVELS.map((lv, i) => `${lv.name} ${fmt(bossHp(i, w))}`).join('  |  ');
    console.log(`波次 ${String(w).padEnd(4)} ${row}`);
  });

  console.log('\n【3】武器 DPS（含命中/暴击均值）');
  console.log('武器\tLv1\tLv3\t满级');
  weaponDpsTable.sort((a, b) => b.max - a.max).forEach((w) => {
    console.log(`${w.name.padEnd(8)}\t${fmt(w.lv1, 1)}\t${fmt(w.lv3, 1)}\t${fmt(w.max, 1)}`);
  });

  console.log('\n【3b】被动收益（成型 build：群战5敌 / Boss单敌）');
  console.log('被动\t群1级\t群3级\t群5级\tBoss1级\tBoss5级\t定位');
  passiveRows.forEach((r) => {
    console.log(`${r.name.padEnd(5)}\t${fmt(r.group[0], 1).padEnd(6)}\t${fmt(r.group[1], 1).padEnd(6)}\t${fmt(r.group[2], 1).padEnd(6)}\t${fmt(r.boss[0], 1).padEnd(7)}\t${fmt(r.boss[2], 1).padEnd(7)}\t${r.note}`);
  });

  console.log('\n【4】升级经验需求');
  console.log('等级\t1\t2\t3\t5\t8\t12\t16\t20\t25\t30');
  console.log('经验\t' + [1, 2, 3, 5, 8, 12, 16, 20, 25, 30].map((l) => fmt(expToNext(l))).join('\t'));

  console.log('\n【5】经济（每波金币期望）');
  console.log('波次\t' + WAVES.map(String).join('\t'));
  console.log('金币\t' + economy.map((e) => fmt(e.coins)).join('\t'));

  console.log('\n【6】坎检测结论');
  conclusions.forEach((c) => console.log(c));

  // 写 HTML 报告
  const html = buildHtml({
    waves: WAVES,
    enemyCurves,
    bossCurves,
    weaponDps: weaponDpsTable,
    economy,
    levelCurve,
    levelCompare,
    passiveTable: passiveRows,
    conclusions,
  });
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const out = path.join(__dirname, 'balance-report.html');
  fs.writeFileSync(out, html, 'utf-8');
  console.log(`\n📊 HTML 报告已生成：${out}`);
}

main();
