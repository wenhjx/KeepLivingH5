# Keep Living H5 — 技术架构设计文档

> 面向协作者 / 面试深挖的技术文档。代码即事实；本文描述当前 `main` 分支的实际实现（2026-09-13）。
> 在线试玩：https://wenhjx.github.io/KeepLivingH5/

## 1. 项目概述

一款 **Phaser 3 + TypeScript + Vite** 构建的 2D 割草生存 H5 游戏：大量敌人同屏 + 自动攻击 + Roguelike 三选一成长，包含多地图关卡、词缀系统、成就、神秘商店、无尽模式与独立试玩场地。**全部游戏纹理由代码程序化生成**，无任何外部图片素材。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 引擎 | Phaser 3.80+（Arcade Physics） |
| 语言 | TypeScript 5.4+（strict，`tsc --noEmit` 门禁） |
| 构建 | Vite 5.2+ |
| 格式化 | Prettier（`npm run format`，singleQuote / printWidth 120） |
| 渲染 | Phaser Canvas/WebGL + 程序化纹理 |

## 3. 架构分层

```
src/
├── game/       GameConfig（全局数值/画质分级） + GameManager（单例：对局生命周期/存档/成就）
├── scenes/     15 个场景：Boot/Preload → MainMenu → GameScene(主玩法)+UIScene(叠加UI)
│               → 商店/升级/突破/结算/属性面板/成就/图鉴/试玩/无尽选择/调试
├── entities/   Player / Enemy / Bullet / Drone / Pickup
├── systems/    波次/成就/地形/词缀/特效/输入/对象池/碰撞/存档/音频/引导
├── ui/         HUD / 摇杆 / 血条 / 小地图 / 升级面板 / 调试面板 / 滚动条
├── data/       13 张纯数据表（武器/敌人/波次/升级/关卡/词缀/成就/商店/物品/地形…）
├── constants/  Layers.ts（显示层级常量表，杜绝魔法数字）
└── utils/      UIText / UILayout / CameraHelper / DebugAPI / TextureGenerator…
```

**核心原则：数据驱动。** 玩法内容（敌人属性、词缀、升级项、关卡、成就、商店商品）全部声明在 `src/data/*.ts` 纯数据表中，代码只负责"读表 + 执行"。新增一种词缀/武器/关卡 = 加一行表 + 必要时挂一个行为分支，扩展成本被压到最低。

## 4. 核心系统设计

### 4.1 GameManager 单例（对局状态权威源）

- `startNewRun(level, testMode)` 重置 `_runData`（score/kills/survivalTime/isGameOver）→ 一切对局状态以此为准
- `endRun()` / `completeRun()`：定格最高分、写统计（`mutateStats` 在 testMode 下静默，试玩不污染正式数据）
- `addKill()` / `addSurvivalTime()` / `setWave()`：单一入口累计局内数据
- 存档：`saveRun(player)` / `restoreRun()`（完整恢复玩家状态）/ `clearSavedRun()`；进度/设置/成就经 `SaveSystem` 持久化 localStorage
- **教训沉淀**：所有"进入对局"的路径必须走 `startNewRun`——`GameOverScene.restart()` 曾漏调它，导致 `isGameOver` 残留 true、整局 update 停摆（见 §6）

### 4.2 数据驱动表（`src/data/`）

| 表 | 关键结构 | 消费方 |
|---|---|---|
| `enemies.ts` | 基础属性/体型/AI 类型 | Enemy 实体 |
| `affixes.ts` | `AffixDef`（稀有度/数值乘区/效果/图标/应对文案），`COMMON_AFFIX_POOL`/`ELITE_AFFIX_POOL` | Enemy 挂载 |
| `levels.ts` | `LevelConfig`（地形/敌人池/波次/Boss 配置），`MODIFIER_CONFIGS`（关卡词条） | MainMenu/GameScene |
| `upgrades.ts` | 升级项 + `passiveDescForLevel`/`passiveLevelTexts`（按等级实时生成文案，与代码公式同源） | HUD/三选一/商店 |
| `achievements.ts` | `AchievementDef`（6 系列，含隐藏成就） | AchievementManager |
| `shop.ts` / `items.ts` | 商品池 / 道具定义 | ShopScene/InventoryUI |

**文案与公式同源**：被动描述不再硬编码，而是调用 `passiveLevelTexts(level)` 从真实公式生成"当前级 + 下一级"文案，杜绝"描述与代码不符"类 bug（历史教训：弹射描述写 50% 实际 70%、灼烧写 +10% 实际 15%×级）。

### 4.3 词缀系统（Enemy 挂载）

- 挂载规则（`Enemy.ts`）：Boss 不挂（防不可控）· 精英必挂 1 个 `ELITE_AFFIX_POOL` · 普通怪 6% 概率挂 `COMMON_AFFIX_POOL`
- 稀有度：common（灰）/ rare（蓝）/ epic（紫），视觉用 tint 区分
- 效果实现 = 数值乘区（如厚皮 +hp、迅捷 +移速）+ 机制标记（如爆炸死亡 AOE、增援死亡召唤、剧毒命中挂 debuff）
- 图鉴（`EnemyCodexScene`）：明日方舟式左列表右详情，emoji 图标用 **Canvas 离屏纹理**（`ensureEmojiTexture` 128px 注册为 Phaser 纹理）解决裁剪与锯齿

