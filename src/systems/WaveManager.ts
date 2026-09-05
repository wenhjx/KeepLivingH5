import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { GameManager } from '../game/GameManager';
import { MathUtils } from '../utils/MathUtils';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import { EventBus } from '../utils/EventBus';
import type { ObjectPool } from './ObjectPool';
import type { EnemyConfig, EnemyType, WaveConfig } from '../types';
import { ENEMY_CONFIGS } from '../data/enemies';
import type { LevelConfig } from '../data/levels';

/**
 * 波次管理器
 * 控制怪物波次生成、难度递增、Boss 出现逻辑
 */
export class WaveManager {
  private scene: Phaser.Scene;
  private objectPool: ObjectPool;
  private levelConfig: LevelConfig;

  private currentWave: number = 1;
  private waveTimer: number = 0;
  private spawnTimer: number = 0;
  private waveActive: boolean = false;
  private bossActive: boolean = false;

  // 当前波次的生成表
  private currentSpawnTable: { type: EnemyType; weight: number }[] = [];

  constructor(scene: Phaser.Scene, objectPool: ObjectPool, levelConfig: LevelConfig) {
    this.scene = scene;
    this.objectPool = objectPool;
    this.levelConfig = levelConfig;
  }

  /** 切换关卡配置（关卡重启时由 GameScene 重建；保留方法以备复用同一实例） */
  setLevelConfig(cfg: LevelConfig): void {
    this.levelConfig = cfg;
  }

  /** 开始指定波次 */
  startWave(wave: number): void {
    this.currentWave = wave;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.waveActive = true;
    this.bossActive = false;

    GameManager.getInstance().setWave(wave);

    // 演出事件：波次开始（GameFeedback 订阅播横幅；纯表现，不影响玩法）
    EventBus.emit('wave:start', {
      wave,
      isBoss: wave % GameConfig.WAVE.bossWaveInterval === 0,
    });

    // 构建生成表
    this.buildSpawnTable(wave);

    // Boss 波
    if (wave % GameConfig.WAVE.bossWaveInterval === 0) {
      this.spawnBoss();
    }
  }

  /** 构建当前波次的敌人生成权重表（默认构成 × 关卡 enemyOverrides 权重倍率） */
  private buildSpawnTable(wave: number): void {
    this.currentSpawnTable = [];
    // 关卡敌人构成覆盖：按敌人类型放大/缩小默认权重
    const mult = (type: EnemyType): number => this.levelConfig.enemyOverrides?.[type]?.weightMult ?? 1;

    // 基础敌人始终出现
    this.currentSpawnTable.push({ type: 'normal', weight: 100 * mult('normal') });

    // 第2波开始出现快速敌人
    if (wave >= 2) {
      this.currentSpawnTable.push({ type: 'fast', weight: (30 + wave * 2) * mult('fast') });
    }

    // 第3波开始出现坦克
    if (wave >= 3) {
      this.currentSpawnTable.push({ type: 'tank', weight: (15 + wave) * mult('tank') });
    }

    // 第4波开始出现远程
    if (wave >= 4) {
      this.currentSpawnTable.push({ type: 'ranged', weight: (10 + wave) * mult('ranged') });
    }

    // 第5波开始出现自爆怪
    if (wave >= 5) {
      this.currentSpawnTable.push({ type: 'suicider', weight: (12 + wave) * mult('suicider') });
    }

    // 第7波开始出现护盾怪
    if (wave >= 7) {
      this.currentSpawnTable.push({ type: 'shielded', weight: (10 + wave * 0.8) * mult('shielded') });
    }

    // 第8波开始出现分裂怪
    if (wave >= 8) {
      this.currentSpawnTable.push({ type: 'splitter', weight: (8 + wave * 0.6) * mult('splitter') });
    }

    // 第6波开始出现精英
    if (wave >= 6) {
      this.currentSpawnTable.push({ type: 'elite', weight: (5 + wave * 0.5) * mult('elite') });
    }
  }

