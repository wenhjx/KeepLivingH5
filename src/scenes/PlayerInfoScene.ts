import { createUIText } from "../utils/UIText";
import Phaser from "phaser";
import { GameManager } from "../game/GameManager";
import { setupUICamera } from "../utils/CameraHelper";
import { UIScrollBar } from "../utils/UIScrollBar";
import { WEAPONS } from "../data/weapons";
import { UPGRADE_OPTIONS } from "../data/upgrades";
import { SOUND_KEYS } from "../data/sounds";
import { AudioManager } from "../systems/AudioManager";
import type { Player } from "../entities/Player";
import { GameConfig } from "../game/GameConfig";
import { Layers } from "../constants/Layers";

/**
 * 玩家属性面板（二游式：按 C 打开的角色详情）
 *
 * 展示玩家全部成长数据：等级/经验、战斗属性、生存属性、金币，
 * 以及当前持有的武器/被动/stat 升级（含 Boss 突破次数）。
 * 与 UpgradeScene/BreakthroughScene 一样作为独立叠加场景，暂停游戏逻辑。
 * 关闭后恢复打开前的暂停状态（打开前在游玩中则继续游玩，在暂停菜单则回到暂停）。
 *
 * 实时刷新：面板打开期间每 200ms 轮询玩家状态快照，属性/持有列表变化才重绘
 * （setText 复用文本对象，避免重建闪烁）。属性修改点分散（升级/拾取/词缀/调试面板），
 * 事件驱动容易漏发，轮询 + 差异刷新更稳。
 */
export class PlayerInfoScene extends Phaser.Scene {
  // 打开前的暂停状态，由调用方（GameScene C 键 / 暂停菜单按钮）显式传入
  private prevPaused = false;

  private player?: Player;

  // 属性值文本引用（每行最多两段：白字基础 + 暗金溢出，复用对象 setText 无闪烁）
  private leftValues: Array<{
    base: Phaser.GameObjects.Text;
    extra: Phaser.GameObjects.Text;
  }> = [];
  private rightValues: Array<{
    base: Phaser.GameObjects.Text;
    extra: Phaser.GameObjects.Text;
  }> = [];

  // 持有列表（可滚动区）
  private holdingsContainer?: Phaser.GameObjects.Container;
  private scrollContent?: Phaser.GameObjects.Container;
  private scrollBar?: UIScrollBar;
  private scrollY = 0;
  private scrollOff = 0;
  private maxScroll = 0;
  private holdingsSig = "";
  private hintText?: Phaser.GameObjects.Text;

  // 轮询
  private refreshTimer = 0;
  private readonly REFRESH_INTERVAL = 200;

  constructor() {
    super("PlayerInfoScene");
  }

