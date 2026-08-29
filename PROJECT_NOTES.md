# Keep Living H5 - 项目笔记

> 开发备忘 / 待办记录。已完成的改动均有 git 检查点，可随时回滚。

## 📋 开发计划（待办，按优先级）

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

### ② 敌人多样化（机制挑战）
  - 新敌人：自爆怪（近身爆炸）、分裂怪（死后分裂）、盾牌怪（正面减伤）
  - 精英词缀：狂暴 / 护盾 / 分裂
- [ ] **③ 宝箱 + 一次性道具**（爽点）
  - 宝箱：杀怪/精英掉落，开出金币、随机升级、全屏炸弹
  - 消耗品：炸弹清屏、护盾、时间减速、狂暴药水、大磁铁
- [ ] **④ 更多被动 & 状态效果**（build 深度，进阶大版本）
  - 新被动：吸血、弹射、冰冻减速、灼烧 DOT、闪电链
  - 元素状态系统（冰/火/电）

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



