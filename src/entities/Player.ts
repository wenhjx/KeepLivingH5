import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { EventBus, EventKeys } from '../utils/EventBus';
import { MathUtils } from '../utils/MathUtils';
import { Drone } from './Drone';
import { WEAPONS } from '../data/weapons';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { USABLE_ITEMS } from '../data/items';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import { AchievementManager } from '../systems/AchievementManager';
import type { PlayerStats, WeaponConfig, UpgradeOption } from '../types';
import type { InputManager } from '../systems/InputManager';

/**
 * 可突破的 stat 属性（Boss 突破奖励候选）。
 * 只保留"战斗输出向"属性——突破后能直接提升击杀效率的属性；
 * 生存/便利类（护甲/磁力/疾风步/生命/幸运）满级即够，若放进同一候选池，
 * 玩家会无脑选择输出属性而永远放弃它们（价值不等价，选择无意义）。
 * 后续新增战斗向 stat 时把 id 加进此列表即可。
 */
export const BREAKTHROUGH_STATS: string[] = [
  'attack_power', // 力量强化：攻击力 +20%/级
  'attack_speed', // 急速：攻速 +15%/级
  'crit_rate',    // 暴击精通：暴击率 +10%/级（突破可到100%+，溢出转爆伤）
  'crit_damage',  // 致命一击：暴击伤害 +50%/级
];

