// js/save.js
// LocalStorage 介面：設定、圖鑑（永久保留）、當輪資料（死亡時清除）。
window.Abyss = window.Abyss || {};

window.Abyss.Save = (function () {
  "use strict";

  const KEYS = {
    settings: "abyss_settings",
    codex: "abyss_codex",
    run: "abyss_run_state",
    wallet: "abyss_wallet" // 永久金庫（金幣帶回家，死亡不清除）
  };

  const DEFAULT_SETTINGS = {
    // 三軌音量控制（0~1）＋總靜音，依 docs/06 規格。
    masterVolume: 0.7,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false
  };

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return clone(fallback);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
      return clone(fallback);
    } catch (err) {
      // 解析失敗時回退到預設值，避免壞資料讓遊戲崩潰。
      console.warn("[Save] 無法解析", key, err);
      return clone(fallback);
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("[Save] 無法寫入", key, err);
      return false;
    }
  }

  function clone(obj) {
    return obj === null ? null : JSON.parse(JSON.stringify(obj));
  }

  // ---- 設定 ----
  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, readJSON(KEYS.settings, DEFAULT_SETTINGS));
  }

  function setSettings(patch) {
    const next = Object.assign(getSettings(), patch || {});
    writeJSON(KEYS.settings, next);
    return next;
  }

  // ---- 圖鑑（永久保留，不提供戰力）----
  function getCodex() {
    return readJSON(KEYS.codex, {
      monsters: {},
      items: {},
      characters: {},
      events: {},
      relics: {},
      lore: {},
      secrets: {},
      endings: {}
    });
  }

  function unlockCodexEntry(category, id) {
    if (!id) return;
    const codex = getCodex();
    if (!codex[category]) codex[category] = {};
    if (!codex[category][id]) {
      codex[category][id] = { seen: true };
      writeJSON(KEYS.codex, codex);
    }
  }

  function unlockMonster(codexId) {
    unlockCodexEntry("monsters", codexId);
  }

  function unlockItem(codexId) {
    unlockCodexEntry("items", codexId);
  }

  // ---- 當輪資料 ----
  function saveRun(state) {
    return writeJSON(KEYS.run, state);
  }

  function loadRun() {
    return readJSON(KEYS.run, null);
  }

  function clearRun() {
    // 只清當輪資料，設定、圖鑑與金庫保留。
    try {
      window.localStorage.removeItem(KEYS.run);
    } catch (err) {
      console.warn("[Save] 無法清除當輪資料", err);
    }
  }

  // ---- 永久金庫（金幣帶回家）----
  function getWallet() {
    const w = readJSON(KEYS.wallet, { gold: 0 });
    return { gold: Math.max(0, Math.floor(w.gold || 0)) };
  }

  // 把本輪金幣存入金庫，回傳新的總額。
  function addToWallet(amount) {
    const w = getWallet();
    w.gold += Math.max(0, Math.floor(amount || 0));
    writeJSON(KEYS.wallet, w);
    return w.gold;
  }

  return {
    KEYS,
    getSettings,
    setSettings,
    getCodex,
    unlockMonster,
    unlockItem,
    saveRun,
    loadRun,
    clearRun,
    getWallet,
    addToWallet
  };
})();
