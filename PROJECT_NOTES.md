# Keep Living H5 - 项目笔记

> 开发备忘 / 待办记录。已完成的改动均有 git 检查点，可随时回滚。

## 📋 开发计划（待办，按优先级）

### 🔥 待修复问题（2026-09-09 用户在 Pages 构建版实测确认，代码已定位未改）

**1. 「再来一局」后整局停摆（无法移动/无法发射/无怪生成/波次不走）— 最高优先**
- 现象：正常局死亡 → 结算 → 点「再来一局」→ 新局玩家不能移动、武器不发射、无怪生成、波次不推进（HUD 正常但整局逻辑死）
- 根因：GameOverScene.restart()（src/scenes/GameOverScene.ts:186-189）只 scene.start("GameScene") + launch("UIScene")，**未调 GameManager.startNewRun()** → _runData.isGameOver 残留 true → GameScene.update 开头 if (gm.isPaused || gm.isGameOver) return;（GameScene.ts:712）整帧停摆。主菜单正常路径 startGame() 有 startNewRun（MainMenuScene.ts:214-227）
- 证据：preview 构建版实测 restart 后 waveTimer 恒 0、敌人数 0、2.5s 采样零推进；dev 上曾误判"能动"——物理 body 位移是 Phaser 核心在 scene.update 之后自动 step，与 update 逻辑停摆无关
- 修复方向：restart() 先 gm.startNewRun(上局 level) 再切场景（与主菜单一致）；_testMode 也需重置
- 连带：使「再来一局」的 _runData 残留旧局 score/kills/survivalTime → 结算显示旧数据（见问题 2）

**2. 清除全部后「最高分≠当前分」（结算数据错乱）**
- 现象：调试面板「清除全部」→ 游玩一局结束后，结算页历史最高分与本局得分不一致
- 根因：**与问题 1 同根**（restart 缺 startNewRun）——卡死局实际 0 分，但 _runData 残留旧局数据（实测：上局 135 分/13 杀/0:29 全量残留到新局结算），结算显示混乱；「清除全部」本身清 highScore 正确（GameManager.resetAllData:344-360，内存+localStorage 都清），非直接原因
- 证据：preview 实测第一局 135 分 → 再来一局（卡死）→ 第二局结算仍显示"本局 135/最高 135"+ 旧击杀/存活时间
- 修复方向：修问题 1 即修复；resetAllData 可考虑同时清 _runData（清除时若有进行中对局）
- 备注：用户那局 1000+ 分、环境复杂，或叠加其他因素（疑似某种"神秘延时伤害"），待用户截图补充复现
- **★真实机制（2026-09-09 追加确认）**：死亡后「延时击杀」导致结算分差——
  - 流程：玩家死亡 → GameManager.endRun() 立即把 highScore 定格（若 score>highScore 则写入）→ GameScene.update 因 isGameOver 停摆 → **但 Arcade 物理仍在 step，已发射的子弹/弹幕继续飞行命中敌人 → 死亡后延时击杀 → addKill() 让 _runData.score 继续增加** → 1.5s 后 GameOverScene 才创建
  - 取值：GameOverScene.create()（src/scenes/GameOverScene.ts:29-30,68-69）实时读 gm.runData.score（含延时击杀新增）与 stats.highScore（endRun 定格）→ 两者差 N×每杀分数（用户实测差 5 分）
  - 连带：「新纪录！」判定 runData.score >= stats.highScore（GameOverScene.ts:89）→ 延时击杀可造成假「新纪录」
  - 修复方向：① addKill 在 isGameOver 时直接 return（阻止死亡后计分）；② 结算页改用 run:end 事件载荷（endRun 定格值）而非实时读——双保险；顺带修假「新纪录」

### ① 神秘商店 + 金币经济（✅ 已完成 2026-08-29）

