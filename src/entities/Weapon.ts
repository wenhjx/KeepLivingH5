import type { WeaponConfig, WeaponType } from '../types';

/**
 * 武器系统
 * 管理武器配置、升级、属性计算
 * 实际发射逻辑在 Player 中，此处负责配置数据和升级计算
 */
export class WeaponSystem {
  private weapons: Map<string, WeaponConfig> = new Map();

  constructor() {
    this.loadDefaultWeapons();
  }

  private loadDefaultWeapons(): void {
    // 基础武器
    this.weapons.set('default_gun', {
      id: 'default_gun',
      name: '基础射击',
      type: 'ranged',
      texture: 'bullet',
      damage: 10,
      attackSpeed: 2,
      range: 400,
      projectileSpeed: 500,
      projectileCount: 1,
      description: '基础远程攻击，稳定输出',
      maxLevel: 8,
    });

    // 霰弹枪
    this.weapons.set('shotgun', {
      id: 'shotgun',
      name: '霰弹枪',
      type: 'ranged',
      texture: 'bullet',
      damage: 6,
      attackSpeed: 1,
      range: 250,
      projectileSpeed: 450,
      projectileCount: 5,
      description: '近距离高伤害，发射5发散弹',
      maxLevel: 6,
    });

    // 回旋镖（AOE）
    this.weapons.set('boomerang', {
      id: 'boomerang',
      name: '回旋镖',
      type: 'aoe',
      texture: 'bullet',
      damage: 15,
      attackSpeed: 0.8,
      range: 300,
      projectileSpeed: 300,
      projectileCount: 1,
      aoeRadius: 40,
      description: '可穿透敌人的回旋攻击',
      maxLevel: 6,
    });

    // 召唤物（无人机）
    this.weapons.set('drone', {
      id: 'drone',
      name: '无人机',
      type: 'summon',
      texture: 'bullet',
      damage: 8,
      attackSpeed: 1.5,
      range: 350,
      projectileSpeed: 400,
      projectileCount: 1,
      description: '环绕玩家的自动攻击无人机',
      maxLevel: 6,
    });

    // 近战（光剑）
    this.weapons.set('lightsaber', {
      id: 'lightsaber',
      name: '光剑',
      type: 'melee',
      texture: 'weapon_sword',
      damage: 25,
      attackSpeed: 1.5,
      range: 80,
      aoeRadius: 80,
      description: '近战范围攻击，高伤害',
      maxLevel: 6,
    });
  }

  /** 获取武器配置 */
  getWeapon(id: string): WeaponConfig | undefined {
    return this.weapons.get(id);
  }

  /** 获取所有武器 */
  getAllWeapons(): WeaponConfig[] {
    return Array.from(this.weapons.values());
  }

  /** 获取指定类型的武器 */
  getWeaponsByType(type: WeaponType): WeaponConfig[] {
    return this.getAllWeapons().filter((w) => w.type === type);
  }

  /** 计算武器某等级的实际伤害 */
  getDamageAtLevel(weaponId: string, level: number, baseAttackPower: number): number {
    const config = this.weapons.get(weaponId);
    if (!config) return 0;
    return config.damage * (1 + level * 0.2) * (baseAttackPower / 10);
  }

  /** 计算武器某等级的实际攻速 */
  getAttackSpeedAtLevel(weaponId: string, level: number, baseAttackSpeed: number): number {
    const config = this.weapons.get(weaponId);
    if (!config) return 0;
    return config.attackSpeed * (1 + level * 0.05) * baseAttackSpeed;
  }

  /** 计算武器某等级的投射物数量 */
  getProjectileCountAtLevel(weaponId: string, level: number): number {
    const config = this.weapons.get(weaponId);
    if (!config) return 1;
    return (config.projectileCount || 1) + Math.floor(level / 3);
  }

  /** 注册自定义武器 */
  registerWeapon(config: WeaponConfig): void {
    this.weapons.set(config.id, config);
  }
}
