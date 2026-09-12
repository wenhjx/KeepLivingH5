# Keep Living H5 - 项目笔记

> **协作约定（2026-09-11）**：GitHub Pages 推送时机由用户决定（担心 github 打包次数过多产生奇怪影响）。日常改动只推 gitee（`git push origin main`）；用户明确说"同步/推送 Pages"时，才执行 `git push github main:main`。

> **UI 设计约定（2026-09-12）**：玩家状态图标（减益/限时增益）统一归纳进 HUD buff 栏渲染——同款卡片视觉 + 剩余时间角标 + 到期闪烁 + 点击出说明，不再做独立于 buff 栏的旁挂图标，减少玩家学习成本。当前剧毒已按此并入（HUD.updateBuffs 伪条目 + 到期闪烁），未来新状态沿用同方案。



> 开发备忘 / 待办记录。已完成的改动均有 git 检查点，可随时回滚。



## 📋 开发计划（待办，按优先级）



### 🔥 待修复问题（✅ 8 条已全部修复并推送，2026-09-10；历史定位记录保留）



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



## 📌 近期改动速览（2026-09-11 ~ 09-12，玩家状态可见性 + 标准化 + 死代码清理，已推 Gitee）



### 玩家状态可见性（c253273）

- 时间类状态统一进 HUD buff 栏：护盾（🛡 免疫伤害）/狂暴（⚡ 攻速攻伤 +50%）与剧毒同款卡片 + 剩余秒数角标 + 到期前 3s 闪烁（statusFlashBefore=3000），点击出说明

- 位置类状态用环境提示、不进 buff 栏（无剩余时间语义，避免列表抖动）：冰面减速 ❄ / 风道加速 💨 显示在 buff 栏上方（GameScene.getSpeedFactorAt → TerrainManager，slowZone 优先于 boostZone）

- 调试面板新增「🗺 解锁全地图」（GameManager.unlockAllLevels + DebugAPI 注册），便于未解锁关卡实测

- 波次/Boss 横幅可见性根治：UIScene uiRoot 反向缩放容器 + 物理像素坐标，超宽屏比例不再裁出屏幕

- 成就提示层级提升（Layers.GUIDE=10000 常量表）；词缀系统第一层（affixes.ts）落地：词缀怪有数值乘区 + 机制标记 + 视觉 tint

- 调试面板实测细节：召唤 Boss 掉落后按钮恢复正常；召唤怪随波次成长（调试功能不养闲怪）



### 标准格式化（3efb7dd）

- 项目原本无 formatter；引入 prettier（.prettierrc.json：singleQuote / printWidth 120 / tabWidth 2 / trailingComma es5），`npm run format` 全项目 46 文件

- prettier 故意保留 import 间空行（视为作者分组意图、无配置可关）；脚本压缩 5 文件 import 空行（GameScene / Enemy / levels / GuideCard / ModifierSystem）



### 死代码清理（a837f5e）

- 用 `tsc --noUnusedLocals --noUnusedParameters` 扫描，删除：

  - 文件：`PlayerStatusIcons.ts`（已被 buff 栏方案取代）

  - 死方法：`TerrainManager.getSlowFactorAt`（getSpeedFactorAt 已替代）

  - 未用导入 8 处：AchievementScene(GameManager / ACHIEVEMENT_SERIES)、BootScene / PreloadScene(GameManager)、GameScene(createUIText / Layers)、AchievementManager(getAchievementById)、InputManager(GameConfig)、WaveManager(WaveConfig)

  - 未用字段：GameScene(lastWaveBanner / aiCurrentDir)、DebugPanel(autoPlayBg / themeBg)、HUD(barCenterY / statVisuals)、InventoryUI(reviveIcon)、ObjectPool(particleGroup)、Minimap(scene)、UIScrollBar(viewH)、Enemy(affixHpMult)、MainMenuScene(levelPreviewTitle)、PlayerInfoScene(player)

  - 未用局部：AchievementScene(rowH)、BootScene(gm)、TextureGenerator(cx×2)、HUD(viewH)

  - 保留：Phaser 回调 / 接口签名参数（time / delta / player / sourceX 等，删了无收益）

- 教训：启发式"删行脚本"对对象字面量不安全（statVisuals 声明行被误删导致语法崩），且其内部 tsc 快照只过滤 TS6133/6196、吞掉语法错误造成误报 clean；改用精确锚点 / 行号删除，并始终跑全量 `tsc --noEmit` 验证



