# Keep Living - 2D 割草生存游戏 (H5)

一款基于 Phaser 3 + TypeScript + Vite 构建的 2D 割草类生存游戏，支持 PC 和移动端多端游玩。包含多关卡、词缀系统、成就、神秘商店、试玩场地等完整玩法闭环。

## 技术栈

- **游戏引擎**: Phaser 3.80+
- **语言**: TypeScript 5.4+
- **构建工具**: Vite 5.2+
- **物理引擎**: Arcade Physics (Phaser 内置)
- **渲染**: 全部纹理程序化生成（无外部图片素材）

## 项目结构

```
Keep Living H5/
├── public/                        # 静态资源（可选音频）
├── src/
│   ├── main.ts                    # 游戏入口（场景注册 / renderScale 计算）
│   ├── game/                      # 游戏核心
│   │   ├── GameConfig.ts          # 全局配置（画质分级/对象池/波次/玩家数值）
│   │   └── GameManager.ts         # 全局管理器（单例，对局存档/成就进度/存档）
│   ├── logic/                     # 纯逻辑层（无 Phaser 依赖，可单元测试）
│   │   ├── affix.ts               # 词缀逻辑（伤害/状态结算）
│   │   ├── player.ts              # 玩家数值逻辑
│   │   └── wave.ts                # 波次生成/成长曲线
│   ├── scenes/                    # 场景
│   │   ├── BootScene.ts / PreloadScene.ts    # 启动与预加载（程序化纹理）
│   │   ├── MainMenuScene.ts       # 主菜单（开始/继续/成就/试玩/设置 + 选关面板）
│   │   ├── CharacterSelectScene.ts # 角色选择（多角色差异化）
│   │   ├── WeaponSelectScene.ts   # 开局武器选择
│   │   ├── GameScene.ts           # 游戏主场景（三地图 + 无尽模式）
│   │   ├── UIScene.ts             # UI 叠加场景（HUD/暂停/调试入口）
│   │   ├── GameOverScene.ts / UpgradeScene.ts / ShopScene.ts
│   │   ├── EndlessChoiceScene.ts / BreakthroughScene.ts
│   │   ├── PlayerInfoScene.ts     # 玩家属性面板（C 键）
│   │   ├── AchievementScene.ts    # 成就页
│   │   ├── EnemyCodexScene.ts     # 敌方情报图鉴（敌人/词缀双标签）
│   │   └── DebugScene.ts          # 调试菜单（暂停时 ` 键）
│   ├── entities/                  # 实体
│   │   ├── Player.ts              # 玩家（被动/升级/存档恢复）
│   │   ├── Enemy.ts               # 敌人（13 种 AI + 词缀系统）
│   │   ├── Bullet.ts / Drone.ts / Pickup.ts
│   ├── systems/                   # 系统
│   │   ├── WaveManager.ts         # 波次管理（难度成长/Boss 波）
│   │   ├── AchievementManager.ts  # 成就系统（含隐藏成就）
│   │   ├── TerrainManager.ts      # 地形系统（冰面/加速带等）
│   │   ├── ModifierSystem.ts      # 词缀/修改器系统
│   │   ├── FXManager.ts / GameFeedback.ts  # 特效与反馈
│   │   ├── InputManager.ts / ObjectPool.ts / CollisionSystem.ts
│   │   ├── SaveSystem.ts / AudioManager.ts / GuideManager.ts
│   ├── ui/                        # UI 组件
│   │   ├── HUD.ts                 # 抬头显示（buff 栏：等级化提示 + 下一级预览）
│   │   ├── VirtualJoystick.ts / Minimap.ts
│   │   ├── UpgradePanel.ts / OptionCard.ts / InventoryUI.ts
│   │   ├── DebugPanel.ts          # 调试面板（刷怪/召唤Boss/调数值）
│   │   ├── UIStyle.ts             # UI 统一风格令牌
│   │   └── GuideCard.ts / DamageTextManager.ts / UIScrollBar.ts
│   ├── data/                      # 数据配置（实际数据源）
│   │   ├── weapons.ts / enemies.ts / upgrades.ts
│   │   ├── levels.ts              # 三地图关卡配置（草原/废墟/冰原）
│   │   ├── affixes.ts             # 词缀表（10 词缀，稀有度分层）
│   │   ├── achievements.ts / shop.ts
│   │   ├── items.ts / terrain.ts / characters.ts / backgrounds.ts / sounds.ts
│   ├── constants/Layers.ts        # 显示层级常量表
│   ├── utils/                     # 工具类（UIText/CameraHelper/UILayout/TextureGenerator 等）
│   └── types/index.ts
├── tests/                         # Vitest 单元测试（逻辑层覆盖）
├── scripts/                       # 开发脚本（balance-audit 平衡审计）
├── index.html
├── package.json / tsconfig.json / vite.config.ts
├── .eslintrc.cjs / .prettierrc.json / .gitattributes
├── PROJECT_NOTES.md               # 项目开发笔记/待办
└── README.md
```

## 在线试玩

👉 [点开即玩（GitHub Pages）](https://wenhjx.github.io/KeepLivingH5/) —— PC / 移动端均可

## 快速开始

```
npm install     # 安装依赖
npm run dev     # 开发模式 → http://localhost:5173
npm run build   # 构建生产版本 → dist/
npm run preview # 预览生产版本
```

## 核心特性

### 多端适配

- **PC 端**: WASD / 方向键移动，鼠标瞄准
- **移动端**: 虚拟摇杆 + 自适应 UI（`?mobile=1` 模拟，支持 `uiscale` 参数），触控目标 ≥44px
- **画质分级**: 自动检测设备性能，低 / 中 / 高三档，可在设置面板手动调整

### 玩法系统

- **多地图关卡**: 草原 / 废墟 / 冰原 三关，通关解锁，每关有专属敌人变体（腐化僵尸 / 霜冻僵尸）与差异化 Boss（召唤魔像 / 弹幕机械）
- **割草核心**: 大量同屏怪物 + 对象池优化
- **武器系统**: 9 种武器（远程 / 近战 / AOE / 召唤），开局选择 + 商店补充
- **升级系统**: Roguelike 三选一（含跳过拿金币），满级突破奖励，被动可多级成长
- **词缀系统**: 敌人随机携带 10 种词缀（迅捷 / 厚皮 / 吸血 / 剧毒 / 爆炸 / 冰冻 / 增援…），普通 / 稀有 / 史诗稀有度分层，精英必挂
- **敌方图鉴**: 选关面板「📖 敌方情报」—— 明日方舟式左列表右详情，敌人 / 词缀双标签页，含出没范围与应对提示
- **成就系统**: 多条件成就 + 隐藏成就（含提示），永久加成随浏览器存档
- **神秘商店**: 局内金币购买武器 / 被动 / 属性 / 消耗品（复活币 / 狂暴药水等）
- **无尽模式**: 通关三关后解锁，无限波次 + 成长曲线
- **试玩场地**: 主菜单独立入口，自由刷怪测试技能与词缀，死亡原地刷新，不触发成就
- **存档系统**: 本地存档 + 设置持久化 + 对局中途继续（完整恢复玩家状态）

### 战斗细节

- **Buff 栏**: 被动 / 武器 / 限时增益统一卡片式展示，点击弹出详情 —— 当前级效果 + 金色下一级预览，到期前闪烁
- **玩家状态**: 剧毒 / 减速等减益并入 buff 栏统一渲染，减少学习成本
- **Boss 战**: 顶部大血条 + 入场演出 + 差异化阶段机制

## 操作说明

### PC 端

- `W/A/S/D` 或 `方向键`: 移动　`鼠标`: 瞄准（自动攻击）
- `ESC`: 暂停　`空格`: 攻击（备用）　`C`: 玩家属性面板
- `` ` ``: 调试菜单　`= / -`: 加速 / 减速