**3. 暴击伤害爆炸（20 级玩家 6 级暴伤 buff = 1709%）**
- 现象：属性面板暴伤 1709%（17.09 倍）；同局暴击率仅 15%（无溢出）——纯 stat 累积爆炸
- 根因：Player.modifyStat（src/entities/Player.ts:1079-1092）isPercent 分支**乘算** cur*(1+value)；breakthroughStat（Player.ts:1024-1035）突破走同一 modifyStat → 致命一击（crit_damage，maxLevel 3 + 突破上限 3）= 6 次 ×1.5 → 1.5^7 ≈ 17.09 与截图完全吻合。升级三选一/商店/突破共用此路径
- 注意：不是暴转爆伤公式问题（CollisionSystem.ts:61-64 公式正确），是 stat 成长乘算爆炸
- 修复方向：percent stat 改**基于基础值加算**（base*(1+value*n)），或突破改加算/固定收益；攻击力 ×1.2ⁿ 同理受影响；改后重跑数值审计

**4. 波次/Boss 来袭横幅位置漂移（玩家远离地图中部就看不到）**
- 现象：横幅固定在世界坐标，玩家离开地图中部区域（如去角落）后横幅不出现在屏幕内
- 根因：GameFeedback.showWaveBanner（src/systems/GameFeedback.ts:49-62）x=cam.width/2、y=132 为**世界坐标**；GameScene Boss 来袭横幅（GameScene.ts:1087）x=cam.width/2、y=cam.height*0.16 同理；相机跟随玩家 → 横幅固定在世界点、不随屏幕
- 证据：preview 实测玩家 teleport 到 (120,120) 触发「第3波」→ 横幅漂移到屏幕偏右而非居中
- 修复方向：横幅 setScrollFactor(0)（屏幕固定）+ 屏幕坐标

**5. 固定伤害不随波次成长（3 处，后期乏力/无压力）**
- 清单：
  - 炸弹道具 e.takeDamage(500)（src/data/items.ts:50）— 固定 500，后期敌人血量指数成长后几乎无用
  - 清屏冲击波 e.takeDamage(300)（src/data/upgrades.ts:358）— 固定 300，同上
  - 敌人接触碰撞 enemy.getConfig()?.attackPower（src/systems/CollisionSystem.ts:33）— **未乘 difficultyMultiplier/atkBoost**，后期怪碰人仍是基础伤害无压力（对比：弹幕 Enemy.ts:899/1073、冲锋 1059、自爆 554 均乘难度倍率）
- 修复方向：炸弹/清屏 × 波次难度系数（或按敌人 maxHp 百分比）；碰撞伤害补 difficultyMultiplier*atkBoost*affixAtkBoost 与弹幕对齐；自爆/灼烧/闪电链/弹射/荆棘已随玩家/波次成长，无需改

**6. 后期数值曲线失衡（小怪无威胁 vs Boss 上亿血）**
- 现象：无限波次小怪对玩家毫无威胁（生成即秒），Boss 血量上亿（用户实测 85/90 波附近），压力全集中在 Boss 战，小怪形同虚设
- 根因（已核对代码）：**成长曲线错配**——
  - 小怪：difficultyMultiplier = 1 + (wave-1)*0.1（src/systems/WaveManager.ts:189/308，**线性每波 +10%**），血量/攻击线性爬升
  - Boss：difficultyMultiplier = Math.pow(2.2, bossTier-1)（WaveManager.ts:231，**指数 2.2^tier**，每 5 波 tier+1）——85 波 tier17 ≈ 2.2^16 ≈ 4.2e7 倍基础血量，上亿由此而来
  - 玩家侧：buff 乘算成长（问题 3 同源）指数输出 → 小怪线性血量被碾压，Boss 指数血量又变成血牛
- 修复方向：小怪成长改为指数档位（如 1.15^(wave-1) 或按 bossTier 跳档）并补偿数量/攻速；Boss 曲线（2.2^tier 的 base 或 tier 步长）与玩家峰值输出对齐校准；修完问题 3（乘算爆炸）后用数值审计工具（scripts/balance-report）整体重校
- 备注：属整体数值平衡，与问题 3 联动，建议一起处理


**7. 摘除「后台游玩」，改为进后台自动暂停（2026-09-09 用户决定）**
- 背景：此前为实现后台挂机做了两个改动，但实测**切后台击杀数不涨**（浏览器对后台 tab 的 setTimeout 限流 + 低频主循环下碰撞/击杀结算不可靠），且易过度依赖自动游玩。用户拍板：拿掉后台游玩，回归浏览器默认——进后台自动暂停
- 现状代码（两处，均在 src/main.ts）：
  - main.ts:71-84：fps.forceSetTimeOut=true（setTimeout 驱动主循环）+ fps.smoothStep=false（不禁 delta 平滑）——让后台低频继续跑
  - main.ts:115-128：READY 后 game.events.off(HIDDEN/VISIBLE/BLUR/FOCUS)——移除 Phaser 的页面不可见/失焦自动暂停监听
