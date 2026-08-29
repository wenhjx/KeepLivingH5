import type { EnemyConfig, EnemyType } from '../types';

/**
 * 敌人配置数据
 * 所有敌人类型的基础属性定义
 */
export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  normal: {
    type: 'normal',
    name: '普通僵尸',
    texture: 'enemy_normal',
    maxHealth: 30,
    moveSpeed: 60,
    attackPower: 8,
    attackRange: 30,
    attackCooldown: 1000,
    expReward: 5,
    scoreReward: 10,
    size: 24,
    color: 0x66aa66,
  },
  fast: {
    type: 'fast',
    name: '疾速僵尸',
    texture: 'enemy_fast',
    maxHealth: 20,
    moveSpeed: 120,
    attackPower: 6,
    attackRange: 28,
    attackCooldown: 800,
    expReward: 8,
    scoreReward: 15,
    size: 20,
    color: 0x6666ff,
  },
  tank: {
    type: 'tank',
    name: '重装僵尸',
    texture: 'enemy_tank',
    maxHealth: 120,
    moveSpeed: 35,
    attackPower: 15,
    attackRange: 35,
    attackCooldown: 1500,
    expReward: 15,
    scoreReward: 30,
    size: 32,
    color: 0xaa6644,
  },
  ranged: {
    type: 'ranged',
    name: '远程僵尸',
    texture: 'enemy_ranged',
    maxHealth: 25,
    moveSpeed: 50,
    attackPower: 10,
    attackRange: 300,
    attackCooldown: 2000,
    expReward: 12,
    scoreReward: 25,
    size: 22,
    color: 0xaa44aa,
  },
  elite: {
    type: 'elite',
    name: '精英僵尸',
    texture: 'enemy_normal',
    maxHealth: 200,
    moveSpeed: 70,
    attackPower: 20,
    attackRange: 35,
    attackCooldown: 1200,
    expReward: 30,
    scoreReward: 60,
    size: 28,
    color: 0xffaa00,
  },
  boss: {
    type: 'boss',
    name: 'BOSS',
    texture: 'enemy_boss',
    maxHealth: 1000,
    moveSpeed: 45,
    attackPower: 30,
    attackRange: 50,
    attackCooldown: 1500,
    expReward: 100,
    scoreReward: 500,
    size: 48,
    color: 0xff2222,
  },
};

/** 获取敌人配置 */
export const getEnemyConfig = (type: EnemyType): EnemyConfig | undefined => ENEMY_CONFIGS[type];

/** 获取所有敌人类型 */
export const getAllEnemyTypes = (): EnemyType[] => Object.keys(ENEMY_CONFIGS) as EnemyType[];
