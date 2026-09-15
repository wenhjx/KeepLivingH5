# 固定设计分辨率下节点位置偏移问题分析报告

> **项目**: Keep Living H5（Phaser 3 + TypeScript + Vite）
> **逻辑分辨率**: 960×640
> **缩放模式**: Phaser Scale.FIT（保持宽高比缩放，不足部分留黑边）
> **分析日期**: 2026-09-15

---

## 目录

- [1. 核心问题](#1-核心问题)
- [2. 偏移根因（5 类）](#2-偏移根因5-类)
- [3. 已实施的解决方案](#3-已实施的解决方案)
  - [3.1 策略 A：setupUICamera — 纯 UI 场景](#31-策略-asetupuicamera--纯-ui-场景)
  - [3.2 策略 B：uiRoot 反向缩放容器 — 叠加 UI 场景](#32-策略-buiroot-反向缩放容器--叠加-ui-场景)
  - [3.3 策略 C：手动 pointerdown + 矩形命中检测 — 交互命中区修正](#33-策略-c手动-pointerdown--矩形命中检测--交互命中区修正)
  - [3.4 辅助工具：anchorX / anchorY — 贴边元素锚点换算](#34-辅助工具anchorx--anchory--贴边元素锚点换算)
  - [3.5 辅助工具：UILayout — 游标式自动布局](#35-辅助工具uilayout--游标式自动布局)
- [4. 已修复的典型 Bug 时间线](#4-已修复的典型-bug-时间线)
- [5. 仍存在的问题（技术债务）](#5-仍存在的问题技术债务)
- [6. 统一方案建议](#6-统一方案建议)

---

## 1. 核心问题

项目固定逻辑分辨率为 **960×640**，使用 Phaser **Scale.FIT** 模式（保持宽高比缩放，不足部分留黑边）。在不同屏幕尺寸下，存在以下几个层面的位置偏移：

1. 相机 zoom 以画布中心为缩放原点，zoom > 1 时可视区域整体偏移
2. 逻辑坐标（960×640）与画布像素坐标（scale.width × scale.height）混用
3. 嵌套 Container + 父级 scale 下 `setInteractive` 的 hitArea 偏移
4. 移动端 uiScale 中心缩放导致贴边元素漂移
5. GameScene 滚动相机中世界坐标与屏幕坐标混用

---

## 2. 偏移根因（5 类）

| # | 根因 | 触发条件 | 影响 |
|---|---|---|---|
| 1 | **相机 zoom 以画布中心为缩放原点** | `camera.setZoom(z)` 且 z > 1 | 可视区域偏移 `(canvas_w - logical_w)/2`，UI 整体偏左上、底部被裁 |
| 2 | **逻辑坐标与画布像素坐标混用** | 部分场景用 960×640 布局，部分用 `scale.width/height` 布局 | 同一场景内坐标空间不一致，元素跑到错误位置 |
| 3 | **嵌套 Container + 父级 scale 的 hitArea 偏移** | 在 uiRoot（scale = 1/z）内的对象调 `setInteractive` | 点击命中区与视觉位置不一致（曾导致"点左半命中右边的 buff"） |
| 4 | **uiScale 中心缩放导致贴边元素漂移** | 移动端横屏 uiScale > 1，元素用绝对坐标定位 | 贴边元素（暂停按钮、小地图、FPS）离开屏幕边缘 |
| 5 | **世界坐标 vs 屏幕坐标混用** | GameScene 滚动相机中，横幅用世界坐标定位 | 玩家远离地图中心时横幅不在屏幕内 |

---

## 3. 已实施的解决方案

项目目前采用 **3 套策略 + 2 个辅助工具** 组合应对不同场景的位置偏移。

### 3.1 策略 A：setupUICamera — 纯 UI 场景

| 项目 | 内容 |
|---|---|
| **文件** | `src/utils/CameraHelper.ts` |
| **适用场景** | MainMenu / Shop / GameOver / Upgrade / Breakthrough / CharacterSelect / EnemyCodex / EndlessChoice / PlayerInfo / Preload（共 10 个纯 UI 场景） |
| **原理** | `setZoom(renderScale × uiScale)` + `setScroll(-(w - w/zoom)/2, ...)` 补偿，使可视区域从世界 (0,0) 开始，返回逻辑分辨率 960×640 供布局 |

**核心代码**：

```typescript
// src/utils/CameraHelper.ts
export function setupUICamera(scene: Phaser.Scene): { width: number; height: number } {
  const zoom = GameConfig.renderScale;
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  cam.setScroll(
    -(cam.width - cam.width / zoom) / 2,
    -(cam.height - cam.height / zoom) / 2
  );
  return { width: GameConfig.GAME_WIDTH, height: GameConfig.GAME_HEIGHT };
}
```

**各场景调用方式**（统一模式）：

```typescript
// 例：src/scenes/ShopScene.ts
create(): void {
  this.cameras.main.setZoom(GameConfig.uiScale);  // 真机 UI 缩放
  const { width, height } = setupUICamera(this);   // zoom + scroll 补偿
  // 此后用 960×640 逻辑坐标布局
}
```

**已修复的具体问题**：

- 商店/结算/升级面板在 Chrome 大窗口下整体偏左上、底部被裁 → 一次性解决
- 移动端真机 dpr > 1 时 zoom = fit 导致 UI 缩成 1/3（2026-09-14 回归修复）

> **注意**：zoom 必须等于 renderScale（含 dpr 的渲染倍率），不能直接用 FIT 比例。移动端真机 dpr > 1 时 renderScale ≈ dpr 远大于 fit，若 zoom = fit 则视野 = 960 × renderScale / fit，会被放大数倍（如 844×390 真机视野约 3153），UI 缩成 1/3 不可读。

**局限**：贴边元素仍需 `anchorX/anchorY` 换算（uiScale > 1 时中心缩放把贴边元素拉离边缘）。

---

### 3.2 策略 B：uiRoot 反向缩放容器 — 叠加 UI 场景

| 项目 | 内容 |
|---|---|
| **文件** | `src/scenes/UIScene.ts`、`src/scenes/DebugScene.ts` |
| **适用场景** | UIScene（游戏内 HUD / 摇杆 / 小地图 / 横幅）、DebugScene（调试面板 / FPS） |
| **原理** | 创建容器，位置 = 中心 × (1 - u/z)、缩放 = u/z，抵消相机 zoom，使容器内子元素视觉位置与逻辑基准一致。所有子元素创建后移入 uiRoot |

**核心代码**：

```typescript
// src/scenes/UIScene.ts — create()
const z = GameConfig.renderScale;
const u = GameConfig.uiScale;

this.cameras.main.setZoom(z);
this.uiRoot = this.add
  .container(
    (this.scale.width / 2) * (1 - u / z),
    (this.scale.height / 2) * (1 - u / z)
  )
  .setScale(u / z);

// ... 创建所有 UI 子元素 ...

// 将全部 UI 对象移入反向缩放根容器（保持视觉位置/比例不变）
this.children.list.slice().forEach((child) => {
  if (child !== this.uiRoot && child !== this.joystick?.getContainer())
    this.uiRoot.add(child);
});
```

**已修复的具体问题**：

- **波次/Boss 横幅漂移**：横幅原在 GameFeedback 用世界坐标 → 玩家远离地图中心时不可见 → 迁移到 UIScene uiRoot + 物理像素坐标（`width * 0.5, height * 0.18`），超宽屏不再裁出
- **第 1 波横幅丢失**：UIScene 晚于 GameScene 启动，wave:start 事件已过 → 从 GameScene 补取 `lastWaveBanner`
- **超宽屏高度受限窗口渲染丢失**：GameScene 滚动相机 + scrollFactor(0) 在宽高比 < 1.5 时有渲染丢失 → 统一归 UIScene uiRoot 管理

**关键例外（摇杆）**：

> 虚拟摇杆容器**独立挂场景根**，不移入 uiRoot。
>
> 原因：joystick.container 被移入 uiRoot 后被二次变换（+120, +80 偏移、×0.8 缩放），导致渲染位置永远偏离手指。
>
> 摇杆自身用 `getScreenPoint/getWorldPoint` 双向换算处理 zoom，内部一律使用"屏幕逻辑坐标"（与 `scale.width/height` 同空间）。

```typescript
// 摇杆例外：移入 uiRoot 时排除
this.children.list.slice().forEach((child) => {
  if (child !== this.uiRoot && child !== this.joystick?.getContainer())
    this.uiRoot.add(child);
});
```

---

### 3.3 策略 C：手动 pointerdown + 矩形命中检测 — 交互命中区修正

| 项目 | 内容 |
|---|---|
| **适用场景** | UIScene 内嵌套 Container + scale 的可点击元素（buff 图标、物品栏槽位） |
| **原理** | 弃用 Phaser 的 `setInteractive(hitArea)`（嵌套 Container + 父级 scale 下 hitArea 偏移），改用全局 `pointerdown` + 手动矩形判定（`pointer.x/y` = uiRoot 局部坐标 = canvas 像素坐标） |

**核心代码（物品栏槽位命中检测）**：

```typescript
// src/ui/InventoryUI.ts
this.pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
  for (const r of this.slotHitRects) {
    if (
      pointer.x >= r.x &&
      pointer.x <= r.x + this.slotSize &&
      pointer.y >= r.y &&
      pointer.y <= r.y + this.slotSize
    ) {
      this.useSlot(r.index);
      return;
    }
  }
};
scene.input.on('pointerdown', this.pointerDownHandler);
```

**已修复的具体问题**：

- buff 图标"点左半命中右边的 buff" → 改全局 pointerdown + 手动 rect
- 物品栏"点击区域整体偏上一个槽位高度" → 同方案

---

### 3.4 辅助工具：anchorX / anchorY — 贴边元素锚点换算

| 项目 | 内容 |
|---|---|
| **文件** | `src/game/GameConfig.ts` |
| **用途** | uiScale > 1（移动端横屏中心缩放）时，把"贴边坐标"换算回原坐标，使贴边元素仍贴边 |

```typescript
// src/game/GameConfig.ts
static anchorX(x: number, w: number): number {
  const k = GameConfig.uiScale;
  return x / k + (w / 2) * (1 - 1 / k);
}

static anchorY(y: number, h: number): number {
  const k = GameConfig.uiScale;
  return y / k + (h / 2) * (1 - 1 / k);
}
```

**使用位置**：

| 场景 | 元素 |
|---|---|
| UIScene | 暂停按钮（右上角）、调试按钮（暂停按钮左侧）、小地图（左上角） |
| DebugScene | FPS 文字（左下角） |
| HUD | 顶部基准线 `anchorY(padding, height)`、底部血条中心 `anchorY(height - 40, height)` |

---

### 3.5 辅助工具：UILayout — 游标式自动布局

| 项目 | 内容 |
|---|---|
| **文件** | `src/utils/UILayout.ts` |
| **用途** | 自动列/行排列，新增子节点自动接在上一个后面（解决"加一个 buff 就要手动重算所有坐标"的痛点） |

```typescript
// 使用示例：暂停菜单三按钮排列
const menuLayout = new UILayout({
  x: width / 2,
  y: height / 2,
  direction: 'column',
  spacing: 60,
});
menuLayout.placeCentered(resumeBtn);   // (w/2, h/2)
menuLayout.placeCentered(infoBtn);     // (w/2, h/2 + 60)
menuLayout.placeCentered(menuBtn);     // (w/2, h/2 + 120)
```

**使用位置**：暂停菜单三按钮排列、HUD buff 栏排列。

---

## 4. 已修复的典型 Bug 时间线

| 时间 | Bug | 根因 | 修复方案 |
|---|---|---|---|
| 09-06 | 文字模糊 | 渲染倍率不足 | renderScale 上限 1.5/2/2.5 + 画布像素 1:1 |
| 09-08 | 商店/结算偏左上 | setZoom 无 scroll 补偿 | **setupUICamera** 统一函数 |
| 09-10 | 摇杆偏离手指 | joystick.container 被移入 uiRoot 二次变换 | 移入时排除摇杆容器 |
| 09-10 | 横幅不在屏幕内 | 世界坐标 vs 屏幕坐标 | 迁移到 UIScene uiRoot + scrollFactor(0) |
| 09-12 | 横幅超宽屏裁出 | 逻辑坐标 vs 物理像素 | uiRoot + 物理像素坐标 |
| 09-12 | buff 点击区偏移 | 嵌套 Container setInteractive | 全局 pointerdown + 手动 rect |
| 09-13 | 主菜单按钮重叠 | y 坐标都写成 buttonY + spacing | 改为递增 +1/+2/+3 |
| 09-14 | 移动端 UI 缩 1/3 | zoom = fit 而非 renderScale | setupUICamera zoom 必须 = renderScale |

---

## 5. 仍存在的问题（技术债务）

根据 `SHOWCASE_TODO.md` 中的复盘，以下问题尚未系统化解决：

1. **大文件用绝对像素坐标**：`DebugPanel`（785 行）、`HUD`（730 行）等大量 UI 组件仍用逐个挤坐标的方式，频繁错位
2. **移动端布局未系统化**：大量 UI 用像素绝对坐标，需推广 `anchorX/anchorY` + `UILayout` 锚点布局模式替代写死坐标
3. **三套策略不统一**：纯 UI 场景用 setupUICamera、叠加场景用 uiRoot、交互用手动 pointerdown — 新开发者需理解三套方案才能正确放置元素
4. **UpgradePanel 用 960×640 坐标**：`overlay` 用 `GameConfig.GAME_WIDTH/HEIGHT` 但它被嵌入在场景中，与其他元素坐标空间可能冲突

---

## 6. 统一方案建议

若要彻底解决位置偏移问题，建议收敛为 **一套坐标空间 + 一套锚点系统**：

### 6.1 统一坐标空间

所有 UI 场景统一用 `setupUICamera` 返回的 **960×640 逻辑分辨率**布局，弃用 `scale.width/height` 做布局基准（仅在 `anchorX/anchorY` 换算时用）。

### 6.2 统一锚点系统

扩展 `UILayout`，增加 `anchor` 参数：

```
anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
```

所有贴边元素通过锚点定位，不再手写坐标。

### 6.3 统一交互方案

所有嵌套 Container 内的可点击元素统一走全局 `pointerdown` + 手动 rect（或封装为 `HitRectManager`），彻底弃用 `setInteractive(hitArea)`。

### 6.4 UIScene uiRoot 保留

作为 GameScene 叠加层的唯一方案（因 GameScene 相机跟随玩家，不能用 setupUICamera），但内部布局统一用 960×640 逻辑坐标 + `anchorX/anchorY` 换算。

### 6.5 新增 UISafeZone

封装"安全区域"概念（FIT 模式下黑边内的实际可视区域），所有贴边元素基于安全区域而非画布边缘定位，彻底消除 letterbox 导致的偏移。
