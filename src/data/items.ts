import type { Player } from '../entities/Player';
import { SOUND_KEYS } from './sounds';
import { AudioManager } from '../systems/AudioManager';

/**
 * 可主动使用的物品定义（物品栏系统）
 * 商店购买的消耗品进入物品栏，由玩家主动使用
 * 复活币为被动触发，不进入物品栏
 */
export interface UsableItemDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 槽位边框颜色 */
  color: number;
  /** 使用效果 */
  use: (player: Player, gameScene: any) => void;
}

export const USABLE_ITEMS: Record<string, UsableItemDef> = {
  shield: {
    id: 'shield',
    name: '能量护盾',
    icon: '🛡️',
    description: '8 秒无敌护盾',
    color: 0x33ccff,
    use: (player) => { player.applyShield(8000); AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_ITEM_SHIELD, 0.9); },
  },
  rage: {
    id: 'rage',
    name: '狂暴药水',
    icon: '⚗️',
    description: '15 秒攻速与攻击力 +50%',
    color: 0xff4444,
    use: (player) => { player.applyRage(15000); AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_ITEM_RAGE, 0.9); },
  },
  bomb: {
    id: 'bomb',
    name: '全屏炸弹',
    icon: '💣',
    description: '对全场敌人造成 500 点伤害',
    color: 0xffaa00,
    use: (_player, gameScene) => {
      const enemies = gameScene?.getEnemies?.();
      if (!enemies) return;
      const list = enemies.getChildren() as any[];
      list.forEach((e: any) => {
        if (e.active && typeof e.takeDamage === 'function') {
          e.takeDamage(500, true);
        }
      });
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_ITEM_BOMB, 1);
    },
  },
  heal: {
    id: 'heal',
    name: '大血包',
    icon: '🍗',
    description: '恢复 50% 最大生命值',
    color: 0x44ff88,
    use: (player) => { player.heal(player.getMaxHealth() * 0.5); AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_ITEM_USE, 0.8); },
  },
};

/** 物品栏显示顺序 */
export const INVENTORY_ORDER = ['heal', 'shield', 'rage', 'bomb'];