- 修复方向：恢复 Phaser 默认——forceSetTimeOut 移除或 false、smoothStep 恢复 true（默认平滑）、删除 115-128 的 off 块 → 页面不可见/失焦自动暂停、切回恢复；游戏内暂停（esc / GameManager.setPaused）不受影响
- 备注：未来若真要后台挂机，应改用独立于浏览器 tab 主循环的方案（服务端模拟 / Web Worker 决策），不靠前台主循环

### ① 神秘商店 + 金币经济（✅ 已完成 2026-08-29）
**设计目标**：杜绝"货品没价值 + 不能刷新"的失落感（参考明日方舟集成战略的商店体验）

**A. 金币经济闭环（已实装，2026-08-29 经济调平）**
- 掉落来源：普通 30% 掉 2-5 金 / 快速 30% 掉 2-4 / 坦克 50% 掉 4-7 / 远程 35% 掉 3-5 / 精英必掉 15-25 / Boss 必掉 80-150（整数随机，受幸运加成：金币量 ×(1+luck/100)）
- 消费去向：商店（武器/被动/属性/消耗品）
- 「金币加成」被动已放回升级三选一池（+50% 金币，存 Player.addCoins）
- 玩家 `stats.coins` 字段；`addCoins/getCoins/spendCoins`；HUD 右上角金币显示

**B. 商品清单（src/data/shop.ts，SHOP_POOL 25 项）**
- 武器：霰弹枪60/机枪60/回旋镖70/无人机70/光剑70/火箭筒100/激光100
- 被动：金币加成40/经验加成50/生命恢复50/荆棘60
- 属性：生命35/疾风步35/力量45/急速45/暴击45/致命50/磁力30/护甲35/幸运45
- 消耗品：全屏炸弹60/能量护盾40/狂暴药水35/大血包30/复活币100

**C. 防"失落"体验（已实装）**
1. 4 格货架 = 3 常规 + 1 **高级位保底**（传说武器/复活币）
2. **可刷新**：每次 1 次免费刷新 + 金币付费刷新（首刷 20 递增）
3. **智能补货**：缺武器高权重补位、低血量加权大血包、已满级/无效项过滤
4. 明码标价 + 效果描述

**D. 出现时机**：**Boss 战前补给点**（2026-08-29 用户反馈调整）——每 5 波 Boss 波**开始前**弹出（不是 Boss 死后）。WaveManager.nextWave 检测下一波是 Boss 波 → `openShopBeforeBoss(wave)` → 弹商店 → 关闭后 `startWave(boss 波)`。传统 RPG"重大事件前有补给点"逻辑，玩家用前 4 波攒的金币强化后再打 Boss。Boss 死后不再弹商店。
- GameScene：`pendingShop` + `pendingBossWave` + `openShopBeforeBoss` + 监听 `shop:closed`（关闭后开始待开的 Boss 波）
- ShopScene.leave() → emit `shop:closed`
- 与升级三选一排队：升级选完再弹商店（复用 tryOpenShop guard）

**E. 消耗品效果（Player 新增）**
- 全屏炸弹：全场敌人 500 伤害
- 能量护盾：3s 无敌 + 圆环视觉（applyShield）
- 狂暴药水：8s 攻速/攻伤 +50%（applyRage，到期恢复）
- 大血包：回 50% 最大生命
- 复活币：死亡原地满血复活 + 2s 无敌 + 清屏（player:revive 事件）

