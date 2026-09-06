import { createUIText } from '../utils/UIText';
import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { GameConfig } from '../game/GameConfig';
import { setupUICamera } from '../utils/CameraHelper';
import { SOUND_KEYS } from '../data/sounds';
import { AudioManager } from '../systems/AudioManager';

/**
 * 游戏结束场景
 * 显示本局成绩、统计数据，提供重新开始和返回主菜单选项
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  // 结算模式：'victory' 通关成功 / 'defeat' 游戏结束（默认）
  private mode: 'victory' | 'defeat' = 'defeat';

  init(data: { mode?: 'victory' | 'defeat' }): void {
    this.mode = data?.mode ?? 'defeat';
  }

  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);
    const gm = GameManager.getInstance();
    const runData = gm.runData;
    const stats = gm.stats;
    const centerX = width / 2;
    const isVictory = this.mode === 'victory';

    // 音效：胜利/失败分开（胜利音效资源缺失时 playSfx 静默失败，不阻塞流程）
    AudioManager.getInstance().playSfx(
      isVictory ? SOUND_KEYS.SFX_VICTORY : SOUND_KEYS.SFX_GAME_OVER,
      1
    );

    // 背景：胜利用金色暗调，失败用冷黑
    this.add.rectangle(0, 0, width, height, isVictory ? 0x120d04 : 0x0a0a0f).setOrigin(0);

    // 标题
    createUIText(this, centerX, height * 0.18, isVictory ? '通关成功！' : '游戏结束', {
        fontSize: '52px',
        color: isVictory ? '#ffd700' : '#ff4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 胜利副标题（失败不显示）
    if (isVictory) {
      createUIText(this, centerX, height * 0.18 + 48, '完成第 ' + runData.wave + ' 波，成功存活！', {
          fontSize: '20px',
          color: '#ffb347',
        })
        .setOrigin(0.5);
    }

    // 本局数据
    const dataY = height * 0.4;
    const lineHeight = 40;

    const statsData = [
      { label: '存活时间', value: this.formatTime(runData.survivalTime) },
      { label: isVictory ? '通关波次' : '到达波次', value: `${runData.wave}` },
      { label: '击杀数', value: `${runData.kills}` },
      { label: '本局得分', value: `${runData.score}` },
      { label: '历史最高分', value: `${stats.highScore}` },
    ];

    statsData.forEach((item, i) => {
      const y = dataY + i * lineHeight;
      createUIText(this, centerX - 100, y, item.label, {
          fontSize: '20px',
          color: '#888888',
        })
        .setOrigin(0, 0.5);

      createUIText(this, centerX + 100, y, item.value, {
          fontSize: '20px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);
    });

    // 新纪录徽章（右下角，仪式感动画）：金色辉光标题 + 副标题 + 光晕呼吸 + 星点闪烁 + 弹跳入场
    if (runData.score >= stats.highScore && runData.score > 0) {
      // 标题右侧同一行：不遮挡中央数据列表与底部按钮（标题居中 x=480，徽章中心 x=710 安全留白）
      const bx = width * 0.74;
      const by = height * 0.18;
      const badge = this.add.container(bx, by);

      // 光晕层（双层呼吸，收敛半径避免与标题/数据区重叠）
      const glow = this.add.circle(0, 0, 58, 0xffd700, 0.12);
      const glow2 = this.add.circle(0, 0, 36, 0xffb347, 0.18);
      badge.add([glow, glow2]);

      // 主标题：大号金色 + 橙色辉光阴影
      const title = createUIText(this, 0, -6, '新纪录！', {
          fontSize: '36px',
          color: '#ffd700',
          fontStyle: 'bold',
          shadow: { color: '#ff8c00', blur: 14, offsetX: 0, offsetY: 0 },
        })
        .setOrigin(0.5);
      badge.add(title);

      // 副标题
      const sub = createUIText(this, 0, 32, '历史最高分已刷新', {
          fontSize: '14px',
          color: '#ffb347',
          shadow: { color: '#000000', blur: 0, offsetX: 0, offsetY: 0 },
        })
        .setOrigin(0.5);
      badge.add(sub);

      // 环绕星点（错峰闪烁）
      const stars: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const rad = 46 + Math.random() * 20;
        const s = this.add
          .circle(Math.cos(ang) * rad, Math.sin(ang) * rad, 2 + Math.random() * 2, 0xffe9a8, 0.9)
          .setAlpha(0);
        stars.push(s);
        badge.add(s);
      }

      // 入场：延迟 0.6s（先看数据再看纪录），弹跳放大 + 渐入
      badge.setScale(0).setAlpha(0);
      this.tweens.add({
        targets: badge,
        scale: 1.18,
        alpha: 1,
        duration: 320,
        delay: 600,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({ targets: badge, scale: 1, duration: 180, ease: 'Back.Out' });
        },
      });
      // 光晕呼吸
      this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.04, duration: 950, yoyo: true, repeat: -1, delay: 950 });
      this.tweens.add({ targets: glow2, scale: 1.22, alpha: 0.08, duration: 1250, yoyo: true, repeat: -1, delay: 950 });
      // 星点闪烁
      stars.forEach((s, i) => {
        this.tweens.add({
          targets: s,
          alpha: 0.15,
          duration: 350 + i * 90,
          delay: 950 + i * 70,
          yoyo: true,
          repeat: -1,
          repeatDelay: 300,
        });
      });
    }

    // 按钮
    const buttonY = height * 0.75;
    this.createButton(centerX - 120, buttonY, '再来一局', () => this.restart());
    this.createButton(centerX + 120, buttonY, '主菜单', () => this.toMenu());
  }

  private createButton(x: number, y: number, text: string, callback: () => void): void {
    const btn = createUIText(this, x, y, text, {
        fontSize: '22px',
        color: '#e0e0e0',
        backgroundColor: '#1a1a25',
        padding: { left: 30, right: 30, top: 12, bottom: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      btn.setStyle({ color: '#ff6b35', backgroundColor: '#2a2a35' });
    });
    btn.on('pointerout', () => {
      btn.setStyle({ color: '#e0e0e0', backgroundColor: '#1a1a25' });
    });
    btn.on('pointerdown', callback);
  }

  private restart(): void {
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  private toMenu(): void {
    this.scene.start('MainMenuScene');
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
