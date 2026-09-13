import Phaser from 'phaser';
import { GameManager } from '../game/GameManager';
import { CHARACTERS, type CharacterConfig } from '../data/characters';
import { createUIText } from '../utils/UIText';
import { setupUICamera } from '../utils/CameraHelper';
import { GameConfig } from '../game/GameConfig';
import { UIColors, UIFonts, createSceneTitle, createBackButton, createUIButton } from '../ui/UIStyle';

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
    // UI 相机统一设置：zoom + scroll 补偿，返回逻辑分辨率 960x640（与其他菜单场景一致）
    this.cameras.main.setZoom(GameConfig.uiScale);
    const { width, height } = setupUICamera(this);
    this.cameras.main.setBackgroundColor('#' + UIColors.sceneBg.toString(16).padStart(6, '0'));

    createSceneTitle(this, width / 2, 56, '选择角色');
    createUIText(this, width / 2, 96, '不同角色拥有不同的武器熟练与独特被动', {
      fontSize: '14px',
      color: UIColors.textDim,
    }).setOrigin(0.5);

    const ids = Object.keys(CHARACTERS);
    const isMobile = width < 700;
    const cardW = isMobile ? Math.min(width - 80, 520) : 260;
    const cardH = isMobile ? 148 : 350;
    const gap = isMobile ? 16 : 24;
    const startY = isMobile ? 140 : 150;

    ids.forEach((id, i) => {
      let x: number;
      let y: number;
      if (isMobile) {
        x = width / 2;
        y = startY + cardH / 2 + i * (cardH + gap);
      } else {
        const totalW = ids.length * cardW + (ids.length - 1) * gap;
        x = (width - totalW) / 2 + cardW / 2 + i * (cardW + gap);
        y = startY + cardH / 2;
      }
      this.createCard(CHARACTERS[id], x, y, cardW, cardH, id === GameManager.getInstance().getActiveCharacterId());
    });

    // 底部说明
    createUIText(this, width / 2, height - 44, '点击角色切换，点「开始冒险」进入选关', {
      fontSize: UIFonts.small,
      color: UIColors.textFaint,
    }).setOrigin(0.5);

    // 返回按钮（统一左上角，与图鉴/成就页一致）
    const backBtn = createBackButton(this, 60, 44, () => this.scene.start('MainMenuScene'));

    // 开始冒险：选完角色直接进关卡选择（无需先回主菜单再点开始）
    const playBtn = createUIButton(this, width - 16, height - 16, '▶ 开始冒险', () => this.scene.start('MainMenuScene', { openLevelSelect: true }), {
      fontSize: UIFonts.body,
      color: UIColors.accent,
      bg: UIColors.accentBg,
      bgHover: '#3a2a20',
      padding: { left: 14, right: 14, top: 6, bottom: 6 },
    }).setOrigin(1, 1);
  }

  private createCard(config: CharacterConfig, x: number, y: number, w: number, h: number, selected: boolean): void {
    const gfx = this.add.graphics();
    const draw = () => {
      gfx.clear();
      gfx.fillStyle(selected ? UIColors.cardActive : UIColors.card, 1);
      gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      gfx.lineStyle(selected ? 3 : 1, selected ? UIColors.accentDim : UIColors.cardBorder, 1);
      gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    draw();

    const container = this.add.container(x, y, [gfx]);
    const texts: Phaser.GameObjects.Text[] = [];
    const pad = 18;
    // isNarrow：仅极小卡片用紧凑版；桌面 260 卡 / 手机 520 卡均走标准分层布局
    const isNarrow = w < 180 || h < 250;

    if (!isNarrow) {
      const iconBg = this.add.graphics();
      iconBg.fillStyle(0x2a2a35, 1);
      iconBg.fillCircle(0, -h / 2 + 62, 30);
      container.add(iconBg);
      texts.push(
        createUIText(this, 0, -h / 2 + 62, config.icon, {
          fontSize: '26px',
        }).setOrigin(0.5)
      );
    }

    texts.push(
      createUIText(this, 0, -h / 2 + (isNarrow ? 30 : 122), config.name, {
        fontSize: isNarrow ? '24px' : '26px',
        color: UIColors.textBright,
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    texts.push(
      createUIText(this, 0, -h / 2 + (isNarrow ? 58 : 150), config.description, {
        fontSize: '12px',
        color: UIColors.textDim,
        align: 'center',
        wordWrap: { width: w - pad * 2 },
      }).setOrigin(0.5)
    );

    if (config.passiveDesc) {
      if (!isNarrow) {
        const passiveY = -h / 2 + 196;
        const descBg = this.add.graphics();
        descBg.fillStyle(0x000000, 0.35);
        descBg.fillRoundedRect(-(w - 20) / 2, passiveY - 39, w - 20, 78, 6);
        container.add(descBg);
      }
      texts.push(
        createUIText(this, 0, -h / 2 + (isNarrow ? 88 : 196), config.passiveDesc, {
          fontSize: '12px',
          color: isNarrow ? UIColors.accentSoft : '#cccccc',
          align: 'center',
          wordWrap: { width: w - pad * 2 - (isNarrow ? 0 : 12) },
        }).setOrigin(0.5)
      );
    }

    const favored = config.favoredTags?.length
      ? `熟练系别：${config.favoredTags.map((t) => TAG_NAMES[t] ?? t).join('、')}`
      : '全武器均衡';
    texts.push(
      createUIText(this, 0, -h / 2 + (isNarrow ? 112 : 244), favored, {
        fontSize: '13px',
        color: config.favoredTags?.length ? UIColors.blue : UIColors.textDim,
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
          createUIText(this, 0, -h / 2 + (isNarrow ? 132 : 268), parts.join('  '), {
            fontSize: '12px',
            color: UIColors.green,
          }).setOrigin(0.5)
        );
      }
    }

    if (selected && !isNarrow) {
      texts.push(
        createUIText(this, 0, h / 2 - 18, '✓ 当前角色', { fontSize: UIFonts.small, color: UIColors.accent }).setOrigin(0.5)
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
