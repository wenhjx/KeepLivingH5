import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { GameManager } from '../game/GameManager';
import { MathUtils } from '../utils/MathUtils';
import type { ObjectPool } from './ObjectPool';
import type { EnemyConfig, EnemyType, WaveConfig } from '../types';
import { ENEMY_CONFIGS } from '../data/enemies';

/**
 * 波次管理器
 * 控制怪物波次生成、难度递增、Boss 出现逻辑
 */
export class WaveManager {
  private scene: Phaser.Scene;
  private objectPool: ObjectPool;

  private currentWave: number = 1;
  private waveTimer: number = 0;
  private spawnTimer: number = 0;
  private waveActive: boolean = false;
  private bossActive: boolean = false;

  // 当前波次的生成表
  private currentSpawnTable: { type: EnemyType; weight: number }[] = [];

  constructor(scene: Phaser.Scene, objectPool: ObjectPool) {
    this.scene = scene;
    this.objectPool = objectPool;
  }

  /** 开始指定波次 */
  startWave(wave: number): void {
    this.currentWave = wave;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.waveActive = true;
    this.bossActive = false;

    GameManager.getInstance().setWave(wave);

    // 构建生成表
    this.buildSpawnTable(wave);

    // Boss 波
    if (wave % GameConfig.WAVE.bossWaveInterval === 0) {
      this.spawnBoss();
    }
  }

  /** 构建当前波次的敌人生成权重表 */
  private buildSpawnTable(wave: number): void {
    this.currentSpawnTable = [];

    // 基础敌人始终出现
    this.currentSpawnTable.push({ type: 'normal', weight: 100 });

    // 第2波开始出现快速敌人
    if (wave >= 2) {
      this.currentSpawnTable.push({ type: 'fast', weight: 30 + wave * 2 });
    }

    // 第3波开始出现坦克
    if (wave >= 3) {
      this.currentSpawnTable.push({ type: 'tank', weight: 15 + wave });
    }

    // 第4波开始出现远程
    if (wave >= 4) {
      this.currentSpawnTable.push({ type: 'ranged', weight: 10 + wave });
    }

    // 第6波开始出现精英
    if (wave >= 6) {
      this.currentSpawnTable.push({ type: 'elite', weight: 5 + wave * 0.5 });
    }
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
    const config = ENEMY_CONFIGS[enemyType];
    if (!config) return;

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

  /** 生成 Boss */
  private spawnBoss(): void {
    const config = ENEMY_CONFIGS['boss'];
    if (!config) return;

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
  }

  /** 进入下一波 */
  private nextWave(): void {
    this.waveActive = false;

    const next = this.currentWave + 1;
    const isBossWave = next % GameConfig.WAVE.bossWaveInterval === 0;

    // 短暂间隔后开始下一波；Boss 波前先弹商店（战前补给点），商店关闭后再开打
    this.scene.time.delayedCall(2000, () => {
      if (isBossWave) {
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