**F. 商店场景 ShopScene（src/scenes/ShopScene.ts）**
- 布局用逻辑分辨率 960x640（相机已 setZoom(renderScale)，用 this.scale 会裁掉底部按钮——已修复）
- 整格点击购买 / 刷新按钮 / 离开按钮；`main.ts` 注册
- **布局居中修复（2026-08-29）**：Phaser 相机以画布中心为缩放中心，setZoom 后可视区域偏移 (画布宽-逻辑宽)/2，导致内容偏左上。修复：setZoom 后 `cam.setScroll(-(cam.width-cam.width/zoom)/2, -(cam.height-cam.height/zoom)/2)`，使 worldView 从 (0,0) 开始
- **经济调平（2026-08-29）**：用户反馈前 4 波只攒 32 金、RARE 商品 45 买不起。调整：
  - 金币掉落提升：普通 20%/1-3 → 30%/2-5；快速 20%/1-2 → 30%/2-4；坦克 40%/3-5 → 50%/4-7；远程 25%/2-3 → 35%/3-5；精英 10-20 → 15-25；Boss 50-100 → 80-150
  - 商品整体降价约 30%：武器 45/55/80（原 60/70/100）；被动 30-45（原 40-60）；属性 20-40（原 30-50）；消耗品 20-80（原 30-100）
  - 注意：HIGH_VALUE_ITEMS（高级位候选池）价格必须与 WEAPON_ITEMS 同步，否则高级位显示旧价

**G. UI 场景相机统一修复（2026-08-29）**
- 问题：Chrome 大窗口下主菜单/升级/结算等界面整体偏上、底部被裁；内置浏览器窗口小（renderScale≈1）时不明显
- 根因：Phaser 相机 setZoom 以画布中心为缩放中心，zoom>1 时可视区域偏移 (画布宽-逻辑宽)/2；这些场景只 setZoom 无补偿，且布局用 this.scale（渲染尺寸）
- 修复：新增 `src/utils/CameraHelper.ts` → `setupUICamera(scene)`，统一 setZoom + scroll 补偿，返回 960x640 逻辑分辨率
- 适用场景：MainMenuScene / UpgradeScene / GameOverScene / ShopScene / PreloadScene（全部改用 setupUICamera + 960x640 布局）
- UpgradePanel 也改用 GameConfig.GAME_WIDTH/HEIGHT（不再依赖 scene.scale）
- 例外：GameScene 相机跟随玩家（动态 scroll，不需补偿）；UIScene 采用反向缩放根容器方案（独立实现）

**H. Boss 强度指数增长（2026-08-29）**
- 问题：第10波 Boss 才 2350 血（线性增长 1+0.15/wave），玩家 build 乘法叠加后完全碾压，"Boss 不够打"
- 修复：Boss 按层级指数增长——`bossTier = floor(wave/5)`，`difficultyMultiplier = 2.2^(tier-1)`
- Boss 基础属性提升：血量 1000→2000，攻击 30→40
- 血量曲线：第5波 2000 / 第10波 4400 / 第15波 9680 / 第20波 21296（每5波×2.2）
- 修复 Boss 弹幕攻击未乘 difficultyMultiplier 的 bug
- 普通敌人仍用线性增长（1+0.1/wave）

### ② 敌人多样化（✅ 已完成 2026-09-01）
  - **新敌人已实装**（类型驱动：EnemyType 联合 + ENEMY_CONFIGS 配置 + Enemy.updateAI 分支 + WaveManager 波次权重）：
    - **自爆怪 suicider**（第5波解锁，橙红）：高速冲向玩家，进入爆炸半径 60px 即自爆——对玩家造成范围衰减伤害、对范围内敌人造成 50% 连锁伤害、爆圈视觉 + 屏幕震动，自身无掉落
    - **分裂怪 splitter**（第8波解锁，紫色）：死亡后原地分裂成 2 只 normal 小怪（difficultyMultiplier ×0.6）
    - **护盾怪 shielded**（第7波解锁，蓝灰）：正面减伤 75%（`shieldFrontReduction: 0.75`）——`takeDamage(amount, isCrit, fromX, fromY)` 新增来源坐标参数，CollisionSystem 传子弹位置，攻击方向与"敌人→玩家"夹角 <60° 判为正面减伤；护盾怪每帧 setRotation 朝向玩家，盾牌弧视觉与减伤逻辑一致
  - **纹理**：TextureGenerator 新增 3 个生成方法（generateEnemySuicider / Splitter / Shielded），按各自颜色生成
  - **波次解锁**：suicider 第5波 / shielded 第7波 / splitter 第8波（WaveManager.buildSpawnTable 权重随波次增长）
  - **平衡**：自爆 40血/攻25/速110 是脆皮威胁；分裂 60血/攻10 血量少但死后膨胀；护盾 90血/攻12 需绕后或范围武器处理
  - **验证**：三种敌人正常生成/纹理正确；击杀分裂怪分裂出 2 normal；自爆怪接近爆炸玩家掉血、自身消失；护盾怪朝向玩家旋转
  - 待办：精英词缀（狂暴/护盾/分裂）尚未做，列入后续

