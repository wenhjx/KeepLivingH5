import Phaser from 'phaser';

/**
 * 浮动伤害数字管理器（池化）
 * 子弹命中/暴击时在命中位置弹出伤害数字：普通白字上飘、暴击大号金字带"!"
 */
export class DamageTextManager {
  private scene: Phaser.Scene;
  private pool: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(x: number, y: number, damage: number, isCrit: boolean = false): void {
    let text = this.pool.pop();
    if (!text) {
      text = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });
      text.setOrigin(0.5);
      text.setDepth(20);
    }

    const value = String(Math.round(damage));
    if (isCrit) {
      text.setColor('#ffd700');
      text.setFontSize(26);
      text.setStroke('#7a5200', 4);
      text.setText(value + '!');
    } else {
      text.setColor('#ffffff');
      text.setFontSize(16);
      text.setStroke('#000000', 3);
      text.setText(value);
    }

    text.setPosition(x + Phaser.Math.Between(-10, 10), y - 12);
    text.setAlpha(1);
    text.setVisible(true);
    text.setActive(true);

    this.scene.tweens.add({
      targets: text,
      y: text.y - (isCrit ? 52 : 34),
      alpha: 0,
      duration: isCrit ? 900 : 650,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        text.setVisible(false);
        text.setActive(false);
        this.pool.push(text);
      },
    });
  }

  /** 自定义文本飘字（宝箱/事件等非伤害提示），支持任意字符串与颜色 */
  showText(x: number, y: number, text: string, color: string = '#ffffff'): void {
    let t = this.pool.pop();
    if (!t) {
      t = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      });
      t.setOrigin(0.5);
      t.setDepth(20);
    }
    t.setColor(color);
    t.setFontSize(15);
    t.setStroke('#000000', 3);
    t.setText(text);
    t.setPosition(x + Phaser.Math.Between(-8, 8), y - 10);
    t.setAlpha(1);
    t.setVisible(true);
    t.setActive(true);
    this.scene.tweens.add({
      targets: t,
      y: t.y - 40,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        t.setVisible(false);
        t.setActive(false);
        this.pool.push(t);
      },
    });
  }
}
