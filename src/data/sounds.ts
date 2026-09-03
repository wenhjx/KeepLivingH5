/**
 * 音效 key 集中定义（音频接口预留层）
 *
 * 使用方式：
 * 1. 在 PreloadScene 中加载对应音频资源（audio key 与此处 key 保持一致）
 * 2. 游戏各事件点已通过 AudioManager.playSfx / playSfxAtPosition 调用
 * 3. 资源缺失时 playSfx 静默失败（不会报错、不影响游戏），补齐资源即可出声
 *
 * 命名约定：{类别}_{事件}，如 bgm_menu / sfx_shoot_laser
 */
export const SOUND_KEYS = {
  // ===== 背景音乐 =====
  /** 主菜单 BGM */
  BGM_MENU: 'bgm_menu',
  /** 战斗 BGM */
  BGM_BATTLE: 'bgm_battle',
  /** Boss 战 BGM */
  BGM_BOSS: 'bgm_boss',
  /** 商店 BGM */
  BGM_SHOP: 'bgm_shop',

  // ===== 武器射击 =====
  SFX_SHOOT_DEFAULT: 'sfx_shoot_default',
  SFX_SHOOT_SHOTGUN: 'sfx_shoot_shotgun',
  SFX_SHOOT_MACHINE_GUN: 'sfx_shoot_machine_gun',
  SFX_SHOOT_LASER: 'sfx_shoot_laser',
  SFX_SHOOT_ROCKET: 'sfx_shoot_rocket',
  SFX_MELEE_SWING: 'sfx_melee_swing',
  SFX_BOOMERANG: 'sfx_boomerang',
  SFX_DRONE: 'sfx_drone',

  // ===== 战斗反馈 =====
  /** 子弹命中敌人 */
  SFX_HIT: 'sfx_hit',
  /** 暴击命中（更大声） */
  SFX_HIT_CRIT: 'sfx_hit_crit',
  /** 爆炸 */
  SFX_EXPLOSION: 'sfx_explosion',
  /** 敌人死亡 */
  SFX_ENEMY_DIE: 'sfx_enemy_die',
  /** Boss 出现警报 */
  SFX_BOSS_ALERT: 'sfx_boss_alert',
  /** Boss 死亡 */
  SFX_BOSS_DIE: 'sfx_boss_die',

  // ===== 玩家 =====
  /** 玩家受伤 */
  SFX_PLAYER_HURT: 'sfx_player_hurt',
  /** 玩家死亡 */
  SFX_PLAYER_DIE: 'sfx_player_die',
  /** 复活 */
  SFX_PLAYER_REVIVE: 'sfx_player_revive',
  /** 升级 */
  SFX_LEVEL_UP: 'sfx_level_up',
  /** 新武器解锁 */
  SFX_WEAPON_UNLOCK: 'sfx_weapon_unlock',

  // ===== 拾取 =====
  /** 拾取经验 */
  SFX_PICKUP_EXP: 'sfx_pickup_exp',
  /** 拾取金币 */
  SFX_PICKUP_COIN: 'sfx_pickup_coin',
  /** 拾取血包 */
  SFX_PICKUP_HEALTH: 'sfx_pickup_health',

  // ===== 商店 =====
  /** 购买成功 */
  SFX_SHOP_BUY: 'sfx_shop_buy',
  /** 购买失败（金币不足） */
  SFX_SHOP_DENY: 'sfx_shop_deny',
  /** 刷新商品 */
  SFX_SHOP_REFRESH: 'sfx_shop_refresh',
  /** 离开商店 */
  SFX_SHOP_CLOSE: 'sfx_shop_close',

  // ===== 道具使用 =====
  /** 使用消耗品 */
  SFX_ITEM_USE: 'sfx_item_use',
  /** 炸弹清屏 */
  SFX_ITEM_BOMB: 'sfx_item_bomb',
  /** 护盾激活 */
  SFX_ITEM_SHIELD: 'sfx_item_shield',
  /** 狂暴激活 */
  SFX_ITEM_RAGE: 'sfx_item_rage',

  // ===== UI =====
  /** 按钮点击 */
  SFX_UI_CLICK: 'sfx_ui_click',
  /** 暂停 */
  SFX_UI_PAUSE: 'sfx_ui_pause',
  /** 游戏结束 */
  SFX_GAME_OVER: 'sfx_game_over',
  /** 通关胜利 */
  SFX_VICTORY: 'sfx_victory',
} as const;

export type SoundKey = (typeof SOUND_KEYS)[keyof typeof SOUND_KEYS];
