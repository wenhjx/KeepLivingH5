# Keep Living 测试手册

本文档记录浏览器端的调试与自动化测试手段，方便后续快速验证游戏功能、复现/定位问题。
调试钩子统一挂在 `window.__debug`；需要深入内部状态时可通过 `window.__game` 访问 Phaser 实例。

> 维护约定：若游戏内容改动导致本文档中的接口/坐标/流程失效，请同步更新本文档。

---

## 一、环境准备

```bash
# 推荐：带日志的守护启动（stdout/stderr 落盘 + 异常退出码记录）
scripts\dev-server.cmd

# 崩溃自动重启模式（异常退出后 3s 自动拉起）
scripts\dev-server.cmd --watch

# 直接启动（无日志，不推荐用于排查）
node node_modules\vite\bin\vite.js --port 5173
```

- 浏览器打开 `http://localhost:5173/`
- **每次代码热更新后建议整页刷新**：Vite HMR 脏状态可能导致 `Player.scene` 运行时为 `undefined`（报 `Cannot read properties of undefined (reading 'sys')`），整页刷新可解，非代码 bug。
- 浏览器内直接控制台输入 `window.__debug` 可查看全部可用方法。

### dev server 偶发"无声消失"的调查结论（2026-09-04）

现象：Vite dev server 运行中无任何报错突然进程消失（HTTP 连不上、node 进程列表为空）。
排查结果：

1. **无 Vite/esbuild 崩溃痕迹**：无 npm-debug 日志、无 WerFault 记录、无 JS heap OOM（内存充足，16G 空闲 6.9G）；
2. **系统层有异常佐证**：同一时段系统事件日志出现 `LiveKernelEvent 117/141`（显卡驱动挂起/内核级崩溃）+ `AppTermFailureEvent`，环境为云电脑/还原卡场景，存在外部进程终止先例（历史多次"进程被锁"）；
3. **结论**：大概率是**外部环境因素终止了 node 进程**，而非 Vite 热更新自身崩溃——同样的改动/刷新操作下，重启后的 server 一直稳定。

对策：`scripts\dev-server.cmd` 把全部输出与退出码落盘到 `logs\vite-*.log`，再次异常消失时可凭日志区分"Vite 崩"与"外部杀"；`--watch` 模式可自动拉起。

---

## 二、window.__debug API 速查

在浏览器控制台（或自动化脚本）中直接调用，全部挂载在 `window.__debug` 上。

| 方法 | 参数 | 用途 |
|---|---|---|
| `startGame()` | — | 开始新游戏（清存档） |
| `continueGame()` | — | 继续游戏（有进行中存档时） |
| `backToMenu()` | — | 返回主菜单 |
| `pause()` / `resume()` | — | 暂停 / 恢复游戏 |
| `closeTutorial()` | — | 关闭所有新手引导卡片 |
| `giveItem(id, count?)` | 物品 id（heal/shield/rage/bomb/slow/magnet） | 给玩家消耗品 |
| `addLevel(n?)` | 升级次数（默认 1） | 玩家升 n 级（触发升级三选一） |
| `killAll()` | — | 秒杀场上所有敌人 |
| `getPlayer()` | — | 返回玩家对象引用 |
| `getScenes()` | — | 当前运行中的场景 key 列表 |
| `getSave()` / `clearSave()` | — | 读取 / 清除存档 |
| `autoPlay(enabled?)` | 布尔（默认取反） | 开关 AI 自动玩 |
| `testStable()` | — | **稳定测试态**：无敌 + 巨大血量 + 锁升级 + 关闭所有覆盖面板 |
| `setTheme('pixel'/'classic')` | 主题名 | 运行时切换视觉皮肤 |
| `giveAllBuffs(level?)` | 等级（默认 1） | 添加当前所有可获得 buff（跳过兜底项与初始武器） |
| `openWeaponSelect()` | — | 触发一次武器强化三选一 |
| `getWave()` | — | 当前波次 |
| `getEnemyCount()` | — | 场上存活敌人数 |
| `jumpToWave(n)` | 波次数 | **跳到指定波**（直接 startWave，Boss 波自动出 Boss） |
| `completeWave()` | — | 当前波计时拨满 → 触发下一波/通关判定 |
| `openEndlessChoice()` | — | 直接弹出通关结算窗口（继续征战/结束征程） |

---

## 三、快速测试流程（常用）

### 1. 稳定测试态（UI / 交互 / 战斗稳定性测试前置）

```js
__debug.startGame();      // 开始一局
__debug.testStable();     // 无敌 + 锁升级 + 关面板，避免弹窗/死亡干扰观察
```

- `testStable` 会把血量设为 1e9（满血）——此时 `heal`（血包）等回复道具不会消耗，测试消耗品请用 `bomb` / `slow` / `shield`。
- 若测试中需要看场景内容（不是只测 UI），先调 `testStable()` 再操作。

### 2. 快速走到 15 波并验证通关

```js
__debug.jumpToWave(15);   // 直接开 15 波（Boss 波，自动生成 Boss）
__debug.killAll();        // 秒杀 15 波敌人（含 Boss）
__debug.completeWave();   // 波计时拨满 → 触发通关判定
// 约 2 秒后自动弹出「通关成功 / 继续征战」窗口，此时场上敌人已被清空
```

### 3. 直接打开通关结算窗口

```js
__debug.openEndlessChoice();
// 验证两个分支：
// 点「继续征战」→ 进入无尽模式，波次继续（第 16 波）
// 点「结束征程」→ 进入胜利结算（GameOverScene，mode=victory）
```

### 4. 验证物品栏 / buff 点击区域