### ②+ 商店会话重置 + AI 自动购物/使用物品（✅ 已完成 2026-09-01）
- **商店每次遇到重置购买消耗**：ShopScene.create() 重置 `freeRefreshLeft=1; refreshCost=20`（原为字段初始值只在实例创建时生效，Phaser 场景实例复用导致跨会话累积涨价）
- **AI 自动购物**（ShopScene.runAIShopping）：
  - 进入商店 600ms 后启动，人类化节奏（每次购买间隔 250-600ms）
  - 策略：从货架挑"买得起 + 稀有度最高"商品购买（同稀有度优先便宜的）→ 买不起货架时刷新（免费优先再付费）→ 直到金币既买不起商品又付不起刷新费 → 离开
  - 需要 `cardRefs`（renderStock 重建时同步维护卡片引用）
- **AI 战斗自动使用消耗品**（GameScene.updateAIItems，每 0.8-1.2s 判断一次，单次只处理最高优先级）：
  - 血量 <40% 有血包 → 用 heal
  - 敌人贴脸(<110px) 有护盾未开盾 → 用 shield
  - 200px 内 ≥6 敌 有炸弹 → 用 bomb 清屏
  - 战斗(400px 内有敌) 有狂暴未激活 → 用 rage
  - Player 新增 `isShieldActive()` / `isRageActive()` 访问器
- **验证**：第二次进店显示"免费刷新"（重置生效）；AI 500金→9金购买武器/消耗品+自动刷新+正确离开；低血量自动回血(39→104)；贴脸 Boss 自动开盾/开狂暴
- [ ] **③ 宝箱 + 一次性道具**（爽点）
  - 宝箱：杀怪/精英掉落，开出金币、随机升级、全屏炸弹
  - 消耗品：炸弹清屏、护盾、时间减速、狂暴药水、大磁铁
- [x] **④ 更多被动 & 状态效果**（✅ 已实装 2026-09-07）
  - 吸血 / 弹射 / 冰冻 / 灼烧 / 闪电链 数据与效果已全部接入：`Enemy.applyPlayerEffects`（CollisionSystem 命中后调用）统一消费，FXManager 特效（frost/bounce/chainLightning）
  - 效果：吸血 3%/级；冰冻 8%/级概率减速 2s；灼烧 10%/级概率 DOT；闪电链 10%/级概率 60% 连锁；弹射 50% 伤害逐跳（maxLevel 3）
  - 元素状态系统（冰/火/电复合）未做，列入后续
- [ ] **⑤ 多角色系统**（想法备忘 2026-09-03，时机未到暂缓）
  - 灵感：街机《吞食天地》每角色独特技能；多角色自由选择，搭配不同风格/地形
  - **差异化光谱（2026-09-03 补充）**：参考《合金弹头》——玩家只是动作/外观不同、功能一致，说明差异化不是二选一而是可调档位：
    - 纯外观（换形象/动作）→ 成本极低、无平衡风险
    - 初始差异（开局武器/属性不同）→ 成本低、风险低
    - 独特被动（每角色 1 个专属被动）→ 成本中、风险中
    - 独特技能（完全不同的主动机制）→ 成本高、风险高
    - **具体选哪档，取决于项目定位**（作品展示/玩法深度/平衡成本）再定
  - 可行性：项目已有 Player 属性/武器/buff/主题皮肤模块化基础 → 角色本质是**配置层**（初始属性乘区 + 专属被动 + 初始武器），主菜单加选择界面即可
  - 分期建议：
    - 一期：3~4 角色，差异化 = 初始属性乘区 + 1 个专属被动（复用现有 buff/被动系统），**不碰武器数值**，避免刚稳住的平衡再次震荡
    - 二期：角色主动技能（大招条 + 冷却 + 释放键），需新增技能条 UI
    - 三期：不同地形风格与角色搭配（地形系统已数据驱动，扩展 TerrainConfig 即可）
  - 权衡：平衡成本随角色数线性上升；专属被动可与"突破上限靠任务/boss 奖励"联动，形成角色成长线