## 📌 近期改动速览（2026-09-10，摇杆根因修复 + 8 条数值/逻辑修复，已推 Gitee/GitHub Pages）



### 2026-09-10

- 移动端虚拟摇杆位置偏移【根因修复】（d8d138c）：UIScene.create 末尾把全部 children 移入 uiRoot（反向缩放容器，pos+scale 补偿 zoom）时，**摇杆 container 也被移入**，被 uiRoot 二次变换（+120,+80 偏移、×0.8 缩放）导致渲染位置永远偏离手指（此前误判为 toScreen×zoom 换算，9725b85 未解决）。修复：移入时排除 joystick.container，其独立挂场景根。验证：zoom=1.25 下 finger(150,650)→setPosition→getWorldPoint 互逆→renderedScreen(150,650) 精确闭环。

- 8 条待修复落地（4c02fea/a3b2401/cc9f512，详见顶部清单）：再来一局停摆、结算分差、拾取物磁吸失控、横幅漂移、后台游玩摘除、全属性乘算爆炸、固定伤害随波次、Boss 数值曲线。



## 📌 近期改动速览（2026-09-06 ~ 09-09，均已提交，按 commit 索引）



### 2026-09-06（Boss/敌人/成就/表现大版本）

- Boss 手感重做：三 Boss 体积+30%、移速封顶 130、技能 600ms 预警可躲、接触与技能伤害上调（684c695）

- 新增三种敌人：召唤师/冲锋怪/治疗怪（双主题贴图+行为AI+波次权重）（d87e1a9）

- 敌人辨识度重绘：fast 尖梭/ranged 法师帽/suicider 引信，补齐三敌像素网格（758f62e）

- 升级三选一新增「跳过」：放弃升级 +50 金币（fadd4d7）

- 修复系统浏览器文字模糊：渲染倍率上限 1.5/2/2.5、画布像素 1:1（91f7a07）

- 成就系统上线：22 成就/6 系列/永久加成/称号/隐藏成就（8fd532d）

- 滚动条统一 UIScrollBar 组件（轨道+滑块一体）（bdabf0b）

- 调试面板新增成就清空/全部清空（925fdb2）

- 满级超限强化（固定需求轮换收益）+ 调试跳转入口（61df768）

- 修复覆盖场景点击穿透（商店/升级等背景拦截点击）（a11a4a4）

- 修复 classic 三敌缺失纹理（97e6332）

- 修复 meta_all 成就死锁 + 自测脚本 24 项通过（4892254）

- 修复 hidden_90 解锁后仍显示？？？（bbfc265）

- 修复 pixel 障碍物纹理不对称（12a93e6）

- 修复玩家/拾取物碰撞圆偏移（0c31110）

- Boss 入场演出：震屏+顶部横幅（3916471，笔记另有独立条目）

- 表现层：数据驱动背景纹理 + AI 拾取优化 + 新纪录徽章 + 光剑命中率修正（8a649be）

- 表现层：8 武器弹道拖尾 + Boss 个性化视觉（a005837）

- 主菜单美化 + 9 武器矢量图标（b7dbb34）



### 2026-09-07

- 移动端 HUD 调试按钮（暂停左侧🛠）+ 面板✕关闭（eb732c5）

- GitHub Pages 部署 workflow（6294be4）

- 点子提交：自动游玩观察想法（42e3744）/ 修改建议（8c2f9e3）/ 继续发现问题（7970185）



### 2026-09-08

- 可破坏障碍物定时恢复（默认20s）→ 随机 20~40s 防蹲守（6ba0079、317cdc2）

- 修复提示卡片跑屏幕中间：GuideCard 改物理坐标（5c9caa7）

- 波次/击杀/分数/金币信息移至小地图下方（4a1a542）

- 被动表现增强：状态图标/弹射加粗/灼烧首跳/闪电链电花（0bbdc18）

- 试玩场地全套：复用主场景逻辑 + 自定义刷怪 + 规范化 + testMode 泄漏修复 + 死亡重召唤（1267428、610fe53、b7abe2e、6b600d2、7b8d3ff）

- 狂暴药水修复：激活期临时加成，防重复叠加（5f5f900）

- 暴击率溢出封顶 100% + 溢出转爆伤暗金标注（11f519b）

- 移动端与数值平衡：成就胜利计数/摇杆/震屏CD/怪速上限/跨关战利品/满级升级框文案（4020caf）