```js
const ui = window.__game.scene.getScene('UIScene');
// 找到 inventoryUI（含 slotHitRects 字段），读取槽位矩形坐标（canvas 像素）
```

---

## 四、跳波次与波次操控（内部字段）

**原理**：波次是计时制——每波 `waveDuration`（默认 30 秒）到即强制 `nextWave()`（不清怪）。`WaveManager` 的字段虽标 `private`，但 JS 运行时可直接访问。

```js
const wm = window.__game.scene.getScene('GameScene').waveManager;
wm.waveTimer = GameConfig.WAVE.waveDuration; // 拨满计时，下一帧触发 nextWave
```

已有封装接口：
- `__debug.jumpToWave(n)`：跳到第 n 波（Boss 波自动出 Boss）
- `__debug.completeWave()`：当前波计时拨满
- `__debug.getWave()` / `__debug.getEnemyCount()`：查询

**注意**：
- `jumpToWave` 会**跳过中间波次的奖励**（商店 / 武器强化 / Boss 突破），仅用于快速定位特定波次玩法，不经过正常推进。
- 验证"第 15 波通关弹窗"完整流程：`jumpToWave(15)` → `killAll()` → `completeWave()` → 等 2s。

---

## 五、坐标与适配注意事项（关键！）

项目固定分辨率 + UIScene 反向缩放容器（`uiRoot`），导致两个高频坑：

### 1. canvas 在视口中居中偏移

- 游戏 canvas 尺寸可能小于浏览器视口，且**垂直居中**（如视口 1243 高时 canvas `top=140`）。
- `__debug` 返回的坐标是 **canvas 像素**；自动化点击用的 `click_xy` 是 **视口千分比**（0~1000），二者需换算：

```js
// 读取偏移
const rect = window.__game.canvas.getBoundingClientRect();
// 换算：viewportPx = canvasPx + rect.top/left
// 千分比 = viewportPx / 视口宽高 * 1000
```

### 2. 嵌套 Container + 父级 scale 的 setInteractive 命中偏移

- Phaser 嵌套 Container（在 `uiRoot` scale=1/z 下）的 `setInteractive(hitArea)` 命中区会偏移（buff 图标、物品栏槽位都踩过）。
- 已修复方案：**全局 `pointerdown` + 手动矩形命中检测**（用 `pointer.x/y` = uiRoot 局部坐标）。新增可点击 UI 时请沿用此模式，不要再用嵌套 Container 的 `setInteractive`。

---

## 六、已知坑与规避

| 现象 | 原因 / 规避 |
|---|---|
| `Cannot read properties of undefined (reading 'sys')` | Vite HMR 脏状态，`Player.scene` 为 undefined；**整页刷新** |
| 点了没反应 / 敌人子弹不动 | 游戏已暂停（暂停时 `update` 不跑）；先 `__debug.resume()` |
| `heal` 点了不消耗 | `testStable` 满血，回复道具无效；改用 `bomb`/`slow` 测消耗品 |
| 点击命中区与视觉偏位 | canvas 视口偏移（见五-1）或嵌套 Container hitArea（见五-2） |
| 通关窗口没弹 | 检查是否有其他模态挡路；新版本已改为延迟重试（`openEndlessChoice`） |
| 15 波通关后直接"游戏结束" | 已修复：通关瞬间清空残留敌人再弹窗，不会再被残留怪打死 |
| 重新加载存档后背包道具（鸡腿/盾）丢失 | 已修复（2026-09-04，commit 523dfcc）：`saveRun` 原来不序列化 `inventory`，现存档/恢复已补全；旧存档无该字段会跳过 |

### 待验证：敌人地图边界约束（2026-09-04 修复，commit 5850f8f）

- **现象**：85 波 Boss 冲锋冲出 3000x3000 地图外（实测坐标漂到 -11411/-10934、15582/16064），
  玩家看不到本体、小地图无 Boss 标记、顶部血条却在掉（远程武器仍能磨血）。
- **根因**：敌人（含 Boss）原本完全没有地图边界约束；普通敌人靠"追踪玩家"自然不离场，
  Boss 冲锋（chargeState=2 沿固定方向全速突进）可一路冲出地图，出界后 dist 过大追踪失效、无限漂移。
- **修复**：`Enemy.update` 末尾对 x/y 做地图范围 clamp（留白 24px，同步 body.position），
  冲锋/击退/卡墙均不可能再把敌人推出地图。
- **待验证**：重开一局打到高波 Boss（≥85 波），确认 Boss 冲锋不再出图、小地图稳定显示大红点。
- **耗时提示**：2 倍速自动游玩到 85+ 波约需 **30~46 分钟**（含后台挂机，实测 85 波时存活时间 46:00），
  验证需预留时间；也可用 `__debug.jumpToWave(85)` + `killAll()` 快速逼近 Boss 波（注意 jumpToWave 后需处理场上残敌）。

---

## 七、附：一键自动化示例（Python + browser-use）

```python
import seed_browser_use as bu
import time

bu.navigate("http://localhost:5173/")
bu.wait_for_load(timeout=15)
bu.wait_for_element("canvas", visible=True, timeout=10)
time.sleep(1.2)
bu.js('(function(){ window.__debug.startGame(); return 1; })()')
time.sleep(2.5)
bu.js('(function(){ window.__debug.testStable(); return 1; })()')

# 快速到 15 波通关
bu.js('(function(){ window.__debug.jumpToWave(15); return 1; })()')
bu.js('(function(){ window.__debug.killAll(); return 1; })()')
bu.js('(function(){ window.__debug.completeWave(); return 1; })()')
time.sleep(3)
# 检查通关窗口
print(bu.js('(function(){ return window.__game.scene.getScene("GameScene").scene.isActive("EndlessChoiceScene"); })()'))
```
