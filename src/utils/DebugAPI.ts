import type Phaser from 'phaser';
import { GameConfig } from '../game/GameConfig';
import { GameManager } from '../game/GameManager';
import { USABLE_ITEMS } from '../data/items';
import { UPGRADE_OPTIONS } from '../data/upgrades';
import { applyUpgradeToPlayer } from './UpgradeApplier';
import { GuideManager } from '../systems/GuideManager';

/**
 * 全局调试 API（仅开发环境使用，挂在 window.__debug 上）
 * 方便浏览器控制台 / 自动化测试直接调用游戏内部方法，
 * 避免通过坐标点击 Canvas 按钮（分辨率缩放导致坐标转换困难）。
 */
export interface DebugAPI {
  /** 开始新游戏 */
  startGame: () => void;
  /** 继续游戏（有存档时） */
  continueGame: () => void;
  /** 返回主菜单 */
  backToMenu: () => void;
  /** 暂停游戏 */
  pause: () => void;
  /** 恢复游戏 */
  resume: () => void;
  /** 关闭所有新手引导 */
  closeTutorial: () => void;
  /** 给玩家物品 */
  giveItem: (id: string, count?: number) => void;
  /** 玩家升 n 级 */
  addLevel: (n?: number) => void;
  /** 杀死所有敌人 */
  killAll: () => void;
  /** 获取玩家引用 */
  getPlayer: () => any;
  /** 获取当前场景 key 列表 */
  getScenes: () => string[];
  /** 获取存档内容（JSON） */
  getSave: () => string;
  /** 清除存档 */
  clearSave: () => void;
  /** 开关 AI 自动玩 */
  autoPlay: (enabled?: boolean) => boolean;
  /** 稳定测试态：无敌 + 不升级 + 关闭所有覆盖面板（避免升级/商店弹窗干扰 UI 点击测试） */
  testStable: () => string;
  /** 切换视觉主题（皮肤）：'pixel' 像素风 | 'classic' 经典矢量霓虹（已有实体即时生效） */
  setTheme: (theme: 'pixel' | 'classic') => string;
  /** 为玩家添加当前所有可获得 buff（武器/被动/属性），默认各 1 级；跳过兜底项与初始武器 */
  giveAllBuffs: (level?: number) => string;
  /** 触发一次武器强化三选一（击败 Boss 奖励；调试用） */
  openWeaponSelect: () => string;
  // ========== 波次/战斗测试辅助（快速定位特定波次，不经过正常推进） ==========
  /** 获取当前波次 */
  getWave: () => number;
  /** 场上存活敌人数 */
  getEnemyCount: () => number;
  /** 跳到指定波次（直接 startWave，Boss 波自动生成 Boss；跳过中间奖励） */
  jumpToWave: (n: number) => string;
  /** 把当前波计时拨满 → 下一帧触发下一波/通关判定（配合 jumpToWave 快速走完 15 波） */
  completeWave: () => string;
  /** 直接弹出通关结算窗口（继续征战 / 结束征程） */
  openEndlessChoice: () => string;
  /** 设置全局游戏速度（0.25~4 倍速；2=加速一倍，0.25=慢速观察） */
  setGameSpeed: (speed: number) => string;
  /** 获取当前游戏速度 */
  getGameSpeed: () => number;
}