### 4.4 程序化纹理（`utils/TextureGenerator.ts`）

所有敌人/子弹/地形/UI 底图在 PreloadScene 用 Canvas 逐像素生成（霓虹风格）。收益：零素材版权风险、仓库体积小、移动端加载快；代价：美术风格受代码能力约束——这是"作品演示规格"下的刻意取舍。

### 4.5 波次与难度曲线（`systems/WaveManager.ts`）

- 难度乘区 `difficultyMultiplier = 1 + (wave - 1) * 0.1`，波次 20 约 ×2.9
- 每 5 波 Boss，Boss 血量/攻击随波次成长；三地图 Boss 差异化（召唤魔像 / 弹幕机械）
- 无尽模式：通关三关后无限波次 + 持续成长

### 4.6 双端输入与 UI 自适应

- `InputManager` 统一 PC（WASD+鼠标）与触屏（虚拟摇杆）输入
- **uiRoot 反缩放容器**：UIScene 把 UI children 移入 uiRoot，用 `pos/scale` 反向补偿相机 zoom，使 UI 在超宽屏/缩放下保持物理像素清晰（见 §6 摇杆坑）
- 移动端适配参数：`?mobile=1` 模拟、`uiscale` 缩放、触控目标 ≥44px

### 4.7 HUD buff 栏（`ui/HUD.ts`）

- 持久条目（被动/武器）与限时状态（剧毒/护盾/狂暴/减速）统一卡片式渲染
- **双键重建**：`persistKey`（被动/武器 id:level，等级变化重建）+ `timedKey`（限时状态存在性，出现/消失重建；秒数变化不重建，角标每帧更新）——避免漏刷新（图标不出现/到期残留）与过度重建（性能）
- 限时状态到期前 3s 闪烁（`statusFlashBefore=3000`）；点击弹 tooltip（当前级 + 金色下一级预览，锚定图标中心而非手指，移动端不遮挡）

## 5. 质量门禁与工具链

- `tsc --noEmit` 全量类型检查（严格模式）——每次改动后必跑
- Prettier 统一格式（`npm run format`）
- **自建调试工具链**（作品级开发的自我增强）：
  - 调试面板（暂停菜单 `` ` `` 键）：刷怪 / 召唤 Boss / 调等级数值 / 测试道具 / 解锁全地图，召唤怪随波次成长
  - 独立试玩场地（主菜单入口）：正常数值（无无敌）、死亡原地刷新、不触发成就/存档，可自由测试词缀与技能
- 双远端：gitee（日常）/ github Pages（对外演示，推送时机由用户控制）

## 6. 关键设计决策与踩坑记录（面试素材）

1. **「再来一局」整局停摆**：restart 未走 `startNewRun` → `isGameOver` 残留 → update 开头早退。修复：所有进局路径统一走 `startNewRun`。
2. **结算分差**：玩家死亡后 Arcade 物理仍在 step，飞行子弹继续击杀 → 死亡后延时计分。修复：`addKill` 在 `isGameOver` 时早退 + 结算页读定格值。
3. **移动端摇杆偏移根因**：joystick.container 被误移入 uiRoot 二次变换（+120,+80 / ×0.8）导致渲染位置永远偏离手指。修复：摇杆独立挂场景根，移入时排除。
4. **波次横幅被超宽屏裁出**：逻辑坐标 vs 物理像素混用。修复：uiRoot 反向缩放 + 物理像素坐标。
5. **buff 图标时有时无/到期残留**：限时状态排除在重建键外导致出现/消失不触发重建。修复：拆 persistKey + timedKey 双键。
6. **暴击溢出转暴伤**：暴击率 >100% 时溢出部分转暴击伤害（暗金色标注），且可逆（减暴击光环时从暴伤退回）——状态可双向换算。

## 7. 开发规范速记

- 加武器/敌人/词缀/关卡/成就：先加 `src/data/` 表，再挂行为分支，最后在对应场景接入
- 显示层级用 `constants/Layers.ts` 常量，禁止魔法数字
- 新场景：`src/scenes/` 建类 → `main.ts` 注册
- 改动后：`tsc --noEmit` + 双端（`?mobile=1` 与桌面）手测；激进改动先备份分支

## 8. 已知短板与后续方向

- 纯前端单机，无后端/账号（远期：WebSocket 多人共斗 + 后台管理页 + 随机地图，见 PROJECT_NOTES「远期方向 / 点子库」）
- 数值成长后期爆炸，需收敛（平衡专项）
- 无自动化测试（计划引入 vitest 覆盖纯逻辑：词缀数值公式 / 存档恢复 / 描述生成）
