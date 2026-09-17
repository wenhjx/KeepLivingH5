/**
 * 超武追踪（愿望单）本地持久化
 *
 * 玩家勾选希望优先合成的超武后，升级三选一出现其必要组件时，
 * UpgradePanel 会在卡片上高亮提示（👍）。
 */
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
  return next;
}
