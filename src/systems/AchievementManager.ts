import { EventBus } from '../utils/EventBus';
import { GameManager } from '../game/GameManager';
import { GuideManager } from './GuideManager';
import { ACHIEVEMENTS, getAchievementById, type AchievementDef } from '../data/achievements';
import { WEAPONS } from '../data/weapons';
import type { AchievementSaveData, SaveStats } from '../types';

/**
 * 成就系统管理器（单例）
 *
 * 数据驱动：成就定义见 src/data/achievements.ts（累计型 progress + 单局判定型 check）。
 * 监听 EventBus 业务事件 → 更新全局统计（SaveStats 扩展字段）→ 全量检查解锁。
 * 解锁即时发放永久加成并弹右上角提示；状态随全局存档持久化（不随对局存档清除）。
 *
 * 事件流：
 *  - enemy:death  → bossesKilled++
 *  - coin:earned  → totalCoinsEarned += amount（Player.addCoins 发射）
 *  - shop:purchase → totalCoinsSpent += price（ShopScene.tryBuy 发射）
 *  - run:wave     → maxWaveReached 取历史最大
 *  - player:coins → hoard_300 单局持币判定
 *  - player:hit   → 本局受击标记（无伤成就）
 *  - run:end      → wins++ / 合并本局武器进 weaponsCollected / 构造 payload 判定单局型 / meta 系列
 *  - run:start    → 重置本局受击标记
 */
export class AchievementManager {
  private static _instance: AchievementManager | null = null;

  private _unlocked: Set<string> = new Set();
  private _bonuses: Record<string, number> = {};
  private _titles: string[] = [];
  private _hitThisRun = false;
  private _inited = false;

  private constructor() {}

  static getInstance(): AchievementManager {
    if (!AchievementManager._instance) {
      AchievementManager._instance = new AchievementManager();
    }
    return AchievementManager._instance;
  }

  /** 初始化：读存档 + 注册监听 + 全量检查一次（旧存档达标立即补解锁） */
  init(): void {
    if (this._inited) return;
    this._inited = true;

    const data = GameManager.getInstance().achievementsData;
    if (data) {
      this._unlocked = new Set(data.unlocked ?? []);
      this._bonuses = { ...(data.bonuses ?? {}) };
      this._titles = [...(data.titles ?? [])];
    }

    // 注意：EventBus.on 不支持 thisArg，统一用箭头包装保持 this
    // 试玩场地（GameManager.testMode）下事件照常派发，但成就/统计处理全部短路——试玩不产生任何收益
    const guard = (fn: (...args: any[]) => void) => (...args: any[]): void => {
      if (GameManager.getInstance().testMode) return;
      fn(...args);
    };
    EventBus.on('enemy:death', guard((c) => this.handleEnemyDeath(c)));
    EventBus.on('coin:earned', guard((a) => this.handleCoinEarned(a)));
    EventBus.on('shop:purchase', guard((p) => this.handleShopPurchase(p)));
    EventBus.on('run:wave', guard((w) => this.handleWave(w)));
    EventBus.on('player:coins', guard((c) => this.handleCoins(c)));
    EventBus.on('player:hit', guard(() => this.handlePlayerHit()));
    EventBus.on('run:end', guard((r) => this.handleRunEnd(r)));
    EventBus.on('run:start', guard(() => this.handleRunStart()));
    EventBus.on('level:clear', guard(() => this.checkAll()));

    // 旧存档/历史统计达标 → 立即补解锁（如已 1000 杀的存档）
    this.checkAll();
  }

  // ========== 事件处理 ==========

  private handleEnemyDeath(config: any): void {
    if (config?.type === 'boss') {
      this.mutateStats((s) => {
        s.bossesKilled = (s.bossesKilled ?? 0) + 1;
      });
      this.checkAll();
    }
  }

  private handleCoinEarned(amount: number): void {
    if (!isFinite(amount) || amount <= 0) return;
    this.mutateStats((s) => {
      s.totalCoinsEarned = (s.totalCoinsEarned ?? 0) + Math.floor(amount);
    });
    this.checkAll();
  }

  private handleShopPurchase(payload: { price?: number }): void {
    const price = Math.floor(payload?.price ?? 0);
    if (price <= 0) return;
    this.mutateStats((s) => {
      s.totalCoinsSpent = (s.totalCoinsSpent ?? 0) + price;
    });
    this.checkAll();
  }

  private handleWave(wave: number): void {
    this.mutateStats((s) => {
      s.maxWaveReached = Math.max(s.maxWaveReached ?? 0, wave);
    });
    this.checkAll();
  }

  private handleCoins(coins: number): void {
    this.checkAll({ coins });
  }

  private handlePlayerHit(): void {
    this._hitThisRun = true;
  }

  private handleRunStart(): void {
    this._hitThisRun = false;
  }