  create(data?: { prevPaused?: boolean }): void {
    // Phaser 场景复用实例：scene.stop 不会重置实例字段，二次 create 必须清零，
    // 否则旧 Text 引用残留导致 setText 失效/持有列表跳过重建（面板值空白）。
    this.player = undefined;
    this.leftValues = [];
    this.rightValues = [];
    this.holdingsContainer = undefined;
    this.scrollContent = undefined;
    this.scrollBar = undefined;
    this.scrollY = 0;
    this.scrollOff = 0;
    this.maxScroll = 0;
    this.holdingsSig = "";
    this.hintText = undefined;
    this.refreshTimer = 0;

    // 真机 UI 缩放：中心放大面板（贴边元素已用 anchor 换算）
    this.cameras.main.setZoom(GameConfig.uiScale);
    this.prevPaused = data?.prevPaused ?? GameManager.getInstance().isPaused;
    // UI 相机统一设置
    const { width, height } = setupUICamera(this);

    const gameScene = this.scene.get("GameScene") as any;
    const player = gameScene?.getPlayer?.() as Player | undefined;
    if (!player) {
      this.closePanel();
      return;
    }
    this.player = player;

    // 半透明背景（盖住暂停遮罩与游戏画面）
    this.add
      .rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();

    // 中央面板尺寸
    const panelW = 700;
    const panelH = 470;
    const cx = width / 2;
    const cy = height / 2;

    // 面板背景
    const bg = this.add.graphics();
    bg.fillStyle(0x14141f, 0.95);
    bg.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    bg.lineStyle(2, 0x3a3a55, 1);
    bg.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    this.add.existing(bg);

    // 标题
    createUIText(this, cx, cy - panelH / 2 + 32, "🎮 玩家属性", {
      fontSize: "26px",
      color: "#ffd54f",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5);

    // 关闭按钮（右上角 ×）
    const closeBtn = createUIText(
      this,
      cx + panelW / 2 - 20,
      cy - panelH / 2 + 28,
      "✕",
      {
        fontSize: "22px",
        color: "#aaaaaa",
        backgroundColor: "#222233",
        padding: { left: 8, right: 8, top: 2, bottom: 2 },
      },
    )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => {
      AudioManager.getInstance().playSfx(SOUND_KEYS.SFX_UI_CLICK, 0.6);
      this.closePanel();
    });

    // ===== 属性值文本（先创建空文本占位，刷新时 setText） =====
    const colX = cx - panelW / 2 + 70;
    const colX2 = cx + 40;
    const startY = cy - panelH / 2 + 85;
    const rowGap = 36;
    const valueX = 150;

    const createValuePair = (x: number, y: number) => {
      const base = createUIText(this, x + valueX, y, "", {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0, 0);
      const extra = createUIText(this, x + valueX, y, "", {
        fontSize: "16px",
        color: "#c9a227",
        fontStyle: "bold",
      })
        .setOrigin(0, 0)
        .setVisible(false);
      return { base, extra };
    };

    ["⚔️ 攻击力", "⚡ 攻速", "🎯 暴击率", "💥 暴击伤害", "👟 移速"].forEach(
      (label, i) => {
        createUIText(this, colX, startY + i * rowGap, label, {
          fontSize: "16px",
          color: "#bbbbbb",
        }).setOrigin(0, 0);
        this.leftValues.push(createValuePair(colX, startY + i * rowGap));
      },
    );
    ["❤️ 生命", "🛡️ 防御", "🍀 幸运", "🧲 拾取范围", "💰 金币"].forEach(
      (label, i) => {
        createUIText(this, colX2, startY + i * rowGap, label, {
          fontSize: "16px",
          color: "#bbbbbb",
        }).setOrigin(0, 0);
        this.rightValues.push(createValuePair(colX2, startY + i * rowGap));
      },
    );

    // ===== 底部：武器 / 被动 / stat =====
    // 持有区整体上移，滚动区固定 4 行可视高度（更美观，也避免与底部提示重叠）
    const bottomY = cy + panelH / 2 - 198;

    createUIText(this, cx - panelW / 2 + 30, bottomY, "📦 持有", {
      fontSize: "15px",
      color: "#ffd54f",
      fontStyle: "bold",
    }).setOrigin(0, 0);

    // ===== 持有列表（可滚动区域：GeometryMask 遮罩 + 滚轮/拖拽滚动 + 滚动条） =====
    // Phaser 3 无内置 UI 滚动容器，采用标准做法：内容放入 Container，
    // 用矩形 GeometryMask 裁剪可视区域，滚轮/拖拽修改容器 y 偏移实现滚动。
    const itemPerRow = 4;
    const itemColW = 165;
    const rowH = 34;
    const itemX0 = cx - panelW / 2 + 30;
    const scrollX = itemX0 - 8;
    const scrollY = bottomY + 28;
    const scrollW = panelW - 60;
    const scrollH = 4 * rowH; // 固定 4 行可视高度
    const barX = scrollX + scrollW + 6; // 滚动条 x

    // 遮罩（不加入显示列表，仅作裁剪几何）
    const maskG = this.make.graphics(undefined, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(scrollX, scrollY, scrollW, scrollH);
    const mask = maskG.createGeometryMask();

    // 内容容器（遮罩内滚动）
    this.scrollContent = this.add
      .container(scrollX, scrollY)
      .setDepth(Layers.SCROLL_CONTENT);
    this.scrollContent.setMask(mask);
    this.scrollY = scrollY;

    // 滚动条（统一组件：轨道+滑块一体，无可滚动内容时不显示）
    this.scrollBar = new UIScrollBar(this, barX, scrollY, 5, scrollH);

    const applyScroll = () => {
      this.scrollContent?.setY(scrollY - this.scrollOff);
      this.scrollBar?.update(this.scrollOff);
    };

    // 滚轮滚动（deltaY 除以相机 zoom 换算为逻辑像素，与布局坐标系一致）
    const zoom = this.cameras.main.zoom;
    this.input.on("wheel", (_p: any, _o: any, _dx: number, dy: number) => {
      if (this.maxScroll <= 0) return;
      this.scrollOff = Phaser.Math.Clamp(
        this.scrollOff + dy / zoom,
        0,
        this.maxScroll,
      );
      applyScroll();
    });

    // 拖拽滚动（按住上下拖动内容区）
    // 位移超阈值才真正滚动：轻点/微移不跳动内容，也为将来滚动区放入可交互组件预留防误触
    let dragging = false;
    let dragMoved = false;
    let dragStartY = 0;
    let dragStartOff = 0;
    const DRAG_THRESHOLD = 12;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      dragging = true;
      dragMoved = false;
      dragStartY = p.y;
      dragStartOff = this.scrollOff;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!dragging || this.maxScroll <= 0) return;
      if (!dragMoved && Math.abs(p.y - dragStartY) > DRAG_THRESHOLD)
        dragMoved = true;
      if (dragMoved) {
        this.scrollOff = Phaser.Math.Clamp(
          dragStartOff + (dragStartY - p.y) / zoom,
          0,
          this.maxScroll,
        );
        applyScroll();
      }
    });
    this.input.on("pointerup", () => {
      dragging = false;
    });

