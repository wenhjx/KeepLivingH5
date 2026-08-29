import { GameConfig, QualityLevel } from './GameConfig';
import { EventBus } from '../utils/EventBus';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import type { GameSaveData, SavedRun } from '../types';
import type { Player } from '../entities/Player';

/**
 * 游戏全局管理器（单例）
 * 负责跨场景状态共享、运行时数据、全局事件协调
 */
export class GameManager {
  private static _instance: GameManager | null = null;

  private _qualityLevel: QualityLevel = 'medium';
  private _isMobile: boolean = false;
  private _stats = {
    totalKills: 0,
    totalPlayTime: 0,
    highScore: 0,
    gamesPlayed: 0,
  };
  private _runData = {
    wave: 1,
    kills: 0,
    score: 0,
    survivalTime: 0,
    isPaused: false,
    isGameOver: false,
  };
  private _saveSystem: SaveSystem | null = null;
  private _pendingRun: SavedRun | null = null;
  private _initialized = false;

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager._instance) {
      GameManager._instance = new GameManager();
    }
    return GameManager._instance;
  }

  init(): void {
    if (this._initialized) return;
    this._initialized = true;

    this._isMobile = this.detectMobile();
    this._qualityLevel = this.detectQuality();

    this._saveSystem = new SaveSystem();
    this.loadProgress();

    EventBus.emit('game:initialized', {
      isMobile: this._isMobile,
      quality: this._qualityLevel,
    });
  }

  private detectMobile(): boolean {
    if (typeof navigator === 'undefined') return false;

    // 1. userAgent 正则匹配（覆盖大多数移动设备和浏览器设备模拟）
    const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // 2. 触摸点检测（触摸设备至少 1 个点）
    const hasTouch = (navigator.maxTouchPoints || 0) > 0;

    // 3. 指针类型检测（coarse = 手指/触控笔，fine = 鼠标）
    let coarsePointer = false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    }

    // 综合判断：userAgent 匹配 或 (触摸 + 粗指针)
    // 触屏笔记本有触摸但 pointer 通常是 fine，不会误判
    return uaMobile || (hasTouch && coarsePointer);
  }

  private detectQuality(): QualityLevel {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'medium';
    const memory = (navigator as any).deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (memory <= 2 || cores <= 2) return 'low';
    if (memory >= 8 && cores >= 8) return 'high';
    return 'medium';
  }

  startNewRun(): void {
    this._runData = {
      wave: 1,
      kills: 0,
      score: 0,
      survivalTime: 0,
      isPaused: false,
      isGameOver: false,
    };
    this._pendingRun = null;
    this.clearSavedRun();
    EventBus.emit('run:start', this._runData);
  }

  endRun(): void {
    this._runData.isGameOver = true;
    this._stats.gamesPlayed++;
    this._stats.totalKills += this._runData.kills;
    this._stats.totalPlayTime += this._runData.survivalTime;
    if (this._runData.score > this._stats.highScore) {
      this._stats.highScore = this._runData.score;
    }
    // 对局结束，清除可继续的存档
    this.clearSavedRun();
    this.saveProgress();
    EventBus.emit('run:end', { ...this._runData, highScore: this._stats.highScore });
  }

  addKill(score: number = 10): void {
    this._runData.kills++;
    this._runData.score += score;
    EventBus.emit('run:kill', { kills: this._runData.kills, score: this._runData.score });
  }

  addSurvivalTime(delta: number): void {
    this._runData.survivalTime += delta;
  }

  setWave(wave: number): void {
    this._runData.wave = wave;
    EventBus.emit('run:wave', wave);
  }

  setPaused(paused: boolean): void {
    this._runData.isPaused = paused;
    EventBus.emit('run:pause', paused);
  }

  /** 手动设置画质等级（设置面板调用） */
  setQualityLevel(level: QualityLevel): void {
    this._qualityLevel = level;
    this.saveProgress();
    EventBus.emit('quality:changed', level);
  }

  // ========== 进行中对局存档（继续游戏） ==========

  /** 是否有可继续的对局 */
  hasSavedRun(): boolean {
    return !!this.getSavedRun();
  }

  /** 获取可继续的对局存档 */
  getSavedRun(): SavedRun | null {
    return this._saveSystem?.load()?.run ?? null;
  }

  /** 从存档恢复对局（设置 runData 与待恢复数据） */
  restoreRun(): void {
    const run = this.getSavedRun();
    if (!run) return;
    this._pendingRun = run;
    this._runData = {
      wave: run.wave,
      kills: run.kills,
      score: run.score,
      survivalTime: run.survivalTime,
      isPaused: false,
      isGameOver: false,
    };
    EventBus.emit('run:start', this._runData);
  }

  /** 获取待恢复的对局数据 */
  get pendingRun(): SavedRun | null {
    return this._pendingRun;
  }

  /** 保存当前对局进度（供"继续游戏"恢复） */
  saveRun(player: Player): void {
    if (!this._saveSystem || !player) return;
    const data = this._saveSystem.load() || this.buildSaveData();
    data.run = {
      wave: this._runData.wave,
      score: this._runData.score,
      kills: this._runData.kills,
      survivalTime: this._runData.survivalTime,
      player: {
        stats: player.getStats(),
        weapons: player.getWeapons().map((w) => ({ id: w.id, level: w.level })),
        passives: player.getPassives().map((p) => ({ id: p.id, name: p.name, level: p.level })),
      },
    };
    this._saveSystem.save(data);
  }

  /** 清除进行中对局存档 */
  clearSavedRun(): void {
    this._pendingRun = null;
    if (!this._saveSystem) return;
    const data = this._saveSystem.load();
    if (data && data.run) {
      data.run = undefined;
      this._saveSystem.save(data);
    }
  }

  /** 构造一份基础存档数据（无对局进度） */
  private buildSaveData(): GameSaveData {
    const audio = AudioManager.getInstance();
    return {
      version: 1,
      timestamp: Date.now(),
      stats: { ...this._stats },
      settings: {
        quality: this._qualityLevel,
        soundVolume: audio.getSfxVolume(),
        musicVolume: audio.getMusicVolume(),
        muted: audio.isMuted(),
      },
    };
  }

  private loadProgress(): void {
    if (!this._saveSystem) return;
    const data = this._saveSystem.load();
    if (data) {
      this._stats = { ...this._stats, ...data.stats };
      // 恢复设置（画质、音量、静音）
      if (data.settings) {
        this._qualityLevel = data.settings.quality || 'medium';
        const audio = AudioManager.getInstance();
        audio.setSfxVolume(data.settings.soundVolume ?? 1);
        audio.setMusicVolume(data.settings.musicVolume ?? 0.7);
        audio.setMuted(data.settings.muted ?? false);
      }
    }
  }

  saveProgress(): void {
    if (!this._saveSystem) return;
    const audio = AudioManager.getInstance();
    const data: GameSaveData = {
      version: 1,
      timestamp: Date.now(),
      stats: { ...this._stats },
      settings: {
        quality: this._qualityLevel,
        soundVolume: audio.getSfxVolume(),
        musicVolume: audio.getMusicVolume(),
        muted: audio.isMuted(),
      },
    };
    this._saveSystem.save(data);
  }

  get isMobile(): boolean {
    return this._isMobile;
  }

  get qualityLevel(): QualityLevel {
    return this._qualityLevel;
  }

  get qualitySettings() {
    return GameConfig.QUALITY[this._qualityLevel];
  }

  get runData() {
    return { ...this._runData };
  }

  get stats() {
    return { ...this._stats };
  }

  get isPaused(): boolean {
    return this._runData.isPaused;
  }

  get isGameOver(): boolean {
    return this._runData.isGameOver;
  }
}
