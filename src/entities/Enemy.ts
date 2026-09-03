import Phaser from 'phaser';
import { MathUtils } from '../utils/MathUtils';
import { EventBus } from '../utils/EventBus';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';
import { GameConfig } from '../game/GameConfig';
import { ENEMY_CONFIGS } from '../data/enemies';
import type { EnemyConfig, EnemyType } from '../types';
import type { Player } from './Player';

/**
 * 敌人实体基类
 * 所有敌人类型继承此类，实现AI移动、攻击、死亡掉落等逻辑
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private config!: EnemyConfig;
  private health: number = 0;
  private maxHealth: number = 0;
  private attackCooldown: number = 0;
  private isDead: boolean = false;
  private hitFlashTimer: number = 0;
  private difficultyMultiplier: number = 1;
  private atkBoost: number = 1;
  /** 击退（环形冲击波等推离效果）：速度分量 + 剩余时长（ms） */
  private knockbackVx = 0;
  private knockbackVy = 0;
  private knockbackTimer = 0;
  private avoidSide: number = 1; // 障碍物避让方向：+1 右，-1 左（每个敌人固定，避免扎堆）
  /** 冰冻剩余时长(ms)：>0 时大幅减速 + 蓝色视觉 */
  private freezeTimer = 0;
  /** 灼烧 DOT：剩余时长(ms) + 每跳伤害 + 跳间计时 */
  private burnTimer = 0;
  private burnDamage = 0;
  private burnTick = 0;
  /** 头顶小血条（受伤时短暂显示，平时隐藏） */
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpBarTimer = 0;
  /** 精英词缀：enrage(狂暴)/shield(护盾)/split(分裂)，仅精英怪随机附加 */
  private affix = '';
  private shieldPool = 0;
  private affixAtkBoost = 1;
  private affixSpeedMult = 1;
  private affixText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, GameConfig.themeKey('enemy_normal'));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
  }

  /** 从对象池取出时初始化 */
  spawn(config: EnemyConfig, x: number, y: number, difficultyMultiplier: number = 1, hpBoost: number = 1, atkBoost: number = 1): void {
    this.config = config;
    this.difficultyMultiplier = difficultyMultiplier;
    this.atkBoost = isFinite(atkBoost) && atkBoost > 0 ? atkBoost : 1;
    // 防御：难度系数非法（NaN/Infinity）时回退为 1，血量永远用有效正数，
    // 避免 maxHealth/health 变成 NaN 导致怪物永久无敌（health -= NaN 永远不死）
    const safeMult = isFinite(difficultyMultiplier) && difficultyMultiplier > 0 ? difficultyMultiplier : 1;
    const safeHpBoost = isFinite(hpBoost) && hpBoost > 0 ? hpBoost : 1;
    const baseHp = Number(config.maxHealth);
    // 全局耐久系数 1.3：怪物整体更扛揍，给吸血/灼烧/闪电链等新被动发挥空间
    this.maxHealth = Math.max(1, Math.floor(isFinite(baseHp) && baseHp > 0 ? baseHp * safeMult * safeHpBoost * 1.3 : 1));
    this.health = this.maxHealth;
    this.attackCooldown = 0;
    this.isDead = false;
    this.hitFlashTimer = 0;
    this.freezeTimer = 0;
    this.burnTimer = 0;
    this.burnDamage = 0;
    this.avoidSide = Math.random() > 0.5 ? 1 : -1;

    // 头顶小血条（Boss 用顶部大血条，不显示小血条）
    if (!this.hpBarBg && config.type !== 'boss') {
      this.hpBarBg = this.scene.add.graphics().setDepth(8);
      this.hpBar = this.scene.add.graphics().setDepth(9);
      this.hpBarBg.setVisible(false);
      this.hpBar.setVisible(false);
    }

    this.setTexture(GameConfig.themeKey(config.texture || 'enemy_normal'));
    // 先启用物理体并 reset 到正确位置
    if (this.body) {
      this.body.enable = true;
      this.body.reset(x, y);
    }
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setCircle(config.size / 2 || 16);
    this.setDepth(5);
    this.clearTint();
    this.setAlpha(1);

    // 根据类型设置颜色：像素主题（白色像素主体）需 tint 上色；
    // 经典矢量主题纹理自带颜色，无需 tint（避免双重染色）
    if (config.color && GameConfig.VISUAL_THEME === 'pixel') {
      this.setTint(config.color);
    }

    // ===== 精英词缀：狂暴/护盾/分裂（仅精英怪随机附加，可按配置固定） =====
    if (config.type === 'elite') {
      const affixes = ['enrage', 'shield', 'split'];
      this.affix = config.affix || affixes[Math.floor(Math.random() * affixes.length)];
    } else {
      this.affix = config.affix || '';
    }
    this.shieldPool = 0;
    this.affixAtkBoost = 1;
    this.affixSpeedMult = 1;
    if (this.affix === 'enrage') {
      // 狂暴：攻击×1.2、移速×1.3、橙红视觉
      this.affixAtkBoost = 1.2;
      this.affixSpeedMult = 1.3;
      this.setTint(0xff8844);
    } else if (this.affix === 'shield') {
      // 护盾：额外护盾值 60% 血量、亮蓝视觉
      this.shieldPool = Math.floor(this.maxHealth * 0.6);
      this.setTint(0x44aaff);
    } else if (this.affix === 'split') {
      // 分裂：死亡分裂 2 只小怪、紫色视觉
      this.setTint(0xcc88ff);
    }
    // 词缀图标（跟随头顶）
    const affixIcons: Record<string, string> = { enrage: '🔥', shield: '🛡️', split: '💥' };
    if (!this.affixText) {
      this.affixText = this.scene.add.text(0, 0, '', { fontSize: '12px', fontFamily: 'Arial' }).setDepth(6).setOrigin(0.5);
    }
    const affixIcon = affixIcons[this.affix] || '';
    this.affixText.setText(affixIcon)
      .setPosition(this.x, this.y - (config.size || 32) / 2 - 22)
      .setVisible(!!affixIcon);

    EventBus.emit('enemy:spawn', this);
  }

  /** 回收对象池 */
  despawn(): void {
    this.knockbackTimer = 0;
    this.freezeTimer = 0;
    this.burnTimer = 0;
    this.burnDamage = 0;
    this.affix = '';
    this.shieldPool = 0;
    this.affixAtkBoost = 1;
    this.affixSpeedMult = 1;
    if (this.affixText) this.affixText.setVisible(false);
    this.hideHpBar();
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.setVelocity(0, 0);
      this.body.enable = false;
      this.body.reset(0, 0);
    }
  }

  /** 击退：从 fromX/fromY 方向将敌人推离（环形冲击波等），短暂覆盖 AI 移动 */
  applyKnockback(fromX: number, fromY: number, force: number): void {
    if (this.isDead || !this.body) return;
    const angle = MathUtils.angle(fromX, fromY, this.x, this.y);
    this.knockbackVx = Math.cos(angle) * force;
    this.knockbackVy = Math.sin(angle) * force;
    this.knockbackTimer = 200; // 200ms 击退（足够把围堵的敌人推出一段安全距离）
  }

  /** 冰冻（冰冻被动）：减速 + 蓝色视觉 */
  applyFreeze(duration: number): void {
    if (this.isDead) return;
    this.freezeTimer = Math.max(this.freezeTimer, duration);
    this.setTint(0x88ddff);
  }

  /** 灼烧（灼烧被动）：持续火焰伤害 */
  applyBurn(damage: number, duration: number): void {
    if (this.isDead) return;
    this.burnDamage = Math.max(this.burnDamage, damage);
    this.burnTimer = Math.max(this.burnTimer, duration);
    this.burnTick = 0;
  }

  /**
   * 玩家攻击命中时触发被动效果（吸血/冰冻/灼烧/闪电链/弹射）
   * 由 CollisionSystem（子弹）/ Player.fireMelee / Player.fireNova 调用
   */
  applyPlayerEffects(amount: number, player: Player, sourceX: number, sourceY: number): void {
    if (this.isDead || !player) return;
    const getLv = (id: string) => player.getPassiveLevel(id);

    // 吸血：回复造成伤害的一定比例
    const ls = getLv('passive_lifesteal');
    if (ls > 0) {
      player.heal(amount * 0.03 * ls);
    }

    // 冰冻：概率冰冻减速
    const frz = getLv('passive_freeze');
    if (frz > 0 && Math.random() < 0.08 * frz) {
      this.applyFreeze(2000);
      (this.scene as any).getFXManager?.()?.frost?.(this.x, this.y);
    }

    // 灼烧：概率施加 DOT
    const brn = getLv('passive_burn');
    if (brn > 0 && Math.random() < 0.1 * brn) {
      this.applyBurn(Math.max(1, amount * 0.1 * brn), 3000);
    }

    // 闪电链：概率连锁伤害附近敌人（不递归触发其他被动）
    const chn = getLv('passive_chain');
    if (chn > 0 && Math.random() < 0.1 * chn) {
      this.chainLightning(player, amount * 0.6, chn, sourceX, sourceY);
    }

    // 弹射：伤害弹射到附近敌人（不递归触发其他被动）
    const bnc = getLv('passive_bounce');
    if (bnc > 0) {
      this.bounceHit(player, amount * 0.5, bnc, sourceX, sourceY);
    }
  }

  /** 弹射：从源敌人跳到附近最近的敌人，逐跳递减伤害 */
  private bounceHit(player: Player, damage: number, jumps: number, sourceX: number, sourceY: number): void {
    const scene = this.scene as any;
    let source: any = this;
    for (let i = 0; i < jumps; i++) {
      const target = this.findNearbyEnemy(source, 160);
      if (!target) break;
      target.takeDamage(damage, false);
      scene?.getFXManager?.()?.bounce?.(source.x, source.y, target.x, target.y);
      source = target;
    }
  }

  /** 闪电链：连锁伤害附近敌人，每跳 60% 伤害 */
  private chainLightning(player: Player, damage: number, jumps: number, sourceX: number, sourceY: number): void {
    const scene = this.scene as any;
    let source: any = this;
    for (let i = 0; i < jumps; i++) {
      const target = this.findNearbyEnemy(source, 220);
      if (!target) break;
      target.takeDamage(damage, false);
      scene?.getFXManager?.()?.chainLightning?.(source.x, source.y, target.x, target.y);
      source = target;
    }
  }

  /** 查找源敌人附近最近的存活敌人（弹射/闪电链用） */
  private findNearbyEnemy(source: any, radius: number): any {
    const scene = this.scene as any;
    const enemies = scene?.getEnemies?.();
    if (!enemies) return null;
    let best: any = null;
    let bd = radius;
    enemies.getChildren().forEach((e: any) => {
      if (!e.active || e === source || e.isDead) return;
      const d = Phaser.Math.Distance.Between(source.x, source.y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    });
    return best;
  }

  /** 当前精英词缀（enrage/shield/split/''） */
  getAffix(): string {
    return this.affix;
  }

  /** 绘制头顶小血条（跟随敌人位置） */
  private drawHpBar(): void {
    if (!this.hpBarBg || !this.hpBar) return;
    const w = Math.max(20, (this.config?.size || 32) * 1.2);
    const h = 3;
    const x = this.x - w / 2;
    const y = this.y - (this.config?.size || 32) / 2 - 9;
    const pct = Math.max(0, Math.min(1, this.health / (this.maxHealth || 1)));
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x000000, 0.6);
    this.hpBarBg.fillRect(x, y, w, h);
    this.hpBar.clear();
    const barColor = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa33 : 0xff4444;
    this.hpBar.fillStyle(barColor, 1);
    this.hpBar.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * pct), h - 2);
  }

  /** 隐藏头顶小血条 */
  private hideHpBar(): void {
    this.hpBarTimer = 0;
    if (this.hpBarBg) this.hpBarBg.setVisible(false);
    if (this.hpBar) this.hpBar.setVisible(false);
  }

  update(time: number, delta: number, player: Player): void {
    if (!this.active || this.isDead) return;

    // 受击闪烁
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.clearTint();
        if (this.config?.color) this.setTint(this.config.color);
      }
    }

    // 词缀图标跟随敌人
    if (this.affixText && this.affixText.visible) {
      this.affixText.setPosition(this.x, this.y - (this.config?.size || 32) / 2 - 22);
    }

    // 灼烧 DOT（持续火焰伤害，每 500ms 一跳）
    if (this.burnTimer > 0) {
      this.burnTimer -= delta;
      this.burnTick -= delta;
      if (this.burnTick <= 0) {
        this.burnTick = 500;
        this.takeDamage(this.burnDamage, false);
        (this.scene as any).getFXManager?.()?.burn?.(this.x, this.y - 10);
      }
      if (this.burnTimer <= 0) this.burnDamage = 0;
    }

    // 头顶小血条：受伤后短暂显示，超时隐藏
    if (this.hpBarTimer > 0) {
      this.hpBarTimer -= delta;
      this.drawHpBar();
      if (this.hpBarTimer <= 0) this.hideHpBar();
    }

    // AI 行为
    this.updateAI(time, delta, player);

    // 击退覆盖（环形冲击波等推离效果，短暂覆盖 AI 移动后恢复）
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= delta;
      this.setVelocity(this.knockbackVx, this.knockbackVy);
    } else {
      // 时间减速（时间减速药水）：统一缩放敌人速度，不影响玩家与子弹
      let slow = (this.scene as any).getSlowFactor?.() ?? 1;
      // 冰冻（冰冻被动）：额外大幅减速 + 倒计时，结束后恢复原色
      if (this.freezeTimer > 0) {
        this.freezeTimer -= delta;
        slow *= 0.4;
        if (this.freezeTimer <= 0) {
          if (this.config?.color) this.setTint(this.config.color);
          else this.clearTint();
        }
      }
      if (slow !== 1 && this.body) {
        this.setVelocity(this.body.velocity.x * slow, this.body.velocity.y * slow);
      }
    }

    // 攻击冷却
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
  }

  private updateAI(time: number, delta: number, player: Player): void {
    const dist = MathUtils.distance(this.x, this.y, player.x, player.y);

    switch (this.config.type) {
      case 'ranged':
        this.rangedAI(delta, player, dist);
        break;
      case 'boss':
        this.bossAI(delta, player, dist);
        break;
      case 'fast':
        this.fastAI(delta, player, dist);
        break;
      case 'suicider':
        this.suiciderAI(delta, player, dist);
        break;
      case 'splitter':
        this.normalAI(delta, player, dist);
        break;
      case 'shielded':
        this.shieldedAI(delta, player, dist);
        break;
      default:
        this.normalAI(delta, player, dist);
        break;
    }
  }

  /** 自爆怪：高速冲向玩家，进入爆炸半径后自爆 */
  private suiciderAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier * this.affixSpeedMult;
    const v = this.avoidObstacles(angle, speed);
    this.setVelocity(v.vx, v.vy);

    // 进入爆炸半径立即自爆
    const explodeRadius = this.config.explodeRadius ?? 60;
    if (dist < explodeRadius) {
      this.explode(player);
    }
  }

  /** 自爆：对玩家造成范围伤害，自身死亡 */
  private explode(player: Player): void {
    if (this.isDead) return;
    const radius = this.config.explodeRadius ?? 60;
    const damage = (this.config.explodeDamage ?? 30) * this.difficultyMultiplier * this.atkBoost;

    // 对范围内的敌人也造成伤害（连锁爆炸的爽感）
    const scene = this.scene as any;
    const enemies = scene?.getEnemies?.();
    if (enemies) {
      enemies.getChildren().forEach((e: any) => {
        if (!e.active || e === this) return;
        const d = MathUtils.distance(this.x, this.y, e.x, e.y);
        if (d <= radius) {
          e.takeDamage?.(damage * 0.5, false);
        }
      });
    }

    // 对玩家造成伤害（范围衰减）
    const pDist = MathUtils.distance(this.x, this.y, player.x, player.y);
    const falloff = 1 - Math.max(0, pDist / radius) * 0.5;
    player.takeDamage(Math.max(1, damage * falloff));

    // 自爆视觉：双环 + 橙色粒子 + 轻震屏（统一走 FXManager）+ 爆炸音效
    AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_EXPLOSION, 0.8);
    scene?.getFXManager?.()?.explosion(this.x, this.y, radius);

    // 自身死亡（不掉落，自爆无收益）
    this.isDead = true;
    EventBus.emit('enemy:death', this.config);
    this.despawn();
  }

  /** 护盾怪：缓慢接近，正面减伤，侧面/背面正常受伤 */
  private shieldedAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier * this.affixSpeedMult;
    const v = this.avoidObstacles(angle, speed);
    this.setVelocity(v.vx, v.vy);

    // 旋转朝向玩家，让护盾弧始终朝前（与正面减伤逻辑一致）
    this.setRotation(angle);

    // 接触攻击
    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.attackPlayer(player);
    }
  }

  /** 普通敌人：直接冲向玩家 */
  private normalAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier * this.affixSpeedMult;
    const v = this.avoidObstacles(angle, speed);
    this.setVelocity(v.vx, v.vy);

    // 接触攻击
    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.attackPlayer(player);
    }
  }

  /** 快速敌人：速度快但血量低，Z字移动 */
  private fastAI(delta: number, player: Player, dist: number): void {
    const baseAngle = MathUtils.angle(this.x, this.y, player.x, player.y);
    // 加入正弦波动实现Z字
    const wobble = Math.sin(this.scene.time.now / 200 + this.x * 0.01) * 0.5;
    const angle = baseAngle + wobble;
    const speed = this.config.moveSpeed * this.difficultyMultiplier * this.affixSpeedMult;
    const v = this.avoidObstacles(angle, speed);
    this.setVelocity(v.vx, v.vy);

    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.attackPlayer(player);
    }
  }

  /** 远程敌人：保持距离并射击 */
  private rangedAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier * this.affixSpeedMult;
    const preferredDist = 250;

    let moveAngle = angle;
    let moveSpeed = speed;

    if (dist > preferredDist + 50) {
      // 靠近
      moveAngle = angle;
    } else if (dist < preferredDist - 50) {
      // 远离
      moveAngle = angle + Math.PI;
    } else {
      // 横向移动
      moveAngle = angle + Math.PI / 2;
      moveSpeed = speed * 0.5;
    }

    const v = this.avoidObstacles(moveAngle, moveSpeed);
    this.setVelocity(v.vx, v.vy);

    // 远程攻击
    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.rangedAttack(player);
    }
  }

  /** Boss：多种攻击模式 */
  private bossAI(delta: number, player: Player, dist: number): void {
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    const speed = this.config.moveSpeed * this.difficultyMultiplier * this.affixSpeedMult;
    const v = this.avoidObstacles(angle, speed);
    this.setVelocity(v.vx, v.vy);

    // 接触伤害
    if (dist < this.config.attackRange && this.attackCooldown <= 0) {
      this.attackPlayer(player);
    }

    // 周期性弹幕（每3秒）
    if (Math.floor(this.scene.time.now / 3000) !== Math.floor((this.scene.time.now - delta) / 3000)) {
      this.bossBarrage();
    }
  }

  /**
   * 障碍物避让：探测前方是否有障碍物，被挡则侧向绕行
   * 每个敌人有固定的 avoidSide，避免全部往同一边蹭
   */
  private avoidObstacles(targetAngle: number, speed: number): { vx: number; vy: number } {
    const gs = this.scene as any;
    const tm = gs?.getTerrainManager?.();
    if (!tm) return { vx: Math.cos(targetAngle) * speed, vy: Math.sin(targetAngle) * speed };

    const obstacles = tm.getObstacles();
    const lookAhead = 55; // 前方探测距离
    const fx = this.x + Math.cos(targetAngle) * lookAhead;
    const fy = this.y + Math.sin(targetAngle) * lookAhead;

    let blocked = false;
    for (const obs of obstacles) {
      if (
        fx > obs.x - obs.width / 2 && fx < obs.x + obs.width / 2 &&
        fy > obs.y - obs.height / 2 && fy < obs.y + obs.height / 2
      ) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      return { vx: Math.cos(targetAngle) * speed, vy: Math.sin(targetAngle) * speed };
    }

    // 被阻挡：侧向避让（约72度），混合目标方向30% + 避让方向70%
    const avoidAngle = targetAngle + this.avoidSide * (Math.PI / 2.5);
    const vx = Math.cos(targetAngle) * speed * 0.3 + Math.cos(avoidAngle) * speed * 0.7;
    const vy = Math.sin(targetAngle) * speed * 0.3 + Math.sin(avoidAngle) * speed * 0.7;
    return { vx, vy };
  }

  private bossBarrage(): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;
    const pool = scene.getObjectPool();
    // 8方向弹幕
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      pool.spawnEnemyBullet(this.x, this.y, angle, 200, this.config.attackPower * 0.5 * this.difficultyMultiplier * this.atkBoost * this.affixAtkBoost);
    }
  }

  private attackPlayer(player: Player): void {
    player.takeDamage(this.config.attackPower * this.difficultyMultiplier * this.atkBoost * this.affixAtkBoost);
    this.attackCooldown = this.config.attackCooldown;
  }

  private rangedAttack(player: Player): void {
    const scene = this.scene as any;
    if (!scene || !scene.getObjectPool) return;
    const pool = scene.getObjectPool();
    const angle = MathUtils.angle(this.x, this.y, player.x, player.y);
    pool.spawnEnemyBullet(this.x, this.y, angle, 300, this.config.attackPower * this.difficultyMultiplier * this.atkBoost * this.affixAtkBoost);
    this.attackCooldown = this.config.attackCooldown;
  }

  // ========== 受伤与死亡 ==========

  takeDamage(amount: number, isCrit: boolean = false, fromX?: number, fromY?: number): void {
    if (this.isDead) return;

    // 受伤后短暂显示头顶小血条（Boss 用顶部大血条，不显示）
    if (this.config?.type !== 'boss' && this.hpBarBg) {
      this.hpBarTimer = 2000;
      this.hpBarBg.setVisible(true);
      this.hpBar.setVisible(true);
    }

    // 防御：无效伤害（NaN/Infinity/<=0）直接忽略，防止污染血量（health -= NaN → 永久无敌）
    if (!isFinite(amount) || amount <= 0) return;

    // 防御：血量已被污染成 NaN 的残留怪，先重置为满血再正常结算，避免"打不死"
    if (!isFinite(this.health) || this.health < 0) {
      this.health = this.maxHealth || 1;
    }

    // 精英护盾词缀：护盾池优先吸收伤害
    if (this.shieldPool > 0) {
      const absorbed = Math.min(this.shieldPool, amount);
      this.shieldPool -= absorbed;
      amount -= absorbed;
      (this.scene as any).getFXManager?.()?.hit?.(this.x, this.y, false);
      if (amount <= 0) return;
    }

    // 护盾怪：正面减伤（攻击来自玩家方向的子弹视为正面）
    const reduction = this.config?.shieldFrontReduction;
    let finalAmount = amount;
    if (reduction && fromX !== undefined && fromY !== undefined) {
      // 敌人面向玩家的方向 = 盾牌正面朝向
      const gs = this.scene as any;
      const player = gs?.getPlayer?.();
      if (player) {
        const facingAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const attackAngle = Math.atan2(fromY - this.y, fromX - this.x);
        // 夹角（弧度）
        let diff = Math.abs(facingAngle - attackAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        // 正面 ±60° 内减伤
        if (diff < Math.PI / 3) {
          finalAmount = Math.max(1, amount * (1 - reduction));
        }
      }
    }

    this.health -= finalAmount;
    this.hitFlashTimer = 100;
    this.setTint(0xffffff);

    // 击退效果
    // TODO: 根据攻击方向添加击退

    if (this.health <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.isDead = true;
    const scene = this.scene as any;

    // 分裂怪：死亡后分裂成小怪
    const splitConfig = this.config?.splitInto;
    if (splitConfig) {
      const productConfig = ENEMY_CONFIGS[splitConfig.type];
      if (productConfig && scene?.getObjectPool?.()) {
        for (let i = 0; i < splitConfig.count; i++) {
          const offsetX = (i % 2 === 0 ? -1 : 1) * 20;
          scene.getObjectPool().spawnEnemy(
            productConfig,
            this.x + offsetX,
            this.y + (i % 2 === 0 ? 15 : -15),
            this.difficultyMultiplier * 0.6
          );
        }
      }
    }

    // 精英分裂词缀：死亡分裂 2 只普通小怪（词缀版，与分裂怪机制一致）
    if (this.affix === 'split') {
      const productConfig = ENEMY_CONFIGS.normal;
      if (productConfig && scene?.getObjectPool?.()) {
        for (let i = 0; i < 2; i++) {
          const offsetX = (i % 2 === 0 ? -1 : 1) * 20;
          scene.getObjectPool().spawnEnemy(
            productConfig,
            this.x + offsetX,
            this.y + (i % 2 === 0 ? 15 : -15),
            this.difficultyMultiplier * 0.6
          );
        }
      }
    }

    // 掉落经验（随波次难度成长，避免后期"需求指数涨、获取固定"导致升级断崖）
    if (scene && scene.spawnPickup) {
      scene.spawnPickup(
        {
          type: 'exp',
          texture: 'pickup_exp',
          value: Math.max(1, Math.floor(this.config.expReward * this.difficultyMultiplier)),
          magnetSpeed: 300,
        },
        this.x,
        this.y
      );
    }

    // 概率掉落血包
    if (MathUtils.chance(0.05)) {
      scene?.spawnPickup?.(
        {
          type: 'health',
          texture: 'pickup_health',
          value: 20,
          magnetSpeed: 300,
        },
        this.x + 20,
        this.y
      );
    }

    // 金币掉落（按敌人类型配置掉率与数量）
    const coinDrop = this.getCoinDrop();
    if (coinDrop && MathUtils.chance(coinDrop.chance)) {
      scene?.spawnPickup?.(
        {
          type: 'coin',
          texture: 'pickup_coin',
          value: MathUtils.randomInt(coinDrop.min, coinDrop.max),
          magnetSpeed: 300,
        },
        this.x - 20,
        this.y
      );
    }

    // 宝箱掉落（爽点）：普通怪小概率，精英高概率，Boss 必掉
    const chestChance = this.config.type === 'boss' ? 1 : (this.config.type === 'elite' ? 0.15 : 0.03);
    if (MathUtils.chance(chestChance)) {
      scene?.spawnPickup?.(
        {
          type: 'chest',
          texture: 'pickup_chest',
          value: 0,
          magnetSpeed: 200,
        },
        this.x + 15,
        this.y + 20
      );
    }

    // 死亡消散特效（统一入口：子弹击杀 / killAll / 连锁伤害均触发）
    scene?.getFXManager?.()?.enemyDeath(this.x, this.y, this.config?.color || 0xff4444);

    // 死亡音效（Boss 用专属死亡音效）
    AudioManager.getInstance().playSfx(
      this.config.type === 'boss' ? SOUND_KEYS.SFX_BOSS_DIE : SOUND_KEYS.SFX_ENEMY_DIE,
      this.config.type === 'boss' ? 1 : 0.5
    );

    EventBus.emit('enemy:death', this.config);
    this.despawn();
  }

  // ========== Getters ==========

  getConfig(): EnemyConfig {
    return this.config;
  }

  getEnemyType(): EnemyType {
    return this.config?.type || 'normal';
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  getExpReward(): number {
    return this.config?.expReward || 0;
  }

  getScoreReward(): number {
    return this.config?.scoreReward || 10;
  }

  /** 金币掉落配置（chance 0-1，min/max 金币数）；不掉的类型返回 null */
  private getCoinDrop(): { chance: number; min: number; max: number } | null {
    switch (this.config?.type) {
      case 'normal':
        return { chance: 0.3, min: 2, max: 5 };
      case 'fast':
        return { chance: 0.3, min: 2, max: 4 };
      case 'tank':
        return { chance: 0.5, min: 4, max: 7 };
      case 'ranged':
        return { chance: 0.35, min: 3, max: 5 };
      case 'elite':
        return { chance: 1, min: 15, max: 25 };
      case 'boss':
        return { chance: 1, min: 80, max: 150 };
      default:
        return { chance: 0.3, min: 2, max: 5 };
    }
  }

  isBoss(): boolean {
    return this.config?.type === 'boss';
  }
}
