import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { CHARACTERS, type CharacterConfig } from '../data/characters';
import { createUIText } from '../utils/UIText';

/**
 * 角色选择场景（选角系统第一步）
 * 展示全部角色卡片（数值/熟练系别/独特被动），点击切换激活角色并持久化（存档 settings.activeCharacterId）。
 * 布局：宽屏 3 卡横排，窄屏（<700）竖排；当前选中角色橙色高亮。
 */
export class CharacterSelectScene extends Phaser.Scene {
  private cardGroups: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('CharacterSelectScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0a0f');

    createUIText(this, width / 2, 56, '选择角色', { fontSize: '34px', color: '#ff6b35' }).setOrigin(0.5);
    createUIText(this, width / 2, 96, '不同角色拥有不同的武器熟练与独特被动', {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5);

    const ids = Object.keys(CHARACTERS);
    const isMobile = width < 700;
    const cardW = isMobile ? Math.min(width - 80, 520) : 260;
    const cardH = isMobile ? 148 : 310;
    const gap = isMobile ? 16 : 24;
    const startY = isMobile ? 140 : 170;

    ids.forEach((id, i) => {
      let x: number;
      let y: number;
      if (isMobile) {
        x = width / 2;
        y = startY + i * (cardH + gap);
      } else {
        const totalW = ids.length * cardW + (ids.length - 1) * gap;
        x = (width - totalW) / 2 + cardW / 2 + i * (cardW + gap);
        y = startY;
      }
      this.createCard(CHARACTERS[id], x, y, cardW, cardH, id === GameManager.getInstance().getActiveCharacterId());
    });

    // 底部说明
    createUIText(this, width / 2, height - 44, '点击角色切换，返回后开始游戏生效', {
      fontSize: '13px',
      color: '#777777',
    }).setOrigin(0.5);

    // 返回按钮
    const backBtn = createUIText(this, width - 16, 16, '‹ 返回', {
      fontSize: '18px',
      color: '#cccccc',
      backgroundColor: 'rgba(255,255,255,0.08)',
      padding: { x: 12, y: 6 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));

    // 开始冒险：选完角色直接进关卡选择（无需先回主菜单再点开始）
    const playBtn = createUIText(this, width - 16, height - 16, '▶ 开始冒险', {
      fontSize: '18px',
      color: '#ff6b35',
      backgroundColor: 'rgba(255,107,53,0.15)',
      padding: { x: 14, y: 6 },
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    playBtn.on('pointerdown', () => this.scene.start('MainMenuScene', { openLevelSelect: true }));
  }

  private createCard(config: CharacterConfig, x: number, y: number, w: number, h: number, selected: boolean): void {
    const gfx = this.add.graphics();
    const draw = () => {
      gfx.clear();
      gfx.fillStyle(selected ? 0x2a2018 : 0x16161d, 1);
      gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      gfx.lineStyle(selected ? 3 : 1, selected ? 0xff6b35 : 0x2a2a35, 1);
      gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    draw();

    const container = this.add.container(x, y, [gfx]);
    const texts: Phaser.GameObjects.Text[] = [];
    const pad = 18;
    const isNarrow = w < 400;

    texts.push(
      createUIText(this, 0, -h / 2 + 34, config.name, {
        fontSize: isNarrow ? '24px' : '26px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    texts.push(
      createUIText(this, 0, -h / 2 + 66, config.description, {
        fontSize: '12px',
        color: '#aaaaaa',
        align: 'center',
        wordWrap: { width: w - pad * 2 },
      }).setOrigin(0.5)
    );

    if (config.passiveDesc) {
      texts.push(
        createUIText(this, 0, -h / 2 + (isNarrow ? 108 : 132), config.passiveDesc, {
          fontSize: '12px',
          color: '#ff9a6b',
          align: 'center',
          wordWrap: { width: w - pad * 2 },
        }).setOrigin(0.5)
      );
    }

    const favored = config.favoredTags?.length
      ? `熟练系别：${config.favoredTags.map((t) => TAG_NAMES[t] ?? t).join('、')}`
      : '全武器均衡';
    texts.push(
      createUIText(this, 0, -h / 2 + (isNarrow ? 92 : 180), favored, {
        fontSize: '13px',
        color: config.favoredTags?.length ? '#6bd5ff' : '#8a8a8a',
      }).setOrigin(0.5)
    );

    if (config.statBonus) {
      const parts: string[] = [];
      const b = config.statBonus;
      if (b.maxHealth) parts.push(`生命+${b.maxHealth}`);
      if (b.attackPower) parts.push(`攻击+${b.attackPower}`);
      if (b.moveSpeed) parts.push(`移速+${b.moveSpeed}`);
      if (b.critRate) parts.push(`暴击+${Math.round(b.critRate * 100)}%`);
      if (b.critDamage) parts.push(`爆伤+${Math.round(b.critDamage * 100)}%`);
      if (parts.length) {
        texts.push(
          createUIText(this, 0, -h / 2 + (isNarrow ? 132 : 210), parts.join('  '), {
            fontSize: '12px',
            color: '#7ee0a0',
          }).setOrigin(0.5)
        );
      }
    }

    if (selected) {
      texts.push(
        createUIText(this, 0, h / 2 - 18, '✓ 当前角色', { fontSize: '13px', color: '#ff6b35' }).setOrigin(0.5)
      );
    }

    container.add(texts);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      if (GameManager.getInstance().setActiveCharacterId(config.id)) {
        this.rebuild();
      }
    });
    this.cardGroups.push(container);
  }

  /** 切换角色后重建场景，刷新高亮（简单可靠，避免逐卡状态管理） */
  private rebuild(): void {
    this.scene.restart();
  }
}

const TAG_NAMES: Record<string, string> = {
  gun: '枪械',
  melee: '近战',
  aoe: '范围',
  summon: '召唤',
  heavy: '爆破',
};