  private handleRunEnd(runData: any): void {
    // 结算统计：胜利次数 / 本局武器并入跨局收集
    const victory = !!runData?.isVictory;
    this.mutateStats((s) => {
      if (victory) s.wins = (s.wins ?? 0) + 1;
      s.maxWaveReached = Math.max(s.maxWaveReached ?? 0, runData?.wave ?? 0);

      // 跨局武器收集（去重）：从 GameScene 玩家读取（endRun 时场景仍在）
      const gs = (window as any).__game?.scene?.getScene?.('GameScene');
      const player = gs?.getPlayer?.();
      const weaponIds = (player?.getWeapons?.() ?? []).map((w: any) => w.id) as string[];
      const collected = new Set(s.weaponsCollected ?? []);
      weaponIds.forEach((id) => collected.add(id));
      s.weaponsCollected = [...collected];

      // 单局判定型 payload：victory / 武器构成 / 最高武器等级 / 是否受击 / 场上是否有存活 Boss
      let maxWeaponLevel = 0;
      for (const w of player?.getWeapons?.() ?? []) {
        const cfg = WEAPONS[w.id];
        const lvl = Number(w.level) || 0;
        if (cfg && lvl >= (cfg.maxLevel || 1)) maxWeaponLevel = 1;
      }
      let bossAlive = false;
      const enemies = gs?.getEnemies?.();
      if (enemies?.getChildren) {
        enemies.getChildren().forEach((e: any) => {
          if (e?.active && e?.config?.type === 'boss') bossAlive = true;
        });
      }
      this.checkAll({
        victory,
        weaponIds,
        maxWeaponLevel,
        hitThisRun: this._hitThisRun,
        bossAlive,
      });
    });
  }

  // ========== 统计与检查 ==========

  /** 更新全局统计并立即保存（成就计数随全局存档，异常退出也不丢） */
  private mutateStats(fn: (s: SaveStats) => void): void {
    GameManager.getInstance().mutateStats(fn);
  }

  /** 全量检查：统计变化/事件后调用，解锁达标的成就（累计型 progress + 单局型 check） */
  private checkAll(payload?: any): void {
    const stats = GameManager.getInstance().stats as SaveStats;
    const ctx = {
      ...(payload ?? {}),
      unlockedCount: this._unlocked.size,
    };
    let changed = false;
    for (const def of ACHIEVEMENTS) {
      if (this._unlocked.has(def.id)) continue;
      const met = this.checkDef(def, stats, ctx);
      if (met) {
        this.unlock(def);
        changed = true;
      }
    }
    if (changed) {
      // meta 系列依赖解锁数，解锁后需再查一轮（成就的成就）
      this.checkMeta(stats, ctx);
    }
  }

  private checkDef(def: AchievementDef, stats: SaveStats, ctx: any): boolean {
    if (def.check) {
      return def.check(ctx, stats);
    }
    if (def.progress && def.target != null) {
      return def.progress(stats) >= def.target;
    }
    return false;
  }

  /** meta 系列：解锁数增长后再查一轮（meta_5/10/all 可能连环解锁） */
  private checkMeta(stats: SaveStats, baseCtx: any): void {
    let guard = 0;
    while (guard < 5) {
      guard++;
      const ctx = { ...baseCtx, unlockedCount: this._unlocked.size };
      let any = false;
      for (const def of ACHIEVEMENTS) {
        if (this._unlocked.has(def.id)) continue;
        if (this.checkDef(def, stats, ctx)) {
          this.unlock(def);
          any = true;
        }
      }
      if (!any) break;
    }
  }

  // ========== 解锁与奖励 ==========

  private unlock(def: AchievementDef): void {
    this._unlocked.add(def.id);
    console.log(`[成就] 解锁: ${def.icon} ${def.name}`);

    // 发放奖励
    if (def.reward.bonuses) {
      for (const [stat, v] of Object.entries(def.reward.bonuses)) {
        this._bonuses[stat] = (this._bonuses[stat] ?? 0) + v;
      }
    }
    if (def.reward.title) {
      this._titles.unshift(def.reward.title);
    }
    this.persist();
    this.notify(def);
  }

  private persist(): void {
    const data: AchievementSaveData = {
      unlocked: [...this._unlocked],
      bonuses: { ...this._bonuses },
      titles: [...this._titles],
    };
    GameManager.getInstance().saveAchievementsData(data);
  }

  /** 右上角弹窗提示解锁（GuideCard 自动消失，无按钮） */
  private notify(def: AchievementDef): void {
    // 延迟到下一帧发（避免在事件回调栈里创建 UI 引发场景时序问题）
    setTimeout(() => {
      try {
        const title = `成就解锁: ${def.name}`;
        const desc = def.reward.title
          ? `获得称号「${def.reward.title}」`
          : def.reward.bonuses
            ? '永久属性加成已生效'
            : '达成条件已记录';
        GuideManager.getInstance().show({
          title,
          description: desc,
          icon: def.icon || '🏅',
          color: 0xffd700,
          position: 'top-right',
          duration: 3200,
          showButton: false,
        });
      } catch (e) {
        console.warn('[成就] 解锁提示显示失败', e);
      }
      // 顺手存档（成就已持久化，这里确保统计字段也落盘）
      GameManager.getInstance().saveProgress();
    }, 80);
  }

  // ========== 查询 ==========

  isUnlocked(id: string): boolean {
    return this._unlocked.has(id);
  }

  /** 永久加成总值（stat 字段名 → 数值） */
  getBonus(stat: string): number {
    return this._bonuses[stat] ?? 0;
  }

  /** 全部永久加成汇总（面板展示用） */
  getBonusSummary(): Record<string, number> {
    return { ...this._bonuses };
  }

  get unlockedCount(): number {
    return this._unlocked.size;
  }

  get unlockedIds(): string[] {
    return [...this._unlocked];
  }

  get titles(): string[] {
    return [...this._titles];
  }

  /** 成就进度（累计型）；单局型返回 -1（无进度概念） */
  getProgress(def: AchievementDef): { current: number; target: number } {
    if (!def.progress || def.target == null) return { current: -1, target: -1 };
    const stats = GameManager.getInstance().stats as SaveStats;
    return { current: def.progress(stats), target: def.target };
  }
}
