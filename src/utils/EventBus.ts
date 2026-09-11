/**
 * 全局事件总线
 * 用于跨场景、跨系统的事件通信，解耦模块间依赖
 */
type EventCallback = (...args: any[]) => void;

class EventBusClass {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /** 订阅事件 */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  /** 订阅一次后自动取消 */
  once(event: string, callback: EventCallback): () => void {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  /** 取消订阅 */
  off(event: string, callback: EventCallback): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /** 触发事件 */
  emit(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      // 复制一份避免回调中修改集合导致问题
      const callbacks = Array.from(set);
      for (const cb of callbacks) {
        try {
          cb(...args);
        } catch (e) {
          console.error(`[EventBus] Error in event "${event}":`, e);
        }
      }
    }
  }

  /** 清除指定事件的所有监听 */
  clear(event: string): void {
    this.listeners.delete(event);
  }

  /** 清除所有事件监听 */
  clearAll(): void {
    this.listeners.clear();
  }

  /** 获取事件监听数量（调试用） */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

export const EventBus = new EventBusClass();

/** 事件键常量（集中管理，防止魔法字符串改名断链） */
export const EventKeys = {
  BOSS_SPAWN: 'boss:spawn',
  BULLET_EXPLODE: 'bullet:explode',
  COIN_EARNED: 'coin:earned',
  COMBAT_CRIT: 'combat:crit',
  ENDLESSCHOICE_CONTINUE: 'endlesschoice:continue',
  ENDLESSCHOICE_END: 'endlesschoice:end',
  ENDLESSCHOICE_NEXTLEVEL: 'endlesschoice:nextlevel',
  ENEMY_DEATH: 'enemy:death',
  ENEMY_SPAWN: 'enemy:spawn',
  GAME_INITIALIZED: 'game:initialized',
  GAME_SPEED: 'game:speed',
  LEVEL_CLEAR: 'level:clear',
  PLAYER_COINS: 'player:coins',
  PLAYER_DAMAGE: 'player:damage',
  PLAYER_DEATH: 'player:death',
  PLAYER_HEAL: 'player:heal',
  PLAYER_HIT: 'player:hit',
  PLAYER_INVENTORY_CHANGED: 'player:inventoryChanged',
  PLAYER_LEVELUP: 'player:levelup',
  PLAYER_OVERFLOW: 'player:overflow',
  PLAYER_REVIVE: 'player:revive',
  QUALITY_CHANGED: 'quality:changed',
  RUN_END: 'run:end',
  RUN_KILL: 'run:kill',
  RUN_PAUSE: 'run:pause',
  RUN_START: 'run:start',
  RUN_WAVE: 'run:wave',
  SAVE_COMPLETE: 'save:complete',
  SAVE_ERROR: 'save:error',
  SHOP_CLOSED: 'shop:closed',
  SHOP_PURCHASE: 'shop:purchase',
  UPGRADE_CHOSEN: 'upgrade:chosen',
  WAVE_START: 'wave:start',
  WEAPONSELECT_CLOSED: 'weaponselect:closed',
} as const;