- [ ] **⑥ 技能自由组合（DOTA 4+2 式）**（想法备忘 2026-09-03，暂缓）
  - 方向：技能随意组合、单一技能本身复杂、组合出神奇效果（与 ⑤ 正交，可叠加：⑤ 管"选谁"、⑥ 管"局内怎么构建"）
  - 与现状契合：升级三选一已是"从武器/被动池组合"的雏形，⑥ 是把技能模块化更细 + 允许跨池组合 + 单一技能多段效果/条件触发
  - 优先级：**排在 ⑤ 之后**。若上，先小步验证：给现有被动池加几个"多段效果复合被动"（如 弹射次数+传导距离+伤害 叠加），验证组合趣味，不做完整技能编辑器
  - 权衡：组合指数级 → 平衡/测试成本所有方向中最高，超模/废技难靠人力覆盖

- [ ] **⑦ 关卡化结构（拉长流程方向，2026-09-03 讨论，待拍板）**
  - 背景：A 方向（作品展示/可完整通关）需要拉长流程，决定做关卡型而非单关无限生存
  - **循环结构**：每关 15 波 → 波次 15 关底 Boss → Boss 后二选一：
    - 进下一关：解锁新机制/新敌人/更好掉落，拿过关奖励，波次重置 1，build 完全继承
    - 继续运营：留在本关波次 16+，敌人更强但掉落/经验更高，运营到满意再进下一关（或打不动）
  - **每关「多一些东西」**（第一版机制池，数据配置化，新关=新配置组合）：
    - 地形差异：平原 / 陨石障碍多 / 冰原减速区
    - 敌人偏移：某关远程多 / 自爆多 / 更肉
    - 特殊规则：金币双倍但受伤增 / 击杀回血 / 持续毒雾
  - **通关**：打完最后一关的 15 波 = 通关 → 胜利结算（当前游戏无通关/胜利概念，是 A 方向最大缺口）
  - **待拍板**：① 跨关继承边界（建议 build 完全继承+回满血）② 继续运营的边界（建议软上限 30 波、随时可主动进下一关，运营自愿不锁死）③ 关卡数量（建议首版 3 关）与每关机制粒度（地形+敌人偏移+1 条规则）④ 落地顺序（建议先做单关可通关闭环【15波+胜利结算+AI验证数值】，再加关卡化，避免多关卡一起动难定位）
  - 关联：地形系统已数据驱动（TerrainConfig），关卡=配置组合即可；WaveManager 需支持关卡配置与切换
## 🎬 Boss 入场演出（2026-09-07，已提交 3916471）

- Boss 生成时：屏幕震动（300ms）+ 顶部横幅 `⚠ {Boss名} 来袭`（深红底、淡入→停留 1.5s→淡出），scrollFactor 0 固定屏幕，depth 300
- 三种 Boss 各显示自己的名字（BOSS / 召唤魔像 / 弹幕机械），纯表现不打断战斗；多 Boss 同帧只保留最新横幅

## ✅ 已修复（2026-08-29，已提交）

### 1. 汉字显示不完整（上方切割像素）→ 已修复
- **根因**：所有 UI 文本 `scene.add.text(...)` 无 padding，Phaser 对中文字体度量不准，字形顶部出界被裁
- **修复**：新增统一工厂 `src/utils/UIText.ts`（`createUIText`，自动 `setPadding({top:3,bottom:3})`），全项目 10 个 UI 文件共 52 处 `add.text` 调用替换为工厂
- **验证**：主菜单中文完整无切割

### 2. 火箭筒不遇敌直接消失 → 已修复
- **修复**：`Bullet.update` 超射程分支中，`explosive` 子弹到达射程尽头时先 `emit('bullet:explode')` 再 `despawn()`，不再静默消失
- **验证**：玩家空旷处自动发射，爆炸点距玩家 ≈500px（射程尽头），boom 计数正常