### 2026-09-09

- 待修复问题清单 7 条（40b7f3a，见本笔记顶部）



**8. 超限阶段卡顿：拾取物磁吸失控飞离地图（实测 FPS 22-23）**

- 现象：超限阶段（满级后）机器卡顿；实测 FPS 22-23（目标 60）、场景 children 堆积 824 个（Text 128/拾取物 147/敌人+子弹等）

- 根因（已实测定位，src/entities/Pickup.ts）：

  - 场景 147 个拾取物中 15 个飞到 5 万像素外，最远 745 万像素（地图仅 3000×3000），速度最高 3300 万 px/s

  - Pickup.ts:70-71：if (dist < player.getPickupRadius()) magnetActive = true —— **magnetActive 置 true 后永不重置**（玩家走远仍持续磁吸）

  - Pickup.ts:77：speed = magnetSpeed * (1 + (1 - dist/radius) * 2) —— **dist > radius 时 (1 - dist/radius) 为负** → speed 负巨大 → 反方向超高速 → dist 更大 → 正反馈爆炸，拾取物飞出地图

  - Pickup 无生命周期（不超时消失/不出界清理/无数量上限）→ 飞走的对象永久滞留，每帧物理 step + 场景遍历 → 卡顿

- 修复方向：

  1. 磁吸解除：dist > radius*1.5 时 magnetActive = false（或每帧按 dist 实时判断）

  2. 速度公式保底/封顶：speed = clamp(magnetSpeed*(1+(1-dist/radius)*2), 0, magnetSpeed*3)

  3. 拾取物生命周期：超时（30~60s）或出界（地图边界+余量）自动 despawn

  4. 可选：磁吸追不上时重置（避免病态追尾）

- 备注：与问题 3（stat 乘算爆炸）无直接关系，纯拾取物逻辑缺陷；前期不卡是因为拾取物很快被捡完



### ① 神秘商店 + 金币经济（✅ 已完成 2026-08-29）



**3. 暴击伤害爆炸（20 级玩家 6 级暴伤 buff = 1709%）**

- 现象：属性面板暴伤 1709%（17.09 倍）；同局暴击率仅 15%（无溢出）——纯 stat 累积爆炸

- 根因：Player.modifyStat（src/entities/Player.ts:1079-1092）isPercent 分支**乘算** cur*(1+value)；breakthroughStat（Player.ts:1024-1035）突破走同一 modifyStat → 致命一击（crit_damage，maxLevel 3 + 突破上限 3）= 6 次 ×1.5 → 1.5^7 ≈ 17.09 与截图完全吻合。升级三选一/商店/突破共用此路径

- 注意：不是暴转爆伤公式问题（CollisionSystem.ts:61-64 公式正确），是 stat 成长乘算爆炸

- 修复方向：percent stat 改**基于基础值加算**（base*(1+value*n)），或突破改加算/固定收益；攻击力 ×1.2ⁿ 同理受影响；改后重跑数值审计

- **最新观测（2026-09-09 自动游玩 wave80 实测）**：不止暴伤，**全部 stat 一起爆炸**——玩家 maxHP 85,852,552,559,196,850（8.6e16）、攻击力 277,497,191,270（2.77e11）、暴击率 773%；两亿血 Boss 轻松拿捏、几万血小怪秒杀。确认乘算+突破影响生命/攻击/暴击/暴伤全部属性，修复必须统一口径（加算 or 突破单列上限）



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

- **最新观测（2026-09-09 自动游玩超限阶段）**：两亿血 Boss 轻松拿捏、几万血小怪秒杀，伤害再次天文数字化（详见问题 3 观测：全属性 stat 乘算爆炸）——数值曲线失衡持续，需结合问题 3 一并排查

- **最新观测（2026-09-09 自动游玩超限阶段）**：两亿血 Boss 轻松拿捏、几万血小怪秒杀，伤害再次天文数字化（攻速/攻击力/暴伤在超限+乘算下指数膨胀）——数值曲线失衡问题持续，需结合问题 3 一并排查根因（玩家峰值 DPS vs 怪物血量曲线）





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





### 2026-09-10（8 条待修复全部落地，两批推送 4c02fea / a3b2401）

- 再来一局停摆: GameOverScene.restart 补 startNewRun(保留关卡), 消除 isGameOver 残留整帧停摆

