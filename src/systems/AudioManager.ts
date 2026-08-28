import Phaser from 'phaser';
import { Logger } from '../utils/Logger';

/**
 * 音频管理器（单例）
 * 统一管理背景音乐和音效播放，支持音量控制、淡入淡出
 */
export class AudioManager {
  private static _instance: AudioManager | null = null;

  private scene: Phaser.Scene | null = null;
  private bgm: Phaser.Sound.WebAudioSound | null = null;
  private currentBgmKey: string = '';
  private sfxVolume: number = 1.0;
  private musicVolume: number = 0.7;
  private muted: boolean = false;
  private initialized: boolean = false;

  // 音效缓存
  private sfxCache: Map<string, Phaser.Sound.BaseSound> = new Map();

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager._instance) {
      AudioManager._instance = new AudioManager();
    }
    return AudioManager._instance;
  }

  /** 初始化（在场景中调用） */
  init(scene: Phaser.Scene): void {
    this.scene = scene;
    this.initialized = true;
    Logger.info('[AudioManager] 初始化完成');
  }

  // ========== 背景音乐 ==========

  /** 播放背景音乐 */
  playBgm(key: string, loop: boolean = true): void {
    if (!this.initialized || !this.scene) return;
    if (this.currentBgmKey === key && this.bgm?.isPlaying) return;

    // 停止当前 BGM
    this.stopBgm();

    try {
      this.bgm = this.scene.sound.add(key, {
        loop,
        volume: this.muted ? 0 : this.musicVolume,
      }) as Phaser.Sound.WebAudioSound;
      this.bgm.play();
      this.currentBgmKey = key;
      Logger.info(`[AudioManager] 播放BGM: ${key}`);
    } catch (e) {
      Logger.error(`[AudioManager] 播放BGM失败: ${key}`, e);
    }
  }

  /** 停止背景音乐 */
  stopBgm(): void {
    if (this.bgm && this.bgm.isPlaying) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = null;
      this.currentBgmKey = '';
    }
  }

  /** 暂停背景音乐 */
  pauseBgm(): void {
    if (this.bgm && this.bgm.isPlaying) {
      this.bgm.pause();
    }
  }

  /** 恢复背景音乐 */
  resumeBgm(): void {
    if (this.bgm && this.bgm.isPaused) {
      this.bgm.resume();
    }
  }

  /** 淡入 BGM */
  fadeInBgm(key: string, duration: number = 1000): void {
    if (!this.initialized || !this.scene) return;
    this.playBgm(key);
    if (this.bgm) {
      this.bgm.setVolume(0);
      this.scene.tweens.add({
        targets: this.bgm,
        volume: this.muted ? 0 : this.musicVolume,
        duration,
      });
    }
  }

  /** 淡出 BGM */
  fadeOutBgm(duration: number = 1000): void {
    if (!this.bgm || !this.scene) return;
    this.scene.tweens.add({
      targets: this.bgm,
      volume: 0,
      duration,
      onComplete: () => this.stopBgm(),
    });
  }

  // ========== 音效 ==========

  /** 播放音效 */
  playSfx(key: string, volume?: number): void {
    if (!this.initialized || !this.scene || this.muted) return;

    try {
      const finalVolume = (volume ?? 1) * this.sfxVolume;
      this.scene.sound.play(key, { volume: finalVolume });
    } catch (e) {
      // 音效资源不存在时静默失败
      Logger.debug(`[AudioManager] 音效不存在: ${key}`);
    }
  }

  /** 播放带空间感的音效（根据距离衰减） */
  playSfxAtPosition(key: string, x: number, y: number, listenerX: number, listenerY: number): void {
    if (!this.initialized || !this.scene || this.muted) return;

    const dist = Phaser.Math.Distance.Between(x, y, listenerX, listenerY);
    const maxDist = 800;
    const volume = Math.max(0, 1 - dist / maxDist) * this.sfxVolume;

    if (volume > 0.01) {
      this.playSfx(key, volume);
    }
  }

  // ========== 音量控制 ==========

  setSfxVolume(volume: number): void {
    this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
    if (this.bgm && !this.muted) {
      this.bgm.setVolume(this.musicVolume);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.bgm) {
      this.bgm.setVolume(muted ? 0 : this.musicVolume);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ========== Getters ==========

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isBgmPlaying(): boolean {
    return this.bgm?.isPlaying ?? false;
  }

  /** 场景切换时清理 */
  destroy(): void {
    this.stopBgm();
    this.sfxCache.clear();
    this.initialized = false;
    this.scene = null;
  }
}
