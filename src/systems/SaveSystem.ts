import { GameConfig } from '../game/GameConfig';
import { EventBus } from '../utils/EventBus';
import { Logger } from '../utils/Logger';
import type { GameSaveData } from '../types';

/**
 * 存档系统
 * 支持本地存档（localStorage）和云端存档（预留接口）
 * 本地缓存 + 云端同步策略，断网可玩，联网自动同步
 */
export class SaveSystem {
  private localStorageKey: string;
  private memoryCache: GameSaveData | null = null;
  private cloudSyncEnabled: boolean = false;
  private syncInProgress: boolean = false;

  constructor() {
    this.localStorageKey = GameConfig.SAVE.localStorageKey;
    this.cloudSyncEnabled = GameConfig.SAVE.cloudSyncEnabled;
    this.loadFromLocal();
  }

  /**
   * 保存游戏数据
   * 先写入本地缓存和 localStorage，再异步同步到云端
   */
  save(data: GameSaveData): void {
    // 更新时间戳
    data.timestamp = Date.now();
    this.memoryCache = data;

    // 写入本地
    this.saveToLocal(data);

    // 云端同步
    if (this.cloudSyncEnabled) {
      this.syncToCloud(data);
    }

    EventBus.emit('save:complete');
    Logger.info('[SaveSystem] 存档保存成功', data);
  }

  /**
   * 加载游戏数据
   * 优先从内存缓存，其次本地，最后尝试云端
   */
  load(): GameSaveData | null {
    // 内存缓存
    if (this.memoryCache) {
      return this.memoryCache;
    }

    // 本地存储
    const localData = this.loadFromLocal();
    if (localData) {
      this.memoryCache = localData;
      return localData;
    }

    return null;
  }

  // ========== 本地存储 ==========

  private saveToLocal(data: GameSaveData): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const json = JSON.stringify(data);
      localStorage.setItem(this.localStorageKey, json);
    } catch (e) {
      Logger.error('[SaveSystem] 本地存档失败', e);
      EventBus.emit('save:error', '本地存储失败');
    }
  }

  private loadFromLocal(): GameSaveData | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const json = localStorage.getItem(this.localStorageKey);
      if (!json) return null;
      const data = JSON.parse(json) as GameSaveData;
      // 版本校验
      if (!this.validateSaveData(data)) {
        Logger.warn('[SaveSystem] 存档数据版本不兼容，已忽略');
        return null;
      }
      return data;
    } catch (e) {
      Logger.error('[SaveSystem] 读取本地存档失败', e);
      return null;
    }
  }

  // ========== 云端同步（预留接口） ==========

  /**
   * 同步到云端
   * 需要后端 API 支持，当前为占位实现
   */
  private async syncToCloud(data: GameSaveData): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      // TODO: 实现云端同步 API
      // const response = await fetch('/api/save', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data),
      // });
      Logger.info('[SaveSystem] 云端同步（占位）');
    } catch (e) {
      Logger.error('[SaveSystem] 云端同步失败', e);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 从云端拉取存档
   */
  async loadFromCloud(): Promise<GameSaveData | null> {
    try {
      // TODO: 实现云端拉取 API
      // const response = await fetch('/api/save');
      // const data = await response.json();
      // return data;
      return null;
    } catch (e) {
      Logger.error('[SaveSystem] 云端拉取失败', e);
      return null;
    }
  }

  // ========== 冲突解决 ==========

  /**
   * 解决本地与云端存档冲突
   * 策略：取时间戳较新的存档
   */
  resolveConflict(local: GameSaveData, cloud: GameSaveData): GameSaveData {
    if (local.timestamp >= cloud.timestamp) {
      Logger.info('[SaveSystem] 冲突解决：使用本地存档（较新）');
      return local;
    } else {
      Logger.info('[SaveSystem] 冲突解决：使用云端存档（较新）');
      return cloud;
    }
  }

  // ========== 数据校验 ==========

  private validateSaveData(data: GameSaveData): boolean {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.version !== 'number') return false;
    if (typeof data.timestamp !== 'number') return false;
    if (!data.stats || typeof data.stats !== 'object') return false;
    return true;
  }

  // ========== 存档管理 ==========

  /** 清除本地存档 */
  clearLocalSave(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(this.localStorageKey);
      this.memoryCache = null;
      Logger.info('[SaveSystem] 本地存档已清除');
    } catch (e) {
      Logger.error('[SaveSystem] 清除存档失败', e);
    }
  }

  /** 导出存档为字符串 */
  exportSave(): string | null {
    const data = this.load();
    if (!data) return null;
    return JSON.stringify(data);
  }

  /** 从字符串导入存档 */
  importSave(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString) as GameSaveData;
      if (!this.validateSaveData(data)) return false;
      this.save(data);
      return true;
    } catch (e) {
      Logger.error('[SaveSystem] 导入存档失败', e);
      return false;
    }
  }

  /** 获取存档大小（字节） */
  getSaveSize(): number {
    try {
      if (typeof localStorage === 'undefined') return 0;
      const json = localStorage.getItem(this.localStorageKey);
      return json ? new Blob([json]).size : 0;
    } catch {
      return 0;
    }
  }
}