- 结算分差: addKill 死亡后拦截 + endRun 定格快照(lastRunSummary) + 结算改读快照, 顺带修假"新纪录"

- 拾取物磁吸失控: 超出1.5倍半径解除(滞回) + 速度保底0/封顶3× + 出界护栏(±10万px) + 60s超时清理

- 横幅漂移: scrollFactor(0) 屏幕固定 + x÷zoom 真正居中(波次/Boss 两处)

- 后台游玩摘除: 恢复 Phaser 默认(RAF+delta平滑+可见性暂停), 进后台自动暂停

- percent stat 改基准加算(新增 _baseStats 快照): 暴伤6次 1709%→600%, 攻击/攻速/磁力/疾风步线性化

- 固定伤害随波次: 炸弹/清屏 ×小怪难度系数; 敌人接触伤害×难度(原漏乘)

- Boss 难度曲线 2.2^(tier-1)→1.5^(tier-1): wave60 58400倍→86倍

- 验证: build 通过; 实机确认 ①waveTimer推进 ④横幅居中 ⑧出界清理/磁吸解除 ③⑥数值口径

- 备注: 已存爆炸数值存档不受新公式影响(读档原样恢复), 建议清档重玩验证; 数值曲线需配合 scripts/balance-report.html 长期跟踪

### 2026-09-10 晚（地形增强 + 调试刷 Boss，分支 feat-terrain-boss，c55ec23）

- 加速区风道（BoostZoneConfig，speedFactor>1）：第1关草地 boost_01/02、第2关废墟 r_boost_01/02（移速+35%）

- TerrainManager: createBoostZones（青绿块+流动线+箭头视觉）+ getSpeedFactorAt（合并减速/加速，重叠减速优先）

- GameScene 玩家移速改查 getSpeedFactorAt；WaveManager.forceSpawnBoss（复用完整 Boss 流程）

- DebugAPI/DebugPanel: 🐲 Boss×1 刷怪按钮

- 验证：tsc 通过；BU 实测 factor=1.35、视觉明显、Boss 生成带顶部血条（2600/2600）

- 成就排查结论：初战告捷/征服三境不解锁=历史存档脱节（成就胜利计数 4020caf 2026-09-08 11:38 上线，之前通关只解锁关卡不记 wins）；实测通关弹窗+右上角金色提示正常



## 待办

- ✅ 成就解锁提示层级（已完成 2026-09-12，237d14c）：显示层级收编为 Layers 常量表（Layers.GUIDE=10000），GuideCard 改 setDepth(Layers.GUIDE)，浮于一切 UI 之上

### 2026-09-11 关卡差异化主线（独特怪 + 选关图鉴 + 变体视觉，分支 feat-terrain-boss）

- 新增两种关卡专属变体怪：frost_zombie 霜冻僵尸（38hp/78速/10攻，0x88ccff 冰蓝）、corrupt_zombie 腐化僵尸（52hp/52速/13攻，0xcc4455 暗红），复用 enemy_normal 纹理，classic/pixel 双主题均 setTint 染色（Enemy.spawn 变体特判，避免 classic 下与普通僵尸无法区分）

- LevelConfig 扩展：exclusiveEnemies（第2波起按权重混入生成表，废墟 corrupt:28、冰原 frost:28）+ enemyPreview（选关图鉴数据，5 条/关）

- 选关面板 UI 升级（MainMenuScene）：面板 520x420→800x480，三关按钮左移，右侧新增"本关敌人"图鉴区（怪物名按 config.color 着色 + 一行说明），hover 关卡按钮即切换图鉴，初始显示草原

- Boss 差异化基线（此前已有）：草原 generic 默认 / 废墟 boss_summoner 召唤魔像（style=summoner）/ 冰原 boss_barrage 弹幕机械（style=barrage, barrageAtkMult 1.3）

- 验证：tsc 全绿；BU 实机——图鉴 updateLevelPreview(废墟) 显示腐化/自爆/分裂/召唤师/召唤魔像 5 条正确；废墟生成表含 corrupt_zombie:28；classic 主题下腐化僵尸场上 tint=0xcc4455 生效；存档解锁为关卡 id 数组（unlocked=['meadow','ruins','tundra']，用 [0,1,2] 不生效）

- 测试环境注意：__debug.setLevel() 调试接口不切关卡（只改玩家等级且会 NaN），切关验证需 JS 注入 gs.levelConfig/waveManager.levelConfig 后 buildSpawnTable；试玩场地 Lv.NaN 为既有现象（无 quickStart）

