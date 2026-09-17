/**
 * 超武追踪（愿望单）本地持久化
 *
 * 玩家勾选希望优先合成的超武后，升级三选一出现其必要组件时，
 * UpgradePanel 会在卡片上高亮提示（👍）。
 */
import { SUPER_WEAPONS } from "./superWeapons";
import { EventBus } from "../utils/EventBus";
import type { SuperWeaponConfig } from "./superWeapons";

const STORAGE_KEY = "keepLiving.pinnedSupers";

export function getPinnedSupers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isSuperPinned(id: string): boolean {
  return getPinnedSupers().includes(id);
}

export function togglePinSuper(id: string): string[] {
  const cur = getPinnedSupers();
  const next = cur.includes(id)
    ? cur.filter((x) => x !== id)
    : [...cur, id];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 忽略存储失败 */
  }
  EventBus.emit("super:track-changed");
  return next;
}

/** 取消某超武的追踪（进化达成后自动调用，仅移除不添加） */
export function unpinSuper(id: string): void {
  const cur = getPinnedSupers();
  const next = cur.filter((x) => x !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 忽略存储失败 */
  }
  EventBus.emit("super:track-changed");
}

/** 匹配某升级选项是否为已勾选超武的必要组件（源武器/辅助升级） */
export function findPinnedSuperForOption(option: {
  kind: string;
  id: string;
  effect?: { weaponId?: string };
}): SuperWeaponConfig | undefined {
  return getPinnedSupers()
    .map((pid) => SUPER_WEAPONS[pid])
    .filter((s): s is NonNullable<typeof s> => !!s)
    .find(
      (s) =>
        option.kind === "weapon"
          ? s.weaponId === option.id ||
            s.weaponId === option.effect?.weaponId
          : s.requiredUpgradeId === option.id,
    );
}
