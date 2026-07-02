// js/main.js
// 應用程式入口：初始化、畫面切換與事件綁定。
(function () {
  "use strict";

  const Abyss = window.Abyss;

  function $(id) { return document.getElementById(id); }

  // 固定 1920×1080 舞台等比縮放置中。
  function fitStage() {
    const app = $("app");
    if (!app) return;
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const x = Math.round((window.innerWidth - 1920 * s) / 2);
    const y = Math.round((window.innerHeight - 1080 * s) / 2);
    app.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
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
    bindButton("btn-settings", function () { syncAudioPanel(); Abyss.UI.toggleModal("modal-audio", true); });
    bindButton("btn-instructions", function () { Abyss.UI.toggleInstructions(true); });
    bindButton("btn-instructions-close", function () { Abyss.UI.toggleInstructions(false); });
    bindButton("btn-fullscreen", toggleFullscreen);
    bindButton("btn-volume", function () { toggleTrack("sfx"); updateAudioChips(); });
    bindButton("btn-music", function () { toggleTrack("music"); updateAudioChips(); });
    // 圖鑑尚未製作，先停用（資料已在記錄，日後補瀏覽介面）。
    if ($("btn-codex")) $("btn-codex").disabled = true;
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
    bindButton("btn-maze-settings", function () { syncAudioPanel(); Abyss.UI.toggleModal("modal-audio", true); });

    // 迷宮小地圖：縮放與「查看地圖詳情」。
    bindButton("btn-map-zoomin", function () { Abyss.Maze.zoomMinimap(1); Abyss.Game.refreshMaze(); });
    bindButton("btn-map-zoomout", function () { Abyss.Maze.zoomMinimap(-1); Abyss.Game.refreshMaze(); });
    bindButton("btn-map-detail", function () { Abyss.UI.mazeMessage("完整地圖檢視之後開放，先用右上角小地圖探索吧。"); });

    // 戰鬥設定鈕。
    bindButton("btn-battle-settings", function () { syncAudioPanel(); Abyss.UI.toggleModal("modal-audio", true); });

    // 戰鬥動作。
    bindButton("btn-attack", function () { Abyss.Battle.chooseAttack(); });
    bindButton("btn-skill", function () { Abyss.Battle.chooseSkill(); });
    bindButton("btn-item", function () { Abyss.Battle.chooseItem(); });
    bindButton("btn-flee", function () { Abyss.Battle.chooseFlee(); });

    // 死亡 / 勝利。
    bindButton("btn-death-restart", function () { Abyss.UI.showScreen("screen-start"); });
    bindButton("btn-victory-continue", function () { Abyss.Game.endRunToStart(); });

    // 鍵盤。
    window.addEventListener("keydown", onKey);
    // 開發：R 鍵切換參考圖疊層。
    window.addEventListener("keydown", function (e) {
      if ((e.key === "r" || e.key === "R") && !/input|textarea/i.test((e.target.tagName || ""))) cycleRef();
    });

    // 1920×1080 舞台縮放。
    fitStage();
    window.addEventListener("resize", fitStage);

    Abyss.UI.showScreen("screen-start");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