### 2026-09-12（词缀系统 + 玩家状态 UI 统一 + 横幅根治，提交 237d14c → ee0fe0d）

- 显示层级收编为 Layers 常量表（237d14c）：setDepth 魔法数字全部摘除（GUIDE=10000 / BANNER=300 / HUD_BUFF_ICON=51 等），成就提示层级问题随此修复

- 词缀系统第1层（fe69ade）：数据化词缀表 src/data/affixes.ts + 普通怪低概率挂词缀 + 稀有度分层；剧毒词缀（命中玩家施加 3s 持续中毒，每秒 8% 攻击力伤害，无视无敌帧）

- 限时状态图标系统（ef2f13d）：剧毒红色减益图标（结束前闪烁）→ 移入 HUD buff 栏（96d74d1）→ 作为伪条目并入 buff 栏统一渲染（ee0fe0d）：同款卡片视觉 + 剩余秒数角标 + 到期前 3s 闪烁 + 点击出说明，移除独立 PlayerStatusIcons 流程；确立"玩家状态图标统一归纳进 buff 栏"设计约定（记于文件头）

- 波次/Boss 横幅根治（ebf3b48 → 7588259）：从 GameFeedback 迁至 UIScene uiRoot + 物理像素坐标（宽 50% / 高 18%），修复高度受限 FIT 窗口渲染丢失（阈值≈宽高比 1.5）；第 1 波时序补显示（GameScene.lastWaveBanner）

- 词条系统（第1层已落码 2026-09-12 fe69ade：剧毒；远期继续扩展）：调研 D3/泰拉瑞亚/七日杀精英词条共识＝属性词缀（迅捷/厚皮/吸血）+ 机制词缀（分裂/爆炸/召唤/冰冻减速/毒）+ 稀有度分层 + 视觉标注；基础设施 affixes.ts 数据表 + Enemy 词缀分支已就绪，"低基础怪随机挂极品词条实现逆袭"可在其上继续加词缀

## 📐 UI 排版经验（2026-09-10 选关面板重构沉淀）

### 核心原则
1. 参考同类游戏 UI 惯例（选关/图鉴双栏布局），别凭空设计
2. 优先避免：元素重叠、空白过大/过小、左右不对称
3. 元素之间要联动呼应（左右分区对齐、附属控件贴主控件），避免各管各的
4. 布局以"几何对称"为骨架，不要靠逐个挤坐标——坐标微调治标不治本

### 今天的具体教训
- **先算几何再放内容**：面板 800 宽，左右内容不对称时逐个挪坐标只会越调越乱；正确做法是数学算对称（左右卡片中心 cx±210、等宽 360、居中空隙 60、两侧边距 10）
- **附属按钮（感叹号）必须贴主按钮**：从 cx-40 → cx-105 → cx-125 → cx-110 反复试，最终以 getBounds 实测间距（gap 43 逻辑 px）为准，而不是凭感觉
- **分组底板（卡片）容易突兀**：加卡片后面板显得"嵌套重"，用户反馈突兀后移除，保留对称坐标即可——分隔用留白，不用加底
- **图鉴两列（名称+说明）比单行拼接干净**：说明列设上限（12 字）截断加省略号，防贴边溢出
- **视觉验证以截图原图为准**：OCR 会漏感叹号等小元素、也会被按钮 padding 误导；坐标系注意：getBounds 是相机逻辑系、截图 OCR 是 1000 制，两者不直接可比
- **BU 模拟器缩放非线性**：感叹号区与按钮区的坐标换算比例不同（0.27 vs 0.38），逻辑上"贴 24px"BU 上会显示"远 88"，最终以截图目视为准；真机（固定 DPR）不存在此问题

### 后续 UI 调整 checklist
- [ ] 先画几何骨架（面板尺寸、左右分区中心、间距），再放内容
- [ ] 附属控件（! / 详情箭头）贴主控件边缘，间隙 ≤ 10-20 逻辑 px，且 z 序高于主控件防误触
- [ ] 长文本列预留宽度上限，超长截断/省略号，防溢出
- [ ] 截图目视（Read 原图）+ 移动端（?mobile=1&uiscale=1.35）双验证
- [ ] 与游戏其他 UI（结算/成就/商店）风格统一：深色面板 + 橙色描边 + 同字号体系
