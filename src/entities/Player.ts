import Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { EventBus } from '../utils/EventBus';
import { MathUtils } from '../utils/MathUtils';
import { Drone } from './Drone';
import { WEAPONS } from '../data/weapons';
import { USABLE_ITEMS } from '../data/items';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import type { PlayerStats, WeaponConfig } from '../types';
import type { InputManager } from '../systems/InputManager';

/**
 * 玩家实体
 * 管理玩家移动、属性、升级、武器、受伤等核心逻辑
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  // 属性
  private stats: PlayerStats;
  // 武器列表
  private weapons: Map<string, { config: WeaponConfig; level: number; cooldown: number }> = new Map();
  // 被动技能列表
  private passives: Map<string, { id: string; name: string; level: number; maxLevel: number }> = new Map();
  // 无人机列表（summon 类型武器）
  private drones: Drone[] = [];
  // 生命恢复计时器
  private regenTimer: number = 0;
  // 无敌状态
  private invincible = false;
  private invincibleTimer = 0;
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
    super(scene, x, y, 'player');

    // 初始化属性
    this.stats = {
      maxHealth: GameConfig.PLAYER.maxHealth,
      health: GameConfig.PLAYER.maxHealth,
      moveSpeed: GameConfig.PLAYER.moveSpeed,
      attackPower: GameConfig.PLAYER.baseAttackPower,
      attackSpeed: GameConfig.PLAYER.baseAttackSpeed,
      defense: 0,
      level: 1,
      exp: 0,
      expToNext: GameConfig.LEVEL.baseExp,
      critRate: GameConfig.PLAYER.baseCritRate,
      critDamage: GameConfig.PLAYER.baseCritDamage,
      pickupRadius: GameConfig.PLAYER.pickupRadius,
      luck: 0,
      coins: 0,
    };

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 物理设置
    this.setCollideWorldBounds(true);
    this.setCircle(16);
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
      } else if (!this.shieldActive) {
        // 非护盾的受击无敌才闪烁
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
        // 恢复基础攻速/攻击力（与增益时乘的系数相反）
        this.stats.attackSpeed /= 1.5;
        this.stats.attackPower /= 1.5;
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
    this.setVelocity(moveDir.x * this.stats.moveSpeed, moveDir.y * this.stats.moveSpeed);

    // 更新朝向（朝移动方向），并旋转箭头指向移动方向
    if (moveDir.x !== 0 || moveDir.y !== 0) {
      this.facingAngle = Math.atan2(moveDir.y, moveDir.x);
      // 玩家纹理箭头朝上（即 -90°），加上 PI/2 让尖端指向实际移动方向
      this.setRotation(this.facingAngle + Math.PI / 2);
    }

    // 武器攻击
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

      weapon.cooldown -= delta;
      if (weapon.cooldown <= 0) {
        this.fireWeapon(weapon.config, weapon.level);
        weapon.cooldown = 1000 / (weapon.config.attackSpeed * this.stats.attackSpeed);
      }
    });
  }

  /** 按武器类型分发攻击逻辑 */
  private fireWeapon(config: WeaponConfig, level: number): void {
    switch (config.type) {
      case 'melee':
        this.fireMelee(config, level);
        break;
      case 'aoe':
        if (config.boomerang) {
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
    const damage = config.damage * (1 + level * 0.2) * this.stats.attackPower / 10;

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
          color: visual.color,
          scaleX: visual.scaleX,
          scaleY: visual.scaleY,
        }
      );
    }
  }

  /** 获取武器视觉参数（颜色/缩放），用于区分不同武器子弹 */
  private getWeaponVisual(weaponId: string): { color?: number; scaleX?: number; scaleY?: number } {
    switch (weaponId) {
      case 'machine_gun':
        return { color: 0xffcc00, scaleX: 0.7, scaleY: 0.7 }; // 橙黄小弹
      case 'shotgun':
        return { color: 0xff5555, scaleX: 0.9, scaleY: 0.9 }; // 红色散弹
      case 'laser':
        return { color: 0x00ffff, scaleX: 2.5, scaleY: 0.4 }; // 青色细长激光
      case 'default_gun':
        return { color: 0xffffff }; // 白色默认
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
      default: audio.playSfx(SOUND_KEYS.SFX_SHOOT_DEFAULT, 0.5); break;
    }
  }

  /** 回旋镖：穿透 + 飞出后返回 */
  private fireBoomerang(config: WeaponConfig, level: number): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;

    const pool = scene.getObjectPool();
    const damage = config.damage * (1 + level * 0.2) * this.stats.attackPower / 10;

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
      }
    );
  }

  /** 近战武器：光剑扇形范围攻击 */
  private fireMelee(config: WeaponConfig, level: number): void {
    const scene = this.scene as any;
    if (!scene || !scene.getEnemies) return;

    const damage = config.damage * (1 + level * 0.2) * this.stats.attackPower / 10;
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

  takeDamage(amount: number): void {
    if (this.invincible || this.stats.health <= 0) return;

    const actualDamage = Math.max(1, amount - this.stats.defense);
    this.stats.health -= actualDamage;
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

    EventBus.emit('player:damage', actualDamage);
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PLAYER_HURT, 1);

    if (this.stats.health <= 0) {
      this.stats.health = 0;
      this.die();
    }
  }

  heal(amount: number): void {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
    EventBus.emit('player:heal', amount);
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
      EventBus.emit('player:revive');
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_PLAYER_REVIVE, 1);
      return;
    }

    this.setActive(false);
    this.setVisible(false);
    this.shieldRing?.destroy();
    this.shieldRing = null;
    EventBus.emit('player:death');
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
    EventBus.emit('player:coins', this.stats.coins);
  }

  getCoins(): number {
    return this.stats.coins;
  }

  /** 消费金币（不足返回 false） */
  spendCoins(amount: number): boolean {
    if (this.stats.coins < amount) return false;
    this.stats.coins -= amount;
    EventBus.emit('player:coins', this.stats.coins);
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
    EventBus.emit('player:inventoryChanged');
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
    EventBus.emit('player:inventoryChanged');
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
    this.stats.attackSpeed *= 1.5;
    this.stats.attackPower *= 1.5;
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
  }

  private levelUp(): void {
    this.stats.level++;
    this.stats.expToNext = this.calcExpToNext(this.stats.level);

    // 升级属性提升
    this.stats.maxHealth += 5;
    this.stats.health = this.stats.maxHealth;
    this.stats.attackPower += 2;

    EventBus.emit('player:levelup', this.stats.level);
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
  }): void {
    if (saved.stats) {
      this.stats = { ...this.stats, ...saved.stats };
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
      (this.stats as any)[stat] *= 1 + value;
    } else {
      (this.stats as any)[stat] += value;
    }
    // 确保生命值不超过上限
    if (stat === 'maxHealth') {
      this.stats.health = Math.min(this.stats.health, this.stats.maxHealth);
    }
  }

  // ========== Getters ==========

  getStats(): PlayerStats {
    return { ...this.stats };
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
    return this.stats.pickupRadius;
  }

  isInvincible(): boolean {
    return this.invincible;
  }
}
