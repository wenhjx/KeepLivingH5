/**
 * 显示层级常量表（替代散落的 setDepth 魔法数字）
 *
 * 分层规则（自底向上，数值越大越靠前渲染）：
 *   -1     背景装饰（世界之下）
 *   0.5~4  地形 / 地面特效
 *   5~11   实体层（敌人 / 子弹 / 拾取物 / 血条 / 玩家 / 头顶标记）
 *   20     伤害飘字
 *   50~60  HUD 子层（buff 图标 / Boss 血条）与战斗特效
 *   100    小地图 / 暂停遮罩
 *   150    物品栏
 *   200    摇杆 / 主菜单弹窗
 *   210    悬浮说明
 *   300    升级 / 商店 / 横幅等弹层
 *   1000   调试面板
 *   10000  成就 / 引导提示（永远最高）
 *
 * 新增 UI 时先在此登记层级，避免与既有元素互相遮挡。
 */
export const Layers = {
  // —— 背景 ——
  BACKGROUND: -1, // 主菜单装饰背景（世界之下）

  // —— 地形 / 地面 ——
  TERRAIN_ZONE: 0.5, // 减速 / 加速地带（贴地）
  TERRAIN_BASE: 1, // 地形本体
  FX_GROUND: 4, // 地面扩散环（命中扩散 / 蓄力地基）

  // —— 实体 ——
  ENEMY: 5, // 敌人本体
  ENTITY_TAG: 6, // 敌人词缀文字（头顶）
  PICKUP: 6, // 拾取物
  PROJECTILE: 7, // 弹道特效 / 无人机
  PROJECTILE_CORE: 8, // 子弹本体
  HP_BAR_BG: 8, // 敌人血条底
  HP_BAR_FILL: 9, // 敌人血条填充
  PLAYER_FX: 9, // 玩家绘制特效（受击闪白等）
  PLAYER: 10, // 玩家本体
  ENTITY_STATUS: 10, // 敌人状态 emoji（冰冻 / 灼烧）
  SCROLL_CONTENT: 10, // 成就 / 角色列表滚动内容
  PLAYER_RING: 11, // 护盾 / 狂暴光环

  // —— 飘字 / 战斗特效 ——
  DAMAGE_TEXT: 20, // 伤害数字
  FX: 50, // 命中 / 爆炸 / 闪电链等
  HUD_BUFF: 50, // HUD buff 容器
  HUD_BUFF_ICON: 51, // HUD 单个 buff 图标
  HUD_BOSS: 60, // HUD Boss 血条
  FX_TELEGRAPH: 60, // 蓄力预警圈

  // —— HUD 主层 ——
  HUD: 100, // HUD 基础 / 暂停遮罩
  MINIMAP: 100, // 小地图
  INVENTORY: 150, // 物品栏
  JOYSTICK: 200, // 虚拟摇杆
  MENU_OVERLAY: 200, // 主菜单弹窗（选关 / 设置）
  TOOLTIP: 210, // buff 悬浮说明

  // —— 弹层 ——
  OVERLAY: 300, // 升级 / 商店 / 暂停面板
  BANNER: 300, // 波次 / Boss 来袭横幅

  // —— 调试 ——
  DEBUG: 1000, // 调试面板

  // —— 全局最高 ——
  GUIDE: 10000, // 成就 / 引导提示（必须浮于一切之上）
} as const;