  /** 关卡数值调参：血量/攻击 × 关卡倍率（克隆配置避免污染 ENEMY_CONFIGS） */
  private applyLevelTuning(config: EnemyConfig): EnemyConfig {
    const hpMult = this.levelConfig.enemyHpMultiplier;
    const dmgMult = this.levelConfig.enemyDmgMultiplier;
    if (!hpMult && !dmgMult) return config;
    return {
      ...config,
      maxHealth: config.maxHealth * (hpMult ?? 1),
      attackPower: config.attackPower * (dmgMult ?? 1),
    };
  }

  update(time: number, delta: number): void {
    if (!this.waveActive) return;

    this.waveTimer += delta;
    this.spawnTimer += delta;

    // 计算当前生成间隔（随波次递减）
    const spawnInterval = Math.max(
      GameConfig.WAVE.spawnIntervalMin,
      GameConfig.WAVE.spawnIntervalBase - this.currentWave * 50
    );

    // 生成敌人
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.trySpawnEnemy();
    }

    // 波次时间到，进入下一波
    if (this.waveTimer >= GameConfig.WAVE.waveDuration) {
      this.nextWave();
    }
  }

  /** 尝试生成敌人（受同屏数量限制） */
  private trySpawnEnemy(): void {
    const gm = GameManager.getInstance();
    const maxEnemies = gm.qualitySettings.maxEnemies;

    // 达到同屏上限则不生成
    if (this.objectPool.getActiveEnemyCount() >= maxEnemies) return;

    // 选择敌人类型
    const types = this.currentSpawnTable.map((s) => s.type);
    const weights = this.currentSpawnTable.map((s) => s.weight);
    const enemyType = MathUtils.weightedRandom(types, weights);

    // 获取配置
    const baseConfig = ENEMY_CONFIGS[enemyType];
    if (!baseConfig) return;
    const config = this.applyLevelTuning(baseConfig);

    // 计算生成位置（玩家周围屏幕外）
    const gameScene = this.scene as any;
    const player = gameScene.getPlayer();
    if (!player) return;

    const spawnPos = this.getSpawnPosition(player.x, player.y);
    const difficultyMultiplier = 1 + (this.currentWave - 1) * 0.1;

    this.objectPool.spawnEnemy(config, spawnPos.x, spawnPos.y, difficultyMultiplier);
  }

  /** 计算屏幕外的生成位置 */
  private getSpawnPosition(playerX: number, playerY: number): { x: number; y: number } {
    const camera = this.scene.cameras.main;
    const halfW = camera.width / 2 + 100;
    const halfH = camera.height / 2 + 100;

    // 在玩家周围圆形区域外生成
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(halfW, halfH) + MathUtils.randomRange(50, 150);

    let x = playerX + Math.cos(angle) * distance;
    let y = playerY + Math.sin(angle) * distance;

    // 限制在地图范围内
    const mapSize = (this.scene as any).getMapSize?.();
    if (mapSize) {
      x = MathUtils.clamp(x, 50, mapSize.width - 50);
      y = MathUtils.clamp(y, 50, mapSize.height - 50);
    }

    return { x, y };
  }

  /** 生成 Boss（类型由关卡 bossType 决定，可做召唤型/弹幕型差异化） */
  private spawnBoss(): void {
    const baseConfig = ENEMY_CONFIGS[this.levelConfig.bossType ?? 'boss'];
    if (!baseConfig) return;
    const config = this.applyLevelTuning(baseConfig);

    const gameScene = this.scene as any;
    const player = gameScene.getPlayer();
    if (!player) return;

    const spawnPos = this.getSpawnPosition(player.x, player.y);
    // Boss 按层级指数增长：第5波=tier1(×1.0), 第10波=tier2(×2.2), 第15波=tier3(×4.84)...
    // 玩家 build 是乘法叠加，线性增长的 Boss 会被碾压，故用指数曲线
    const bossTier = Math.max(1, Math.floor(this.currentWave / GameConfig.WAVE.bossWaveInterval));
    const difficultyMultiplier = Math.pow(2.2, bossTier - 1);

    this.objectPool.spawnEnemy(config, spawnPos.x, spawnPos.y, difficultyMultiplier);
    this.bossActive = true;
    // 演出事件：Boss 实际生成（GameFeedback 订阅播警报演出；纯表现）
    EventBus.emit('boss:spawn', { x: spawnPos.x, y: spawnPos.y, wave: this.currentWave });
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_BOSS_ALERT, 1);
  }

  /** 进入下一波 */
  private nextWave(): void {
    this.waveActive = false;

    // 通关判定：打完第 victoryWave 波且未进入无尽 → 弹通关结算（继续征战/结束征程）
    // 无尽模式下不拦截，波次继续无限增长，Boss 每 bossWaveInterval 波继续增强
    if (this.currentWave >= GameConfig.WAVE.victoryWave && !(this.scene as any).isEndlessMode?.()) {
      // 通关清敌：波次为计时制（waveDuration 到即通关），清完 boss 后小怪仍会残留/继续生成。
      // 若不清空，弹窗前的 2s 空档里低血量玩家会被残留敌人打死 → 直接 GameOver 且清存档，
      // "继续征战"窗口永远弹不出来。先清敌再弹窗，玩家安全进入通关结算。
      this.objectPool.despawnAllEnemies();
      const gameScene = this.scene as any;
      if (gameScene.activeBoss) gameScene.activeBoss = null;
      this.scene.time.delayedCall(2000, () => {
        (this.scene as any).openEndlessChoice?.();
      });
      return;
    }

    const next = this.currentWave + 1;
    const isBossWave = next % GameConfig.WAVE.bossWaveInterval === 0;
    // 刚打完 Boss 波（当前波是 Boss 波）→ 弹武器强化三选一作为战力成长奖励
    const justBeatBoss = this.currentWave % GameConfig.WAVE.bossWaveInterval === 0;
    // 前期武器前置：非 Boss 波的第 3、7 波结束也发一次武器强化，
    // 避免玩家前期只有初始武器、干等到第 5/10 波商店/ Boss 才拿到武器（"前期太穷/到十波才有武器"）
    const justWeaponReward = this.currentWave === 3 || this.currentWave === 7;

    // 短暂间隔后：Boss 波后→武器强化；前期武器奖励波→武器强化；Boss 波前→战前商店；普通→直接下一波
    this.scene.time.delayedCall(2000, () => {
      if (justBeatBoss) {
        (this.scene as any).openWeaponSelectAfterBoss?.(next);
      } else if (justWeaponReward) {
        (this.scene as any).openWeaponSelectAfterBoss?.(next);
      } else if (isBossWave) {
        (this.scene as any).openShopBeforeBoss?.(next);
      } else {
        this.startWave(next);
      }
    });
  }

  // ========== Getters ==========

  getCurrentWave(): number {
    return this.currentWave;
  }

  getWaveProgress(): number {
    return Math.min(1, this.waveTimer / GameConfig.WAVE.waveDuration);
  }

  getWaveTimeRemaining(): number {
    return Math.max(0, GameConfig.WAVE.waveDuration - this.waveTimer);
  }

  isBossWave(): boolean {
    return this.currentWave % GameConfig.WAVE.bossWaveInterval === 0;
  }

  isBossActive(): boolean {
    return this.bossActive;
  }

  /** 直接生成敌人（供外部调用） */
  spawnEnemy(config: EnemyConfig, x: number, y: number): void {
    const difficultyMultiplier = 1 + (this.currentWave - 1) * 0.1;
    this.objectPool.spawnEnemy(config, x, y, difficultyMultiplier);
  }
}
