/**
 * 成就系统自测脚本（浏览器内执行）
 *
 * 用法：
 *   1. 打开游戏（dev server）后，在浏览器控制台执行：
 *        window.__debug.resetAchievements()   // 清空成就（会自动刷新页面）
 *   2. 页面刷新完成后，执行本文件内容（粘贴到控制台，或经自动化工具注入）
 *   3. 等待数秒（脚本内含多次开局/跳波），结果写入 window.__achTestResult
 *
 * 覆盖：
 *   A. 累计型 14 个：注入全局统计达标 → 事件触发全量检查 → 断言解锁
 *   B. 单局判定型 5 个：player:coins / run:end（注意字段是 isVictory）→ 断言解锁
 *   C. meta 系列 3 个：连环解锁（含"解锁全部"死锁回归）
 *   D. 永久加成汇总 == 全部成就 reward.bonuses 累加
 *   E. 玩家新开一局初始属性 == 基础值 + 成就加成（闭环验证）
 */
window.__achTestResult = null;
(async () => {
  const out = { ok: [], fail: [], notes: [], bonuses: null, expected: null, player: null };
  const push = (id, name, cond, note) => {
    (cond ? out.ok : out.fail).push(id);
    out.notes.push((cond ? 'PASS' : 'FAIL') + ' ' + id + ' ' + (name || '') + (note ? ' | ' + note : ''));
  };
  try {
    const [{ AchievementManager }, { GameManager }, { EventBus }, { ACHIEVEMENTS }, { WEAPONS }, { GameConfig }] = await Promise.all([
      import('/src/systems/AchievementManager.ts'),
      import('/src/game/GameManager.ts'),
      import('/src/utils/EventBus.ts'),
      import('/src/data/achievements.ts'),
      import('/src/data/weapons.ts'),
      import('/src/game/GameConfig.ts'),
    ]);
    const am = AchievementManager.getInstance();
    const gm = GameManager.getInstance();
    am.init();

    // A. 累计型
    const allWeaponIds = Object.keys(WEAPONS);
    gm.mutateStats((s) => {
      s.totalKills = 1000;
      s.bossesKilled = 10;
      s.wins = 3;
      s.maxWaveReached = 90;
      s.totalCoinsEarned = 2000;
      s.totalCoinsSpent = 500;
      s.weaponsCollected = [...allWeaponIds];
    });
    EventBus.emit('run:wave', 90);
    ['survive_wave_5','survive_wave_10','win_once','win_all','kill_100','kill_500','kill_1000','boss_5','boss_10','weapon_all','coins_500','coins_2000','shop_500','hidden_90'].forEach((id) => {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      push(id, def ? def.name : id, am.isUnlocked(id));
    });

    // B1. hoard_300
    EventBus.emit('player:coins', 300);
    push('hoard_300', '守财奴', am.isUnlocked('hoard_300'));

    // B2. weapon_max / starter_only / hidden_nohit（单武器满级无伤通关）
    window.__debug.startGame();
    await new Promise((r) => setTimeout(r, 1500));
    const gs = window.__game?.scene?.getScene?.('GameScene');
    const player = gs?.getPlayer?.();
    if (!player) throw new Error('no player after startGame');
    const map = player.weapons;
    if (map && map.forEach) map.forEach((w) => { w.level = w.config.maxLevel; });
    EventBus.emit('run:end', { isVictory: true, wave: 1 });
    ['weapon_max','starter_only','hidden_nohit'].forEach((id) => {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      push(id, def ? def.name : id, am.isUnlocked(id));
    });

    // B3. hidden_bossdeath（失败 + 场上 Boss 存活）
    window.__debug.jumpToWave(15);
    await new Promise((r) => setTimeout(r, 3500));
    EventBus.emit('run:end', { isVictory: false, wave: 15 });
    push('hidden_bossdeath', '陨落者', am.isUnlocked('hidden_bossdeath'));

    // C. meta 系列
    ['meta_5','meta_10','meta_all'].forEach((id) => {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      push(id, def ? def.name : id, am.isUnlocked(id), 'count=' + am.unlockedCount);
    });

    // D. 加成汇总
    const expected = {};
    ACHIEVEMENTS.forEach((a) => { if (a.reward.bonuses) for (const [k, v] of Object.entries(a.reward.bonuses)) expected[k] = (expected[k] ?? 0) + v; });
    const actual = am.getBonusSummary();
    out.expected = expected; out.bonuses = actual;
    let bonusOk = true;
    new Set([...Object.keys(expected), ...Object.keys(actual)]).forEach((k) => {
      const e = expected[k] ?? 0, a2 = actual[k] ?? 0;
      if (Math.abs(e - a2) > 1e-9) { bonusOk = false; out.notes.push('BONUS MISMATCH ' + k + ': exp ' + e + ' got ' + a2); }
    });
    push('bonuses_total', '永久加成汇总', bonusOk, JSON.stringify(actual));

    // E. 玩家初始属性应用加成
    window.__debug.backToMenu();
    await new Promise((r) => setTimeout(r, 900));
    window.__debug.startGame();
    await new Promise((r) => setTimeout(r, 1800));
    const gs2 = window.__game?.scene?.getScene?.('GameScene');
    const p2 = gs2?.getPlayer?.();
    if (p2) {
      const st = p2.getStats();
      const eHp = GameConfig.PLAYER.maxHealth + (actual.maxHealth ?? 0);
      const eAtk = GameConfig.PLAYER.baseAttackPower + (actual.attackPower ?? 0);
      const eCrit = GameConfig.PLAYER.baseCritRate + (actual.critRate ?? 0);
      out.player = { maxHealth: st.maxHealth, eHp, atk: st.attackPower, eAtk, crit: st.critRate, eCrit };
      push('player_bonus', '加成应用到玩家', st.maxHealth === eHp && Math.abs(st.attackPower - eAtk) < 1e-9 && Math.abs(st.critRate - eCrit) < 1e-9, JSON.stringify(out.player));
    } else push('player_bonus', '加成应用到玩家', false, 'no player');
  } catch (e) {
    out.fail.push('SCRIPT_ERROR');
    out.notes.push('EXCEPTION: ' + ((e && e.stack) || e));
  }
  window.__achTestResult = out;
})();