    // 底部提示
    this.hintText = createUIText(this, cx, cy + panelH / 2 - 20, "", {
      fontSize: "13px",
      color: "#666688",
    }).setOrigin(0.5);

    // 首次渲染
    this.refreshStats();
    this.refreshHoldings();
  }

  /** 刷新属性区：重算显示值并 setText（复用对象，富文本两段自动衔接） */
  private refreshStats(): void {
    const player = this.player;
    if (!player) return;
    const s = player.getStats();
    const atk = s.attackPower ?? 10;
    const spd = s.attackSpeed ?? 1;
    const crit = s.critRate ?? 0.05;
    const critDmg = s.critDamage ?? 1.5;
    const mspd = s.moveSpeed ?? 100;
    const def = s.defense ?? 0;
    const hp = player.getHealth?.() ?? s.maxHealth;
    const maxHp = s.maxHealth ?? 100;
    const luck = s.luck ?? 0;
    const pick = s.pickupRadius ?? 60;
    const coins = player.getCoins?.() ?? 0;

    // 暴击溢出：直接封顶 100%（不附说明文字），多出部分按 1:2 转暴击伤害
    const critOverflow = Math.max(0, crit - 1);
    const critDisplay = crit >= 1 ? "100%" : `${(crit * 100).toFixed(0)}%`;
    // 暴击伤害：隐藏基础 100%（二游惯例，只显示额外加成），溢出转化部分暗金色标注
    const critDmgBase = `${Math.max(0, (critDmg - 1) * 100).toFixed(0)}%`;

    const left: Array<string | { base: string; extra: string }> = [
      atk.toFixed(1),
      `${spd.toFixed(2)}/s`,
      critDisplay,
      critOverflow > 0
        ? { base: critDmgBase, extra: `+${(critOverflow * 200).toFixed(0)}%` }
        : critDmgBase,
      mspd.toFixed(0),
    ];
    const right: Array<string | { base: string; extra: string }> = [
      `${Math.ceil(hp)}/${Math.ceil(maxHp)}`,
      def.toFixed(0),
      luck.toFixed(0),
      pick.toFixed(0),
      coins.toFixed(0),
    ];

    const applyPair = (
      pair: { base: Phaser.GameObjects.Text; extra: Phaser.GameObjects.Text },
      v: string | { base: string; extra: string },
    ) => {
      if (typeof v === "string") {
        pair.base.setText(v);
        pair.extra.setVisible(false);
      } else {
        pair.base.setText(v.base);
        pair.extra.setText(v.extra);
        pair.extra.setVisible(true).setX(pair.base.x + pair.base.width + 6);
      }
    };
    left.forEach(
      (v, i) => this.leftValues[i] && applyPair(this.leftValues[i], v),
    );
    right.forEach(
      (v, i) => this.rightValues[i] && applyPair(this.rightValues[i], v),
    );
  }

  /** 刷新持有区：签名变化才重建（清空 container 重绘，滚动位置归零） */
  private refreshHoldings(): void {
    const player = this.player;
    if (!player || !this.scrollContent) return;

    // 收集武器/被动/stat 展示项（过滤异常空项，避免显示 "undefined"）
    const weapons = (player.getWeapons?.() || [])
      .map((w: any) => ({
        icon: (WEAPONS[w.id] && this.getWeaponIcon(w.id)) || "🔫",
        name: w.name,
        lv: w.level,
      }))
      .filter((w: any) => w && w.name);
    const passives = (player.getPassives?.() || [])
      .map((p: any) => ({
        icon: UPGRADE_OPTIONS.find((u) => u.id === p.id)?.icon || "✨",
        name: p.name,
        lv: p.level,
      }))
      .filter((p: any) => p && p.name);
    const stats = (player.getStatUpgrades?.() || [])
      .map((st: any) => ({
        icon: UPGRADE_OPTIONS.find((u) => u.id === st.id)?.icon || "✨",
        name: st.name,
        lv: st.level + (player.getBreakthroughLevel?.(st.id) ?? 0), // 升级+突破总等级
      }))
      .filter((s: any) => s && s.name);

    const holdings = [...weapons, ...passives, ...stats];
    const sig = holdings.map((h) => `${h.icon}|${h.name}|${h.lv}`).join(";");
    if (sig === this.holdingsSig) return;
    this.holdingsSig = sig;

    // 重建内容
    this.scrollContent.removeAll(true);
    const itemPerRow = 4;
    const itemColW = 165;
    const rowH = 34;
    holdings.forEach((h, i) => {
      const col = i % itemPerRow;
      const row = Math.floor(i / itemPerRow);
      this.scrollContent!.add(
        createUIText(
          this,
          col * itemColW,
          row * rowH,
          `${h.icon} ${h.name}  Lv.${h.lv}`,
          {
            fontSize: "14px",
            color: "#e0e0e0",
          },
        ).setOrigin(0, 0),
      );
    });

    // 滚动范围与状态（内容变化后归零，并更新滚动条/提示）
    const contentH = Math.ceil(holdings.length / itemPerRow) * rowH;
    this.maxScroll = Math.max(0, contentH - 4 * rowH);
    this.scrollOff = 0;
    this.scrollContent.setY(this.scrollY);
    this.scrollBar?.setRange(contentH, 4 * rowH);
    this.scrollBar?.update(0);
    if (this.hintText) {
      this.hintText.setText(
        this.maxScroll > 0
          ? "滚轮 / 拖动滚动 · 按 C 或点击 ✕ 关闭"
          : "按 C 或点击 ✕ 关闭",
      );
    }
  }

  update(_time: number, delta: number): void {
    // 暂停态轮询：属性/持有变化才刷新（200ms 间隔足够"实时"，开销极小）
    this.refreshTimer += delta;
    if (this.refreshTimer >= this.REFRESH_INTERVAL) {
      this.refreshTimer = 0;
      this.refreshStats();
      this.refreshHoldings();
    }
  }

  private getWeaponIcon(id: string): string {
    // 与 HUD weaponVisuals 保持一致
    const map: Record<string, string> = {
      default_gun: "🔫",
      machine_gun: "🔫",
      shotgun: "🔫",
      laser: "🔆",
      rocket: "🚀",
      boomerang: "🪃",
      lightsaber: "🗡️",
      drone: "🤖",
    };
    return map[id] || "🔫";
  }

  /** 关闭属性面板：恢复打开前的暂停状态（供 GameScene 的 C 键调用） */
  closePanel(): void {
    GameManager.getInstance().setPaused(this.prevPaused);
    this.scene.stop("PlayerInfoScene");
  }
}
