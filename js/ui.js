// js/ui.js
// DOM 更新、畫面切換、HUD、訊息、職業卡、死亡與勝利畫面。
// 所有 DOM 查找集中於此模組。
window.Abyss = window.Abyss || {};

window.Abyss.UI = (function () {
  "use strict";

  const SCREEN_IDS = ["screen-start", "screen-class", "screen-maze", "screen-battle", "screen-death", "screen-victory"];
  let el = {};

  function $(id) { return document.getElementById(id); }

  function init() {
    el = {
      screens: {},
      viewCanvas: $("view-canvas"),
      minimapCanvas: $("minimap-canvas"),
      mazeMsg: $("maze-message"),
      hudClass: $("hud-class"),
      hudLv: $("hud-lv"),
      hudHp: $("hud-hp"),
      hudHpBar: $("hud-hpbar"),
      hudMp: $("hud-mp"),
      hudMpBar: $("hud-mpbar"),
      hudExpBar: $("hud-expbar"),
      hudFloor: $("hud-floor"),
      hudGold: $("hud-gold"),
      hudExp: $("hud-exp"),
      hudExplore: $("hud-explore"),
      hudExploreBar: $("hud-explorebar"),
      hudExplore2: $("hud-explore2"),
      mazePortrait: $("maze-portrait"),
      homeGold: $("home-gold"),
      classGrid: $("class-grid"),
      instructions: $("modal-instructions"),
      deathStats: $("death-stats"),
      victoryStats: $("victory-stats"),
      equipStats: $("equip-stats"),
      equipSlots: $("equip-slots"),
      equipBag: $("equip-bag"),
      equipGold: $("equip-gold"),
      equipCount: $("equip-count")
    };
    SCREEN_IDS.forEach(function (id) { el.screens[id] = $(id); });
  }

  function showScreen(id) {
    SCREEN_IDS.forEach(function (sid) {
      const node = el.screens[sid];
      if (node) node.classList.toggle("active", sid === id);
    });
    if (id === "screen-start") {
      updateWallet();
      if (window.Abyss.Menu) window.Abyss.Menu.refreshShowcase();
      if (window.Abyss.Audio) window.Abyss.Audio.playMusic("menu_theme"); // 登入音樂（首次點畫面後開始）
    }
  }

  // 開始畫面顯示永久金庫總額。
  function updateWallet() {
    if (el.homeGold && window.Abyss.Save) el.homeGold.textContent = window.Abyss.Save.getWallet().gold;
  }

  // ---- 職業選擇 ----
  function renderClassCards(classes, onSelect) {
    el.classGrid.innerHTML = "";
    let num = 0;
    Object.keys(classes).forEach(function (id) {
      num += 1;
      const c = classes[id];
      const s = c.baseStats;
      const skill = (window.GAME_DATA.skills || {})[c.startingSkill];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "class-card";
      // 正常畫風全身立繪（非 Q 版）。有 .jpg（線上壓縮版）就用 jpg，否則 png。
      card.innerHTML =
        "<span class='cc-num'>" + num + "</span>" +
        "<div class='cc-art'><img src='assets/characters/" + id + "_full.jpg' alt='' " +
        "onerror=\"this.onerror=null;this.src='assets/characters/" + id + "_full.jpg'\"></div>" +
        "<div class='cc-body'>" +
        "<h3>" + c.name + "</h3>" +
        "<ul class='stat-list'>" +
        statLi("HP", s.maxHp) +
        statLi("MP", s.maxMp || 0) +
        statLi("攻擊", s.attack) +
        (s.magicAttack ? statLi("魔攻", s.magicAttack) : "") +
        statLi("防禦", s.defense) +
        statLi("速度", s.speed) +
        statLi("暴擊", Math.round((s.critRate || 0) * 100) + "%") +
        "</ul>" +
        "<div class='class-skill'>初始技能：" + (skill ? skill.name : "—") + "</div>" +
        (skill ? "<div class='class-skill-desc'>" + skill.desc + "</div>" : "") +
        "</div>";
      card.addEventListener("click", function () { onSelect(id); });
      el.classGrid.appendChild(card);
    });
  }

  function statLi(label, value) {
    return "<li><span>" + label + "</span><b>" + value + "</b></li>";
  }

  // ---- 迷宮 HUD ----
  function pct(cur, max) {
    if (!max) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  function renderMazeHud(player, floorName, explorePct) {
    el.hudClass.textContent = player.className;
    el.hudLv.textContent = "Lv." + player.level;
    el.hudHp.textContent = Math.max(0, player.hp) + "/" + player.maxHp;
    el.hudHpBar.style.width = pct(player.hp, player.maxHp) + "%";
    el.hudMp.textContent = player.mp + "/" + player.maxMp;
    el.hudMpBar.style.width = pct(player.mp, player.maxMp) + "%";
    const need = window.Abyss.Player.expToNext(player.level);
    el.hudExpBar.style.width = pct(player.exp, need) + "%";
    if (el.hudExp) el.hudExp.textContent = player.exp + " / " + need;
    el.hudFloor.textContent = floorName;
    if (el.hudGold) el.hudGold.textContent = player.gold || 0;

    // 探索進度（左上文字條 + 小地圖下方文字）。
    if (typeof explorePct === "number") {
      const t = explorePct + "%";
      if (el.hudExplore) el.hudExplore.textContent = t;
      if (el.hudExploreBar) el.hudExploreBar.style.width = explorePct + "%";
      if (el.hudExplore2) el.hudExplore2.textContent = t;
    }

    // 左下橢圓頭像（只在職業變動時重建，避免每步重繪）。
    if (el.mazePortrait && el.mazePortrait.getAttribute("data-cls") !== player.classId) {
      el.mazePortrait.innerHTML = "";
      el.mazePortrait.appendChild(window.Abyss.Sprites.heroPortraitNode(player.classId));
      el.mazePortrait.setAttribute("data-cls", player.classId);
    }
  }

  function mazeMessage(text) {
    if (el.mazeMsg) el.mazeMsg.textContent = text || "";
  }

  // ---- 彈窗 ----
  function toggleModal(id, show) {
    const node = document.getElementById(id);
    if (node) node.classList.toggle("open", show);
  }

  function toggleInstructions(show) {
    toggleModal("modal-instructions", show);
  }

  // ---- 死亡畫面 ----
  function showDeath(stats) {
    el.deathStats.innerHTML =
      row("職業", stats.className) +
      row("到達等級", "Lv." + stats.level) +
      row("擊倒敵人", stats.kills + " 隻") +
      row("移動步數", stats.steps + " 步") +
      row("最終樓層", stats.floorName) +
      row("本輪金幣", "💰 " + (stats.goldEarned || 0)) +
      row("帶回金庫", "🏠 共 " + (stats.goldTotal || 0));
    showScreen("screen-death");
  }

  function showVictory(stats) {
    el.victoryStats.innerHTML =
      row("職業", stats.className) +
      row("等級", "Lv." + stats.level) +
      row("擊倒敵人", stats.kills + " 隻") +
      row("移動步數", stats.steps + " 步") +
      row("本輪金幣", "💰 " + (stats.goldEarned || 0)) +
      row("帶回金庫", "🏠 共 " + (stats.goldTotal || 0));
    showScreen("screen-victory");
  }

  function row(label, value) {
    return "<div class='stat-row'><span>" + label + "</span><b>" + value + "</b></div>";
  }

  // ---- 裝備視窗 ----
  const SLOT_NAMES = { weapon: "武器", armor: "防具", accessory: "飾品" };
  const BONUS_NAMES = { attack: "攻擊", defense: "防禦", magicAttack: "魔攻", speed: "速度", maxHp: "HP", maxMp: "MP", critRate: "暴擊" };

  function equipData(id) {
    return ((window.GAME_DATA && window.GAME_DATA.equipment) || {})[id] || null;
  }

  function bonusText(bonus) {
    const parts = [];
    Object.keys(bonus || {}).forEach(function (k) {
      const v = bonus[k];
      if (k === "critRate") parts.push(BONUS_NAMES[k] + " +" + Math.round(v * 100) + "%");
      else parts.push(BONUS_NAMES[k] + " +" + v);
    });
    return parts.join("、");
  }

  function statChip(label, value) {
    return "<span class='equip-stat'><i>" + label + "</i><b>" + value + "</b></span>";
  }

  function buildEquipCard(item, isSlot) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "equip-card";
    if (window.Abyss.Sprites) {
      const art = window.Abyss.Sprites.equipNode(item.id);
      art.classList.add("equip-card-art");
      card.appendChild(art);
    }
    const info = document.createElement("div");
    info.className = "equip-card-info";
    info.innerHTML =
      "<div class='equip-card-name'>" + item.name + "</div>" +
      "<div class='equip-card-bonus'>" + bonusText(item.bonus) + "</div>" +
      (isSlot ? "<div class='equip-card-hint'>點一下脫下</div>" : "");
    card.appendChild(info);
    return card;
  }

  function renderEquip(player, handlers) {
    // 目前屬性（已含裝備加成）。
    el.equipStats.innerHTML =
      statChip("HP", player.maxHp) +
      statChip("攻擊", player.attack) +
      (player.magicAttack ? statChip("魔攻", player.magicAttack) : "") +
      statChip("防禦", player.defense) +
      statChip("速度", player.speed) +
      statChip("暴擊", Math.round(player.critRate * 100) + "%");

    // 三個裝備格。
    el.equipSlots.innerHTML = "";
    ["weapon", "armor", "accessory"].forEach(function (slot) {
      const wrap = document.createElement("div");
      wrap.className = "equip-slot";
      const label = document.createElement("div");
      label.className = "slot-label";
      label.textContent = SLOT_NAMES[slot];
      wrap.appendChild(label);
      const id = player.equipment[slot];
      const item = id ? equipData(id) : null;
      if (item) {
        const card = buildEquipCard(item, true);
        card.addEventListener("click", function () { handlers.onUnequip(slot); });
        wrap.appendChild(card);
      } else {
        const empty = document.createElement("div");
        empty.className = "slot-empty";
        empty.textContent = "（空）";
        wrap.appendChild(empty);
      }
      el.equipSlots.appendChild(wrap);
    });

    // 頂部：金幣 + 背包格數。
    if (el.equipGold) el.equipGold.textContent = player.gold || 0;
    if (el.equipCount) el.equipCount.textContent = "背包 " + player.bag.length + "/" + window.Abyss.Player.BAG_MAX;

    // 背包（消耗品 + 未穿的裝備），最多 10 格。裝備點一下就穿上。
    el.equipBag.innerHTML = "";
    if (!player.bag || player.bag.length === 0) {
      el.equipBag.innerHTML = "<div class='equip-empty-hint'>包包是空的。打贏怪物有機會撿到金幣和裝備！</div>";
      return;
    }
    player.bag.forEach(function (slot) {
      if (slot.kind === "equipment") {
        const item = equipData(slot.id);
        if (!item) return;
        const card = buildEquipCard(item, false);
        card.classList.add("bag-card");
        card.addEventListener("click", function () { handlers.onEquip(slot.id); });
        el.equipBag.appendChild(card);
      } else {
        const it = (window.GAME_DATA.items || {})[slot.id];
        const card = document.createElement("div");
        card.className = "equip-card bag-card consumable-card";
        if (window.Abyss.Sprites) {
          const art = window.Abyss.Sprites.itemNode(slot.id);
          art.classList.add("equip-card-art");
          card.appendChild(art);
        }
        const info = document.createElement("div");
        info.className = "equip-card-info";
        info.innerHTML = "<div class='equip-card-name'>" + (it ? it.name : slot.id) + " ×" + slot.count + "</div>" +
          "<div class='equip-card-bonus'>" + (it ? itemEffectShort(it) : "") + "</div>";
        card.appendChild(info);
        el.equipBag.appendChild(card);
      }
    });
  }

  function itemEffectShort(it) {
    const e = it.effect || {};
    const parts = [];
    if (e.healHp) parts.push("回復 " + e.healHp + " HP");
    if (e.restoreMp) parts.push("回復 " + e.restoreMp + " MP");
    if (e.removeStatus) parts.push("解除異常");
    return parts.join("、");
  }

  // 小卡片：圖 + 名字 + 說明（供「背包滿了換一個」視窗使用）。
  function pickupCard(artNode, name, info, cls) {
    const card = document.createElement("div");
    card.className = cls;
    const art = document.createElement("div"); art.className = "pickup-art";
    if (artNode) art.appendChild(artNode);
    card.appendChild(art);
    const n = document.createElement("div"); n.className = "pickup-name"; n.textContent = name;
    card.appendChild(n);
    const f = document.createElement("div"); f.className = "pickup-info"; f.textContent = info || "";
    card.appendChild(f);
    return card;
  }

  // 背包滿了：顯示新裝備 + 目前背包各格，點一格 → handlers.onDiscard(index)；放棄 → handlers.onCancel()。
  function renderPickupReplace(newItem, player, handlers) {
    const S = window.Abyss.Sprites;
    const G = window.GAME_DATA || {};
    const newBox = document.getElementById("pickup-new");
    const bagBox = document.getElementById("pickup-bag");
    if (!newBox || !bagBox) return;
    newBox.innerHTML = "";
    newBox.appendChild(pickupCard(S ? S.equipNode(newItem.id) : null, "✨ " + newItem.name,
      (SLOT_NAMES[newItem.slot] || "") + "　" + bonusText(newItem.bonus), "pickup-card new"));
    bagBox.innerHTML = "";
    player.bag.forEach(function (slot, i) {
      let art = null, name = "", info = "";
      if (slot.kind === "equipment") {
        const eq = G.equipment[slot.id]; if (!eq) return;
        art = S ? S.equipNode(slot.id) : null; name = eq.name;
        info = (SLOT_NAMES[eq.slot] || "") + "　" + bonusText(eq.bonus);
      } else {
        const it = G.items[slot.id]; if (!it) return;
        art = S ? S.itemNode(slot.id) : null;
        name = it.name + (slot.count > 1 ? " ×" + slot.count : "");
        info = itemEffectShort(it);
      }
      const card = pickupCard(art, name, info, "pickup-card");
      card.addEventListener("click", function () { handlers.onDiscard(i); });
      bagBox.appendChild(card);
    });
    const cancel = document.getElementById("btn-pickup-cancel");
    if (cancel) cancel.onclick = function () { handlers.onCancel(); };
  }

  // 圖鑑：怪物遭遇後解鎖（未遭遇顯示剪影）；道具、裝備直接展示。
  function renderCodex(category) {
    const grid = document.getElementById("codex-grid");
    const prog = document.getElementById("codex-progress");
    if (!grid) return;
    grid.innerHTML = "";
    const codex = window.Abyss.Save.getCodex();
    const G = window.GAME_DATA || {};
    const S = window.Abyss.Sprites;

    function makeCard(artNode, name, info, locked) {
      const card = document.createElement("div");
      card.className = "codex-card" + (locked ? " locked" : "");
      const art = document.createElement("div"); art.className = "codex-art";
      if (artNode) art.appendChild(artNode);
      card.appendChild(art);
      const n = document.createElement("div"); n.className = "codex-name"; n.textContent = name;
      card.appendChild(n);
      const f = document.createElement("div"); f.className = "codex-info"; f.textContent = info;
      card.appendChild(f);
      grid.appendChild(card);
    }

    if (category === "item") {
      const ids = Object.keys(G.items || {});
      ids.forEach(function (id) {
        const it = G.items[id];
        makeCard(S ? S.itemNode(id) : null, it.name, itemEffectShort(it), false);
      });
      if (prog) prog.textContent = "道具 " + ids.length + " 種";
    } else if (category === "equip") {
      const ids = Object.keys(G.equipment || {});
      ids.forEach(function (id) {
        const eq = G.equipment[id];
        makeCard(S ? S.equipNode(id) : null, eq.name, (SLOT_NAMES[eq.slot] || "") + "　" + bonusText(eq.bonus), false);
      });
      if (prog) prog.textContent = "裝備 " + ids.length + " 件";
    } else {
      const ids = Object.keys(G.monsters || {});
      let seen = 0;
      ids.forEach(function (id) {
        const m = G.monsters[id];
        const unlocked = !!(codex.monsters && codex.monsters[m.codexId]);
        if (unlocked) seen++;
        let artNode = null;
        if (unlocked && S) {
          artNode = S.monsterNode(id);
        } else if (S) {
          artNode = document.createElement("div");
          artNode.className = "sprite-wrap";
          artNode.innerHTML = S.monster(id); // 剪影
        }
        makeCard(artNode,
          unlocked ? m.name : "？？？",
          unlocked ? ("HP " + m.maxHp + "　攻 " + m.attack + "　防 " + m.defense) : "尚未遭遇",
          !unlocked);
      });
      if (prog) prog.textContent = "已遭遇 " + seen + " / " + ids.length;
    }
  }

  return {
    init: init,
    showScreen: showScreen,
    renderClassCards: renderClassCards,
    renderMazeHud: renderMazeHud,
    mazeMessage: mazeMessage,
    toggleModal: toggleModal,
    toggleInstructions: toggleInstructions,
    showDeath: showDeath,
    showVictory: showVictory,
    renderEquip: renderEquip,
    renderCodex: renderCodex,
    renderPickupReplace: renderPickupReplace,
    updateWallet: updateWallet,
    get el() { return el; }
  };
})();
