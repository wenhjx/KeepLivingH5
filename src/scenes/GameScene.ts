import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import { ObjectPool } from '../systems/ObjectPool';
import { WaveManager } from '../systems/WaveManager';
import { InputManager } from '../systems/InputManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import { AudioManager } from '../systems/AudioManager';
import { GuideManager } from '../systems/GuideManager';
import { DamageTextManager } from '../ui/DamageTextManager';
import { TerrainManager } from '../systems/TerrainManager';
import { DEFAULT_TERRAIN } from '../data/terrain';
import { EventBus } from '../utils/EventBus';
import type { EnemyConfig, PickupConfig } from '../types';

/**
 * 游戏主场景
 * 核心玩法场景，管理玩家、敌人、子弹、拾取物、波次等所有游戏实体
 */
export class GameScene extends Phaser.Scene {
  // 核心系统
  private player!: Player;
  private objectPool!: ObjectPool;
  private waveManager!: WaveManager;
  private inputManager!: InputManager;
  private collisionSystem!: CollisionSystem;
  private audioManager!: AudioManager;
  private damageTextManager!: DamageTextManager;
  private terrainManager!: TerrainManager;
  private activeBoss: Enemy | null = null;
  private pendingLevelUps = 0;
  private upgradeQueued = false;
  // Boss 战前待弹出的商店（与升级选择排队，避免同时弹出冲突）
  private pendingShop = false;
  // 商店关闭后要开始的 Boss 波（0 = 无待开始）
  private pendingBossWave = 0;

  // 实体组
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private particles!: Phaser.GameObjects.Group;

  // 地图
  private mapWidth = 3000;
  private mapHeight = 3000;

  // 计时器
  private autoSaveTimer = 0;
  // 是否为"继续游戏"恢复模式
  private resumeMode = false;

  constructor() {
    super('GameScene');
  }

  init(): void {
    const gm = GameManager.getInstance();
    // 存在进行中对局存档时进入恢复模式，否则开始新对局
    if (gm.hasSavedRun()) {
      this.resumeMode = true;
      gm.restoreRun();
    } else {
      this.resumeMode = false;
      gm.startNewRun();
    }
  }

