// 临时脚本：WaveManager.nextWave 改为 Boss 波前先开商店
import { readFileSync, writeFileSync } from 'node:fs';
const p = 'src/systems/WaveManager.ts';
let s = readFileSync(p, 'utf8');

const re = /\/\*\* 进入下一波 \*\/\r?\n  private nextWave\(\): void \{\r?\n    this\.waveActive = false;\r?\n\r?\n    \/\/ 短暂间隔后开始下一波\r?\n    this\.scene\.time\.delayedCall\(2000, \(\) => \{\r?\n      this\.startWave\(this\.currentWave \+ 1\);\r?\n    \}\);\r?\n  \}/;

const neu = `/** 进入下一波 */
  private nextWave(): void {
    this.waveActive = false;

    const next = this.currentWave + 1;
    const isBossWave = next % GameConfig.WAVE.bossWaveInterval === 0;

    // 短暂间隔后开始下一波；Boss 波前先弹商店（战前补给点），商店关闭后再开打
    this.scene.time.delayedCall(2000, () => {
      if (isBossWave) {
        (this.scene as any).openShopBeforeBoss?.(next);
      } else {
        this.startWave(next);
      }
    });
  }`;

if (!re.test(s)) {
  console.error('NOT FOUND: nextWave');
  process.exit(1);
}
s = s.replace(re, neu);
writeFileSync(p, s);
console.log('OK: WaveManager.nextWave updated');