### 移动端

- 左侧虚拟摇杆：移动　自动攻击最近敌人
- 点击 buff 图标查看详情（按下显示，松开延迟消失）

## 开发指南

- **加武器**: `src/data/weapons.ts` 配置 → `upgrades.ts` 加升级项 → 需要时 Player 配子弹视觉
- **加敌人**: `src/data/enemies.ts` 配置 → `Enemy.ts` 加 AI（如需）→ `waves.ts`/`levels.ts` 配置出现波次
- **加词缀**: `src/data/affixes.ts` 定义（稀有度 / 图标 / 效果 / 应对）→ `Enemy` 词缀分支接入
- **加场景**: `src/scenes/` 建类 → `main.ts` 注册
- **调试**: 暂停菜单 → 调试面板（刷怪 / 召唤 Boss / 调整等级数值 / 测试道具），或主菜单 → 试玩场地

## 素材说明

全部游戏纹理由代码程序化生成（`src/utils/TextureGenerator.ts`），无需外部图片素材。音频素材可放入 `public/assets/audio/`（可选）。

## 后续扩展方向

- [x] 成就系统
- [x] 词缀系统（第 1 层已上线：10 种词缀，稀有度分层）
- [ ] 多人同步对战（WebSocket + 账号系统 + 世界级 Boss）
- [ ] 后台管理页（数据统计 / 参数热更）
- [ ] 随机地图 / 更复杂关卡结构
- [ ] 主动技能（闪避等）
- [ ] 账号登录与云端存档

## License

MIT