  create(): void {
    this.initSystems();
    this.createMap();
    this.createEntities();
    this.setupCollisions();
    this.setupCamera();
    this.setupEventListeners();

    // 启动波次（继续游戏时恢复到存档波次，否则第 1 波）
    const startWave = this.resumeMode ? (GameManager.getInstance().pendingRun?.wave ?? 1) : 1;
    this.waveManager.startWave(startWave);

    // 延迟触发新手引导（等 UIScene 绑定 GuideManager 后）
    this.time.delayedCall(800, () => {
      this.triggerTutorial();
    });

    // 场景关闭兜底：如果本局尚未结束（非正常死亡），自动保存数据
    // 防止通过暂停菜单或其他方式退出时丢失本局记录
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const gm = GameManager.getInstance();
      if (!gm.isGameOver) {
        gm.endRun();
      }
    });
  }

  /**
   * 触发新手引导队列
   * 依次显示基础操作提示，玩家逐个点击"知道了"继续
   */
  private triggerTutorial(): void {
    const guide = GuideManager.getInstance();
    const isMobile = GameManager.getInstance().isMobile;

    const moveDesc = isMobile
      ? '拖动左侧虚拟摇杆控制角色移动'
      : '按 W A S D 或方向键控制角色移动';

    guide.queueAll([
      {
        title: '移动',
        description: moveDesc,
        icon: '🎮',
        color: 0x00ffff,
        position: 'top',
      },
      {
        title: '自动攻击',
        description: '武器会自动瞄准最近的敌人发射子弹\n你只需要走位躲避，无需手动攻击',
        icon: '⚔️',
        color: 0xff6b35,
        position: 'top',
      },
      {
        title: '经验与升级',
        description: '击杀敌人掉落经验宝石，走过去自动拾取\n升级后可选择新武器或属性强化',
        icon: '⬆️',
        color: 0xffb347,
        position: 'top',
      },
      {
        title: '生存目标',
        description: '波次每30秒推进，敌人越来越强\n每5波出现Boss，尽可能存活更久！\n按 ESC 可暂停游戏',
        icon: '💀',
        color: 0xff4466,
        position: 'top',
        duration: 6000,
      },
    ]);
  }

  private initSystems(): void {
    // 对象池
    this.objectPool = new ObjectPool(this);

    // 输入管理
    this.inputManager = new InputManager(this);

    // 波次管理
    this.waveManager = new WaveManager(this, this.objectPool);

    // 碰撞系统
    this.collisionSystem = new CollisionSystem(this);

    // 伤害数字
    this.damageTextManager = new DamageTextManager(this);

    // 地形管理（数据驱动，可扩展；以后新增区域调用 setTerrain 切换）
    this.terrainManager = new TerrainManager(this, DEFAULT_TERRAIN);

    // 音频管理
    this.audioManager = AudioManager.getInstance();
    this.audioManager.init(this);
  }

  private createMap(): void {
    // 创建 tiled 地图（占位：使用纯色背景 + 网格）
    const graphics = this.add.graphics();

    // 背景
    graphics.fillStyle(0x12121a, 1);
    graphics.fillRect(0, 0, this.mapWidth, this.mapHeight);

    // 网格线
    graphics.lineStyle(1, 0x1e1e2a, 0.5);
    const gridSize = 100;
    for (let x = 0; x <= this.mapWidth; x += gridSize) {
      graphics.lineBetween(x, 0, x, this.mapHeight);
    }
    for (let y = 0; y <= this.mapHeight; y += gridSize) {
      graphics.lineBetween(0, y, this.mapWidth, y);
    }

    // 地图边界
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // 创建地形障碍物（在地图背景之上）
    this.terrainManager.create();
  }

  private createEntities(): void {
    const centerX = this.mapWidth / 2;
    const centerY = this.mapHeight / 2;

    // 创建玩家
    this.player = new Player(this, centerX, centerY);

    // 创建实体组
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.particles = this.add.group();

    // 将对象池与组关联
    this.objectPool.setGroups(this.enemies, this.bullets, this.pickups, this.particles);

    // 继续游戏：恢复玩家状态（等级/武器/被动/属性）
    if (this.resumeMode) {
      const pending = GameManager.getInstance().pendingRun;
      if (pending) {
        this.player.applySavedState(pending.player);
      }
    }
  }

  private setupCollisions(): void {
    // 玩家与敌人碰撞（受伤）
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (player, enemy) => this.collisionSystem.playerEnemyCollision(player, enemy),
      undefined,
      this
    );

    // 子弹与敌人碰撞（伤害）
    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      (bullet, enemy) => this.collisionSystem.bulletEnemyCollision(bullet, enemy),
      undefined,
      this
    );

    // 玩家与拾取物碰撞
    this.physics.add.overlap(
      this.player,
      this.pickups,
      (player, pickup) => this.collisionSystem.playerPickupCollision(player, pickup),
      undefined,
      this
    );

    // 敌人子弹与玩家碰撞（受伤）
    // 注意：Phaser overlap(sprite, group) 的回调参数顺序为 (sprite, groupChild)，
    // 因此这里 player 在前、bullet 在后，回调内再交换回 (bullet, player)
    this.physics.add.overlap(
      this.player,
      this.bullets,
      (player, bullet) => this.collisionSystem.enemyBulletPlayerCollision(bullet, player),
      undefined,
      this
    );

    // 敌人之间的分离（避免重叠）
    this.physics.add.collider(this.enemies, this.enemies);

    // ===== 地形障碍物碰撞 =====
    const obstacleGroup = this.terrainManager.getObstacleGroup();
    // 玩家/敌人被障碍物阻挡
    this.physics.add.collider(this.player, obstacleGroup);
    this.physics.add.collider(this.enemies, obstacleGroup);
    // 子弹碰到障碍物销毁（爆炸子弹先触发爆炸）
    this.physics.add.overlap(
      this.bullets,
      obstacleGroup,
      (bullet) => {
        const b = bullet as any;
        if (b.explosive) {
          EventBus.emit('bullet:explode', {
            x: b.x,
            y: b.y,
            damage: b.damage,
            radius: b.aoeRadius || 80,
          });
        }
        b.despawn?.();
      }
    );
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.startFollow(this.player, true, 0.1, 0.1);
    camera.setBounds(0, 0, this.mapWidth, this.mapHeight);
    camera.setZoom(GameConfig.renderScale);
  }

  private setupEventListeners(): void {
    // 玩家死亡
    EventBus.on('player:death', () => this.onPlayerDeath());

    // 复活币生效：清空周围敌人 + 震屏反馈，避免复活瞬间被围死
    EventBus.on('player:revive', () => {
      this.handleExplosion(this.player.x, this.player.y, 9999, 400);
      this.cameras.main.shake(200, 0.006);
    });

    // 玩家升级：跨多级时排队逐个弹出三选一（避免一次性升级丢失选择机会）
    EventBus.on('player:levelup', (level: number) => {
      this.audioManager.playSfx('sfx_levelup');
      this.pendingLevelUps++;
      this.showNextUpgrade();
    });

    // 一次升级选择完成，继续弹出剩余待选升级；全部选完后若 Boss 战前商店待开则弹出
    EventBus.on('upgrade:chosen', () => {
      this.upgradeQueued = false;
      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
      if (this.pendingLevelUps > 0) {
        this.time.delayedCall(250, () => this.showNextUpgrade());
      } else {
        this.time.delayedCall(300, () => this.tryOpenShop());
      }
    });

    // 商店关闭：若之前是为 Boss 波开的（战前补给），则开始该 Boss 波
    EventBus.on('shop:closed', () => {
      if (this.pendingBossWave > 0) {
        const wave = this.pendingBossWave;
        this.pendingBossWave = 0;
        this.waveManager.startWave(wave);
      }
    });

    // 子弹爆炸（火箭筒等）：范围伤害 + 视觉效果
    EventBus.on('bullet:explode', (data: { x: number; y: number; damage: number; radius: number }) => {
      this.handleExplosion(data.x, data.y, data.damage, data.radius);
    });

    // Boss 唯一引用（供 HUD 顶部大血条使用）
    EventBus.on('enemy:spawn', (enemy: Enemy) => {
      if (enemy?.isBoss?.()) this.activeBoss = enemy;
    });
    EventBus.on('enemy:death', (config: EnemyConfig) => {
      if (config?.type === 'boss') {
        this.activeBoss = null;
        // 商店改为 Boss 战前补给（WaveManager 在 Boss 波前触发），Boss 死后不再弹
      }
    });

    // 暂停/恢复：同步暂停物理引擎和补间动画
    // （仅 update return 不够，Arcade 物理世界会独立继续运行）
    EventBus.on('run:pause', (paused: boolean) => {
      if (paused) {
        this.physics.pause();
        this.tweens.pauseAll();
      } else {
        this.physics.resume();
        this.tweens.resumeAll();
      }
    });

    // 暂停切换
    this.input.keyboard?.on('keydown-ESC', () => {
      const gm = GameManager.getInstance();
      gm.setPaused(!gm.isPaused);
    });
  }

  update(time: number, delta: number): void {
    const gm = GameManager.getInstance();

    // 暂停时不更新游戏逻辑
    if (gm.isPaused || gm.isGameOver) return;

    // 更新存活时间
    gm.addSurvivalTime(delta);

    // 更新玩家
    this.player.update(time, delta, this.inputManager);

    // 更新无人机
    this.player.updateDrones(time, delta);

    // 更新波次
    this.waveManager.update(time, delta);

    // 更新所有敌人
    this.enemies.children.each((enemy: any) => {
      if (enemy.active && enemy.update) {
        enemy.update(time, delta, this.player);
      }
      return true;
    });

    // 更新所有子弹
    this.bullets.children.each((bullet: any) => {
      if (bullet.active && bullet.update) {
        bullet.update(time, delta);
      }
      return true;
    });

    // 更新所有拾取物（磁吸效果）
    this.pickups.children.each((pickup: any) => {
      if (pickup.active && pickup.update) {
        pickup.update(time, delta, this.player);
      }
      return true;
    });

    // 自动存档（统计信息 + 进行中对局进度）
    this.autoSaveTimer += delta;
    if (this.autoSaveTimer >= GameConfig.SAVE.autoSaveInterval) {
      this.autoSaveTimer = 0;
      const gm = GameManager.getInstance();
      gm.saveProgress();
      gm.saveRun(this.player);
    }
  }

  private onPlayerDeath(): void {
    const gm = GameManager.getInstance();
    gm.endRun();
    this.pendingShop = false;
    this.pendingBossWave = 0;

    // 延迟切换到结算场景
    this.time.delayedCall(1500, () => {
      this.scene.stop('UIScene');
      this.scene.start('GameOverScene');
    });
  }

  /**
   * 处理爆炸：范围伤害 + 视觉效果
   */
  private handleExplosion(x: number, y: number, damage: number, radius: number): void {
    // 对范围内敌人造成伤害
    this.enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist <= radius) {
        // 距离衰减：中心满伤害，边缘半伤害
        const falloff = 1 - (dist / radius) * 0.5;
        enemy.takeDamage(damage * falloff, false);
      }
      return true;
    });

    // 爆炸视觉效果：外圈 + 内圈
    const outer = this.add.circle(x, y, radius, 0xff6600, 0.4).setDepth(50);
    const inner = this.add.circle(x, y, radius * 0.5, 0xffff00, 0.6).setDepth(51);

    this.tweens.add({
      targets: outer,
      scale: { from: 0.3, to: 1.2 },
      alpha: { from: 0.6, to: 0 },
      duration: 300,
      onComplete: () => outer.destroy(),
    });
    this.tweens.add({
      targets: inner,
      scale: { from: 0.5, to: 1 },
      alpha: { from: 0.8, to: 0 },
      duration: 200,
      onComplete: () => inner.destroy(),
    });

    // 屏幕震动
    this.cameras.main.shake(100, 0.005);
  }

  // ========== 公共接口（供其他系统调用） ==========

  /**
   * 弹出一次升级选择（若有待选升级且当前未在显示中）
   * 跨多级时由 upgrade:chosen 事件驱动逐个弹出
   */
  private showNextUpgrade(): void {
    if (this.pendingLevelUps <= 0 || this.upgradeQueued) return;
    if (this.scene.isActive('UpgradeScene')) return;

    this.upgradeQueued = true;
    GameManager.getInstance().setPaused(true);
    this.scene.launch('UpgradeScene');
  }

  /**
   * 弹出神秘商店（若 Boss 战前待开且当前无升级/商店在显示中）
   * 保证与升级三选一排队，不冲突
   */
  private tryOpenShop(): void {
    if (!this.pendingShop) return;
    if (this.pendingLevelUps > 0 || this.upgradeQueued) return;
    if (this.scene.isActive('UpgradeScene') || this.scene.isActive('ShopScene')) return;
    const gm = GameManager.getInstance();
    if (gm.isGameOver) return;

    this.pendingShop = false;
    gm.setPaused(true);
    this.scene.launch('ShopScene');
  }

  /**
   * Boss 战前补给点：商店关闭后开始指定 Boss 波
   * 由 WaveManager 在进入 Boss 波前调用
   */
  openShopBeforeBoss(wave: number): void {
    if (this.scene.isActive('ShopScene')) return;
    this.pendingShop = true;
    this.pendingBossWave = wave;
    this.tryOpenShop();
  }

  /** 弹出浮动伤害数字（供碰撞系统调用） */
  spawnDamageText(x: number, y: number, damage: number, isCrit: boolean = false): void {
    this.damageTextManager?.show(x, y, damage, isCrit);
  }

  /** 当前唯一的 Boss（无则 null，供 HUD 顶部血条使用） */
  getActiveBoss(): Enemy | null {
    return this.activeBoss;
  }

  getPlayer(): Player {
    return this.player;
  }

  getEnemies(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }

  getBullets(): Phaser.Physics.Arcade.Group {
    return this.bullets;
  }

  getPickups(): Phaser.Physics.Arcade.Group {
    return this.pickups;
  }

  getObjectPool(): ObjectPool {
    return this.objectPool;
  }

  getInputManager(): InputManager {
    return this.inputManager;
  }

  getMapSize(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }

  /** 地形管理器（供小地图渲染障碍物轮廓） */
  getTerrainManager(): TerrainManager {
    return this.terrainManager;
  }

  spawnEnemy(config: EnemyConfig, x: number, y: number): void {
    this.waveManager.spawnEnemy(config, x, y);
  }

  spawnPickup(config: PickupConfig, x: number, y: number): void {
    // 金币受幸运值影响（掉落量提升，幸运 +10 → 金币 +10%）
    if (config.type === 'coin' && this.player) {
      const luck = this.player.getStats().luck || 0;
      if (luck > 0) {
        config = { ...config, value: Math.max(1, Math.round(config.value * (1 + luck / 100))) };
      }
    }
    this.objectPool.spawnPickup(config, x, y);
  }
}
