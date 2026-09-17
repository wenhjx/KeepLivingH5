import type { WeaponTag } from "../types";

/**
 * 角色配置数据（选角系统）
 *
 * 未来主角选择界面：通过 GameManager.setActiveCharacterId(id) 切换角色后，
 * 新建对局/试玩场地在创建玩家时自动应用对应角色的初始武器与属性加成。
 * 新增角色只需在此表追加一条配置，GameScene/训练场无需改动。
 */
export interface CharacterConfig {
  id: string;
  name: string;
  /** 角色图标（emoji，选角卡片/图鉴展示） */
  icon: string;
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
  /** 独有被动描述（角色特化能力说明，选角卡片/图鉴展示） */
  passiveDesc?: string;
  /** 熟练武器系别：命中这些系别的武器获得 favoredBonus 加成（缺省=全均衡，如拓荒者） */
  favoredTags?: WeaponTag[];
  /** 熟练系别武器加成 */
  favoredBonus?: { damageMult?: number };
  /** 受击减伤（如 0.2 = 受击伤害 ×0.8；圣盾类角色，结算见 Player.takeDamage） */
  damageReduction?: number;
}

export const CHARACTERS: Record<string, CharacterConfig> = {
  default: {
    id: "default",
    name: "拓荒者",
    icon: "🪖",
    description: "均衡型初始角色：任何武器都能平均发挥",
    starterWeapon: "default_gun",
    passiveDesc: "双暴向：暴击率溢出按 1:2 转为暴击伤害",
  },
  mechanic: {
    id: "mechanic",
    name: "机械师",
    icon: "🔧",
    description: "枪械专家：枪械系武器伤害 +20%",
    starterWeapon: "machine_gun",
    statBonus: { critRate: 0.05 },
    passiveDesc: "枪械熟练：机枪/激光/霰弹等枪械系武器伤害 +20%",
    favoredTags: ["gun"],
    favoredBonus: { damageMult: 1.2 },
  },
  paladin: {
    id: "paladin",
    name: "圣骑士",
    icon: "🛡️",
    description: "圣盾近战：近战/范围系武器伤害 +20%，受击 -20%",
    starterWeapon: "lightsaber",
    statBonus: { maxHealth: 80, moveSpeed: 10 },
    passiveDesc: "圣盾：受击伤害 -20%；近战/范围系武器伤害 +20%",
    favoredTags: ["melee", "aoe"],
    favoredBonus: { damageMult: 1.2 },
    damageReduction: 0.2,
  },
};
