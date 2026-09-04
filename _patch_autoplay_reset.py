# -*- coding: utf-8 -*-
import io, os

def load(p):
    raw = io.open(p, encoding='utf-8', newline='').read()
    eol = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), eol

def save(p, s, eol):
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', eol))

# 选择场景实例复用：stop 后再次 launch 会重新 create，autoTriggered 必须每次 create 重置，
# 否则残留 true 导致后续自动选择被防重跳过（升级排队第二个界面卡住）。
ANCHOR = """  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);"""
RESET = """  create(): void {
    // UI 相机统一设置（zoom + scroll 补偿，返回逻辑分辨率 960x640）
    const { width, height } = setupUICamera(this);
    // 场景实例会复用：stop 后再 launch 重新走 create，自动选择标记必须重置
    this.autoTriggered = false;"""

for name in ['src/scenes/UpgradeScene.ts', 'src/scenes/WeaponSelectScene.ts', 'src/scenes/BreakthroughScene.ts', 'src/scenes/EndlessChoiceScene.ts']:
    s, e = load(name)
    assert ANCHOR in s, name + ' anchor missing'
    s = s.replace(ANCHOR, RESET, 1)
    save(name, s, e)
    print(name, 'reset OK')

try:
    os.remove(__file__)
    print('self-cleaned')
except Exception:
    pass
