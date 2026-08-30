import type Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { USABLE_ITEMS } from '../data/items';

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
      const uiScene = getScene('UIScene');
      // GuideManager 绑定在 UIScene 上，尝试调用其隐藏方法
      const guide = (uiScene as any)?.guideManager || (window as any).GuideManager;
      if (guide?.getInstance) {
        guide.getInstance().hide?.();
        guide.getInstance()?.clearQueue?.();
      }
      // 兜底：直接销毁引导卡片
      const guideCard = (uiScene as any)?.guideCard;
      guideCard?.destroy?.();
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
  };

  (window as any).__debug = api;
  console.log('%c[DebugAPI] 已挂载到 window.__debug', 'color: #ffb347');
}
