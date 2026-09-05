import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { WEAPONS } from '../data/weapons';
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
import { ModifierSystem } from '../systems/ModifierSystem';
import { FXManager } from '../systems/FXManager';
import { getLevelByIndex, type LevelConfig, type QuickStartConfig } from '../data/levels';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { GameFeedback } from '../systems/GameFeedback';
import { EventBus } from '../utils/EventBus';
import { SOUND_KEYS } from '../data/sounds';
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
  /** 当前关卡配置（数据驱动：地形/敌人构成/规则/Boss/直进包） */
  private levelConfig!: LevelConfig;
  /** 关卡特殊规则（嗜血/霜蚀） */
  private modifierSystem!: ModifierSystem;
  private fxManager!: FXManager;
  private gameFeedback!: GameFeedback;
  private activeBoss: Enemy | null = null;
  private pendingLevelUps = 0;
  private upgradeQueued = false;
  // 调试：怪物增强倍率（血量/攻击），作用于新生成敌人，方便测试阈值
  enemyHpBoost = 1;
  enemyAtkBoost = 1;
  // Boss 战前待弹出的商店（与升级选择排队，避免同时弹出冲突）
  private pendingShop = false;
  // 商店关闭后要开始的 Boss 波（0 = 无待开始）
  private pendingBossWave = 0;
  // 武器强化选择待弹出（击败 Boss 后，与升级/商店/突破排队）
  private pendingWeaponSelect = false;
  // 武器强化选择完成后要开始的波（0 = 无待开始）
  private pendingWeaponWave = 0;
  // 通关胜利已触发（防止与死亡路径重复进入结算）
  private victoryTriggered = false;
  // 无尽模式：通关结算选择"继续征战"后为 true，波次无限增长不再触发通关
  private endlessMode = false;
  // 通关窗口延迟重试防抖（遇其他模态时 500ms 后重试，避免窗口被守卫吞掉）
  private _endlessChoiceRetry = false;
  // 全局游戏速度（调试 0.25~4 倍速，默认 1）：同步 Arcade 物理 / 补间 / 逻辑 delta
  private gameSpeed = 1;

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
  /** 时间减速系数（时间减速药水）：1=正常，<1 敌人变慢 */
  private slowFactor = 1;
  // 是否为"继续游戏"恢复模式
  private resumeMode = false;
  // 页面刷新/关闭前的存档回调
  private beforeUnloadHandler: (() => void) | null = null;
  // EventBus 监听器取消函数（场景关闭时统一清理，防止重复注册导致事件多次触发）
  private eventUnsubscribers: Array<() => void> = [];
  // AI 自动玩模式（__debug.autoPlay() 开启）
  private autoPlayEnabled = false;
  // AI 人类化：决策间隔（不每帧重新计算方向）
  private aiDecisionTimer = 0;
  private aiCurrentDir = { x: 0, y: 0 };
  private aiHesitateTimer = 0;
  // AI 使用物品的冷却计时（不每帧判断）
  private aiItemUseTimer = 0;

  constructor() {
    super('GameScene');
  }

  init(): void {
    const gm = GameManager.getInstance();
    // 启动分流：
    //  1) 内存 pendingRun（跨关继承，advanceToNextLevel 设置）→ 恢复模式
    //  2) 本地进行中存档（继续游戏）→ 恢复模式
    //  3) 全新对局（MainMenu 开始/直进选关时已 startNewRun(level)）
    if (gm.pendingRun) {
      this.resumeMode = true;
    } else if (gm.hasSavedRun()) {
      this.resumeMode = true;
      gm.restoreRun();
    } else {
      this.resumeMode = false;
    }
  }

  create(): void {
    // 每局状态重置：Phaser 场景实例复用（scene.start 不重建对象，字段保留上次值），
    // 必须显式清空，否则同页面重开后 endlessMode/victoryTriggered/待弹队列会残留。
    this.endlessMode = false;
    this.victoryTriggered = false;
    this.pendingShop = false;
    this.pendingBossWave = 0;
    this.pendingWeaponSelect = false;
    this.pendingWeaponWave = 0;
    this.pendingLevelUps = 0;
    this.upgradeQueued = false;
    this.activeBoss = null;

    this.initSystems();
    this.createMap();
    this.createEntities();
    this.setupCollisions();
    this.setupCamera();
    this.setupEventListeners();

    // 页面刷新/关闭前强制存档（Phaser SHUTDOWN 在页面卸载时可能来不及执行）
    this.beforeUnloadHandler = () => {
      const gm = GameManager.getInstance();
      if (!gm.isGameOver) {
        gm.saveRun(this.player);
        gm.saveProgress();
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    // 启动波次（继续游戏时恢复到存档波次，否则第 1 波）
    const startWave = this.resumeMode ? (GameManager.getInstance().pendingRun?.wave ?? 1) : 1;
    this.waveManager.startWave(startWave);

    // 延迟触发新手引导（等 UIScene 绑定 GuideManager 后）
    // 新手引导仅新游戏触发，恢复模式不弹
    if (!this.resumeMode) {
      this.time.delayedCall(800, () => {
        this.triggerTutorial();
      });
    }

    // 场景关闭兜底：
    // - 死亡时：onPlayerDeath 已调用 endRun()（清除存档），此处不再重复处理
    // - 主动离开时：保存最新对局状态 + 统计，但保留 run 存档，供"继续游戏"恢复
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // 清理 EventBus 监听器
      this.eventUnsubscribers.forEach((unsub) => unsub());
      this.eventUnsubscribers = [];

      // 清理演出层订阅与横幅
      this.gameFeedback?.destroy();

      // 移除页面卸载前的存档监听
      if (this.beforeUnloadHandler) {
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        this.beforeUnloadHandler = null;
      }

      const gm = GameManager.getInstance();
      if (!gm.isGameOver) {
        // 主动离开：先保存最新对局状态（避免丢失最近一次自动存档后的进度）
        gm.saveRun(this.player);
        gm.exitRun();
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
        position: 'top-right',
        duration: 3500,
      },
      {
        title: '自动攻击',
        description: '武器会自动瞄准最近的敌人发射子弹\n你只需要走位躲避，无需手动攻击',
        icon: '⚔️',
        color: 0xff6b35,
        position: 'top-right',
        duration: 3500,
      },
      {
        title: '经验与升级',
        description: '击杀敌人掉落经验宝石，走过去自动拾取\n升级后可选择新武器或属性强化',
        icon: '⬆️',
        color: 0xffb347,
        position: 'top-right',
        duration: 3500,
      },
      {
        title: '生存目标',
        description: '波次每30秒推进，敌人越来越强\n每5波出现Boss，尽可能存活更久！\n按 ESC 可暂停游戏',
        icon: '💀',
        color: 0xff4466,
        position: 'top-right',
        duration: 6000,
      },
    ]);
  }

  private initSystems(): void {
    // 对象池
    this.objectPool = new ObjectPool(this);

    // 输入管理
    this.inputManager = new InputManager(this);

    // 当前关卡配置（数据驱动）
    this.levelConfig = getLevelByIndex(GameManager.getInstance().currentLevelIndex);

    // 波次管理（消费关卡配置：敌人构成 / Boss 类型 / 数值倍率）
    this.waveManager = new WaveManager(this, this.objectPool, this.levelConfig);

    // 碰撞系统
    this.collisionSystem = new CollisionSystem(this);

    // 伤害数字
    this.damageTextManager = new DamageTextManager(this);

    // 地形管理（消费关卡地形：障碍物 + 减速区）
    this.terrainManager = new TerrainManager(this, this.levelConfig.terrain);

    // 关卡特殊规则（嗜血回血 / 霜蚀掉血）
    this.modifierSystem = new ModifierSystem(this);
    this.modifierSystem.setModifiers(this.levelConfig.modifiers ?? []);

    // 音频管理
    this.audioManager = AudioManager.getInstance();
    this.audioManager.init(this);

    // 视觉特效统一入口（所有命中/死亡/爆炸/升级/拾取/枪口闪光走这里）
    this.fxManager = new FXManager(this);

    // 演出/反馈层（波次横幅/Boss演出/暴击震屏顿帧，纯表现，通过事件总线与玩法解耦）
    this.gameFeedback = new GameFeedback(this);
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

    // 继续游戏 / 跨关继承：恢复玩家状态（等级/武器/被动/属性）
    if (this.resumeMode) {
      const pending = GameManager.getInstance().pendingRun;
      if (pending) {
        this.player.applySavedState(pending.player);
        // 跨关继承时回满血（进入新区域前满状态，玩家在上一关的损耗不计入）
        this.player.heal(this.player.getMaxHealth());
      }
    } else {
      // 直进模式（主菜单选关）：应用快速开局包，补偿跳过前几关缺失的 build 积累
      const gm = GameManager.getInstance();
      const qs = gm.quickStart;
      if (qs) {
        this.applyQuickStart(qs);
        gm.clearQuickStart();
      }
    }
  }

  /** 应用直进模式快速开局包（复用 applySavedState 重建 build，再补等级/金币） */
  private applyQuickStart(qs: QuickStartConfig): void {
    const p = this.player;
    const stats = p.getStats();
    if (qs.startLevel && qs.startLevel > 1) {
      stats.level = qs.startLevel;
    }
    p.applySavedState({
      stats,
      weapons: qs.weapons ?? [],
      passives: (qs.passives ?? []).map((x) => ({ id: x.id, name: '', level: x.level })),
      statUpgrades: (qs.statUpgrades ?? []).map((x) => ({ id: x.id, name: '', level: x.level })),
      breakthroughs: [],
      inventory: qs.inventory ?? [],
    });
    // applySavedState 只重建 stat 升级记录，不修改 stats 本身；
    // 这里按记录的应用次数补上真实属性加成（与升级/商店入口一致，走 modifyStat）
    if (qs.statUpgrades) {
      for (const su of qs.statUpgrades) {
        const opt = UPGRADE_OPTIONS.find((u) => u.id === su.id);
        if (opt?.effect?.stat) {
          for (let i = 0; i < su.level; i++) {
            p.modifyStat(opt.effect.stat, opt.effect.value ?? 0, opt.effect.isPercent ?? false);
          }
        }
      }
    }
    // 直进开局默认满血（生命强化自带回血，也避免低血量开局暴毙）
    p.heal(p.getMaxHealth());
    if (qs.coins) p.addCoins(qs.coins);
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
    // 子弹碰到障碍物：可破坏木箱扣血（血空销毁并掉落），不可破坏的销毁（爆炸子弹先爆炸）
    this.physics.add.overlap(
      this.bullets,
      obstacleGroup,
      (bullet, obstacle) => {
        const b = bullet as any;
        const obs = obstacle as Phaser.GameObjects.Image;
        // 可破坏障碍物（木箱）：受击扣血，血空销毁并掉落奖励
        if (obs.getData?.('destructible')) {
          const dmg = b.getDamage?.() ?? b.damage ?? 1;
          const destroyed = this.terrainManager.damageObstacle(obs, dmg);
          if (destroyed) {
            this.dropCrateLoot(obs.x, obs.y);
          } else {
            // 受击反馈：白闪
            obs.setTintFill(0xffffff);
            this.time.delayedCall(60, () => obs.clearTint());
          }
          b.despawn?.();
          return;
        }
        // 不可破坏障碍物：原逻辑
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
    const sub = (fn: () => void) => this.eventUnsubscribers.push(fn);

    // 玩家死亡
    sub(EventBus.on('player:death', () => this.onPlayerDeath()));

    // 复活币生效：清空周围敌人 + 震屏反馈，避免复活瞬间被围死
    sub(EventBus.on('player:revive', () => {
      this.handleExplosion(this.player.x, this.player.y, 9999, 400);
      this.cameras.main.shake(200, 0.006);
    }));

    // 玩家升级：跨多级时排队逐个弹出三选一（避免一次性升级丢失选择机会）
    sub(EventBus.on('player:levelup', (level: number) => {
      this.audioManager.playSfx('sfx_levelup');
      this.fxManager.levelUp(this.player.x, this.player.y);
      this.pendingLevelUps++;
      this.showNextUpgrade();
    }));

    // 一次升级选择完成，继续弹出剩余待选升级；全部选完后若 Boss 战前商店待开则弹出
    sub(EventBus.on('upgrade:chosen', () => {
      this.upgradeQueued = false;
      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
      if (this.pendingLevelUps > 0) {
        this.time.delayedCall(250, () => this.showNextUpgrade());
      } else {
        // 升级排队清空后同时重试商店与武器强化排队，避免任一方被升级阻塞后死锁
        // （修复：Boss 波结束瞬间恰好有升级排队时，WeaponSelectScene 永不弹出的卡死）
        this.time.delayedCall(300, () => {
          this.tryOpenShop();
          this.tryOpenWeaponSelect();
        });
      }
    }));

    // 商店关闭：若还有武器强化排队则优先补开（防御并发），否则若之前是为 Boss 波
    // 开的（战前补给），则开始该 Boss 波
    sub(EventBus.on('shop:closed', () => {
      if (this.pendingWeaponSelect) {
        this.tryOpenWeaponSelect();
        return;
      }
      if (this.pendingBossWave > 0) {
        const wave = this.pendingBossWave;
        this.pendingBossWave = 0;
        this.waveManager.startWave(wave);
      }
    }));

    // 武器强化选择完成：开始之前排队的下一波
    sub(EventBus.on('weaponselect:closed', () => {
      if (this.pendingWeaponWave > 0) {
        const wave = this.pendingWeaponWave;
        this.pendingWeaponWave = 0;
        this.waveManager.startWave(wave);
      }
    }));

    // 通关结算：继续征战 → 进入无尽模式，波次继续增长
    sub(EventBus.on('endlesschoice:continue', () => {
      const gm = GameManager.getInstance();
      gm.setPaused(false);
      this.scene.stop('EndlessChoiceScene');
      this.enterEndlessMode();
      this.waveManager.startWave(this.waveManager.getCurrentWave() + 1);
    }));

    // 通关结算：结束征程 → 结算胜利
    sub(EventBus.on('endlesschoice:end', () => {
      GameManager.getInstance().setPaused(false);
      this.scene.stop('EndlessChoiceScene');
      this.triggerVictory();
    }));

    // 关卡化：进入下一关 → 跨关继承 build 并重启（地形/波次/规则全部按新关配置重建）
    sub(EventBus.on('endlesschoice:nextlevel', () => {
      const gm = GameManager.getInstance();
      gm.setPaused(false);
      this.scene.stop('EndlessChoiceScene');
      gm.advanceToNextLevel(this.player);
      this.scene.start('GameScene');
    }));

    // 子弹爆炸（火箭筒等）：范围伤害 + 视觉效果
    sub(EventBus.on('bullet:explode', (data: { x: number; y: number; damage: number; radius: number }) => {
      this.handleExplosion(data.x, data.y, data.damage, data.radius);
    }));

    // Boss 唯一引用（供 HUD 顶部大血条使用）
    sub(EventBus.on('enemy:spawn', (enemy: Enemy) => {
      if (enemy?.isBoss?.()) this.activeBoss = enemy;
    }));
    sub(EventBus.on('enemy:death', (config: EnemyConfig) => {
      // 关卡规则：嗜血（击杀回血）
      this.modifierSystem.onEnemyKilled(this.player);
      if (config?.type === 'boss') {
        this.activeBoss = null;
        // Boss 战利品：弹出突破奖励（已满级 stat 突破 +1 级）
        this.triggerBreakthrough();
      }
    }));

    // 暂停/恢复：同步暂停物理引擎和补间动画
    // （仅 update return 不够，Arcade 物理世界会独立继续运行）
    sub(EventBus.on('run:pause', (paused: boolean) => {
      if (paused) {
        this.physics.pause();
        this.tweens.pauseAll();
      } else {
        this.physics.resume();
        this.tweens.resumeAll();
      }
    }));

    // 暂停切换
    this.input.keyboard?.on('keydown-ESC', () => {
      const gm = GameManager.getInstance();
      gm.setPaused(!gm.isPaused);
    });

    // 按 C 打开/关闭玩家属性面板（二游式角色详情）
    // 注意：UIScene/PlayerInfoScene 的键盘监听不生效，统一放在 GameScene（与 ESC 一致）
    this.input.keyboard?.on('keydown-C', () => {
      const gm = GameManager.getInstance();
      if (gm.isGameOver) return;
      if (this.scene.isActive('PlayerInfoScene')) {
        // 已打开 → 关闭（恢复打开前的暂停状态）
        const pi = this.scene.get('PlayerInfoScene') as any;
        pi?.closePanel?.();
        return;
      }
      if (this.scene.isActive('UpgradeScene') || this.scene.isActive('ShopScene') ||
          this.scene.isActive('WeaponSelectScene') || this.scene.isActive('BreakthroughScene')) return;
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      const prevPaused = gm.isPaused; // 记录打开前状态，供关闭时恢复
      gm.setPaused(true);
      this.scene.launch('PlayerInfoScene', { prevPaused });
    });
  }

  update(time: number, delta: number): void {
    const gm = GameManager.getInstance();

    // 暂停时不更新游戏逻辑
    if (gm.isPaused || gm.isGameOver) return;

    // 全局时间缩放（调试 0.25~4 倍速）：缩放本帧逻辑 delta。
    // 移动走 Arcade 物理（physics.world.timeScale 同步）、补间走 tweens.timeScale，
    // 此处只负责冷却/计时/AI/拾取等逻辑层，互不叠加。
    const d = delta * this.gameSpeed;

    // 更新存活时间
    gm.addSurvivalTime(d);

    // AI 自动玩：计算移动方向（躲敌人 / 捡经验）
    if (this.autoPlayEnabled) {
      this.updateAIDirection(d);
      this.updateAIItems(d);
    }

    // 地形减速区：按玩家所在区域设置移动倍率（冰原减速区）
    this.player.movementMultiplier = this.terrainManager.getSlowFactorAt(this.player.x, this.player.y);

    // 关卡特殊规则（霜蚀持续掉血；内部每帧按秒结算）
    this.modifierSystem.update(d, this.player);

    // 更新玩家
    this.player.update(time, d, this.inputManager);

    // 更新无人机
    this.player.updateDrones(time, d);

    // 更新波次
    this.waveManager.update(time, d);

    // 更新所有敌人
    this.enemies.children.each((enemy: any) => {
      if (enemy.active && enemy.update) {
        enemy.update(time, d, this.player);
      }
      return true;
    });

    // 更新所有子弹
    this.bullets.children.each((bullet: any) => {
      if (bullet.active && bullet.update) {
        bullet.update(time, d);
      }
      return true;
    });

    // 更新所有拾取物（磁吸效果）
    this.pickups.children.each((pickup: any) => {
      if (pickup.active && pickup.update) {
        pickup.update(time, d, this.player);
      }
      return true;
    });

    // 接近 Boss 时自动激活商店购买的待生效 buff（护盾/狂暴），避免赶路时浪费持续时间
    if (this.activeBoss && this.activeBoss.active && this.player.hasPendingBossBuffs()) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.activeBoss.x, this.activeBoss.y
      );
      if (dist < 450) {
        this.player.triggerPendingBossBuffs();
      }
    }

    // 自动存档（统计信息 + 进行中对局进度）
    this.autoSaveTimer += d;
    if (this.autoSaveTimer >= GameConfig.SAVE.autoSaveInterval) {
      this.autoSaveTimer = 0;
      const gm = GameManager.getInstance();
      gm.saveProgress();
      gm.saveRun(this.player);
    }

    // 物理倍速：所有实体已在本帧 setVelocity 原始值，统一缩放 body 速度以维持 gameSpeed 倍移动
    this.applySpeedToBodies();
  }

  private onPlayerDeath(): void {
    if (this.victoryTriggered) return;
    this.victoryTriggered = true;
    const gm = GameManager.getInstance();
    gm.endRun();
    this.pendingShop = false;
    this.pendingBossWave = 0;
    this.pendingWeaponSelect = false;
    this.pendingWeaponWave = 0;

    // 玩家死亡消散特效：青色粒子上升消散 + 本体淡出缩放到 0.15
    const p = this.player;
    this.fxManager.playerDeath(p.x, p.y);
    p.setVisible(true);
    p.setAlpha(1);
    this.tweens.add({
      targets: p,
      alpha: 0,
      scale: 0.15,
      duration: 550,
      onComplete: () => {
        p.setVisible(false);
        p.setScale(1);
        p.setAlpha(1);
      },
    });

    // 延迟切换到结算场景（等消散动画播完）
    this.time.delayedCall(1500, () => {
      this.scene.stop('UIScene');
      this.scene.start('GameOverScene');
    });
  }

  /**
   * 通关胜利：打完第 victoryWave 波后由 WaveManager.nextWave 触发
   * 结算数据走 completeRun（标记 isVictory），延迟等庆祝特效播完再进胜利结算
   */
  triggerVictory(): void {
    if (this.victoryTriggered) return;
    this.victoryTriggered = true;
    const gm = GameManager.getInstance();
    gm.completeRun();
    this.pendingShop = false;
    this.pendingBossWave = 0;
    this.pendingWeaponSelect = false;
    this.pendingWeaponWave = 0;

    // 胜利庆祝特效：金色粒子向上升腾 + 双环扩散
    this.fxManager.victory(this.player.x, this.player.y);

    this.time.delayedCall(1500, () => {
      this.scene.stop('UIScene');
      this.scene.start('GameOverScene', { mode: 'victory' });
    });
  }

  /**
   * 设置全局游戏速度（0.25~4 倍速调试）。
   * 三层联动：① 补间 tweens.timeScale；② 逻辑层 delta 在 update 中缩放；③ 物理移动靠每帧统一缩放 body velocity。
   * 注意：Arcade world.timeScale 是"帧率节流"参数（msPerFrame = frameTime * timeScale），并非时间缩放，
   * 设大反而让物理更新变稀疏、body 移动变慢（实测 4x 时敌人位移反而约为 1/4），故绝不使用它变速。
   */
  setGameSpeed(speed: number): void {
    const target = Phaser.Math.Clamp(speed, 0.25, 4);
    const ratio = target / this.gameSpeed;
    this.gameSpeed = target;
    // 把场上所有 body 的当前速度与速度上限按倍率缩放（实体每帧会 setVelocity 原始值，由 applySpeedToBodies 逐帧维持）
    const bodies = this.physics.world.bodies.entries;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i] as any;
      if (b && b.enable && b.moves) {
        b.velocity.x *= ratio;
        b.velocity.y *= ratio;
        b.maxVelocity.x *= ratio;
        b.maxVelocity.y *= ratio;
      }
    }
    this.tweens.timeScale = this.gameSpeed;
    EventBus.emit('game:speed', this.gameSpeed);
  }

  /** 每帧在实体 update 之后调用：body 速度统一缩放回 gameSpeed 倍（实体每帧 setVelocity 原始值会覆盖，需逐帧乘以维持倍速） */
  private applySpeedToBodies(): void {
    if (this.gameSpeed === 1) return;
    const bodies = this.physics.world.bodies.entries;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i] as any;
      if (b && b.enable && b.moves && (b.velocity.x !== 0 || b.velocity.y !== 0)) {
        b.velocity.x *= this.gameSpeed;
        b.velocity.y *= this.gameSpeed;
      }
    }
  }

  /** 获取当前游戏速度 */
  getGameSpeed(): number {
    return this.gameSpeed;
  }

  /** 无尽模式访问器 */
  isEndlessMode(): boolean {
    return this.endlessMode;
  }

  /** 进入无尽模式（通关结算选"继续征战"后） */
  enterEndlessMode(): void {
    this.endlessMode = true;
  }

  /**
   * 通关结算：打完第 victoryWave 波后由 WaveManager.nextWave 调用
   * 弹出 EndlessChoiceScene（继续征战 / 结束征程）
   */
  openEndlessChoice(): void {
    if (this.victoryTriggered) return;
    const gm = GameManager.getInstance();
    if (gm.isGameOver) return;
    // 其他模态（如 15 波 Boss 死亡弹出的突破奖励/升级三选一/商店）正在打开 → 延迟重试，
    // 而不是直接 return 吞掉窗口：否则玩家会卡在无怪地图上永远等不到通关结算
    if (this.scene.isActive('UpgradeScene') || this.scene.isActive('ShopScene') ||
        this.scene.isActive('WeaponSelectScene') || this.scene.isActive('BreakthroughScene') ||
        this.scene.isActive('EndlessChoiceScene')) {
      if (!this._endlessChoiceRetry) {
        this._endlessChoiceRetry = true;
        this.time.delayedCall(500, () => {
          this._endlessChoiceRetry = false;
          this.openEndlessChoice();
        });
      }
      return;
    }
    // 先启动结算场景，再延迟一帧暂停：scene.launch 的场景要到下一帧才真正 RUNNING
    //（isActive 才为 true）。若立即 setPaused(true)，run:pause 触发时 UIScene 识别不到
    // 模态场景，暂停覆盖层会与结算面板重叠显示"游戏暂停/继续游戏"。
    this.scene.launch('EndlessChoiceScene');
    this.time.delayedCall(0, () => gm.setPaused(true));
  }

  /**
   * 处理爆炸：范围伤害 + 视觉效果
   */
  private handleExplosion(x: number, y: number, damage: number, radius: number): void {
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_EXPLOSION, 1);
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

    // 爆炸视觉：双环冲击波 + 橙色粒子 + 轻震屏（统一走 FXManager）
    this.fxManager.explosion(x, y, radius);
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
    if (this.scene.isActive('UpgradeScene') || this.scene.isActive('ShopScene') || this.scene.isActive('WeaponSelectScene')) return;
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

  /**
   * 击败 Boss 后的武器强化三选一：排队弹出 WeaponSelectScene，选完后开始指定波。
   * 由 WaveManager 在 Boss 波结束后调用；全部武器已满级则直接进入下一波。
   */
  openWeaponSelectAfterBoss(wave: number): void {
    const anyLeft = Object.values(WEAPONS).some((w) => !this.player.isWeaponMaxLevel(w.id));
    if (!anyLeft) {
      this.waveManager.startWave(wave);
      return;
    }
    this.pendingWeaponSelect = true;
    this.pendingWeaponWave = wave;
    this.tryOpenWeaponSelect();
  }

  /** 武器强化排队：与升级/商店/突破面板错开，无冲突时启动武器选择场景 */
  private tryOpenWeaponSelect(): void {
    if (!this.pendingWeaponSelect) return;
    if (this.pendingLevelUps > 0 || this.upgradeQueued) return;
    if (this.scene.isActive('UpgradeScene') || this.scene.isActive('ShopScene') ||
        this.scene.isActive('WeaponSelectScene') || this.scene.isActive('BreakthroughScene')) return;
    const gm = GameManager.getInstance();
    if (gm.isGameOver) return;
    this.pendingWeaponSelect = false;
    gm.setPaused(true);
    this.scene.launch('WeaponSelectScene');
  }

  /**
   * Boss 死亡 → 弹出突破奖励（从已满级 stat 中选一个突破 +1 级）。
   * 与升级/商店排队：若当前有面板在显示则不打断；无可用突破项则跳过。
   */
  private triggerBreakthrough(): void {
    // 延迟一点，给 Boss 死亡掉落/动画留时间，也避免与死亡瞬间的其他逻辑冲突
    this.time.delayedCall(700, () => {
      const gm = GameManager.getInstance();
      if (gm.isGameOver) return;
      if (this.scene.isActive('UpgradeScene') || this.scene.isActive('ShopScene') || this.scene.isActive('WeaponSelectScene') || this.scene.isActive('BreakthroughScene')) return;
      if (this.pendingLevelUps > 0 || this.upgradeQueued) return;
      const available = this.player.getAvailableBreakthroughs?.();
      if (!available || available.length === 0) return;
      gm.setPaused(true);
      this.scene.launch('BreakthroughScene');
    });
  }

  /** 弹出浮动伤害数字（供碰撞系统调用） */
  spawnDamageText(x: number, y: number, damage: number, isCrit: boolean = false): void {
    this.damageTextManager?.show(x, y, damage, isCrit);
  }

  /** 事件飘字（宝箱/商店等文本提示），支持自定义颜色 */
  spawnEventText(x: number, y: number, text: string, color: string = '#ffffff'): void {
    this.damageTextManager?.showText(x, y, text, color);
  }

  /** 当前唯一的 Boss（无则 null，供 HUD 顶部血条使用） */
  getActiveBoss(): Enemy | null {
    return this.activeBoss;
  }

  /** 调试：设置怪物增强倍率（血量/攻击 ≥1），作用于后续新生成的敌人 */
  setEnemyBoost(hp: number, atk: number): void {
    this.enemyHpBoost = Math.max(1, hp);
    this.enemyAtkBoost = Math.max(1, atk);
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

  /** 视觉特效管理器（供碰撞系统/实体调用命中/死亡/拾取等特效） */
  getFXManager(): FXManager {
    return this.fxManager;
  }

  // ========== AI 自动玩 ==========

  /** 开关自动玩模式 */
  setAutoPlay(enabled: boolean): void {
    this.autoPlayEnabled = enabled;
    this.aiDecisionTimer = 0;
    this.aiHesitateTimer = 0;
    this.aiCurrentDir = { x: 0, y: 0 };
    if (!enabled) {
      this.inputManager.clearAIDirection();
    } else {
      // 对当前已弹出的选择界面（升级/商店/武器强化/突破/无尽）即时广播托管开启。
      // 各选择场景只在 create 时检查一次托管状态，若"先弹出选择界面、后开托管"会卡住。
      this.scene.manager.getScenes(true).forEach((sc) => {
        if (sc !== this && typeof (sc as any).triggerAutoPlay === 'function') {
          (sc as any).triggerAutoPlay();
        }
      });
    }
  }

  isAutoPlay(): boolean {
    return this.autoPlayEnabled;
  }

  /**
   * AI 移动决策（人类化版本）：
   * - 每 120-200ms 重新决策一次（不每帧精确转向）
   * - 方向上加 15% 随机噪声（不会走完美直线）
   * - 偶尔短暂"犹豫"（停止 0.3-0.8s）
   * 决策逻辑：危险时躲敌人，安全时捡经验
   */
  private updateAIDirection(delta: number): void {
    // 犹豫中：不移动
    if (this.aiHesitateTimer > 0) {
      this.aiHesitateTimer -= delta;
      this.inputManager.clearAIDirection();
      return;
    }

    // 决策间隔：120-200ms 重新计算一次
    this.aiDecisionTimer -= delta;
    if (this.aiDecisionTimer > 0) {
      // 保持当前方向（已设置过）
      return;
    }
    this.aiDecisionTimer = 120 + Math.random() * 80;

    // 5% 概率触发犹豫（安全时才犹豫，危险时不犹豫）
    const nearestEnemyDist = this.getNearestEnemyDist();
    if (nearestEnemyDist > 200 && Math.random() < 0.05) {
      this.aiHesitateTimer = 300 + Math.random() * 500;
      this.inputManager.clearAIDirection();
      return;
    }

    const px = this.player.x;
    const py = this.player.y;
    const SAFE_DIST = 160;
    const BULLET_DIST = 120;
    let targetX = 0;
    let targetY = 0;

    // 敌人躲避向量（所有附近敌人的合力方向）
    let avoidX = 0;
    let avoidY = 0;
    if (nearestEnemyDist < SAFE_DIST) {
      this.enemies.children.each((enemy: any) => {
        if (!enemy.active) return true;
        const dx = px - enemy.x;
        const dy = py - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SAFE_DIST && dist > 0.1) {
          const weight = (SAFE_DIST - dist) / SAFE_DIST;
          avoidX += (dx / dist) * weight;
          avoidY += (dy / dist) * weight;
        }
        return true;
      });
    }

    // 子弹躲避向量：检测附近朝玩家飞来的敌人子弹，预测侧向闪避
    let bulletX = 0;
    let bulletY = 0;
    let bulletDanger = 0;
    this.bullets.children.each((bullet: any) => {
      if (!bullet.active || !bullet.isEnemyBullet) return true;
      const dx = px - bullet.x;
      const dy = py - bullet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.1 && dist < BULLET_DIST) {
        const bvx = bullet.body?.velocity?.x ?? bullet.vx ?? 0;
        const bvy = bullet.body?.velocity?.y ?? bullet.vy ?? 0;
        const spd = Math.hypot(bvx, bvy);
        if (spd > 0.01) {
          // 子弹运动方向与"子弹→玩家"方向的点积：>0 表示正朝玩家飞来
          const dot = (bvx / spd) * (dx / dist) + (bvy / spd) * (dy / dist);
          if (dot > 0.2) {
            // 越近越危险、方向越正越危险
            const weight = (1 - dist / BULLET_DIST) * (0.4 + dot * 0.6);
            // 沿子弹运动方向的垂直方向侧向闪避
            const perpX = -(bvy / spd);
            const perpY = bvx / spd;
            bulletX += perpX * weight;
            bulletY += perpY * weight;
            bulletDanger = Math.max(bulletDanger, weight);
          }
        }
      }
      return true;
    });

    if (bulletDanger > 0.45) {
      // 子弹威胁主导：以侧向闪避为主，轻微叠加敌人躲避
      const bl = Math.hypot(bulletX, bulletY);
      if (bl > 0.01) {
        bulletX /= bl;
        bulletY /= bl;
      }
      targetX = bulletX + avoidX * 0.25;
      targetY = bulletY + avoidY * 0.25;
    } else if (nearestEnemyDist < SAFE_DIST) {
      // 敌人威胁主导：背向敌人合力
      targetX = avoidX;
      targetY = avoidY;
    } else {
      // 安全：找最近的经验宝石
      const nearestExp = this.getNearestExp();
      if (nearestExp) {
        targetX = nearestExp.x - px;
        targetY = nearestExp.y - py;
      }
    }

    // 归一化 + 加噪声（人类化）
    const len = Math.sqrt(targetX * targetX + targetY * targetY);
    if (len > 0.01) {
      let nx = targetX / len;
      let ny = targetY / len;
      // 加 15% 随机噪声
      const noise = 0.15;
      nx += (Math.random() - 0.5) * noise;
      ny += (Math.random() - 0.5) * noise;
      const nlen = Math.sqrt(nx * nx + ny * ny);
      if (nlen > 0.01) {
        nx /= nlen;
        ny /= nlen;
      }
      // 墙体避让：目标方向被障碍物阻挡时逐步旋转探测可通行方向（沿墙滑动），
      // 避免"玩家与敌人被墙隔开时 AI 顶着墙蹭、卡死在墙一侧"。
      const steered = this.avoidWall(this.player.x, this.player.y, nx, ny);
      nx = steered.x;
      ny = steered.y;
      this.aiCurrentDir = { x: nx, y: ny };
      this.inputManager.setAIDirection(nx, ny);
    } else {
      this.aiCurrentDir = { x: 0, y: 0 };
      this.inputManager.clearAIDirection();
    }
  }

  /**
   * AI 墙体避让：目标方向前方被障碍物阻挡时，逐步旋转（±15°~±90°）探测第一个可通行方向，
   * 让 AI 沿墙滑动绕行而非顶着墙蹭。四周都被堵（被包围）时保持原方向交给物理系统处理。
   */
  private avoidWall(px: number, py: number, nx: number, ny: number): { x: number; y: number } {
    const PROBE = 56; // 探测距离：大于玩家半宽 + 余量，表示"前方这么远是否被挡"
    if (!this.isPositionBlocked(px + nx * PROBE, py + ny * PROBE)) {
      return { x: nx, y: ny };
    }
    for (const deg of [15, 30, 45, 60, 75, 90]) {
      for (const sign of [1, -1]) {
        const rad = (deg * sign * Math.PI) / 180;
        const tx = nx * Math.cos(rad) - ny * Math.sin(rad);
        const ty = nx * Math.sin(rad) + ny * Math.cos(rad);
        if (!this.isPositionBlocked(px + tx * PROBE, py + ty * PROBE)) {
          return { x: tx, y: ty };
        }
      }
    }
    return { x: nx, y: ny };
  }

  /** 该点半径 R 内是否与静态障碍物（岩石/墙/木箱）重叠（只检测静态障碍物，忽略动态物体） */
  private isPositionBlocked(x: number, y: number): boolean {
    const R = 22;
    return this.physics.overlapRect(x - R, y - R, R * 2, R * 2, false, true).length > 0;
  }

  /** 获取最近敌人距离 */
  /** 获取最近敌人距离 */
  private getNearestEnemyDist(): number {
    let nearest = Infinity;
    this.enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearest) nearest = dist;
      return true;
    });
    return nearest;
  }

  /**
   * AI 自动使用消耗品（人类化节奏：每 0.8-1.2s 判断一次，单次只处理最高优先级）
   * 优先级：低血量回血 > 被近身开盾 > 被大量包围清屏 > 战斗开狂暴
   */
  private updateAIItems(delta: number): void {
    this.aiItemUseTimer -= delta;
    if (this.aiItemUseTimer > 0) return;
    this.aiItemUseTimer = 800 + Math.random() * 400;

    const inv = this.player.getInventory();
    if (inv.length === 0) return;
    const has = (id: string) => inv.some((i) => i.id === id);

    const hpRatio = this.player.getHealth() / this.player.getMaxHealth();
    const nearestDist = this.getNearestEnemyDist();

    // 1. 血量 < 40% 且有血包 → 回血
    if (hpRatio < 0.4 && has('heal')) {
      this.player.useItem('heal', this);
      return;
    }

    // 2. 敌人贴近（< 110px）且有护盾且未开盾 → 开盾
    if (nearestDist < 110 && has('shield') && !this.player.isShieldActive()) {
      this.player.useItem('shield', this);
      return;
    }

    // 3. 被大量敌人包围（200px 内 ≥ 6 个）→ 炸弹清屏
    let nearbyCount = 0;
    this.enemies.children.each((e: any) => {
      if (!e.active) return true;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy < 200 * 200) nearbyCount++;
      return true;
    });
    if (nearbyCount >= 6 && has('bomb')) {
      this.player.useItem('bomb', this);
      return;
    }

    // 4. 战斗中（附近 400px 有敌）且有狂暴且未激活 → 开狂暴
    if (nearestDist < 400 && has('rage') && !this.player.isRageActive()) {
      this.player.useItem('rage', this);
      return;
    }
  }

  /** 获取最近的经验宝石 */
  private getNearestExp(): any {
    let nearest: any = null;
    let nearestDist = Infinity;
    this.pickups.children.each((pickup: any) => {
      if (!pickup.active) return true;
      if (pickup.getType?.() !== 'exp') return true;
      const dx = pickup.x - this.player.x;
      const dy = pickup.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = pickup;
      }
      return true;
    });
    return nearest;
  }

  spawnEnemy(config: EnemyConfig, x: number, y: number): void {
    this.waveManager.spawnEnemy(config, x, y);
  }

  /** 设置时间减速系数（时间减速药水用，只影响敌人） */
  setSlowFactor(f: number): void {
    this.slowFactor = Math.max(0.1, Math.min(1, f));
  }

  /** 当前时间减速系数 */
  getSlowFactor(): number {
    return this.slowFactor;
  }

  /** 全场拾取物强制磁吸（大磁铁效果） */
  magnetAll(): void {
    this.pickups.children.each((pickup: any) => {
      if (pickup.active) pickup.forceMagnet?.();
      return true;
    });
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

  /** 木箱破坏掉落：金币（必掉）+ 概率经验/血包/宝箱 */
  private dropCrateLoot(x: number, y: number): void {
    if (!this.objectPool) return;
    this.spawnPickup(
      { type: 'coin', texture: 'pickup_coin', value: 2 + Math.floor(Math.random() * 4), magnetSpeed: 300 },
      x,
      y
    );
    if (Math.random() < 0.4) {
      this.spawnPickup({ type: 'exp', texture: 'pickup_exp', value: 4, magnetSpeed: 300 }, x + 12, y - 10);
    }
    if (Math.random() < 0.08) {
      this.spawnPickup({ type: 'health', texture: 'pickup_health', value: 20, magnetSpeed: 300 }, x - 12, y + 8);
    }
    if (Math.random() < 0.05) {
      this.spawnPickup({ type: 'chest', texture: 'pickup_chest', value: 0, magnetSpeed: 200 }, x + 8, y + 10);
    }
  }
}
