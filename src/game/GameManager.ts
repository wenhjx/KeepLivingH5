import { GameConfig, QualityLevel } from './GameConfig';
import { EventBus } from '../utils/EventBus';
import { SaveSystem } from '../systems/SaveSystem';
import type { GameSaveData } from '../types';

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

  private loadProgress(): void {
    if (!this._saveSystem) return;
    const data = this._saveSystem.load();
    if (data) {
      this._stats = { ...this._stats, ...data.stats };
    }
  }

  saveProgress(): void {
    if (!this._saveSystem) return;
    const data: GameSaveData = {
      version: 1,
      timestamp: Date.now(),
      stats: { ...this._stats },
      settings: {
        quality: this._qualityLevel,
        soundVolume: 1,
        musicVolume: 0.7,
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
