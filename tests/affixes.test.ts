import { describe, it, expect } from 'vitest';
import { AFFIXES, COMMON_AFFIX_POOL, ELITE_AFFIX_POOL, type EnemyAffixId } from '../src/data/affixes';

const ALL_IDS = Object.keys(AFFIXES) as EnemyAffixId[];

describe('词缀表完整性', () => {
  it('每个词缀字段齐全（名称/图标/tint/稀有度/描述）', () => {
    expect(ALL_IDS.length).toBeGreaterThanOrEqual(10);
    for (const id of ALL_IDS) {
      const a = AFFIXES[id];
      expect(a.name, `${id}.name`).toBeTruthy();
      expect(a.icon, `${id}.icon`).toBeTruthy();
      expect(typeof a.color, `${id}.color`).toBe('number');
      expect(['common', 'rare', 'epic']).toContain(a.rarity);
      expect(a.description, `${id}.description`).toBeTruthy();
    }
  });

  it('id 字段与键一致', () => {
    for (const id of ALL_IDS) {
      expect(AFFIXES[id].id).toBe(id);
    }
  });

  it('普通池与精英池引用的 id 都存在于表中', () => {
    for (const id of [...COMMON_AFFIX_POOL, ...ELITE_AFFIX_POOL]) {
      expect(AFFIXES[id], `pool id ${id}`).toBeDefined();
    }
  });

  it('池子内部无重复 id（避免权重异常）', () => {
    expect(new Set(COMMON_AFFIX_POOL).size).toBe(COMMON_AFFIX_POOL.length);
    expect(new Set(ELITE_AFFIX_POOL).size).toBe(ELITE_AFFIX_POOL.length);
  });

  it('稀有度分布合理：至少各有 1 个普通/稀有/史诗', () => {
    const rarities = ALL_IDS.map((id) => AFFIXES[id].rarity);
    expect(rarities).toContain('common');
    expect(rarities).toContain('rare');
    expect(rarities).toContain('epic');
  });
});