export function initDebugAPI(game: Phaser.Game): void {
  const gm = GameManager.getInstance();

  // 通过任意已运行场景的 ScenePlugin 操作场景（比 game.scene 更可靠）
  const plugin = () => {
    const anyScene = game.scene.getScenes(true)[0] as any;
    return anyScene?.scene;
  };

  const getScene = (key: string) => game.scene.getScene(key) as any;
  const getGameScene = () => getScene('GameScene');
  const getPlayer = () => getGameScene()?.getPlayer?.();

  const api: DebugAPI = {
    startGame: () => {
      gm.startNewRun();
      const sc = plugin();
      if (!sc) return;
      sc.stop('UIScene');
      sc.stop('GameOverScene');
      sc.start('GameScene');
      sc.launch('UIScene');
    },

    continueGame: () => {
      if (!gm.hasSavedRun()) {
        console.warn('[debug] 无存档，无法继续游戏');
        return;
      }
      const sc = plugin();
      if (!sc) return;
      sc.stop('UIScene');
      sc.start('GameScene');
      sc.launch('UIScene');
    },

    backToMenu: () => {
      const sc = plugin();
      if (!sc) return;
      sc.stop('UIScene');
      sc.stop('GameScene');
      sc.stop('GameOverScene');
      sc.start('MainMenuScene');
    },

    pause: () => gm.setPaused(true),
    resume: () => gm.setPaused(false),

    closeTutorial: () => {
      // 直接操作 GuideManager 单例：清空队列 + 销毁当前卡片（旧实现 getInstance 判断错误导致永不生效）
      GuideManager.getInstance().clearAll();
    },

    giveItem: (id: string, count = 1) => {
      const player = getPlayer();
      if (!player) {
        console.warn('[debug] 玩家不存在');
        return;
      }
      if (!USABLE_ITEMS[id]) {
        console.warn(`[debug] 未知物品 id: ${id}，可用: ${Object.keys(USABLE_ITEMS).join(', ')}`);
        return;
      }
      player.addItem(id, count);
      console.log(`[debug] 给予物品 ${id} x${count}`);
    },

    addLevel: (n = 1) => {
      const player = getPlayer();
      if (!player) return;
      for (let i = 0; i < n; i++) {
        player.addExp(player.stats.expToNext);
      }
    },

    killAll: () => {
      const gs = getGameScene();
      const enemies = gs?.getEnemies?.();
      if (!enemies) return;
      enemies.getChildren().forEach((e: any) => {
        if (e.active && typeof e.takeDamage === 'function') {
          e.takeDamage(99999, true);
        }
      });
    },

    getPlayer,

    getScenes: () => game.scene.getScenes(true).map((s: any) => s.scene.key),

    getSave: () => {
      const SaveSystem = (gm as any)._saveSystem;
      return SaveSystem ? JSON.stringify(SaveSystem.load(), null, 2) : 'no save system';
    },

    clearSave: () => {
      gm.clearSavedRun();
      console.log('[debug] 存档已清除');
    },

    autoPlay: (enabled?: boolean) => {
      const gs = getGameScene();
      if (!gs) {
        console.warn('[debug] GameScene 未运行');
        return false;
      }
      const state = enabled ?? !gs.isAutoPlay?.();
      gs.setAutoPlay?.(state);
      console.log(`[debug] 自动玩: ${state ? '开启' : '关闭'}`);
      return state;
    },

    testStable: () => {
      const player = getPlayer();
      if (player) {
        if (player.stats) {
          // 巨大血量打不死 + 升级需求巨大不升级，避免战斗/升级弹窗干扰 UI 点击测试
          player.stats.maxHealth = 1e9;
          player.stats.health = 1e9;
          player.stats.exp = 0;
          player.stats.expToNext = 1e9;
        }
        player.invincible = true;
        player.invincibleTimer = 1e9; // 持续无敌（timer 单位 ms）
        player.stableMode = true; // 稳定测试态：持续无敌不闪烁
      }
      const gs = getGameScene();
      if (gs) gs.pendingLevelUps = 0;
      // 关闭所有覆盖面板（升级三选一/商店/突破/玩家属性/结算）
      const sc = plugin();
      if (sc) {
        ['UpgradeScene', 'ShopScene', 'BreakthroughScene', 'PlayerInfoScene', 'GameOverScene'].forEach((k) => {
          try {
            if (sc.isActive(k)) sc.stop(k);
          } catch (e) {
            /* 忽略未运行场景 */
          }
        });
      }
      console.log('[debug] 稳定测试态已启用（无敌+不升级+关面板）');
      return 'testStable active';
    },

    setTheme: (theme: 'pixel' | 'classic') => {
      GameConfig.VISUAL_THEME = theme;
      // 渲染器抗锯齿跟随主题：classic 矢量平滑、pixel 像素锐利
      const renderer = game.renderer as any;
      try {
        if (renderer && typeof renderer.setAntialias === 'function') {
          renderer.setAntialias(theme === 'classic');
        }
      } catch (e) {
        /* 渲染器不支持运行时切换则忽略 */
      }
      // 已有实体即时切换纹理（玩家 + 场上敌人）
      const gs = getGameScene();
      const player = gs?.getPlayer?.();
      if (player && player.setTexture) {
        player.setTexture(GameConfig.themeKey('player'));
      }
      gs?.enemies?.children?.each?.((enemy: any) => {
        if (!enemy || !enemy.setTexture || !enemy.config?.texture) return true;
        enemy.setTexture(GameConfig.themeKey(enemy.config.texture));
        // 主题切换后重设染色：pixel 白色主体需 tint；classic 矢量自带色需 clear
        if (theme === 'pixel') {
          if (enemy.config.color) enemy.setTint(enemy.config.color);
        } else {
          enemy.clearTint();
        }
        return true;
      });
      // 场上已有子弹/掉落物即时更新（仅双套纹理的 key）
      const themedBulletKeys = ['bullet', 'bullet_classic'];
      const themedPickupBase = ['pickup_exp', 'pickup_health', 'pickup_coin', 'pickup_chest'];
      gs?.bullets?.children?.each?.((b: any) => {
        if (!b || !b.setTexture || !b.active) return true;
        if (themedBulletKeys.includes(b.texture?.key)) b.setTexture(GameConfig.themeKey('bullet'));
        return true;
      });
      gs?.pickups?.children?.each?.((p: any) => {
        if (!p || !p.setTexture || !p.active) return true;
        const k = p.texture?.key;
        const base = themedPickupBase.find((b) => k === b || k === `${b}_classic`);
        if (base) p.setTexture(GameConfig.themeKey(base));
        return true;
      });
      // 场上已有障碍物即时更新（岩石/墙体/水晶，pixel 与 classic 双套）
      const terrain = gs?.terrainManager;
      if (terrain?.getObstacleGroup?.()) {
        terrain.getObstacleGroup().children.each((o: any) => {
          if (!o || !o.setTexture) return true;
          const k = o.texture?.key || '';
          o.setTexture(GameConfig.themeKey(k.replace(/_classic$/, '')));
          return true;
        });
      }
      // 场上已有无人机即时更新
      player?.drones?.forEach?.((d: any) => {
        if (d && d.setTexture) d.setTexture(GameConfig.themeKey('drone'));
      });
      console.log(`[debug] 视觉主题已切换: ${theme}`);
      return `主题已切换: ${theme}`;
    },

    giveAllBuffs: (level = 1) => {
      const player = getPlayer();
      if (!player) return 'player not found';
      const gs = getGameScene();
      const applied: string[] = [];
      for (const opt of UPGRADE_OPTIONS) {
        // 跳过兜底项（金币/治疗/狂暴/清屏即时效果）与初始武器（玩家开局自带，保持 Lv1）
        if (opt.id.startsWith('fallback_')) continue;
        if (opt.id === 'weapon_default_gun') continue;
        for (let i = 0; i < level; i++) {
          applyUpgradeToPlayer(player, opt, gs);
        }
        applied.push(opt.name);
      }
      console.log(`[debug] 已为玩家添加 ${applied.length} 个 buff（${level} 级）: ${applied.join(', ')}`);
      return `${applied.length} buffs applied (${level} 级)`;
    },
    openWeaponSelect: () => {
      const gs = getGameScene();
      if (!gs) return 'no game scene';
      const wave = (gs.waveManager?.getCurrentWave?.() || 0) + 1;
      gs.openWeaponSelectAfterBoss?.(wave);
      return `open weapon select before wave ${wave}`;
    },

    getWave: () => getGameScene()?.waveManager?.getCurrentWave?.() ?? -1,

    getEnemyCount: () => getGameScene()?.getEnemies?.()?.countActive?.(true) ?? -1,

    // 直接跳到指定波：startWave 会重置 waveTimer/spawnTimer 并生成对应敌人/Boss。
    // 注意：会跳过中间波次的商店/武器强化/突破奖励，仅用于快速定位特定波次玩法。
    jumpToWave: (n: number) => {
      const gs = getGameScene();
      if (!gs?.waveManager) return 'no game scene';
      gs.waveManager.waveActive = false;
      gs.waveManager.startWave(n);
      return `jumped to wave ${n}${n % GameConfig.WAVE.bossWaveInterval === 0 ? '（Boss 波）' : ''}`;
    },

    // 波次为计时制（waveDuration 到即 nextWave）：把 waveTimer 拨满，
    // 下一帧 update 即触发下一波/通关判定。配合 jumpToWave(n)+killAll 可快速走完单关。
    completeWave: () => {
      const gs = getGameScene();
      const wm = gs?.waveManager;
      if (!wm) return 'no game scene';
      wm.waveTimer = GameConfig.WAVE.waveDuration;
      return `wave ${wm.getCurrentWave()} timer -> end (2s 后进入下一波/通关结算)`;
    },

    openEndlessChoice: () => {
      const gs = getGameScene();
      if (!gs) return 'no game scene';
      gs.openEndlessChoice?.();
      return 'opened endless choice';
    },

    setGameSpeed: (speed: number) => {
      const gs = getGameScene();
      if (!gs?.setGameSpeed) return 'no game scene';
      gs.setGameSpeed(speed);
      return `game speed -> ${gs.getGameSpeed?.() ?? gs.gameSpeed}×`;
    },

    getGameSpeed: () => getGameScene()?.gameSpeed ?? 1,
  };

  (window as any).__debug = api;
  console.log('%c[DebugAPI] 已挂载到 window.__debug', 'color: #ffb347');
}
