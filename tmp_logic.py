# -*- coding: utf-8 -*-
import io

# ============ 1. Player.ts：角色应用（statBonus/starterWeapon/减伤/熟练加成） ============
p = r'C:\Projects\keep-living-h5\src\entities\Player.ts'
s = io.open(p, encoding='utf-8').read()

# 1a. import
old_imp = "import { WEAPONS } from '../data/weapons';"
new_imp = "import { WEAPONS } from '../data/weapons';\nimport { GameManager } from '../game/GameManager';"
assert s.count(old_imp) == 1, 'imp count=%d' % s.count(old_imp)
s = s.replace(old_imp, new_imp)

old_imp2 = "import { calcThornsReflect, calcOverflowAttack, calcOverflowCritRate, calcOverflowCritDamage, calcOverflowMaxHealth } from '../logic/player';"
new_imp2 = "import { calcThornsReflect, calcOverflowAttack, calcOverflowCritRate, calcOverflowCritDamage, calcOverflowMaxHealth, calcFavoredDamageMult } from '../logic/player';"
assert s.count(old_imp2) == 1, 'imp2 count=%d' % s.count(old_imp2)
s = s.replace(old_imp2, new_imp2)

# 1b. 构造：角色 statBonus 应用（插在 _baseStats 快照前）
old_stats = """    // percent 加算基准（含成就加成；局内升级/突破不再改它）
    this._baseStats = { ...this.stats };
    scene.add.existing(this);"""
new_stats = """    // 应用角色配置 statBonus（选角界面/存档决定；叠加在成就加成之上）
    const character = GameManager.getInstance().getActiveCharacter();
    if (character.statBonus) {
      const b = character.statBonus;
      if (b.maxHealth) {
        this.stats.maxHealth += b.maxHealth;
        this.stats.health += b.maxHealth;
      }
      if (b.attackPower) this.stats.attackPower += b.attackPower;
      if (b.moveSpeed) this.stats.moveSpeed += b.moveSpeed;
      if (b.critRate) this.stats.critRate += b.critRate;
      if (b.critDamage) this.stats.critDamage += b.critDamage;
    }
    // percent 加算基准（含成就/角色加成；局内升级/突破不再改它）
    this._baseStats = { ...this.stats };
    scene.add.existing(this);"""
assert s.count(old_stats) == 1, 'stats count=%d' % s.count(old_stats)
s = s.replace(old_stats, new_stats)

# 1c. 初始武器：角色 starterWeapon（缺省回退 default_gun）
old_w = "    // 初始武器（默认武器，配置来自统一数据源 src/data/weapons.ts）\n    this.addWeapon(WEAPONS['default_gun']);"
new_w = "    // 初始武器：角色 starterWeapon（缺省回退 default_gun；配置来自 src/data/weapons.ts）\n    this.addWeapon(WEAPONS[character.starterWeapon] ?? WEAPONS['default_gun']);"
assert s.count(old_w) == 1, 'weapon count=%d' % s.count(old_w)
s = s.replace(old_w, new_w)

# 1d. takeDamage：角色减伤（数据驱动 damageReduction）
old_td = "    const actualDamage = Math.max(1, amount - this.stats.defense);\n    this.stats.health -= actualDamage;"
new_td = "    let actualDamage = Math.max(1, amount - this.stats.defense);\n    // 角色减伤（圣骑士圣盾等，数据驱动：damageReduction=0.2 → ×0.8）\n    const reduction = GameManager.getInstance().getActiveCharacter().damageReduction ?? 0;\n    if (reduction > 0) actualDamage = Math.max(1, Math.floor(actualDamage * (1 - reduction)));\n    this.stats.health -= actualDamage;"
assert s.count(old_td) == 1, 'td count=%d' % s.count(old_td)
s = s.replace(old_td, new_td)

# 1e. calcWeaponDamage：熟练系别加成
old_cd = """    const raw = (config.damage * (1 + level * 0.2) * attackPower) / 10;
    return isFinite(raw) && raw > 0 ? raw : config.damage;"""
new_cd = """    const raw = (config.damage * (1 + level * 0.2) * attackPower) / 10;
    const base = isFinite(raw) && raw > 0 ? raw : config.damage;
    // 角色熟练系别加成（机械师枪械/圣骑士近战范围 +20% 等；数据驱动，公式见 logic/player.calcFavoredDamageMult）
    const character = GameManager.getInstance().getActiveCharacter();
    const mult = calcFavoredDamageMult(config.tags, character.favoredTags, character.favoredBonus?.damageMult);
    return base * mult;"""
assert s.count(old_cd) == 1, 'cd count=%d' % s.count(old_cd)
s = s.replace(old_cd, new_cd)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('Player OK')

# ============ 2. GameManager.ts：角色持久化 ============
p2 = r'C:\Projects\keep-living-h5\src\game\GameManager.ts'
s2 = io.open(p2, encoding='utf-8').read()

old_gm = """  /** 切换激活角色；未知 id 拒绝并返回 false */
  setActiveCharacterId(id: string): boolean {
    if (CHARACTERS[id]) {
      this._activeCharacterId = id;
      return true;
    }
    return false;
  }"""
new_gm = """  /** 切换激活角色；未知 id 拒绝并返回 false（写入存档 settings，下次启动保持） */
  setActiveCharacterId(id: string): boolean {
    if (CHARACTERS[id]) {
      this._activeCharacterId = id;
      this.saveProgress();
      return true;
    }
    return false;
  }"""
assert s2.count(old_gm) == 1, 'gm count=%d' % s2.count(old_gm)
s2 = s2.replace(old_gm, new_gm)

old_lp = """      // 恢复设置（画质、音量、静音）
      if (data.settings) {
        this._qualityLevel = data.settings.quality || 'medium';
        this._showFps = data.settings.showFps ?? false;"""
new_lp = """      // 恢复设置（画质、音量、静音、激活角色）
      if (data.settings) {
        this._qualityLevel = data.settings.quality || 'medium';
        this._showFps = data.settings.showFps ?? false;
        // 恢复激活角色（老存档缺省 default；未知 id 回退默认）
        if (data.settings.activeCharacterId && CHARACTERS[data.settings.activeCharacterId]) {
          this._activeCharacterId = data.settings.activeCharacterId;
        }"""
assert s2.count(old_lp) == 1, 'lp count=%d' % s2.count(old_lp)
s2 = s2.replace(old_lp, new_lp)

old_sp = """        muted: audio.isMuted(),
        showFps: this._showFps,
      },"""
new_sp = """        muted: audio.isMuted(),
        showFps: this._showFps,
        activeCharacterId: this._activeCharacterId,
      },"""
assert s2.count(old_sp) == 1, 'sp count=%d' % s2.count(old_sp)
s2 = s2.replace(old_sp, new_sp)

io.open(p2, 'w', encoding='utf-8', newline='\n').write(s2)
print('GameManager OK')
