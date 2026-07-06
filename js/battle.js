// js/battle.js
// 遭遇、敵人生成、回合順序、傷害、技能、道具、逃跑、戰鬥結束。
window.Abyss = window.Abyss || {};

window.Abyss.Battle = (function () {
  "use strict";

  const ENEMY_STEP_MS = 480; // 敵人依序行動的間隔，讓戰鬥紀錄易讀。

  let dom = null;
  let state = null;
  let player = null;
  let config = null;

  function data() { return window.GAME_DATA || {}; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function cacheDom() {
    dom = {
      screen: document.getElementById("screen-battle"),
      enemies: document.getElementById("battle-enemies"),
      log: document.getElementById("battle-log"),
      hint: document.getElementById("battle-hint"),
      submenu: document.getElementById("battle-submenu"),
      actions: document.getElementById("battle-actions"),
      pName: document.getElementById("battle-player-name"),
      pLv: document.getElementById("battle-player-lv"),
      pHpText: document.getElementById("battle-player-hp"),
      pHpBar: document.getElementById("battle-player-hpbar"),
      pMpText: document.getElementById("battle-player-mp"),
      pMpBar: document.getElementById("battle-player-mpbar"),
      pExpBar: document.getElementById("battle-player-expbar"),
      pExpText: document.getElementById("battle-player-exp"),
      pCls: document.getElementById("battle-player-cls"),
      portrait: document.getElementById("battle-portrait"),
      round: document.getElementById("battle-round"),
      area: document.getElementById("battle-area")
    };
  }

  // ---- 敵人生成 ----
  // 依權重挑選 1~5 隻；數量越多，單體 maxHp/attack/exp 越弱。
  function pickCount(weights) {
    const entries = Object.keys(weights).map(function (k) {
      return { n: parseInt(k, 10), w: weights[k] };
    });
    let total = entries.reduce(function (s, e) { return s + e.w; }, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < entries.length; i++) {
      roll -= entries[i].w;
      if (roll <= 0) return entries[i].n;
    }
    return entries[0].n;
  }

  function makeEnemyInstance(baseId, multiplier, indexLabel) {
    const base = data().monsters[baseId];
    const maxHp = Math.max(1, Math.round(base.maxHp * multiplier));
    const attack = Math.max(1, Math.round(base.attack * multiplier));
    const exp = Math.max(1, Math.round(base.exp * multiplier));
    return {
      baseId: baseId,
      name: indexLabel ? base.name + " " + indexLabel : base.name,
      codexId: base.codexId,
      maxHp: maxHp,
      hp: maxHp,
      attack: attack,
      defense: base.defense,
      speed: base.speed,
      exp: exp,
      isBoss: !!base.boss,
      skills: base.skills || [],
      alive: true,
      status: {} // { burn:{turns,dmg}, stun:{turns}, defUp:{turns,amount} }
    };
  }

  function generateNormalEncounter(enc) {
    const count = pickCount(enc.countWeights);
    const mult = enc.strengthMultipliers[count] || 1;
    const enemies = [];
    // 依相同名稱是否重複來決定要不要標號。
    const chosen = [];
    for (let i = 0; i < count; i++) {
      const id = enc.monsterPool[randInt(0, enc.monsterPool.length - 1)];
      chosen.push(id);
    }
    const nameCount = {};
    chosen.forEach(function (id) { nameCount[id] = (nameCount[id] || 0) + 1; });
    const seen = {};
    chosen.forEach(function (id) {
      let label = "";
      if (nameCount[id] > 1) {
        seen[id] = (seen[id] || 0) + 1;
        label = String(seen[id]);
      }
      enemies.push(makeEnemyInstance(id, mult, label));
    });
    return enemies;
  }

  function generateBossEncounter(enc) {
    return [makeEnemyInstance(enc.bossId, 1, "")];
  }

  // ---- 對外入口 ----
  // opts: { player, isBoss, encounter, bossLines, onEnd }
  function start(opts) {
    if (!dom) cacheDom();
    if (window.Abyss.Effects) window.Abyss.Effects.reset();
    player = opts.player;
    config = opts;

    const enc = opts.encounter;
    // fixedFoes：指定固定敵人（例如寶箱怪擬態），不走隨機池。
    let enemies;
    if (opts.fixedFoes && opts.fixedFoes.length) {
      enemies = opts.fixedFoes.map(function (id) { return makeEnemyInstance(id, 1, ""); });
    } else {
      enemies = opts.isBoss ? generateBossEncounter(enc) : generateNormalEncounter(enc);
    }

    state = {
      enemies: enemies,
      isBoss: !!opts.isBoss,
      round: 1,
      phase: "idle", // idle | awaitTarget | busy
      pending: null,
      log: []
    };

    // 圖鑑解鎖。
    enemies.forEach(function (e) {
      if (window.Abyss.Save) window.Abyss.Save.unlockMonster(e.codexId);
    });

    // 玩家的臨時狀態於每場戰鬥開始時清空（不影響當輪等級/道具）。
    player.status = {};
    player.cooldowns = {};

    // 重置紀錄 DOM。
    if (dom.log) dom.log.innerHTML = "";

    if (opts.isBoss) {
      const line = (opts.bossLines && opts.bossLines.open) || "報上姓名。";
      log("赫爾蒙：「" + line + "」");
    } else {
      log("遭遇 " + enemies.length + " 隻敵人！");
    }

    startPlayerTurn(true);
    renderAll();
  }

  // ---- 紀錄與渲染 ----
  function log(msg) {
    state.log.push(msg);
    if (state.log.length > 60) state.log.shift();
    if (dom && dom.log) {
      const line = document.createElement("div");
      // 依內容上色：傷害＝紅、狀態/效果＝金、其餘＝一般。
      let cls = "log-line";
      if (/傷害|受到|扣/.test(msg)) cls += " dmg";
      else if (/效果|流血|燃燒|暈眩|閃避|防禦|中毒|恢復|冷卻/.test(msg)) cls += " eff";
      line.className = cls;
      line.textContent = msg;
      dom.log.appendChild(line);
      dom.log.scrollTop = dom.log.scrollHeight;
    }
  }

  function pct(cur, max) {
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  function renderPlayer() {
    dom.pName.textContent = player.className;
    dom.pLv.textContent = "Lv." + player.level;
    if (dom.pCls) dom.pCls.textContent = player.className;
    dom.pHpText.textContent = Math.max(0, player.hp) + " / " + player.maxHp;
    dom.pHpBar.style.width = pct(player.hp, player.maxHp) + "%";
    dom.pMpText.textContent = player.mp + " / " + player.maxMp;
    dom.pMpBar.style.width = player.maxMp > 0 ? pct(player.mp, player.maxMp) + "%" : "0%";
    const need = window.Abyss.Player.expToNext(player.level);
    dom.pExpBar.style.width = pct(player.exp, need) + "%";
    if (dom.pExpText) dom.pExpText.textContent = player.exp + " / " + need;
    // 左下橢圓頭像（職業變動才重建）。
    if (dom.portrait && dom.portrait.getAttribute("data-cls") !== player.classId) {
      dom.portrait.innerHTML = "";
      if (window.Abyss.Sprites) dom.portrait.appendChild(window.Abyss.Sprites.portraitNode(player.classId));
      dom.portrait.setAttribute("data-cls", player.classId);
    }
  }

  // 頂部列：回合數與所在區域。
  function renderTopbar() {
    if (dom.round) dom.round.textContent = state.round;
    if (dom.area && config && config.areaName) dom.area.textContent = config.areaName;
  }

  // 站位：前排最多 3、後排 2，後排在前排空隙間交叉。
  // 前排靠近（下方、較大），後排較遠（上方、較小）。
  function formationSpots(n) {
    const front = Math.min(n, 3);
    const back = Math.max(0, n - front);
    const FX = { 1: [50], 2: [35, 65], 3: [22, 50, 78] };
    // 後排穿插在前排空隙間，才不會被前排擋住。
    // 4 隻時：前排 3、後排 1 → 那 1 隻卡在前排第 1、2 之間。
    const BX = { 0: [], 1: [36], 2: [36, 64] };
    const fx = FX[front] || [50];
    const bx = BX[back] || [];
    const spots = [];
    fx.forEach(function (x) { spots.push({ x: x, y: 84, row: "front" }); });
    bx.forEach(function (x) { spots.push({ x: x, y: 62, row: "back" }); });
    return spots;
  }

  function renderEnemies() {
    dom.enemies.innerHTML = "";
    const spots = formationSpots(state.enemies.length);
    state.enemies.forEach(function (e, i) {
      const spot = spots[i] || { x: 50, y: 84, row: "front" };
      const targetable = state.phase === "awaitTarget" && e.alive;

      const unit = document.createElement("button");
      unit.type = "button";
      unit.className = "enemy-unit " + spot.row +
        (e.alive ? "" : " dead") + (e.isBoss ? " boss" : "") + (targetable ? " targetable" : "");
      unit.disabled = !targetable;
      // 前排較大、後排較小；Boss 最大。
      const w = e.isBoss ? 28 : (spot.row === "front" ? 19 : 14.5);
      unit.style.left = spot.x + "%";
      unit.style.top = spot.y + "%";
      unit.style.width = w + "%";
      unit.style.zIndex = String(Math.round(spot.y)); // 前排（y 大）疊在後排之上

      // 怪物立繪：有正式圖用圖，否則占位剪影（見 js/sprites.js）。
      if (window.Abyss.Sprites) unit.appendChild(window.Abyss.Sprites.monsterNode(e.baseId));

      // 名牌：名字＋血條，浮在立繪正上方（依使用者要求，只給進度條、不顯示數字）。
      const plate = document.createElement("div");
      plate.className = "unit-plate";
      const name = document.createElement("div");
      name.className = "unit-name";
      name.textContent = e.name + (e.isBoss ? " ☠" : "");
      const barWrap = document.createElement("div");
      barWrap.className = "unit-bar bar hp";
      const bar = document.createElement("div");
      bar.className = "bar-fill hp";
      bar.style.width = pct(e.hp, e.maxHp) + "%";
      barWrap.appendChild(bar);
      plate.appendChild(name);
      plate.appendChild(barWrap);
      unit.appendChild(plate);

      unit.addEventListener("click", function () { selectTarget(i); });
      dom.enemies.appendChild(unit);
    });
  }

  function renderAll() {
    renderPlayer();
    renderEnemies();
    renderTopbar();
    updateActionState();
  }

  // 玩家命中時，敵人列短暫閃光（輕量回饋）。
  function flashEnemies() {
    if (!dom || !dom.enemies) return;
    dom.enemies.classList.remove("flash");
    void dom.enemies.offsetWidth; // 重排以重啟動畫
    dom.enemies.classList.add("flash");
  }

  // ---- 打擊特效 ----
  // 依攻擊來源決定特效種類：劍 / 弓 / 匕首 / 魔法。
  function attackKind(skill) {
    if (skill) {
      if (skill.type === "magic") return "magic";
      if (skill.id === "aimed_shot") return "arrow";
      if (skill.id === "backstab") return "dagger";
      return "sword";
    }
    const byClass = { warrior: "sword", ranger: "arrow", rogue: "dagger", mage: "magic" };
    return byClass[player.classId] || "sword";
  }

  function effectHTML(kind) {
    const flash = "<div class='fx-flash" + (kind === "magic" ? " magic" : "") + "'></div>";
    if (kind === "arrow") return flash + "<div class='fx-arrow'>&#10148;</div><div class='fx-burst'></div>";
    if (kind === "magic") return flash + "<div class='fx-ring'></div><div class='fx-ring r2'></div>" +
      "<span class='fx-spark a'></span><span class='fx-spark b'></span><span class='fx-spark c'></span>";
    if (kind === "dagger") return flash + "<div class='fx-slash d1'><div class='line'></div></div><div class='fx-slash d2'><div class='line'></div></div>";
    return flash + "<div class='fx-slash s1'><div class='line'></div></div><div class='fx-slash s2'><div class='line'></div></div>";
  }

  // 在目標怪物身上播放特效 + 怪物後仰 + 畫面震動。
  function playHitEffect(index, kind, crit) {
    if (!dom || !dom.enemies) return;
    const unit = dom.enemies.children[index];
    if (unit) {
      unit.classList.remove("struck");
      void unit.offsetWidth;
      unit.classList.add("struck");
      const fx = document.createElement("div");
      fx.className = "atk-fx fx-" + kind + (crit ? " fx-crit" : "");
      fx.innerHTML = effectHTML(kind);
      unit.appendChild(fx);
      window.setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 560);
    }
    const scene = document.getElementById("battle-scene");
    if (scene) {
      scene.classList.remove("shake", "shake-hard");
      void scene.offsetWidth;
      scene.classList.add(crit ? "shake-hard" : "shake");
    }
  }

  // 玩家受擊：扣血 + 畫面紅光震動（重擊時加強）。
  function hurtPlayer(dmg) {
    player.hp -= dmg;
    const heavy = dmg >= Math.max(10, player.maxHp * 0.18);
    if (window.Abyss.Effects) window.Abyss.Effects.playHurt(heavy);
  }

  function updateActionState() {
    const enabled = state.phase === "idle";
    Array.prototype.forEach.call(dom.actions.querySelectorAll("button"), function (b) {
      b.disabled = !enabled;
    });
    if (state.phase === "awaitTarget") {
      dom.hint.textContent = "選擇目標（或再次點動作取消）";
    } else if (state.phase === "busy") {
      dom.hint.textContent = "敵人行動中…";
    } else {
      dom.hint.textContent = "輪到你了。";
    }
  }

  function firstAliveIndex() {
    for (let i = 0; i < state.enemies.length; i++) if (state.enemies[i].alive) return i;
    return -1;
  }

  function aliveCount() {
    return state.enemies.filter(function (e) { return e.alive; }).length;
  }

  // ---- 玩家回合 ----
  function startPlayerTurn(first) {
    // 冷卻遞減。
    Object.keys(player.cooldowns).forEach(function (k) {
      if (player.cooldowns[k] > 0) player.cooldowns[k] -= 1;
    });
    // 玩家燃燒 / 命中下降狀態結算。
    if (player.status.burn && player.status.burn.turns > 0) {
      const dmg = player.status.burn.dmg;
      hurtPlayer(dmg);
      log("你受到燃燒，損失 " + dmg + " HP。");
      player.status.burn.turns -= 1;
      if (player.status.burn.turns <= 0) delete player.status.burn;
      if (player.hp <= 0) { renderAll(); return endBattle("lose"); }
    }
    if (player.status.accuracyDown && player.status.accuracyDown.turns > 0) {
      player.status.accuracyDown.turns -= 1;
      if (player.status.accuracyDown.turns <= 0) delete player.status.accuracyDown;
    }
    state.phase = "idle";
    state.pending = null;
    hideSubmenu();
    renderAll();
  }

  function playerAccuracy() {
    let acc = player.accuracy;
    if (player.status.accuracyDown) acc -= 0.3;
    return Math.max(0.3, acc);
  }

  function rollDamagePhysical(atk, def) {
    // 傷害 = max(1, 攻擊力 - 防禦力 × 0.55 + 隨機浮動(-2..+3))
    const base = atk - def * 0.55 + randInt(-2, 3);
    return Math.max(1, Math.round(base));
  }

  function rollDamageMagic(atk, def) {
    const base = atk - def * 0.3 + randInt(-1, 3);
    return Math.max(1, Math.round(base));
  }

  // ---- 玩家動作入口（由按鈕呼叫）----
  function chooseAttack() {
    if (state.phase === "awaitTarget") { cancelPending(); return; }
    if (state.phase !== "idle") return;
    if (aliveCount() === 1) {
      // 只剩一個目標時直接攻擊。
      state.pending = { kind: "attack" };
      state.phase = "awaitTarget";
      selectTarget(firstAliveIndex());
      return;
    }
    state.pending = { kind: "attack" };
    state.phase = "awaitTarget";
    hideSubmenu();
    renderAll();
  }

  function chooseSkill() {
    if (state.phase !== "idle") { if (state.phase === "awaitTarget") cancelPending(); return; }
    const skill = data().skills[player.skillId];
    if (!skill) return;
    const cd = player.cooldowns[skill.id] || 0;
    // 顯示技能子選單。
    showSubmenu([{
      label: skill.name,
      sub: skill.desc + skillCostText(skill),
      disabled: cd > 0 || player.mp < (skill.mpCost || 0),
      note: cd > 0 ? "冷卻中(" + cd + ")" : (player.mp < (skill.mpCost || 0) ? "魔力不足" : ""),
      onClick: function () {
        if (aliveCount() === 1) {
          state.pending = { kind: "skill", skill: skill };
          state.phase = "awaitTarget";
          selectTarget(firstAliveIndex());
        } else {
          state.pending = { kind: "skill", skill: skill };
          state.phase = "awaitTarget";
          hideSubmenu();
          renderAll();
        }
      }
    }], "技能");
  }

  function skillCostText(skill) {
    const parts = [];
    if (skill.mpCost) parts.push("MP " + skill.mpCost);
    if (skill.cooldown) parts.push("冷卻 " + skill.cooldown);
    return parts.length ? "（" + parts.join("、") + "）" : "";
  }

  function chooseItem() {
    if (state.phase !== "idle") { if (state.phase === "awaitTarget") cancelPending(); return; }
    const items = data().items;
    const owned = window.Abyss.Player.consumableList(player).filter(function (e) { return items[e.id]; });
    if (owned.length === 0) {
      log("沒有可用的道具。");
      return;
    }
    const list = owned.map(function (e) {
      const it = items[e.id];
      return {
        label: it.name + " ×" + e.count,
        sub: itemEffectText(it),
        disabled: false,
        icon: window.Abyss.Sprites ? window.Abyss.Sprites.itemNode(e.id) : null,
        onClick: function () { useItem(e.id); }
      };
    });
    showSubmenu(list, "道具");
  }

  function itemEffectText(it) {
    const e = it.effect || {};
    const parts = [];
    if (e.healHp) parts.push("回復 " + e.healHp + " HP");
    if (e.restoreMp) parts.push("回復 " + e.restoreMp + " MP");
    if (e.removeStatus) parts.push("解除" + (e.removeStatus === "bleeding" ? "流血" : e.removeStatus));
    return parts.join("、");
  }

  function chooseFlee() {
    if (state.phase !== "idle") { if (state.phase === "awaitTarget") cancelPending(); return; }
    if (state.isBoss) {
      log("無面守門人擋住去路，無法逃跑！");
      // 逃跑失敗仍消耗回合。
      state.phase = "busy";
      renderAll();
      window.setTimeout(enemyPhase, ENEMY_STEP_MS);
      return;
    }
    // 基礎 50% + 速度差修正。
    const alive = state.enemies.filter(function (e) { return e.alive; });
    const avgSpeed = alive.reduce(function (s, e) { return s + e.speed; }, 0) / Math.max(1, alive.length);
    const chance = 0.5 + (player.speed - avgSpeed) * 0.04;
    if (Math.random() < Math.max(0.1, Math.min(0.95, chance))) {
      log("你成功逃離戰鬥。");
      renderAll();
      endBattle("flee");
    } else {
      log("逃跑失敗！");
      state.phase = "busy";
      renderAll();
      window.setTimeout(enemyPhase, ENEMY_STEP_MS);
    }
  }

  function cancelPending() {
    state.pending = null;
    state.phase = "idle";
    hideSubmenu();
    renderAll();
  }

  // ---- 解析玩家目標動作 ----
  function selectTarget(index) {
    if (state.phase !== "awaitTarget" || !state.pending) return;
    const enemy = state.enemies[index];
    if (!enemy || !enemy.alive) return;

    const pending = state.pending;
    state.pending = null;
    state.phase = "busy";
    hideSubmenu();

    let res, kind;
    if (pending.kind === "attack") {
      res = resolvePlayerAttack(enemy);
      kind = attackKind(null);
    } else {
      res = resolvePlayerSkill(pending.skill, enemy);
      kind = attackKind(pending.skill);
    }

    renderAll();
    if (res && res.hit) {
      // 播放技能動畫，動畫結束才進入敵人回合（動畫期間按鈕已停用＝鎖輸入）。
      const targetEl = dom.enemies.children[index];
      window.Abyss.Effects.playAttack(kind, targetEl, {
        crit: res.crit, damage: res.damage, onDone: afterPlayerAction
      });
    } else {
      window.setTimeout(afterPlayerAction, 300);
    }
  }

  function resolvePlayerAttack(enemy) {
    if (Math.random() > playerAccuracy()) {
      log("你的攻擊落空了。");
      return { hit: false };
    }
    const effDef = enemy.defense + (enemy.status.defUp ? enemy.status.defUp.amount : 0);
    let dmg = rollDamagePhysical(player.attack, effDef);
    const crit = Math.random() < player.critRate;
    if (crit) dmg = Math.round(dmg * 1.6);
    enemy.hp -= dmg;
    window.Abyss.Audio.playSfx(crit ? "crit" : "sword_hit");
    log("你攻擊「" + enemy.name + "」，造成 " + dmg + " 傷害" + (crit ? "（暴擊！）" : "") + "。");
    killCheck(enemy);
    return { hit: true, crit: crit, damage: dmg };
  }

  function resolvePlayerSkill(skill, enemy) {
    // 消耗資源。
    if (skill.mpCost) player.mp = Math.max(0, player.mp - skill.mpCost);
    if (skill.cooldown) player.cooldowns[skill.id] = skill.cooldown + 1; // +1：本回合結束後才開始遞減

    const hit = skill.trueHit || Math.random() <= playerAccuracy();
    if (!hit) {
      log("你使出「" + skill.name + "」，卻沒有命中。");
      return { hit: false };
    }

    const effDef = enemy.defense + (enemy.status.defUp ? enemy.status.defUp.amount : 0);
    let dmg;
    if (skill.type === "magic") {
      dmg = rollDamageMagic(Math.round(player.magicAttack * skill.power), effDef);
    } else {
      dmg = rollDamagePhysical(Math.round(player.attack * skill.power), effDef);
    }

    let crit = Math.random() < player.critRate;
    if (skill.fullHpGuaranteedCrit && enemy.hp >= enemy.maxHp) crit = true;
    if (crit) dmg = Math.round(dmg * 1.6);

    enemy.hp -= dmg;
    var skillSfx = skill.type === "magic" ? "fire" : (skill.id === "aimed_shot" ? "arrow" : "sword_hit");
    window.Abyss.Audio.playSfx(crit ? "crit" : skillSfx);
    log("你使出「" + skill.name + "」，對「" + enemy.name + "」造成 " + dmg + " 傷害" + (crit ? "（暴擊！）" : "") + "。");

    // 附加效果。
    if (skill.stunChance && enemy.hp > 0 && Math.random() < skill.stunChance) {
      enemy.status.stun = { turns: 1 };
      log("「" + enemy.name + "」被打得暈眩。");
    }
    if (skill.burnChance && enemy.hp > 0 && Math.random() < skill.burnChance) {
      enemy.status.burn = { turns: skill.burnTurns, dmg: skill.burnDamage };
      log("「" + enemy.name + "」開始燃燒。");
    }
    killCheck(enemy);
    return { hit: true, crit: crit, damage: dmg };
  }

  function killCheck(enemy) {
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      window.Abyss.Audio.playSfx("die");
      log("「" + enemy.name + "」被擊倒了。");
    }
  }

  function useItem(itemId) {
    const it = data().items[itemId];
    if (!it) return;
    if (!window.Abyss.Player.useConsumable(player, itemId)) return;
    const e = it.effect || {};
    const msgs = [];
    if (e.healHp) {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + e.healHp);
      msgs.push("回復 " + (player.hp - before) + " HP");
    }
    if (e.restoreMp && player.maxMp > 0) {
      const before = player.mp;
      player.mp = Math.min(player.maxMp, player.mp + e.restoreMp);
      msgs.push("回復 " + (player.mp - before) + " MP");
    }
    if (e.removeStatus === "bleeding" && player.status.burn) {
      delete player.status.burn;
      msgs.push("止住了燃燒");
    }
    window.Abyss.Audio.playSfx("potion");
    log("你使用「" + it.name + "」，" + (msgs.join("、") || "但沒有明顯效果") + "。");

    state.phase = "busy";
    hideSubmenu();
    renderAll();
    afterPlayerAction();
  }

  // 玩家動作結束後：檢查勝利，否則進入敵人回合。
  function afterPlayerAction() {
    if (state.enemies.every(function (e) { return !e.alive; })) {
      return win();
    }
    window.setTimeout(enemyPhase, ENEMY_STEP_MS);
  }

  // ---- 敵人回合 ----
  function enemyPhase() {
    if (!state) return;
    // 依速度由快到慢排序活著的敵人。
    const actors = state.enemies.filter(function (e) { return e.alive; })
      .sort(function (a, b) { return b.speed - a.speed; });
    let i = 0;
    function step() {
      if (!state) return;
      if (player.hp <= 0) { renderAll(); return endBattle("lose"); }
      if (i >= actors.length) {
        // 敵人回合結束，回到玩家。
        state.round += 1;
        startPlayerTurn(false);
        return;
      }
      const enemy = actors[i];
      i += 1;
      if (!enemy.alive) { step(); return; }
      enemyAct(enemy);
      renderAll();
      if (player.hp <= 0) { renderAll(); return endBattle("lose"); }
      window.setTimeout(step, ENEMY_STEP_MS);
    }
    step();
  }

  function enemyBasicAttack(enemy) {
    const dmg = rollDamagePhysical(enemy.attack, player.defense);
    hurtPlayer(dmg);
    log("「" + enemy.name + "」攻擊你，造成 " + dmg + " 傷害。");
  }

  function enemyAct(enemy) {
    // 燃燒結算。
    if (enemy.status.burn && enemy.status.burn.turns > 0) {
      enemy.hp -= enemy.status.burn.dmg;
      log("「" + enemy.name + "」因燃燒損失 " + enemy.status.burn.dmg + " HP。");
      enemy.status.burn.turns -= 1;
      if (enemy.status.burn.turns <= 0) delete enemy.status.burn;
      if (enemy.hp <= 0) { killCheck(enemy); return; }
    }
    // 臨時防禦遞減。
    if (enemy.status.defUp) {
      enemy.status.defUp.turns -= 1;
      if (enemy.status.defUp.turns <= 0) delete enemy.status.defUp;
    }
    // 暈眩。
    if (enemy.status.stun && enemy.status.stun.turns > 0) {
      log("「" + enemy.name + "」還在暈眩，無法行動。");
      enemy.status.stun.turns -= 1;
      if (enemy.status.stun.turns <= 0) delete enemy.status.stun;
      return;
    }

    const lowHp = enemy.hp < enemy.maxHp * 0.4;

    if (enemy.isBoss) {
      return bossAct(enemy, lowHp);
    }

    switch (enemy.baseId) {
      case "helmet_rat":
        if (enemy.hp < enemy.maxHp * 0.3 && Math.random() < 0.4) {
          enemy.alive = false;
          enemy.hp = 0;
          log("「" + enemy.name + "」縮進頭盔逃走了。");
          return;
        }
        enemyBasicAttack(enemy);
        return;
      case "candle_slime":
        if (Math.random() < 0.3) {
          const dmg = rollDamagePhysical(enemy.attack, player.defense);
          hurtPlayer(dmg);
          log("「" + enemy.name + "」以燭火撲擊，造成 " + dmg + " 傷害並點燃了你。");
          player.status.burn = { turns: 2, dmg: 3 };
        } else {
          enemyBasicAttack(enemy);
        }
        return;
      case "rotten_skeleton":
        if (lowHp && Math.random() < 0.5) {
          enemy.status.defUp = { turns: 2, amount: 4 };
          log("「" + enemy.name + "」舉盾防禦，防禦力提升。");
        } else {
          enemyBasicAttack(enemy);
        }
        return;
      case "broken_fang_bat":
        if (Math.random() < 0.35) {
          player.status.accuracyDown = { turns: 2 };
          log("「" + enemy.name + "」發出尖嘯，你的命中下降了。");
        } else {
          enemyBasicAttack(enemy);
        }
        return;
      case "crying_mushroom":
        if (Math.random() < 0.35) {
          player.status.accuracyDown = { turns: 2 };
          const dmg = Math.max(1, Math.round(enemy.attack * 0.5));
          hurtPlayer(dmg);
          log("「" + enemy.name + "」噴出孢子，造成 " + dmg + " 傷害並讓你視線模糊。");
        } else {
          enemyBasicAttack(enemy);
        }
        return;
      default:
        enemyBasicAttack(enemy);
    }
  }

  function bossAct(enemy, lowHp) {
    if (lowHp && Math.random() < 0.6) {
      // 低血量連續攻擊。
      log("赫爾蒙低吼，發動連續攻擊！");
      for (let k = 0; k < 2; k++) {
        if (player.hp <= 0) break;
        const dmg = rollDamagePhysical(enemy.attack, player.defense);
        hurtPlayer(dmg);
        log("赫爾蒙斬向你，造成 " + dmg + " 傷害。");
      }
      return;
    }
    if (Math.random() < 0.35) {
      const dmg = Math.round(rollDamagePhysical(enemy.attack, player.defense) * 1.3);
      hurtPlayer(dmg);
      log("赫爾蒙以盾猛擊，造成 " + dmg + " 傷害。");
    } else {
      const dmg = rollDamagePhysical(enemy.attack, player.defense);
      hurtPlayer(dmg);
      log("赫爾蒙揮劍斬擊，造成 " + dmg + " 傷害。");
    }
  }

  // ---- 結束 ----
  function win() {
    state.phase = "busy";
    const totalExp = state.enemies.reduce(function (s, e) { return s + e.exp; }, 0);
    player.stats.kills += state.enemies.length;
    log("戰鬥勝利！獲得 " + totalExp + " 經驗。");
    const levelMsgs = window.Abyss.Player.gainExp(player, totalExp);
    levelMsgs.forEach(function (m) { log(m); });
    if (levelMsgs.length) window.Abyss.Audio.playSfx("levelup");
    if (state.isBoss) {
      const line = (config.bossLines && config.bossLines.death) || "你不該從外面回來。";
      log("赫爾蒙：「" + line + "」");
    }
    renderAll();
    endBattle(state.isBoss ? "win-boss" : "win");
  }

  function endBattle(result) {
    const cb = config && config.onEnd;
    state = null;
    if (cb) window.setTimeout(function () { cb(result); }, result === "flee" ? 350 : 900);
  }

  // ---- 子選單（技能 / 道具）----
  function showSubmenu(list, title) {
    dom.submenu.innerHTML = "";
    dom.submenu.classList.add("open");
    const head = document.createElement("div");
    head.className = "submenu-title";
    head.textContent = title;
    dom.submenu.appendChild(head);
    list.forEach(function (item) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "submenu-btn" + (item.icon ? " has-icon" : "");
      btn.disabled = !!item.disabled;
      const txt = "<span class='submenu-label'>" + escapeHtml(item.label) +
        (item.note ? " <em>" + escapeHtml(item.note) + "</em>" : "") +
        "</span><span class='submenu-sub'>" + escapeHtml(item.sub || "") + "</span>";
      if (item.icon) {
        item.icon.classList.add("item-icon");
        btn.appendChild(item.icon);
        const col = document.createElement("span");
        col.className = "submenu-text";
        col.innerHTML = txt;
        btn.appendChild(col);
      } else {
        btn.innerHTML = txt;
      }
      btn.addEventListener("click", function () {
        if (item.disabled) return;
        item.onClick();
      });
      dom.submenu.appendChild(btn);
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "submenu-btn cancel";
    cancel.textContent = "返回";
    cancel.addEventListener("click", hideSubmenu);
    dom.submenu.appendChild(cancel);
  }

  function hideSubmenu() {
    if (!dom || !dom.submenu) return;
    dom.submenu.classList.remove("open");
    dom.submenu.innerHTML = "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  return {
    start: start,
    chooseAttack: chooseAttack,
    chooseSkill: chooseSkill,
    chooseItem: chooseItem,
    chooseFlee: chooseFlee,
    // 供測試 / 除錯。
    _state: function () { return state; }
  };
})();