### 3. 暴击爆伤无直观体现 + 属性未接入 → 已修复
- **修复A（bug）**：`CollisionSystem.bulletEnemyCollision` 暴击判定从硬编码 `5%/×1.5` 改为读取玩家 `stats.critRate` / `stats.critDamage`——「暴击精通」「致命一击」升级现在真实生效
- **修复B（展示）**：新增 `src/ui/DamageTextManager.ts`（池化浮动伤害数字）：普通伤害白色上飘、暴击大号金字带 "!"
- **集成**：`GameScene` 注入 `damageTextManager` + 公开 `spawnDamageText`，碰撞系统命中时调用
- **验证**：基础射击弹出白色 12；强制 critRate=1.0/critDamage=3.0 后弹出金色 36!

## ✨ Boss 顶部大血条（2026-08-29，已提交）

- **需求**：小怪不要血条；唯一的地图级 Boss 显示屏幕上方的独立大血条
- **实现**：
  - `GameScene` 维护 `activeBoss` 引用：监听 `enemy:spawn`（`isBoss()` 时记录）/ `enemy:death`（`type==='boss'` 时清空），公开 `getActiveBoss()`
  - `HUD` 新增顶部居中 Boss 血条（容器 depth 60）：BOSS 名称 + 420px 大血条（高血量橙红 → 低血量暗红渐变）+ 实时数值 `当前/最大`；无 Boss 时隐藏
- **验证**：跳 5 波 spawnBoss → 血条 1600/1600 出现；扣 800 → 800/1600 实时下降；击杀 → 血条消失、升级正常弹出

## 🐛 顺带修复：Enemy.despawn body 崩溃（Boss 死亡路径）

- **现象**：手动/触发 Boss 死亡时 `despawn()` 内 `setVelocity(0,0)` 因 `body` 为 null 抛 TypeError（`Cannot read properties of undefined`）
- **修复**：`Enemy.despawn()` 将 `setVelocity` 移入 `if (this.body)` 保护内
- **验证**：Boss 击杀后正常 despawn，无报错

## 🎨 暂停按钮优化（2026-08-29，已提交）

- **问题**：右上角暂停按钮（文字 "II"）与 HUD 波次/击杀/分数信息重叠
- **修复**：
  - 按钮文字改为 `⏸️` emoji（实测渲染为蓝色暂停图标，比文字好看）
  - 按钮固定在右上角 (width-16, 16)；HUD 右上三行下移（`infoTop = topY + 44`）让位，不再重叠

## 🔧 升级三选一排队逐个弹出（2026-08-29，已提交）

- **问题**：一次跨多级（如调试面板 +5 级、真实玩法经验溢出）只弹一次三选一，丢失中间等级的选择奖励
- **修复**：
  - `GameScene` 维护 `pendingLevelUps`（待选升级数）+ `upgradeQueued`（防同帧重复弹出）
  - `player:levelup` → 计数 +1 并 `showNextUpgrade()`；`UpgradeScene.onSelect` 完成后 emit `upgrade:chosen` → 计数 -1，剩余>0 时 250ms 后继续弹下一个
- **验证**：+5 级后连续弹出 5 次三选一（每次选项随机），全部选完后队列清空、游戏正常恢复





## 地形系统 + 小地图（2026-08-29，已提交）
- **地形系统**：数据驱动，`src/data/terrain.ts` 定义 `ObstacleConfig`/`TerrainConfig`，`DEFAULT_TERRAIN` 含 16 个障碍物（岩石/墙体/水晶，避开中心出生点 1500,1500）
- **TerrainManager**：`src/systems/TerrainManager.ts`，消费配置创建静态物理物体组，提供 `getObstacleGroup()`/`getObstacles()`/`setTerrain()`（以后切换区域/新地图只需传新配置）
- **碰撞**：玩家 collider 障碍物、敌人 collider 障碍物、子弹 overlap 障碍物（爆炸子弹先触发爆炸再销毁）
- **小地图**：`src/ui/Minimap.ts` 纯渲染组件，每帧 Graphics 重绘（背景框/障碍物灰块/敌人红点/Boss 大红点/玩家青色三角），集成到 UIScene 右下角
- **可扩展性**：以后新增区域只需新建 `TerrainConfig` 并调用 `terrainManager.setTerrain(newConfig)`，小地图自动消费新地图尺寸和障碍物数据，无需改组件
- **验证**：障碍物渲染正常、敌人被障碍物阻挡（不穿过）、小地图实时显示玩家/敌人/障碍物分布
