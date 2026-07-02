// js/audio.js
// 音訊管理介面（依 docs/06_MUSIC_AND_AUDIO.md）。
// 重點：
//  - 三軌音量：總音量 / 音樂 / 音效，另有總靜音，設定存 LocalStorage。
//  - 瀏覽器政策：玩家第一次操作後才解鎖並開始播放。
//  - 檔案不存在時優雅降級：改用 WebAudio 合成的「占位音」，不放損壞空白檔。
//  - 音樂支援淡入淡出與分軌（探索 / 戰鬥 / Boss），未來可無縫替換為正式 OGG。
window.Abyss = window.Abyss || {};

window.Abyss.Audio = (function () {
  "use strict";

  // 未來替換正式素材時填入實際路徑；目前檔案不存在會自動降級為占位合成音。
  // 真實音樂檔（存在就用檔案播放；沒列在這裡的 key 會退回占位合成音）。
  const MUSIC_FILES = {
    menu_theme: "assets/audio/music/menu_theme.mp3"
    // 之後做好樓層/戰鬥音樂，放這裡即可：
    // floor01_explore: "assets/audio/music/floor01_explore.mp3",
    // floor01_battle:  "assets/audio/music/floor01_battle.mp3",
    // boss_hermon:     "assets/audio/music/boss_hermon.mp3"
  };
  const SFX_FILES = {
    footstep: "assets/audio/sfx/footsteps_stone_01.ogg",
    wall_bump: "assets/audio/sfx/wall_bump_01.ogg",
    turn: "assets/audio/sfx/turn_01.ogg",
    sword_hit: "assets/audio/sfx/sword_hit_01.ogg",
    shield: "assets/audio/sfx/shield_block_01.ogg",
    arrow: "assets/audio/sfx/arrow_01.ogg",
    fire: "assets/audio/sfx/fire_spell_01.ogg",
    hurt: "assets/audio/sfx/monster_hurt_01.ogg",
    die: "assets/audio/sfx/monster_die_01.ogg",
    crit: "assets/audio/sfx/crit_01.ogg",
    potion: "assets/audio/sfx/potion_01.ogg",
    ui_confirm: "assets/audio/sfx/ui_confirm_01.ogg",
    levelup: "assets/audio/sfx/levelup_01.ogg",
    codex: "assets/audio/sfx/codex_01.ogg",
    death: "assets/audio/sfx/death_01.ogg",
    victory: "assets/audio/sfx/victory_01.ogg"
  };

  // 占位合成音：各類別的頻率 / 波形（未來被真實檔案取代）。
  const SFX_TONES = {
    footstep: { freq: 120, type: "triangle", dur: 0.08, gain: 0.22 },
    wall_bump: { freq: 70, type: "square", dur: 0.13, gain: 0.3, sweep: -20 },
    turn: { freq: 240, type: "sine", dur: 0.06, gain: 0.14 },
    sword_hit: { freq: 200, type: "sawtooth", dur: 0.1, gain: 0.28, sweep: -60 },
    shield: { freq: 150, type: "square", dur: 0.12, gain: 0.28 },
    arrow: { freq: 520, type: "sine", dur: 0.09, gain: 0.2, sweep: -120 },
    fire: { freq: 320, type: "sawtooth", dur: 0.18, gain: 0.24, sweep: -180 },
    hurt: { freq: 160, type: "square", dur: 0.1, gain: 0.24, sweep: -60 },
    die: { freq: 140, type: "sawtooth", dur: 0.28, gain: 0.28, sweep: -110 },
    crit: { freq: 660, type: "square", dur: 0.13, gain: 0.3, sweep: 120 },
    potion: { freq: 480, type: "sine", dur: 0.16, gain: 0.2, sweep: 220 },
    ui_confirm: { freq: 420, type: "sine", dur: 0.07, gain: 0.16 },
    levelup: { freq: 523, type: "triangle", dur: 0.4, gain: 0.24, sweep: 400 },
    codex: { freq: 600, type: "sine", dur: 0.12, gain: 0.16 },
    death: { freq: 90, type: "sawtooth", dur: 0.7, gain: 0.3, sweep: -50 },
    victory: { freq: 523, type: "triangle", dur: 0.5, gain: 0.26, sweep: 300 }
  };

  let ctx = null;             // WebAudio context（首次互動後建立）
  let masterGain = null;      // 總音量
  let musicGain = null;       // 音樂匯流
  let sfxGain = null;         // 音效匯流
  let settings = null;
  let unlocked = false;       // 首次互動後才可播放
  let pending = null;         // 等待解鎖後播放的音樂 { key, opts }
  let currentKey = null;      // 目前音樂 key
  let placeholderNodes = null; // 占位合成音樂節點群
  let musicAudio = null;       // 真實音樂檔（HTMLAudio；例如登入音樂）

  function Save() { return window.Abyss.Save; }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function init() {
    settings = Save().getSettings();
    // 首次互動（滑鼠 / 觸控 / 鍵盤任一）即解鎖音訊。
    const unlock = function () { enable(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
  }

  function enable() {
    if (unlocked) return;
    unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC();
        masterGain = ctx.createGain();
        musicGain = ctx.createGain();
        sfxGain = ctx.createGain();
        musicGain.connect(masterGain);
        sfxGain.connect(masterGain);
        masterGain.connect(ctx.destination);
        applyVolumes();
      }
    } catch (e) {
      ctx = null;
    }
    if (pending) {
      const p = pending; pending = null;
      playMusic(p.key, p.opts);
    }
  }

  function effMaster() { return settings.muted ? 0 : clamp01(settings.masterVolume); }

  function musicFileVolume() { return clamp01(effMaster() * clamp01(settings.musicVolume)); }

  function applyVolumes() {
    if (musicAudio) musicAudio.volume = musicFileVolume(); // 真實音樂檔跟著總音量/音樂/靜音
    if (!ctx) return;
    const t = ctx.currentTime;
    masterGain.gain.setTargetAtTime(effMaster(), t, 0.02);
    musicGain.gain.setTargetAtTime(clamp01(settings.musicVolume), t, 0.02);
    sfxGain.gain.setTargetAtTime(clamp01(settings.sfxVolume), t, 0.02);
  }

  // ---- 設定 ----
  function getSettings() { return Object.assign({}, settings); }
  function persist() {
    Save().setSettings({
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      muted: settings.muted
    });
  }
  function setMasterVolume(v) { settings.masterVolume = clamp01(v); persist(); applyVolumes(); }
  function setMusicVolume(v) { settings.musicVolume = clamp01(v); persist(); applyVolumes(); }
  function setSfxVolume(v) { settings.sfxVolume = clamp01(v); persist(); applyVolumes(); }
  function setMuted(m) { settings.muted = !!m; persist(); applyVolumes(); }
  function toggleMuted() { setMuted(!settings.muted); return settings.muted; }

  // ---- 音樂 ----
  // 遇敵淡出探索、切戰鬥；結束平滑回探索；Boss 用獨立音樂。避免硬切。
  function playMusic(key, opts) {
    opts = opts || {};
    if (!unlocked) { pending = { key: key, opts: opts }; currentKey = key; return; }
    if (currentKey === key && (placeholderNodes || musicAudio)) return; // 已在播放同一首
    currentKey = key;
    stopPlaceholderMusic(0.4);
    stopFileMusic(0.4);
    // 有真實檔案就播檔案（如登入音樂），否則退回占位合成 drone。
    if (MUSIC_FILES[key]) startFileMusic(key);
    else startPlaceholderMusic(key);
  }

  function stopMusic() { currentKey = null; stopPlaceholderMusic(0.5); stopFileMusic(0.5); }

  // 真實音樂檔（HTMLAudio）：循環播放、淡入淡出，音量跟隨設定。
  function startFileMusic(key) {
    const url = MUSIC_FILES[key];
    if (!url) return;
    const a = new Audio(url);
    a.loop = true; a.preload = "auto"; a.volume = 0;
    musicAudio = a;
    const play = a.play();
    if (play && play.catch) play.catch(function () {}); // 尚未解鎖等情況：忽略
    let i = 0; const steps = 24;
    const iv = setInterval(function () {
      if (musicAudio !== a) { clearInterval(iv); return; } // 已被切換掉
      i++; a.volume = clamp01(musicFileVolume() * (i / steps));
      if (i >= steps) { clearInterval(iv); a.volume = musicFileVolume(); }
    }, 30);
  }

  function stopFileMusic(fade) {
    const a = musicAudio;
    if (!a) return;
    musicAudio = null;
    const v0 = a.volume, steps = 16; let i = 0;
    const ms = Math.max(50, ((fade || 0.4) * 1000) / steps);
    const iv = setInterval(function () {
      i++; a.volume = clamp01(v0 * (1 - i / steps));
      if (i >= steps) { clearInterval(iv); try { a.pause(); } catch (e) {} a.removeAttribute("src"); }
    }, ms);
  }

  // 占位音樂：低沉 drone，依 key 給不同音高與呼吸感，示範分軌與淡入淡出。
  function startPlaceholderMusic(key) {
    if (!ctx) return;
    const base = key === "boss_hermon" ? 55 : (key === "floor01_battle" ? 82 : 65); // Hz
    const nodes = { osc: [], gain: ctx.createGain(), lfo: null, lfoGain: null };
    nodes.gain.gain.value = 0;
    nodes.gain.connect(musicGain);
    const freqs = key === "floor01_battle" ? [base, base * 1.5, base * 2] : [base, base * 1.5];
    freqs.forEach(function (f, i) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.16;
      o.connect(g); g.connect(nodes.gain);
      o.start();
      nodes.osc.push(o);
    });
    // 緩慢音量起伏（呼吸感 / 石室氛圍）。
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = key === "boss_hermon" ? 0.22 : 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain); lfoGain.connect(nodes.gain.gain); lfo.start();
    nodes.lfo = lfo; nodes.lfoGain = lfoGain;
    // 淡入。
    const target = key === "floor01_explore" ? 0.2 : 0.28;
    nodes.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
    placeholderNodes = nodes;
  }

  function stopPlaceholderMusic(fade) {
    if (!placeholderNodes || !ctx) { placeholderNodes = null; return; }
    const n = placeholderNodes; placeholderNodes = null;
    const t = ctx.currentTime;
    n.gain.gain.cancelScheduledValues(t);
    n.gain.gain.setTargetAtTime(0, t, Math.max(0.05, (fade || 0.4) / 3));
    const stopAt = t + (fade || 0.4) + 0.12;
    n.osc.forEach(function (o) { try { o.stop(stopAt); } catch (e) {} });
    try { n.lfo.stop(stopAt); } catch (e) {}
  }

  // ---- 音效 ----
  function playSfx(key) {
    if (!unlocked || !ctx) return;
    if (effMaster() <= 0) return;
    const tone = SFX_TONES[key];
    if (!tone) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = tone.type;
    o.frequency.setValueAtTime(tone.freq, now);
    if (tone.sweep) {
      o.frequency.linearRampToValueAtTime(Math.max(20, tone.freq + tone.sweep), now + tone.dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(tone.gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + tone.dur);
    o.connect(g); g.connect(sfxGain);
    o.start(now);
    o.stop(now + tone.dur + 0.03);
  }

  return {
    init: init,
    enable: enable,
    getSettings: getSettings,
    setMasterVolume: setMasterVolume,
    setMusicVolume: setMusicVolume,
    setSfxVolume: setSfxVolume,
    setMuted: setMuted,
    toggleMuted: toggleMuted,
    playMusic: playMusic,
    stopMusic: stopMusic,
    playSfx: playSfx,
    isUnlocked: function () { return unlocked; },
    getMusicState: function () {
      return musicAudio ? {
        paused: musicAudio.paused,
        t: Math.round(musicAudio.currentTime * 100) / 100,
        vol: Math.round(musicAudio.volume * 100) / 100,
        ready: musicAudio.readyState,
        src: (musicAudio.currentSrc || musicAudio.src || "").split("/").pop()
      } : "無（沒有檔案音樂在播）";
    },
    // 供未來替換素材參考。
    MUSIC_FILES: MUSIC_FILES,
    SFX_FILES: SFX_FILES
  };
})();