/**
 * 玩家实体
 * 管理玩家移动、属性、升级、武器、受伤等核心逻辑
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // 属性
  private stats: PlayerStats;
  /** percent stat 的基准值快照（构造/读档时记录，含成就加成）：percent 加算以它为底，杜绝乘算指数爆炸 */
  private _baseStats: PlayerStats = {} as PlayerStats;  // 武器列表
  private weapons: Map<string, { config: WeaponConfig; level: number; cooldown: number }> = new Map();
  /** 环形冲击波爆发计数：每 5s 周期内快速 3 连发 */
  private novaBurstCount = 0;
  /** 临时拾取半径（大磁铁效果），到期自动恢复 */
  private tempPickupRadius = 0;
  private tempPickupRadiusTimer = 0;
  // 被动技能列表
  private passives: Map<string, { id: string; name: string; level: number; maxLevel: number }> = new Map();
  // stat 类升级次数（满级后不再出现在升级/商店候选池；用于防止无限叠加数值爆炸）
  private statUpgrades: Map<string, { id: string; name: string; level: number; maxLevel: number }> = new Map();
  // Boss 突破奖励记录（对已满级 stat 突破 +1 级，突破上限=原 maxLevel，受 Boss 数量硬限制）
  private breakthroughs: Map<string, { id: string; name: string; level: number; maxLevel: number }> = new Map();
  // 无人机列表（summon 类型武器）
  private drones: Drone[] = [];
  /** 稳定测试态标记（testStable）：持续无敌不闪烁，避免干扰观察 */
  stableMode: boolean = false;
  // 生命恢复计时器
  private regenTimer: number = 0;
  // 无敌状态
  private invincible = false;
  private invincibleTimer = 0;
  /** 地形减速倍率（冰原减速区等）：GameScene 每帧按所在区域设置，移动速度 × 该值 */
  movementMultiplier = 1;
  // 护盾（无敌 + 圆环视觉）
  private shieldActive = false;
  private shieldRing: Phaser.GameObjects.Arc | null = null;
  // 狂暴药水临时增益
  private rageTimer = 0;
  private rageActive = false;
  private rageRing: Phaser.GameObjects.Arc | null = null;
  // 复活币（商店购买，死亡时原地复活）
  private reviveTokens = 0;
  // 待激活的 Boss 战 buff（商店购买，接近 Boss 时自动触发）
  private pendingBossBuffs: Array<(player: Player) => void> = [];
  // 物品栏（可主动使用的消耗品）
  private inventory: Map<string, number> = new Map();
  // 朝向
  private facingAngle = 0;
  // 经验特效
  private expFlashTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // 按当前视觉主题解析玩家纹理（classic 矢量 / pixel 像素）
    super(scene, x, y, GameConfig.themeKey('player'));

    // 初始化属性（叠加成就系统永久加成：温和数值，见 data/achievements.ts 说明）
    const ach = AchievementManager.getInstance();
    this.stats = {
      maxHealth: GameConfig.PLAYER.maxHealth + ach.getBonus('maxHealth'),
      health: GameConfig.PLAYER.maxHealth + ach.getBonus('maxHealth'),
      moveSpeed: GameConfig.PLAYER.moveSpeed,
      attackPower: GameConfig.PLAYER.baseAttackPower + ach.getBonus('attackPower'),
      attackSpeed: GameConfig.PLAYER.baseAttackSpeed,
      defense: 0,
      level: 1,
      exp: 0,
      expToNext: GameConfig.LEVEL.baseExp,
      critRate: GameConfig.PLAYER.baseCritRate + ach.getBonus('critRate'),
      critDamage: GameConfig.PLAYER.baseCritDamage + ach.getBonus('critDamage'),
      pickupRadius: GameConfig.PLAYER.pickupRadius + ach.getBonus('pickupRadius'),
      luck: ach.getBonus('luck'),
      coins: 30,
      overflowCount: 0,
    };
    // percent 加算基准（含成就加成；局内升级/突破不再改它）
    this._baseStats = { ...this.stats };
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 物理设置
    this.setCollideWorldBounds(true);
    this.setCircle(16);
    // 确保碰撞圆以贴图显示中心为圆心（某些情况下 setCircle 的 offset 会落到 0,0）
    this.body!.setOffset((this.displayWidth - 32) / 2, (this.displayHeight - 32) / 2);
    this.setDepth(10);

    // 初始武器（默认武器，配置来自统一数据源 src/data/weapons.ts）
    this.addWeapon(WEAPONS['default_gun']);
  }

  update(time: number, delta: number, input: InputManager): void {
    if (this.active === false) return;

    // 无敌时间（护盾期间不闪烁，保持可见）
    if (this.invincible) {
      this.invincibleTimer -= delta;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.clearTint();
        // 护盾到期移除圆环
        if (this.shieldActive) {
          this.shieldActive = false;
          this.shieldRing?.destroy();
          this.shieldRing = null;
        }
      } else if (!this.shieldActive && !this.stableMode) {
        // 非护盾的受击无敌才闪烁（稳定测试态持续无敌不闪，避免干扰观察）
        this.setAlpha(Math.sin(time / 50) > 0 ? 1 : 0.3);
      }
    } else {
      this.setAlpha(1);
    }

    // 护盾圆环跟随玩家
    if (this.shieldActive && this.shieldRing) {
      this.shieldRing.setPosition(this.x, this.y);
    }

    // 狂暴药水计时
    if (this.rageActive) {
      this.rageTimer -= delta;
      if (this.rageTimer <= 0) {
        this.rageActive = false;
        this.rageRing?.destroy();
        this.rageRing = null;
      } else if (this.rageRing) {
        // 光晕跟随玩家 + 呼吸脉动
        const pulse = 1 + Math.sin(time / 150) * 0.08;
        this.rageRing.setPosition(this.x, this.y);
        this.rageRing.setScale(pulse);
      }
    }

    // 移动
    const moveDir = input.getMoveDirection();
    this.setVelocity(
      moveDir.x * this.stats.moveSpeed * this.movementMultiplier,
      moveDir.y * this.stats.moveSpeed * this.movementMultiplier
    );

    // 更新朝向（朝移动方向），并旋转箭头指向移动方向
    if (moveDir.x !== 0 || moveDir.y !== 0) {
      this.facingAngle = Math.atan2(moveDir.y, moveDir.x);
      // 玩家纹理箭头朝上（即 -90°），加上 PI/2 让尖端指向实际移动方向
      this.setRotation(this.facingAngle + Math.PI / 2);
    }

    // 武器攻击
    // 临时拾取半径计时
    if (this.tempPickupRadiusTimer > 0) {
      this.tempPickupRadiusTimer -= delta;
      if (this.tempPickupRadiusTimer <= 0) this.tempPickupRadius = 0;
    }

    this.updateWeapons(time, delta);

    // 经验闪烁
    if (this.expFlashTimer > 0) {
      this.expFlashTimer -= delta;
    }

    // 被动：生命恢复（每秒恢复 1+level 点）
    const regenLevel = this.getPassiveLevel('passive_regen');
    if (regenLevel > 0 && this.stats.health < this.stats.maxHealth) {
      this.regenTimer += delta;
      if (this.regenTimer >= 1000) {
        this.regenTimer -= 1000;
        this.heal(1 + regenLevel);
      }
    }
  }

  private updateWeapons(time: number, delta: number): void {
    this.weapons.forEach((weapon) => {
      // summon 类型（无人机）由独立实体管理，不走冷却射击
      if (weapon.config.type === 'summon') return;

      // 环形冲击波：5s 爆发周期，周期内快速 3 连发（救急脱困武器，节奏感强）
      if (weapon.config.nova) {
        weapon.cooldown -= delta;
        if (weapon.cooldown <= 0) {
          this.fireNova(weapon.config, weapon.level);
          this.novaBurstCount++;
          if (this.novaBurstCount >= 3) {
            weapon.cooldown = 5000; // 3 连发后进入 5s 冷却
            this.novaBurstCount = 0;
          } else {
            weapon.cooldown = 250; // 连发间隔
          }
        }
        return;
      }

      weapon.cooldown -= delta;
      if (weapon.cooldown <= 0) {
        this.fireWeapon(weapon.config, weapon.level);
        weapon.cooldown = 1000 / (weapon.config.attackSpeed * this.getStats().attackSpeed);
      }
    });
  }

  /**
   * 计算武器伤害
   * 防御：攻击力非法（NaN/Infinity/<=0）时回退基础攻击力，结果仍非法则回退武器基础伤害，
   * 杜绝 0/NaN 伤害（会导致怪物 health 被 NaN 污染而永久无敌）
   */
  private calcWeaponDamage(config: WeaponConfig, level: number): number {
    const atk = Number(this.getStats().attackPower);
    const attackPower = isFinite(atk) && atk > 0 ? atk : GameConfig.PLAYER.baseAttackPower;
    const raw = config.damage * (1 + level * 0.2) * attackPower / 10;
    return isFinite(raw) && raw > 0 ? raw : config.damage;
  }

  /** 按武器类型分发攻击逻辑 */
  private fireWeapon(config: WeaponConfig, level: number): void {
    switch (config.type) {
      case 'melee':
        this.fireMelee(config, level);
        break;
      case 'aoe':
        if (config.nova) {
          this.fireNova(config, level);
        } else if (config.boomerang) {
          this.fireBoomerang(config, level);
        } else {
          this.fireProjectile(config, level); // 火箭筒走弹道，命中后爆炸
        }
        break;
      case 'ranged':
      default:
        this.fireProjectile(config, level);
        break;
    }
  }

  /** 弹道武器：基础射击、机枪、霰弹、激光、火箭筒 */
  private fireProjectile(config: WeaponConfig, level: number): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;

    const pool = scene.getObjectPool();
    const damage = this.calcWeaponDamage(config, level);

    // 寻找最近敌人作为目标
    const nearestEnemy = this.findNearestEnemy();
    let angle = this.facingAngle;
    if (nearestEnemy) {
      angle = MathUtils.angle(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
    }

    // 获取武器视觉参数
    const visual = this.getWeaponVisual(config.id);

    // 射击音效（按武器类型区分，资源缺失时静默失败）
    this.playWeaponSfx(config.id);

    // 枪口闪光（射击瞬间，颜色随武器；霰弹多弹只闪一次）
    scene.getFXManager?.()?.muzzleFlash(
      this.x + Math.cos(angle) * 18,
      this.y + Math.sin(angle) * 18,
      angle,
      visual.color ?? 0xffffff
    );

    // 发射子弹（霰弹等可随等级增加弹丸数）
    const baseCount = config.projectileCount || 1;
    const count = baseCount + (config.extraProjectilesPerLevel || 0) * (level - 1);
    // 保持基础弹数的总扇面宽度，升级加弹只让弹更密集（不扩散到身后）
    const totalArc = baseCount > 1 ? (config.spread || 0.3) * (baseCount - 1) : 0;
    const spread = count > 1 ? totalArc / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
      const bulletAngle = angle + (i - (count - 1) / 2) * spread;
      pool.spawnBullet(
        this.x,
        this.y,
        bulletAngle,
        config.projectileSpeed || 500,
        damage,
        config.range,
        config.texture || 'bullet',
        {
          pierce: config.pierce,
          explosive: config.explosive,
          aoeRadius: config.aoeRadius,
          knockback: config.knockback,
          color: visual.color,
          scaleX: visual.scaleX,
          scaleY: visual.scaleY,
          trailColor: visual.trailColor,
          trailEvery: visual.trailEvery,
        }
      );
    }
  }

  /**
   * 获取武器视觉参数（颜色/缩放/弹道拖尾），用于区分不同武器子弹
   * 每把武器一套专属视觉：颜色 + 形状 + 拖尾颜色/密度
   */
  private getWeaponVisual(
    weaponId: string
  ): { color?: number; scaleX?: number; scaleY?: number; trailColor?: number; trailEvery?: number } {
    switch (weaponId) {
      case 'machine_gun':
        return { color: 0xffcc00, scaleX: 0.7, scaleY: 0.7, trailColor: 0xffaa00, trailEvery: 3 }; // 橙黄小弹+橙黄拖尾
      case 'shotgun':
        return { color: 0xff5555, scaleX: 0.9, scaleY: 0.9, trailColor: 0xff5533, trailEvery: 3 }; // 红色散弹+红拖尾
      case 'laser':
        return { color: 0x00ffff, scaleX: 2.5, scaleY: 0.4, trailColor: 0x00ffff, trailEvery: 4 }; // 青色细长激光+青拖尾
      case 'rocket':
        return { color: 0xff6600, scaleX: 1.5, scaleY: 1.0, trailColor: 0xff8833, trailEvery: 4 }; // 橙色火箭弹+橙拖尾
      case 'default_gun':
        return { color: 0xffffff, trailColor: 0x88ccff, trailEvery: 3 }; // 白色默认+淡蓝拖尾
      default:
        return {};
    }
  }

  /** 按武器播放对应射击音效（资源缺失静默失败） */
  private playWeaponSfx(weaponId: string): void {
    const audio = AudioManager.getInstance();
    switch (weaponId) {
      case 'shotgun': audio.playSfx(SOUND_KEYS.SFX_SHOOT_SHOTGUN, 0.8); break;
      case 'machine_gun': audio.playSfx(SOUND_KEYS.SFX_SHOOT_MACHINE_GUN, 0.6); break;
      case 'laser': audio.playSfx(SOUND_KEYS.SFX_SHOOT_LASER, 0.7); break;
      case 'rocket': audio.playSfx(SOUND_KEYS.SFX_SHOOT_ROCKET, 1); break;
      case 'boomerang': audio.playSfx(SOUND_KEYS.SFX_BOOMERANG, 0.8); break;
      case 'lightsaber': audio.playSfx(SOUND_KEYS.SFX_MELEE_SWING, 0.7); break;
      case 'nova': audio.playSfx(SOUND_KEYS.SFX_EXPLOSION, 0.85); break;
      default: audio.playSfx(SOUND_KEYS.SFX_SHOOT_DEFAULT, 0.5); break;
    }
  }

  /** 回旋镖：穿透 + 飞出后返回 */
  private fireBoomerang(config: WeaponConfig, level: number): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;

    const pool = scene.getObjectPool();
    const damage = this.calcWeaponDamage(config, level);

    const nearestEnemy = this.findNearestEnemy();
    let angle = this.facingAngle;
    if (nearestEnemy) {
      angle = MathUtils.angle(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
    }

    pool.spawnBullet(
      this.x,
      this.y,
      angle,
      config.projectileSpeed || 300,
      damage,
      config.range,
      config.texture || 'bullet',
      {
        pierce: true,
        boomerang: true,
        aoeRadius: config.aoeRadius,
        trailColor: 0x66ff66,
        trailEvery: 4,
      }
    );
  }

  /** 环形冲击波：360° 全向范围伤害 + 击退（被围堵时的救急/脱困武器） */
  private fireNova(config: WeaponConfig, level: number): void {
    const scene = this.scene as any;
    if (!scene || !scene.getEnemies || !scene.getFXManager) return;

    const damage = this.calcWeaponDamage(config, level);
    const range = config.range || 160;
    const enemies = scene.getEnemies();

    // 360° 全向：范围内所有敌人受伤 + 由内向外递减的击退（贴身敌人被推得最远）
    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist > range) return true;
      enemy.takeDamage(damage, false);
      enemy.applyPlayerEffects?.(damage, this, this.x, this.y);
      const falloff = 1 - (dist / range) * 0.6;
      enemy.applyKnockback?.(this.x, this.y, 340 * falloff);
      return true;
    });

    // 环形扩散冲击波视觉 + 音效
    scene.getFXManager()?.shockwave(this.x, this.y, range, 0x00ffff);
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_EXPLOSION, 0.85);
  }

  /** 近战武器：光剑扇形范围攻击 */
  private fireMelee(config: WeaponConfig, level: number): void {
    const scene = this.scene as any;
    if (!scene || !scene.getEnemies) return;

    const damage = this.calcWeaponDamage(config, level);
    const range = config.range || 80;
    const enemies = scene.getEnemies();

    // 朝最近敌人方向，或朝向方向
    const nearestEnemy = this.findNearestEnemy();
    let angle = this.facingAngle;
    if (nearestEnemy) {
      angle = MathUtils.angle(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
    }

    // 扇形范围（120度）内的敌人受伤
    const halfArc = Math.PI / 3; // 60度半边，总共120度
    enemies.children.each((enemy: any) => {
      if (!enemy.active) return true;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist > range) return true;
      const enemyAngle = MathUtils.angle(this.x, this.y, enemy.x, enemy.y);
      let angleDiff = Math.abs(enemyAngle - angle);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      if (angleDiff <= halfArc) {
        enemy.takeDamage(damage, false);
        enemy.applyPlayerEffects?.(damage, this, this.x, this.y);
      }
      return true;
    });

    // 近战挥砍视觉效果
    this.createMeleeSlash(angle, range);

    // 剑气：光剑额外释放远程穿透波，具备远程输出能力
    this.fireBladeWave(config, level, angle, damage);
  }

  /** 光剑剑气：远程穿透弹波 */
  private fireBladeWave(config: WeaponConfig, level: number, angle: number, meleeDamage: number): void {
    if (config.id !== 'lightsaber') return;
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;
    const pool = scene.getObjectPool();
    pool.spawnBullet(
      this.x + Math.cos(angle) * 30,
      this.y + Math.sin(angle) * 30,
      angle,
      420,
      meleeDamage * 0.7,
      config.range + 200,
      config.texture || 'bullet',
      {
        pierce: true,
        color: 0x00ffff,
        scaleX: 2.0,
        scaleY: 0.45,
        trailColor: 0x00ffff,
        trailEvery: 3,
      }
    );
  }

  /** 近战挥砍视觉效果 */
  private createMeleeSlash(angle: number, range: number): void {
    const gfx = this.scene.add.graphics();
    const halfArc = Math.PI / 3;
    gfx.fillStyle(0x00ffff, 0.3);
    gfx.slice(this.x, this.y, range, angle - halfArc, angle + halfArc, false);
    gfx.fillPath();
    gfx.setDepth(9);
    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 150,
      onComplete: () => gfx.destroy(),
    });
  }

  private findNearestEnemy(): Phaser.GameObjects.Sprite | null {
    const scene = this.scene as any;
    if (!scene || !scene.getEnemies) return null;
    const enemies = scene.getEnemies();
    let nearest: Phaser.GameObjects.Sprite | null = null;
    let minDist = Infinity;
    enemies.children.each((enemy: any) => {
      if (enemy.active) {
        const dist = MathUtils.distanceSq(this.x, this.y, enemy.x, enemy.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = enemy;
        }
      }
      return true;
    });
    return nearest;
  }

  // ========== 受伤与治疗 ==========

  /** 授予持续无敌（ms）；stable=true 时同时进入稳定测试态（无敌期间不闪烁，供试玩场地/调试使用） */
  grantInvincible(ms: number, stable = false): void {
    this.invincible = true;
    this.invincibleTimer = ms;
    if (stable) this.stableMode = true;
  }

  takeDamage(amount: number): void {
    if (this.invincible || this.stats.health <= 0) return;

    const actualDamage = Math.max(1, amount - this.stats.defense);
    this.stats.health -= actualDamage;
    // 立即 clamp 到 0：否则广播 player:damage 时 HUD 同步刷新会读到"大负数"
    // （后期 Boss 单次伤害可达数十万，695 血会瞬间被扣成 -999999305 级并显示在血条上）
    if (this.stats.health < 0) this.stats.health = 0;
    // 成就：本局受击标记（无伤通关判定，run:start 时由 AchievementManager 重置）
    EventBus.emit(EventKeys.PLAYER_HIT);
    this.invincible = true;
    this.invincibleTimer = GameConfig.PLAYER.invincibleTime;
    this.setTint(0xff4444);

    // 被动：荆棘（受击时反弹伤害给最近敌人）
    const thornsLevel = this.getPassiveLevel('passive_thorns');
    if (thornsLevel > 0) {
      const reflectDamage = actualDamage * (0.2 + thornsLevel * 0.05);
      const nearest = this.findNearestEnemy();
      if (nearest) {
        (nearest as any).takeDamage?.(reflectDamage, false);
      }
    }

    EventBus.emit(EventKeys.PLAYER_DAMAGE, actualDamage);
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PLAYER_HURT, 1);

    if (this.stats.health <= 0) {
      this.stats.health = 0;
      this.die();
    }
  }

  heal(amount: number): void {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
    EventBus.emit(EventKeys.PLAYER_HEAL, amount);
  }

  /**
   * 环境/规则伤害（如冰原"霜蚀"持续掉血）：绕过无敌帧，按最大生命百分比流失；
   * 归零时正常触发死亡。不触发受击闪烁/荆棘反弹/受击音效。
   */
  damageFromHazard(amount: number): void {
    if (this.stats.health <= 0) return;
    this.stats.health -= amount;
    if (this.stats.health < 0) this.stats.health = 0;
    EventBus.emit(EventKeys.PLAYER_DAMAGE, amount);
    if (this.stats.health <= 0) {
      this.stats.health = 0;
      this.die();
    }
  }

  /** 原地复活：满血 + 短暂无敌 + 恢复活动/可见（训练场与复活币共用核心逻辑） */
  resurrect(invincibleMs = 2000): void {
    this.stats.health = this.stats.maxHealth;
    this.invincible = true;
    this.invincibleTimer = invincibleMs;
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
  }

  private die(): void {
    // 复活币：死亡时原地复活一次（满血 + 短暂无敌 + 清空周围敌人）
    if (this.reviveTokens > 0) {
      this.reviveTokens--;
      this.stats.health = this.stats.maxHealth;
      this.invincible = true;
      this.invincibleTimer = 2000;
      this.setActive(true);
      this.setVisible(true);
      this.setAlpha(1);
      EventBus.emit(EventKeys.PLAYER_REVIVE);
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PLAYER_REVIVE, 1);
      return;
    }

    this.setActive(false);
    this.setVisible(false);
    this.shieldRing?.destroy();
    this.shieldRing = null;
    EventBus.emit(EventKeys.PLAYER_DEATH);
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PLAYER_DIE, 1);
  }

  // ========== 金币 ==========

  /** 获得金币（受「金币加成」被动影响） */
  addCoins(amount: number): void {
    const goldBoostLevel = this.getPassiveLevel('passive_gold_boost');
    if (goldBoostLevel > 0) {
      amount *= 1 + 0.5 + goldBoostLevel * 0.1;
    }
    this.stats.coins += Math.floor(amount);
    EventBus.emit(EventKeys.PLAYER_COINS, this.stats.coins);
    // 成就统计：累计获得金币（含被动加成的最终值）
    EventBus.emit(EventKeys.COIN_EARNED, amount);
  }

  getCoins(): number {
    return this.stats.coins;
  }

  /** 消费金币（不足返回 false） */
  spendCoins(amount: number): boolean {
    if (this.stats.coins < amount) return false;
    this.stats.coins -= amount;
    EventBus.emit(EventKeys.PLAYER_COINS, this.stats.coins);
    return true;
  }

  // ========== 商店消耗品 ==========

  /** 复活币 */
  addReviveToken(): void {
    this.reviveTokens++;
  }
  getReviveTokens(): number {
    return this.reviveTokens;
  }

  /** 添加待激活的 Boss 战 buff（接近 Boss 时自动触发） */
  addPendingBossBuff(effect: (player: Player) => void): void {
    this.pendingBossBuffs.push(effect);
  }

  /** 是否有待激活的 Boss 战 buff */
  hasPendingBossBuffs(): boolean {
    return this.pendingBossBuffs.length > 0;
  }

  /** 触发所有待激活的 Boss 战 buff（接近 Boss 时由 GameScene 调用） */
  triggerPendingBossBuffs(): void {
    for (const effect of this.pendingBossBuffs) {
      effect(this);
    }
    this.pendingBossBuffs = [];
  }

  // ========== 物品栏 ==========

  /** 添加物品到物品栏 */
  addItem(id: string, count: number = 1): void {
    this.inventory.set(id, (this.inventory.get(id) || 0) + count);
    EventBus.emit(EventKeys.PLAYER_INVENTORY_CHANGED);
  }

  /** 获取物品数量 */
  getItemCount(id: string): number {
    return this.inventory.get(id) || 0;
  }

  /** 使用物品（数量不足返回 false） */
  useItem(id: string, gameScene: any): boolean {
    const count = this.inventory.get(id) || 0;
    if (count <= 0) return false;
    const item = (USABLE_ITEMS as any)[id];
    if (!item) return false;
    item.use(this, gameScene);
    this.inventory.set(id, count - 1);
    EventBus.emit(EventKeys.PLAYER_INVENTORY_CHANGED);
    return true;
  }

  /** 获取物品栏快照（供 UI 渲染） */
  getInventory(): Array<{ id: string; count: number }> {
    return Array.from(this.inventory.entries())
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, count }));
  }

  /** 护盾：一段时间无敌 + 圆环视觉 */
  applyShield(duration: number): void {
    this.shieldActive = true;
    this.invincible = true;
    this.invincibleTimer = duration;
    this.setAlpha(1);
    if (this.shieldRing) this.shieldRing.destroy();
    this.shieldRing = this.scene.add.circle(this.x, this.y, 26, 0x33ccff, 0.25);
    this.shieldRing.setStrokeStyle(2, 0x66ddff, 0.9);
    this.shieldRing.setDepth(11);
  }

  /** 狂暴药水：短时间攻速/攻击力 +50% + 红色光晕视觉 */
  applyRage(duration: number): void {
    // 不直接修改 stats：狂暴加成在 getStats()/武器读数聚合，重复使用仅刷新时长不叠加
    this.rageActive = true;
    this.rageTimer = duration;
    if (this.rageRing) this.rageRing.destroy();
    this.rageRing = this.scene.add.circle(this.x, this.y, 24, 0xff4444, 0.2);
    this.rageRing.setStrokeStyle(2, 0xff6666, 0.8);
    this.rageRing.setDepth(11);
  }

  // ========== 经验与升级 ==========

  addExp(amount: number): void {
    // 被动：经验加成（+25% + level*10%）
    const expBoostLevel = this.getPassiveLevel('passive_exp_boost');
    if (expBoostLevel > 0) {
      amount *= 1 + 0.25 + expBoostLevel * 0.1;
    }

    this.stats.exp += amount;
    this.expFlashTimer = 200;

    while (this.stats.exp >= this.stats.expToNext && this.stats.level < GameConfig.LEVEL.maxLevel) {
      this.stats.exp -= this.stats.expToNext;
      this.levelUp();
    }

    // 满级后：经验转"超限强化条"——需求固定（= 满级 expToNext），每满一管自动轮换一轮属性收益，
    // 不弹窗不打断战斗（需求固定避免 15% 递增导致后期突破卡死）
    if (this.stats.level >= GameConfig.LEVEL.maxLevel) {
      const threshold = this.overflowThreshold;
      while (this.stats.exp >= threshold) {
        this.stats.exp -= threshold;
        this.applyOverflow();
      }
    }
  }

  /** 超限强化需求（固定 = 满级 expToNext，约 6324） */
  get overflowThreshold(): number {
    return this.calcExpToNext(GameConfig.LEVEL.maxLevel);
  }

  /**
   * 应用一轮超限强化（自动轮换，共 4 项循环）：
   * 攻击 ×1.03 → 暴击率 +1% → 爆伤 +3% → 生命 ×1.05
   */
  private applyOverflow(): void {
    const idx = this.stats.overflowCount % 4;
    switch (idx) {
      case 0:
        this.stats.attackPower *= 1.03;
        break;
      case 1:
        this.stats.critRate += 0.01; // 小数单位（0.05 = 5%）
        break;
      case 2:
        this.stats.critDamage += 0.03; // 倍率单位（1.5 = 150%）
        break;
      case 3: {
        const oldMax = this.stats.maxHealth;
        this.stats.maxHealth = Math.floor(this.stats.maxHealth * 1.05);
        // 保持当前血量比例（不回满，避免超限 = 免费回血）
        this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + (this.stats.maxHealth - oldMax));
        break;
      }
    }
    this.stats.overflowCount++;
    EventBus.emit(EventKeys.PLAYER_OVERFLOW, this.stats.overflowCount);
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_LEVEL_UP, 0.6);
  }

  /** 调试：直接跳到指定等级（补足升级属性，不触发 player:levelup → 不弹三选一） */
  forceLevel(target: number): void {
    const max = GameConfig.LEVEL.maxLevel;
    const t = Math.max(this.stats.level, Math.min(target, max));
    const diff = t - this.stats.level;
    if (diff <= 0) return;
    this.stats.maxHealth += 5 * diff;
    this.stats.health = this.stats.maxHealth;
    this.stats.attackPower += 2 * diff;
    this.stats.level = t;
    this.stats.exp = 0;
    this.stats.expToNext = this.calcExpToNext(t);
  }

  /** 调试：直接获得 n 管超限强化（模拟攒满 n 管经验） */
  addOverflow(count: number): void {
    for (let i = 0; i < count; i++) this.applyOverflow();
  }

  /** 超限强化累计次数 */
  getOverflowCount(): number {
    return this.stats.overflowCount;
  }

  private levelUp(): void {
    this.stats.level++;
    this.stats.expToNext = this.calcExpToNext(this.stats.level);

    // 升级属性提升
    this.stats.maxHealth += 5;
    this.stats.health = this.stats.maxHealth;
    this.stats.attackPower += 2;

    EventBus.emit(EventKeys.PLAYER_LEVELUP, this.stats.level);
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_LEVEL_UP, 0.9);
  }

  /** 计算指定等级升级所需经验（与 GameConfig.LEVEL 曲线一致） */
  private calcExpToNext(level: number): number {
    return Math.floor(
      GameConfig.LEVEL.baseExp * Math.pow(level, GameConfig.LEVEL.expGrowth)
    );
  }

  // ========== 武器管理 ==========

  addWeapon(config: WeaponConfig): void {
    if (this.weapons.has(config.id)) {
      const w = this.weapons.get(config.id)!;
      if (w.level < config.maxLevel) {
        w.level++;
      }
    } else {
      this.weapons.set(config.id, { config, level: 1, cooldown: 0 });
    }

    // summon 类型武器：同步无人机数量
    if (config.type === 'summon') {
      this.syncDrones();
    }
  }

  upgradeWeapon(weaponId: string): boolean {
    const w = this.weapons.get(weaponId);
    if (!w || w.level >= w.config.maxLevel) return false;
    w.level++;

    // summon 类型武器：同步无人机数量
    if (w.config.type === 'summon') {
      this.syncDrones();
    }
    return true;
  }

  /** 从存档恢复玩家状态（继续游戏时调用） */
  applySavedState(saved: {
    stats: PlayerStats;
    weapons: Array<{ id: string; level: number }>;
    passives: Array<{ id: string; name: string; level: number }>;
    statUpgrades?: Array<{ id: string; name: string; level: number }>;
    breakthroughs?: Array<{ id: string; name: string; level: number }>;
    inventory?: Array<{ id: string; count: number }>;
  }): void {
    if (saved.stats) {
      // 防御：存档中非法数值（null/NaN 等）不覆盖当前基础属性，
      // 否则 stats.attackPower 等变 NaN → 武器伤害 NaN → 怪物血量被污染成 NaN 永久无敌
      const merged = { ...this.stats, ...saved.stats };
      (Object.keys(merged) as Array<keyof typeof merged>).forEach((k) => {
        const v = merged[k];
        if (typeof v === 'number' && !isFinite(v)) {
          (merged as any)[k] = (this.stats as any)[k];
        }
      });
      this.stats = merged;
      // 读档后以存档值作为新的 percent 加算基准
      this._baseStats = { ...this.stats };
    }
    // 旧存档可能存了旧版本曲线(指数1.5)的 expToNext，按当前曲线重新计算，避免"继续游戏"后升级卡住
    this.stats.expToNext = this.calcExpToNext(this.stats.level);
    // 重建武器
    this.weapons.clear();
    if (saved.weapons) {
      for (const w of saved.weapons) {
        const config = WEAPONS[w.id];
        if (config) {
          this.weapons.set(w.id, { config, level: w.level, cooldown: 0 });
        }
      }
    }
    // 重建被动
    this.passives.clear();
    if (saved.passives) {
      for (const p of saved.passives) {
        this.passives.set(p.id, { id: p.id, name: p.name, level: p.level, maxLevel: 5 });
      }
    }
    // 重建 stat 升级计数（从 UPGRADE_OPTIONS 取 maxLevel；旧存档无此字段则跳过）
    this.statUpgrades.clear();
    if (saved.statUpgrades) {
      for (const s of saved.statUpgrades) {
        const opt = UPGRADE_OPTIONS.find((u) => u.id === s.id);
        if (opt?.maxLevel) {
          this.statUpgrades.set(s.id, { id: s.id, name: s.name, level: s.level, maxLevel: opt.maxLevel });
        }
      }
    }
    // 重建 Boss 突破记录（突破上限=原 maxLevel；旧存档无此字段则跳过）
    this.breakthroughs.clear();
    if (saved.breakthroughs) {
      for (const b of saved.breakthroughs) {
        const opt = UPGRADE_OPTIONS.find((u) => u.id === b.id);
        if (opt?.maxLevel) {
          this.breakthroughs.set(b.id, { id: b.id, name: b.name, level: b.level, maxLevel: opt.maxLevel });
        }
      }
    }
    // 重建背包道具（旧存档无 inventory 字段则跳过；负数/0 数量防御）
    this.inventory.clear();
    if (saved.inventory) {
      for (const it of saved.inventory) {
        if (it && it.id && it.count > 0) this.inventory.set(it.id, it.count);
      }
    }
    // 同步无人机数量
    this.syncDrones();
  }

  /** 同步无人机数量和等级（summon 武器升级时调用） */
  private syncDrones(): void {
    const droneWeapon = Array.from(this.weapons.values()).find((w) => w.config.type === 'summon');
    if (!droneWeapon) return;

    const targetCount = droneWeapon.level; // 1级1架，2级2架...
    const currentCount = this.drones.length;

    // 增加无人机
    for (let i = currentCount; i < targetCount; i++) {
      const drone = new Drone(this.scene, this, droneWeapon.config, droneWeapon.level, i, targetCount);
      this.drones.push(drone);
    }

    // 更新所有无人机的等级和总数
    this.drones.forEach((drone, i) => {
      drone.upgrade(droneWeapon.level, this.drones.length);
    });

    // 新增无人机后重新均匀排布环绕角度（旧角度不重排会导致轨道不均、分布杂乱）
    this.drones.forEach((drone, i) => {
      drone.reposition(i, this.drones.length);
    });
  }

  /** 更新所有无人机（由外部 update 调用） */
  updateDrones(time: number, delta: number): void {
    this.drones.forEach((drone) => drone.update(time, delta));
  }

  /** 获取当前所有武器列表（供 UI 增益列表使用） */
  getWeapons(): Array<{ id: string; name: string; level: number; maxLevel: number; type: string }> {
    return Array.from(this.weapons.values()).map((w) => ({
      id: w.config.id,
      name: w.config.name,
      level: w.level,
      maxLevel: w.config.maxLevel,
      type: w.config.type,
    }));
  }

  // ========== 被动技能管理 ==========

  /** 添加或升级被动技能 */
  addPassive(id: string, name: string, maxLevel: number = 5): void {
    if (this.passives.has(id)) {
      const p = this.passives.get(id)!;
      if (p.level < p.maxLevel) {
        p.level++;
      }
    } else {
      this.passives.set(id, { id, name, level: 1, maxLevel });
    }
  }

  /** 是否拥有某被动技能 */
  hasPassive(id: string): boolean {
    return this.passives.has(id);
  }

  // ========== stat 类升级管理 ==========

  /** 记录一次 stat 类升级（按升级项 id 计数，达 maxLevel 后不再出现） */
  recordStatUpgrade(id: string, name: string, maxLevel: number): void {
    if (this.statUpgrades.has(id)) {
      const s = this.statUpgrades.get(id)!;
      if (s.level < s.maxLevel) s.level++;
    } else {
      this.statUpgrades.set(id, { id, name, level: 1, maxLevel });
    }
  }

  /** 某 stat 升级项已选次数（0 表示未选过） */
  getStatUpgradeLevel(id: string): number {
    const s = this.statUpgrades.get(id);
    return s ? s.level : 0;
  }

  /** 某 stat 升级项是否已满级 */
  isStatMaxLevel(id: string, maxLevel?: number): boolean {
    const s = this.statUpgrades.get(id);
    if (!s) return false;
    return s.level >= (maxLevel ?? s.maxLevel);
  }

  /** 获取全部 stat 升级（供 HUD 增益列表显示进度） */
  getStatUpgrades(): Array<{ id: string; name: string; level: number; maxLevel: number }> {
    return Array.from(this.statUpgrades.values());
  }

  // ========== Boss 突破奖励管理 ==========

  /**
   * Boss 突破：对已满级 stat 突破 +1 级（效果再叠加一次，超过原 maxLevel）。
   * 突破上限 = 原 maxLevel，受 Boss 数量硬限制，不会像早期版本那样无限叠加导致数值爆炸。
   * @returns 是否突破成功
   */
  breakthroughStat(option: UpgradeOption): boolean {
    if (option.type !== 'stat' || !option.effect?.stat) return false;
    const upgradeMax = option.maxLevel ?? 0;
    if (upgradeMax <= 0) return false;
    // 必须先通过升级满级，才具备突破资格
    if (!this.isStatMaxLevel(option.id, upgradeMax)) return false;
    const cur = this.breakthroughs.get(option.id)?.level ?? 0;
    if (cur >= upgradeMax) return false;
    this.modifyStat(option.effect.stat, option.effect.value ?? 0, option.effect.isPercent ?? false);
    this.breakthroughs.set(option.id, { id: option.id, name: option.name, level: cur + 1, maxLevel: upgradeMax });
    return true;
  }

  /** 某 stat 已突破次数（0 表示未突破） */
  getBreakthroughLevel(id: string): number {
    return this.breakthroughs.get(id)?.level ?? 0;
  }

  /** 某 stat 是否已达突破上限 */
  isBreakthroughMax(id: string, maxLevel?: number): boolean {
    const b = this.breakthroughs.get(id);
    if (!b) return false;
    return b.level >= (maxLevel ?? b.maxLevel);
  }

  /** 全部突破记录（供存档/HUD） */
  getBreakthroughs(): Array<{ id: string; name: string; level: number; maxLevel: number }> {
    return Array.from(this.breakthroughs.values());
  }

  /** 可突破的 stat 列表：战斗输出向属性、已通过升级满级且未达突破上限（Boss 突破奖励的候选池） */
  getAvailableBreakthroughs(): UpgradeOption[] {
    return UPGRADE_OPTIONS.filter((o) => {
      if (o.type !== 'stat' || !o.maxLevel) return false;
      // 仅战斗输出向属性可突破；生存/便利类（护甲/磁力/疾风步等）不参与，避免无意义选择
      if (!BREAKTHROUGH_STATS.includes(o.id)) return false;
      if (!this.isStatMaxLevel(o.id, o.maxLevel)) return false;
      if (this.isBreakthroughMax(o.id, o.maxLevel)) return false;
      return true;
    });
  }

  /** 获取某被动技能等级（0 表示未拥有） */
  getPassiveLevel(id: string): number {
    const p = this.passives.get(id);
    return p ? p.level : 0;
  }

  /** 获取所有被动技能列表（供 UI 增益列表使用） */
  getPassives(): Array<{ id: string; name: string; level: number; maxLevel: number }> {
    return Array.from(this.passives.values());
  }

  // ========== 属性修改 ==========

  modifyStat(stat: keyof PlayerStats, value: number, isPercent: boolean = false): void {
    if (isPercent) {
      // 加算（2026-09-10 修复）：每次在基准值上叠加 value 比例，而非对当前值乘算。
      // 原 cur*(1+value) 在多级升级+突破下指数爆炸（暴伤 6 次 ×1.5 → 1709%、全属性天文数字）。
      // 现在 attackPower/attackSpeed/critDamage/pickupRadius/moveSpeed 均线性成长。
      const cur = Number((this.stats as any)[stat]);
      const base = Number((this._baseStats as any)[stat]) || 0;
      (this.stats as any)[stat] = (isFinite(cur) ? cur : 0) + base * value;
    } else {
      const cur = Number((this.stats as any)[stat]);
      (this.stats as any)[stat] = (isFinite(cur) ? cur : 0) + value;
    }
    // 确保生命值不超过上限
    if (stat === 'maxHealth') {
      this.stats.health = Math.min(this.stats.health, this.stats.maxHealth);
    }
  }

  // ========== Getters ==========

  getStats(): PlayerStats {
    const s = { ...this.stats };
    // 狂暴激活期间临时加成（不落盘、不污染 stats，重复使用仅刷新时长）
    if (this.rageActive) {
      s.attackPower *= 1.5;
      s.attackSpeed *= 1.5;
    }
    return s;
  }

  getHealth(): number {
    return this.stats.health;
  }

  getMaxHealth(): number {
    return this.stats.maxHealth;
  }

  /** 护盾是否激活中（供 AI/UI 判断） */
  isShieldActive(): boolean {
    return this.shieldActive;
  }

  /** 狂暴是否激活中（供 AI/UI 判断） */
  isRageActive(): boolean {
    return this.rageActive;
  }

  getLevel(): number {
    return this.stats.level;
  }

  /** 是否拥有某武器 */
  hasWeapon(weaponId: string): boolean {
    return this.weapons.has(weaponId);
  }

  /** 获取某武器等级（0 表示未拥有） */
  getWeaponLevel(weaponId: string): number {
    const w = this.weapons.get(weaponId);
    return w ? w.level : 0;
  }

  /** 某武器是否已满级 */
  isWeaponMaxLevel(weaponId: string): boolean {
    const w = this.weapons.get(weaponId);
    return w ? w.level >= w.config.maxLevel : false;
  }

  /** 某被动是否已满级（未拥有返回 false，表示可购买） */
  isPassiveMaxLevel(passiveId: string): boolean {
    const p = this.passives.get(passiveId);
    return p ? p.level >= p.maxLevel : false;
  }

  getExp(): number {
    return this.stats.exp;
  }

  getExpToNext(): number {
    return this.stats.expToNext;
  }

  getPickupRadius(): number {
    return this.tempPickupRadius > 0 ? this.tempPickupRadius : this.stats.pickupRadius;
  }

  /** 临时扩大拾取半径（大磁铁等效果），duration 毫秒后自动恢复 */
  setPickupRadiusTemporary(radius: number, duration: number): void {
    this.tempPickupRadius = radius;
    this.tempPickupRadiusTimer = duration;
  }

  isInvincible(): boolean {
    return this.invincible;
  }
}
