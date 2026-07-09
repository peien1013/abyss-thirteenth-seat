// js/main.js
// 應用程式入口：初始化、畫面切換與事件綁定。
(function () {
  "use strict";

  const Abyss = window.Abyss;

  function $(id) { return document.getElementById(id); }

  // ================= 鍵盤快捷鍵（戰鬥動作，可在設定裡自訂，存於瀏覽器） =================
  const KEY_DEFAULTS = { attack: "A", skill: "S", item: "D", flee: "F" };
  let keyBinds = (function () {
    try { return Object.assign({}, KEY_DEFAULTS, JSON.parse(localStorage.getItem("abyss_keybinds") || "{}")); }
    catch (e) { return Object.assign({}, KEY_DEFAULTS); }
  })();
  let rebinding = null; // 設定中：正在等待新按鍵的 { act, btn }
  function saveKeyBinds() { try { localStorage.setItem("abyss_keybinds", JSON.stringify(keyBinds)); } catch (e) {} }
  function keyFor(action) { return String(keyBinds[action] || KEY_DEFAULTS[action] || "").toUpperCase(); }

  const BATTLE_ACTIONS = [
    { id: "btn-attack", act: "attack", name: "攻擊", fn: function () { Abyss.Battle.chooseAttack(); } },
    { id: "btn-skill", act: "skill", name: "技能", fn: function () { Abyss.Battle.chooseSkill(); } },
    { id: "btn-item", act: "item", name: "道具", fn: function () { Abyss.Battle.chooseItem(); } },
    { id: "btn-flee", act: "flee", name: "逃跑", fn: function () { Abyss.Battle.chooseFlee(); } }
  ];

  // 在按鈕角落顯示對應鍵盤字母。
  function updateKeyBadges() {
    BATTLE_ACTIONS.forEach(function (a) { setBadge(a.id, keyFor(a.act)); });
    // 迷宮方向鍵：固定 W／A／S／D 提示。
    setBadge("btn-forward", "W"); setBadge("btn-left", "A"); setBadge("btn-back", "S"); setBadge("btn-right", "D");
  }
  function setBadge(id, text) {
    const btn = $(id); if (!btn) return;
    let kb = btn.querySelector(".key-badge");
    if (!kb) { kb = document.createElement("span"); kb.className = "key-badge"; btn.appendChild(kb); }
    kb.textContent = text;
  }

  // 戰鬥中：按下綁定的鍵 → 觸發對應動作。
  function onBattleKey(e) {
    if (rebinding) return;
    const el = Abyss.UI.el.screens["screen-battle"];
    if (!el || !el.classList.contains("active")) return;
    if (/input|textarea/i.test((e.target.tagName || ""))) return;
    const k = String(e.key || "").toUpperCase();
    for (let i = 0; i < BATTLE_ACTIONS.length; i++) {
      if (k && k === keyFor(BATTLE_ACTIONS[i].act)) { e.preventDefault(); BATTLE_ACTIONS[i].fn(); return; }
    }
  }

  // 設定畫面：列出可改的按鍵。
  function renderKeybinds() {
    const list = $("keybind-list"); if (!list) return;
    list.innerHTML = "";
    BATTLE_ACTIONS.forEach(function (a) {
      const row = document.createElement("div"); row.className = "keybind-row";
      const label = document.createElement("span"); label.className = "keybind-label"; label.textContent = a.name;
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "keybind-key"; btn.textContent = keyFor(a.act);
      btn.addEventListener("click", function () {
        if (rebinding && rebinding.btn) { rebinding.btn.textContent = keyFor(rebinding.act); rebinding.btn.classList.remove("listening"); }
        rebinding = { act: a.act, btn: btn };
        btn.textContent = "按任意鍵…"; btn.classList.add("listening");
      });
      row.appendChild(label); row.appendChild(btn); list.appendChild(row);
    });
  }
  // 攔截設定中的按鍵（capture：搶在遊戲鍵前面）。
  function handleRebindKey(e) {
    if (!rebinding) return;
    e.preventDefault(); e.stopPropagation();
    const k = String(e.key || "").toUpperCase();
    if (k === "ESCAPE") { rebinding.btn.textContent = keyFor(rebinding.act); rebinding.btn.classList.remove("listening"); rebinding = null; return; }
    if (!/^[A-Z0-9]$/.test(k)) return; // 只接受字母或數字
    const oldKey = keyFor(rebinding.act);
    // 若此鍵已綁其他動作 → 交換（避免兩個動作同一鍵）。
    BATTLE_ACTIONS.forEach(function (a) { if (a.act !== rebinding.act && keyFor(a.act) === k) keyBinds[a.act] = oldKey; });
    keyBinds[rebinding.act] = k; saveKeyBinds();
    rebinding.btn.classList.remove("listening"); rebinding = null;
    renderKeybinds(); updateKeyBadges();
  }
  function openSettings() { syncAudioPanel(); renderKeybinds(); Abyss.UI.toggleModal("modal-audio", true); }

  // 固定 1920×1080 舞台等比縮放置中。
  function fitStage() {
    const app = $("app");
    if (!app) return;
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const x = Math.round((window.innerWidth - 1920 * s) / 2);
    const y = Math.round((window.innerHeight - 1080 * s) / 2);
    app.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
  }

  // 場景背景圖：放了 assets/images/scenes/<name>（.png 本機／.jpg 部署）就套為畫面背景。
  // scrim = 疊在圖上的暗色漸層，確保文字／面板讀得清楚。放圖進去即自動生效，毋須改程式。
  function setSceneBg(el, name, scrim) {
    if (!el) return;
    const base = "assets/images/scenes/" + name;
    const apply = function (url) {
      el.style.backgroundImage = (scrim ? scrim + ", " : "") + "url('" + url + "')";
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    };
    const probe = function (url, ok, fail) { const im = new Image(); im.onload = function () { ok(url); }; im.onerror = fail; im.src = url; };
    probe(base + ".jpg", apply, function () { probe(base + ".png", apply, function () {}); });
  }

  // 開發用：按 R 切換參考圖疊層透明度（0 / 50% / 100%），供逐像素對齊。
  const REF_LEVELS = [0, 0.5, 1];
  let refIdx = 0;
  function cycleRef() {
    refIdx = (refIdx + 1) % REF_LEVELS.length;
    Array.prototype.forEach.call(document.querySelectorAll(".ref-overlay"),
      function (o) {
        // 參考圖只在開發者第一次按 R 時才載入，正式網站不會下載這幾張大圖。
        if (!o.getAttribute("src") && o.dataset.src) o.setAttribute("src", o.dataset.src);
        o.style.opacity = REF_LEVELS[refIdx];
      });
  }

  function onKey(e) {
    // 僅在迷宮畫面且非忙碌時接受移動鍵。
    const mazeActive = Abyss.UI.el.screens["screen-maze"] &&
      Abyss.UI.el.screens["screen-maze"].classList.contains("active");
    if (!mazeActive || Abyss.Game.isBusy()) return;

    switch (e.key) {
      case "w": case "W": case "ArrowUp":
        e.preventDefault(); Abyss.Game.handleMove(true); break;
      case "s": case "S": case "ArrowDown":
        e.preventDefault(); Abyss.Game.handleMove(false); break;
      case "a": case "A": case "ArrowLeft":
        e.preventDefault(); Abyss.Game.handleTurn("left"); break;
      case "d": case "D": case "ArrowRight":
        e.preventDefault(); Abyss.Game.handleTurn("right"); break;
      default: break;
    }
  }

  function toggleFullscreen() {
    const doc = document;
    const root = doc.documentElement;
    if (!doc.fullscreenElement) {
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(function () {});
      } else {
        Abyss.UI.mazeMessage("此瀏覽器不支援全螢幕。");
      }
    } else if (doc.exitFullscreen) {
      doc.exitFullscreen().catch(function () {});
    }
  }

  function bindButton(id, handler) {
    const node = $(id);
    if (node) node.addEventListener("click", handler);
  }

  // 主選單底部的音效 / 音樂快速開關晶片。
  function updateAudioChips() {
    const s = Abyss.Audio.getSettings();
    const v = $("btn-volume"), m = $("btn-music");
    if (v) { const on = s.sfxVolume > 0 && !s.muted; v.textContent = (on ? "🔊" : "🔇") + " 音效"; v.classList.toggle("off", !on); }
    if (m) { const on = s.musicVolume > 0 && !s.muted; m.textContent = (on ? "🎵" : "🔇") + " 音樂"; m.classList.toggle("off", !on); }
  }
  function toggleTrack(kind) {
    const s = Abyss.Audio.getSettings();
    if (kind === "sfx") Abyss.Audio.setSfxVolume(s.sfxVolume > 0 ? 0 : 0.8);
    else Abyss.Audio.setMusicVolume(s.musicVolume > 0 ? 0 : 0.6);
  }

  function setSlider(id, value01) {
    const input = $(id);
    if (input) input.value = Math.round(value01 * 100);
    const val = $(id + "-val");
    if (val) val.textContent = Math.round(value01 * 100);
  }

  function syncAudioPanel() {
    const s = Abyss.Audio.getSettings();
    setSlider("vol-master", s.masterVolume);
    setSlider("vol-music", s.musicVolume);
    setSlider("vol-sfx", s.sfxVolume);
    const chk = $("chk-mute");
    if (chk) chk.checked = !!s.muted;
    updateAudioChips();
  }

  function bindSlider(id, setter) {
    const input = $(id);
    if (!input) return;
    input.addEventListener("input", function () {
      const v = Number(input.value) / 100;
      setter(v);
      const val = $(id + "-val");
      if (val) val.textContent = input.value;
      updateAudioChips();
    });
  }

  function init() {
    Abyss.UI.init();
    Abyss.Audio.init();

    // 讀取設定（音效 / 音樂晶片初始狀態）。
    updateAudioChips();

    // 職業卡。
    Abyss.UI.renderClassCards(window.GAME_DATA.classes, function (classId) {
      Abyss.Game.newGame(classId);
    });

    // 主選單。
    bindButton("btn-new-game", function () { Abyss.UI.showScreen("screen-class"); });
    bindButton("btn-settings", openSettings);
    bindButton("btn-instructions", function () { Abyss.UI.toggleInstructions(true); });
    bindButton("btn-instructions-close", function () { Abyss.UI.toggleInstructions(false); });
    bindButton("btn-fullscreen", toggleFullscreen);
    bindButton("btn-volume", function () { toggleTrack("sfx"); updateAudioChips(); });
    bindButton("btn-music", function () { toggleTrack("music"); updateAudioChips(); });
    // 圖鑑（主選單與迷宮都可開）。
    let codexCat = "monster";
    function openCodex() {
      Abyss.UI.renderCodex(codexCat);
      Abyss.UI.toggleModal("modal-codex", true);
      Abyss.Audio.playSfx("codex");
    }
    bindButton("btn-codex", openCodex);
    bindButton("btn-codex2", openCodex);
    bindButton("btn-codex-close", function () { Abyss.UI.toggleModal("modal-codex", false); });
    document.addEventListener("click", function (e) {
      const tab = e.target.closest(".codex-tab");
      if (!tab) return;
      codexCat = tab.getAttribute("data-cat");
      Array.prototype.forEach.call(document.querySelectorAll(".codex-tab"),
        function (t) { t.classList.toggle("active", t === tab); });
      Abyss.UI.renderCodex(codexCat);
    });
    bindButton("btn-audio-close", function () { Abyss.UI.toggleModal("modal-audio", false); });
    bindSlider("vol-master", Abyss.Audio.setMasterVolume);
    bindSlider("vol-music", Abyss.Audio.setMusicVolume);
    bindSlider("vol-sfx", Abyss.Audio.setSfxVolume);
    const chkMute = $("chk-mute");
    if (chkMute) chkMute.addEventListener("change", function () {
      Abyss.Audio.setMuted(chkMute.checked);
      updateAudioChips();
    });

    // 按鈕確認音效（排除方向鍵，避免與腳步/轉向音重複）。
    document.addEventListener("click", function (e) {
      const b = e.target.closest("button.btn, button.plate-btn, button.chip-btn, button.disc-btn");
      if (b && !b.disabled && !b.classList.contains("dbtn")) Abyss.Audio.playSfx("ui_confirm");
    });

    // 職業選擇畫面。
    bindButton("btn-class-back", function () { Abyss.UI.showScreen("screen-start"); });

    // 迷宮方向鍵（電腦與手機共用）。
    bindButton("btn-forward", function () { Abyss.Game.handleMove(true); });
    bindButton("btn-back", function () { Abyss.Game.handleMove(false); });
    bindButton("btn-left", function () { Abyss.Game.handleTurn("left"); });
    bindButton("btn-right", function () { Abyss.Game.handleTurn("right"); });

    // 裝備視窗。
    bindButton("btn-equip", function () { Abyss.Game.openEquip(); });
    bindButton("btn-equip-close", function () { Abyss.UI.toggleModal("modal-equip", false); });

    // 迷宮右下功能鍵：狀態＝角色面板；設定＝音訊面板；圖鑑暫停用。
    bindButton("btn-status", function () { Abyss.Game.openEquip(); });
    bindButton("btn-maze-settings", openSettings);

    // 迷宮小地圖：縮放與「查看地圖詳情」。
    bindButton("btn-map-zoomin", function () { Abyss.Maze.zoomMinimap(1); Abyss.Game.refreshMaze(); });
    bindButton("btn-map-zoomout", function () { Abyss.Maze.zoomMinimap(-1); Abyss.Game.refreshMaze(); });
    bindButton("btn-map-detail", function () { Abyss.UI.mazeMessage("完整地圖檢視之後開放，先用右上角小地圖探索吧。"); });

    // 戰鬥設定鈕。
    bindButton("btn-battle-settings", openSettings);
    bindButton("btn-keys-reset", function () {
      keyBinds = Object.assign({}, KEY_DEFAULTS); saveKeyBinds(); renderKeybinds(); updateKeyBadges();
    });

    // 戰鬥動作。
    bindButton("btn-attack", function () { Abyss.Battle.chooseAttack(); });
    bindButton("btn-skill", function () { Abyss.Battle.chooseSkill(); });
    bindButton("btn-item", function () { Abyss.Battle.chooseItem(); });
    bindButton("btn-flee", function () { Abyss.Battle.chooseFlee(); });
    // 戰鬥按鈕圖示：放了 assets/images/ui/<name>.png 就用圖取代 emoji（沒放則維持 emoji）。
    [["btn-attack", "attack"], ["btn-skill", "skill"], ["btn-item", "item"], ["btn-flee", "flee"]].forEach(function (p) {
      const btn = $(p[0]); if (!btn) return;
      const ico = btn.querySelector(".at-ico"); if (!ico) return;
      const img = new Image();
      img.onload = function () { ico.innerHTML = "<img class='at-img' src='assets/images/ui/" + p[1] + ".png' alt=''>"; };
      img.src = "assets/images/ui/" + p[1] + ".png";
    });

    // 死亡 / 勝利。
    bindButton("btn-death-restart", function () { Abyss.UI.showScreen("screen-start"); });
    bindButton("btn-victory-continue", function () { Abyss.Game.endRunToStart(); });

    // 鍵盤。
    window.addEventListener("keydown", handleRebindKey, true); // capture：設定改鍵時搶先攔截
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onBattleKey);
    updateKeyBadges();
    // 開發：R 鍵切換參考圖疊層。
    window.addEventListener("keydown", function (e) {
      if ((e.key === "r" || e.key === "R") && !/input|textarea/i.test((e.target.tagName || ""))) cycleRef();
    });

    // 1920×1080 舞台縮放。
    fitStage();
    window.addEventListener("resize", fitStage);

    // 場景背景圖（主選單／死亡／勝利）。有放圖就套上，沒放則維持原本樣式。
    setSceneBg(document.querySelector("#screen-start .menu-bg"), "menu_bg",
      "linear-gradient(rgba(9,7,6,0.28), rgba(6,4,4,0.55))");
    setSceneBg($("screen-death"), "death_bg",
      "linear-gradient(rgba(6,5,6,0.5), rgba(3,3,4,0.7))");
    setSceneBg($("screen-victory"), "victory_bg",
      "linear-gradient(rgba(10,8,5,0.4), rgba(5,4,3,0.62))");

    // 點擊進入開場：第一次點擊＝解鎖音訊（開始播放登入音樂）＋淡出開場畫面。
    const splash = $("enter-splash");
    if (splash) {
      const enterGame = function () {
        Abyss.Audio.enable();
        splash.classList.add("hide");
        window.setTimeout(function () { splash.style.display = "none"; }, 750);
        splash.removeEventListener("pointerdown", enterGame);
      };
      splash.addEventListener("pointerdown", enterGame);
    }

    Abyss.UI.showScreen("screen-start");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
