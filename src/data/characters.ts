/**
 * 角色配置数据（预留接口）
 *
 * 未来主角选择界面：通过 GameManager.setActiveCharacterId(id) 切换角色后，
 * 新建对局/试玩场地在创建玩家时自动应用对应角色的初始武器与属性加成。
 * 新增角色只需在此表追加一条配置，GameScene/训练场无需改动。
 */
export interface CharacterConfig {
  id: string;
  name: string;
  description: string;
  /** 初始武器 id（对应 data/weapons.ts 的 WEAPONS 配置键） */
  starterWeapon: string;
  /** 初始属性加成（可选；叠加在基础属性上） */
  statBonus?: {
    maxHealth?: number;
    attackPower?: number;
    moveSpeed?: number;
    critRate?: number;
    critDamage?: number;
  };
  /** 独有被动描述（预留，未来角色特化能力） */
  passiveDesc?: string;
}

export const CHARACTERS: Record<string, CharacterConfig> = {
  default: {
    id: 'default',
    name: '拓荒者',
    description: '均衡型初始角色，无特殊加成',
    starterWeapon: 'default_gun',
  },
};
