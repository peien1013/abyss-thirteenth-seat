// js/game.js
// 當輪狀態、新遊戲、勝利與死亡流程、迷宮與戰鬥場景切換。
window.Abyss = window.Abyss || {};

window.Abyss.Game = (function () {
  "use strict";

  // 各職業碎碎念（連撞牆三次 / 低血量）。
  const QUIPS = {
    warrior: { wall: "我知道那是牆。我只是在確認它夠不夠結實。", low: "還能走。不能走的時候，我會告訴你。" },
    ranger: { wall: "至少現在知道這條路不值得走第二次。", low: "別分心。我還射得動。" },
    rogue: { wall: "我只是確認它有沒有合作意願。", low: "流點血而已，別大驚小怪。" },
    mage: { wall: "我已經注意到了，只是在研究碰撞結果。", low: "魔力不是無限的，血也是。" }
  };

  const BOSS_LINES = { open: "報上姓名。", death: "你不該從外面回來。" };

  let run = null;
  let busy = false; // 防止畫面切換或戰鬥期間的重複輸入。

  function data() { return window.GAME_DATA || {}; }
  function UI() { return window.Abyss.UI; }
  function Maze() { return window.Abyss.Maze; }
  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  function floor() { return data().floors.floor01; }

  // ---- 新遊戲 ----
  function newGame(classId) {
    run = {
      player: window.Abyss.Player.create(classId),
      floorId: "floor01",
      bossDefeated: false,
      wallBumps: 0
    };
    Maze().load(floor());
    busy = false;
    UI().showScreen("screen-maze");
    resizeCanvases();
    renderMaze();
    UI().mazeMessage("你踏入沉眠門廊。遠處有人低語：「這一次，也是一個人嗎？」");
    window.Abyss.Audio.playMusic("floor01_explore");
    persist();
  }

  function currentPlayer() { return run ? run.player : null; }

  // ---- 迷宮渲染 ----
  function resizeCanvases() {
    const view = UI().el.viewCanvas;
    const mini = UI().el.minimapCanvas;
    if (view && (view.width !== 1280 || view.height !== 720)) {
      view.width = 1280;
      view.height = 720;
    }
    if (mini && (mini.width !== 240 || mini.height !== 210)) {
      mini.width = 240;
      mini.height = 210;
    }
  }

  function renderMaze() {
    Maze().render(UI().el.viewCanvas);
    Maze().renderMinimap(UI().el.minimapCanvas);
    UI().renderMazeHud(run.player, floor().name, Maze().explorePercent());
  }

  // 前進／後退一格的「踏步」回饋：畫面微晃（往前一衝＋下沉）＋手機觸覺震動。
  function mazeStepFeedback() {
    const mw = document.querySelector("#screen-maze .maze-world");
    if (mw) { mw.classList.remove("stepping"); void mw.offsetWidth; mw.classList.add("stepping"); }
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
  }

  // 戰鬥背景：若放了 GPT 場景圖（assets/images/scenes/battle_bg.png/.jpg）就用它，
  // 否則退回「當前所在走廊的第一人稱視角」。放圖進去、重新整理即自動生效，毋須改程式。
  let battleBg = null; // null=未試 / "missing"=沒圖 / Image=已載入
  const BATTLE_BG_URLS = ["assets/images/scenes/battle_bg.jpg", "assets/images/scenes/battle_bg.png"];
  function drawCover(c, img) {
    const ctx = c.getContext("2d");
    const s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }
  function tryLoadBattleBg(urls, i, onOk, onFail) {
    if (i >= urls.length) return onFail();
    const img = new Image();
    img.onload = function () { onOk(img); };
    img.onerror = function () { tryLoadBattleBg(urls, i + 1, onOk, onFail); };
    img.src = urls[i];
  }
  function renderBattleBackdrop() {
    const c = document.getElementById("battle-bg");
    if (!c) return;
    if (c.width !== 1280 || c.height !== 720) { c.width = 1280; c.height = 720; }
    if (battleBg && battleBg !== "missing") { drawCover(c, battleBg); return; }
    Maze().render(c); // 沒圖（或還沒載到）時：先畫走廊視角
    if (battleBg === "missing") return;
    tryLoadBattleBg(BATTLE_BG_URLS, 0,
      function (img) { battleBg = img; const cc = document.getElementById("battle-bg"); if (cc) drawCover(cc, img); },
      function () { battleBg = "missing"; });
  }

  // ---- 裝備 ----
  function openEquip() {
    if (!run || busy) return;
    renderEquipModal();
    UI().toggleModal("modal-equip", true);
  }

  function renderEquipModal() {
    UI().renderEquip(run.player, {
      onEquip: function (id) { window.Abyss.Player.equip(run.player, id); afterEquipChange(); },
      onUnequip: function (slot) { window.Abyss.Player.unequip(run.player, slot); afterEquipChange(); }
    });
  }

  function afterEquipChange() {
    window.Abyss.Audio.playSfx("ui_confirm");
    renderEquipModal();
    const active = document.querySelector(".screen.active");
    if (active && active.id === "screen-maze") renderMaze();
    persist();
  }

  // 打贏怪物後擲骰掉裝備：一般 40%、Boss 必掉。已擁有的不會重複掉。
  // 回傳 null / {item} / {item, full:true}（包包滿了撿不到）。
  function rollEquipmentDrop(isBoss) {
    const P = window.Abyss.Player;
    const all = Object.keys(data().equipment || {});
    const available = all.filter(function (id) { return !P.ownsEquipment(run.player, id); });
    if (available.length === 0) return null;
    if (!isBoss && Math.random() >= 0.4) return null;
    const item = data().equipment[available[Math.floor(Math.random() * available.length)]];
    if (!P.bagAddEquipment(run.player, item.id)) return { item: item, full: true };
    return { item: item };
  }

  // 一次裝備掉落 → 回傳要接在訊息後的字串；背包滿了則開「丟一個換」視窗。
  function equipDropMessage(drop) {
    if (!drop || !drop.item) return "";
    if (drop.full) {
      openReplaceBag(drop.item);
      return "　🎒 撿到【" + drop.item.name + "】，但背包滿了——請選擇丟棄一件或放棄。";
    }
    window.Abyss.Audio.playSfx("levelup");
    return "　✨ 撿到【" + drop.item.name + "】！（點右邊 🎒 包包 穿上）";
  }

  // 背包滿了：跳出視窗，讓玩家丟一件換新裝備（或放棄）。
  function openReplaceBag(item) {
    UI().renderPickupReplace(item, run.player, {
      onDiscard: function (i) {
        window.Abyss.Player.bagDiscardSlot(run.player, i);
        window.Abyss.Player.bagAddEquipment(run.player, item.id);
        window.Abyss.Audio.playSfx("levelup");
        UI().toggleModal("modal-pickup", false);
        UI().mazeMessage("你騰出空間，收下了【" + item.name + "】。（點 🎒 包包 穿上）");
        persist();
      },
      onCancel: function () {
        UI().toggleModal("modal-pickup", false);
        UI().mazeMessage("你放棄了【" + item.name + "】。");
      }
    });
    UI().toggleModal("modal-pickup", true);
  }

  // ---- 移動與轉向 ----
  function handleTurn(direction) {
    if (busy || !run) return;
    Maze().turn(direction);
    window.Abyss.Audio.playSfx("turn");
    renderMaze();
  }

  function handleMove(forward) {
    if (busy || !run) return;
    const result = Maze().move(forward);

    if (result.blocked) {
      run.wallBumps += 1;
      window.Abyss.Audio.playSfx("wall_bump");
      if (run.wallBumps % 3 === 0) {
        const q = QUIPS[run.player.classId];
        UI().mazeMessage("（撞牆）" + (q ? q.wall : "……又是一面牆。"));
      } else {
        UI().mazeMessage("前方是牆，無法前進。");
      }
      renderMaze();
      return;
    }

    run.wallBumps = 0;
    run.player.stats.steps += 1;
    window.Abyss.Audio.playSfx("footstep");
    renderMaze();
    mazeStepFeedback();

    const cell = result.cell;
    if (cell.exit) {
      persist();
      return victory();
    }
    if (cell.boss && !run.bossDefeated) {
      UI().mazeMessage("一道無面的身影擋住去路……");
      return startBossBattle();
    }
    if (cell.treasure) {
      return openChest(cell);
    }

    // 隨機遭遇。
    const enc = data().encounters.floor01;
    if (cell.encounterZone && Math.random() < enc.encounterRate) {
      return startEncounter();
    }
    UI().mazeMessage("你在門廊中前行。");
    persist();
  }

  // ---- 戰鬥 ----
  function startEncounter() {
    busy = true;
    window.Abyss.Audio.playMusic("floor01_battle");
    UI().showScreen("screen-battle");
    renderBattleBackdrop();
    window.Abyss.Battle.start({
      player: run.player,
      isBoss: false,
      encounter: data().encounters.floor01,
      areaName: "第一層・" + floor().name,
      onEnd: onBattleEnd
    });
  }

  function startBossBattle() {
    busy = true;
    window.Abyss.Audio.playMusic("boss_hermon");
    UI().showScreen("screen-battle");
    renderBattleBackdrop();
    window.Abyss.Battle.start({
      player: run.player,
      isBoss: true,
      encounter: data().encounters.floor01,
      areaName: "第一層・" + floor().name,
      bossLines: BOSS_LINES,
      onEnd: onBattleEnd
    });
  }

  // ---- 寶箱 ----
  // 走到寶箱格：先秀出寶箱圖，接著三成是擬態噬客（寶箱怪）、七成是寶物。
  function openChest(cell) {
    busy = true;
    Maze().consumeTile(cell.x, cell.y); // 開過就變普通走道，不重複觸發
    renderMaze();
    const mimic = Math.random() < 0.3;
    showChestReveal(mimic, function () {
      if (mimic) {
        UI().mazeMessage("你伸手掀開寶箱——箱蓋猛然裂成一嘴利齒！");
        return startMimicBattle();
      }
      window.Abyss.Audio.playSfx("levelup");
      const gold = randInt(12, 30);
      run.player.gold += gold;
      let msg = "你打開寶箱，裡面有 💰 +" + gold + " 金幣";
      const dmsg = equipDropMessage(rollEquipmentDrop(true)); // 寶箱＝必給可用裝備（若還有沒拿過的）
      msg += dmsg || "。";
      UI().mazeMessage(msg);
      busy = false;
      persist();
    });
  }

  function startMimicBattle() {
    busy = true;
    window.Abyss.Audio.playMusic("floor01_battle");
    UI().showScreen("screen-battle");
    renderBattleBackdrop();
    window.Abyss.Battle.start({
      player: run.player,
      isBoss: false,
      encounter: data().encounters.floor01,
      fixedFoes: ["mimic_chest"],
      areaName: "第一層・" + floor().name,
      onEnd: onBattleEnd
    });
  }

  // 寶箱揭示：把寶箱圖淡入置中約 1.1 秒後淡出，再執行 done。
  function showChestReveal(mimic, done) {
    const host = document.getElementById("app") || document.body;
    const ov = document.createElement("div");
    ov.className = "chest-reveal";
    ov.innerHTML = "<img src='assets/images/items/treasure_chest.png' alt=''>";
    host.appendChild(ov);
    window.Abyss.Audio.playSfx(mimic ? "wall_bump" : "ui_confirm");
    window.requestAnimationFrame(function () { ov.classList.add("show"); });
    window.setTimeout(function () {
      ov.classList.add("out");
      window.setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (done) done();
      }, 350);
    }, 1100);
  }

  function onBattleEnd(result) {
    if (result === "lose") {
      return death();
    }
    // 勝利 / 逃跑 → 回到迷宮。
    if (result === "win-boss") {
      run.bossDefeated = true;
    }
    busy = false;
    UI().showScreen("screen-maze");
    resizeCanvases();
    renderMaze();
    // 戰鬥結束平滑回到探索音樂。
    window.Abyss.Audio.playMusic("floor01_explore");

    let msg;
    if (result === "win-boss") {
      msg = "無面守門人倒下了。封印大門之後，通往第二層的出口就在上方。";
    } else if (result === "flee") {
      msg = "你暫時脫離了戰鬥。";
    } else {
      msg = "戰鬥結束，你繼續探索。";
      const p = run.player;
      if (p.hp < p.maxHp * 0.25) {
        const q = QUIPS[p.classId];
        if (q) msg = q.low;
      }
    }
    // 勝利時掉金幣 + 可能掉裝備。
    if (result === "win" || result === "win-boss") {
      const gold = result === "win-boss" ? randInt(45, 90) : randInt(5, 16);
      run.player.gold += gold;
      msg += "　💰 +" + gold + " 金幣";
      msg += equipDropMessage(rollEquipmentDrop(result === "win-boss"));
    }
    UI().mazeMessage(msg);
    persist();
  }

  // ---- 死亡歸零 ----
  function death() {
    const p = run.player;
    const banked = window.Abyss.Save.addToWallet(p.gold); // 金幣帶回家
    const stats = {
      className: p.className,
      level: p.level,
      kills: p.stats.kills,
      steps: p.stats.steps,
      floorName: floor().name,
      goldEarned: p.gold,
      goldTotal: banked
    };
    // 清除當輪資料（設定、圖鑑、金庫保留）。
    window.Abyss.Save.clearRun();
    window.Abyss.Audio.stopMusic();
    window.Abyss.Audio.playSfx("death");
    busy = false;
    UI().showDeath(stats);
    run = null;
  }

  // ---- 第一層完成 ----
  function victory() {
    const p = run.player;
    const banked = window.Abyss.Save.addToWallet(p.gold); // 金幣帶回家
    const stats = {
      className: p.className,
      level: p.level,
      kills: p.stats.kills,
      steps: p.stats.steps,
      goldEarned: p.gold,
      goldTotal: banked
    };
    busy = false;
    window.Abyss.Audio.stopMusic();
    window.Abyss.Audio.playSfx("victory");
    UI().showVictory(stats);
    // 第一層完成即為本次 MVP 終點；保留當輪資料到玩家按下「返回起點」。
  }

  function endRunToStart() {
    window.Abyss.Save.clearRun();
    run = null;
    busy = false;
    UI().showScreen("screen-start");
  }

  // ---- 存檔（結構預留，MVP 不做完整續玩）----
  function persist() {
    if (!run) return;
    window.Abyss.Save.saveRun({
      player: run.player,
      floorId: run.floorId,
      bossDefeated: run.bossDefeated,
      maze: Maze().serialize()
    });
  }

  return {
    newGame: newGame,
    handleMove: handleMove,
    handleTurn: handleTurn,
    openEquip: openEquip,
    endRunToStart: endRunToStart,
    currentPlayer: currentPlayer,
    refreshMaze: function () { if (run) renderMaze(); },
    isBusy: function () { return busy; },
    hasRun: function () { return !!run; }
  };
})();
