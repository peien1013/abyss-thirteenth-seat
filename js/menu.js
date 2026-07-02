// js/menu.js
// 主選單主視覺：每次進入主選單時，隨機換一個我們設計過的角色或物品，
// 並在周圍散發一圈「適合它」的光芒。
(function () {
  "use strict";

  window.Abyss = window.Abyss || {};

  // 展示池：英雄用全身圖直接顯示；怪物 / 道具 / 裝備用 Sprites 去背後顯示。
  // glow = 該角色 / 物品專屬的光芒顏色。
  const SHOWCASE = [
    // 英雄（全身立繪）
    { kind: "hero", src: "assets/characters/warrior_full.jpg", glow: "#c0362f", name: "戰士" },
    { kind: "hero", src: "assets/characters/ranger_full.jpg", glow: "#5c8a5a", name: "遊俠" },
    { kind: "hero", src: "assets/characters/mage_full.jpg", glow: "#3f6fae", name: "法師" },
    { kind: "hero", src: "assets/characters/rogue_full.jpg", glow: "#7d5fa0", name: "盜賊" },
    // 怪物
    { kind: "monster", id: "helmet_rat", glow: "#9a7a4a", name: "頭盔鼠" },
    { kind: "monster", id: "candle_slime", glow: "#e0a94e", name: "燭蠟史萊姆" },
    { kind: "monster", id: "crying_mushroom", glow: "#7bb37e", name: "哭臉蘑菇" },
    { kind: "monster", id: "broken_fang_bat", glow: "#9a6fae", name: "碎牙蝙蝠" },
    { kind: "monster", id: "rotten_skeleton", glow: "#cbbd93", name: "腐朽骷髏" },
    { kind: "monster", id: "hermon", glow: "#b02730", name: "赫爾蒙" },
    { kind: "monster", id: "_extra_undead_knight", glow: "#6f8a9a", name: "不死騎士" },
    // 道具
    { kind: "item", id: "red_potion", glow: "#c73a34", name: "紅色藥水" },
    { kind: "item", id: "mana_dew", glow: "#3f7ad0", name: "法力朝露" },
    { kind: "item", id: "ash_bandage", glow: "#b9a98f", name: "灰燼繃帶" },
    // 裝備
    { kind: "equip", id: "blood_dagger", glow: "#c0362f", name: "血刃匕首" },
    { kind: "equip", id: "gate_shield", glow: "#caa54a", name: "門印圓盾" },
    { kind: "equip", id: "lily_ring", glow: "#d98ab0", name: "百合戒指" },
    { kind: "equip", id: "vow_amulet", glow: "#e0c060", name: "誓約護符" },
    { kind: "equip", id: "winged_emblem", glow: "#7ad0d0", name: "羽翼徽記" }
  ];

  let lastIndex = -1;

  function pickIndex() {
    if (SHOWCASE.length <= 1) return 0;
    let i = Math.floor(Math.random() * SHOWCASE.length);
    // 避免和上一次一模一樣。
    if (i === lastIndex) i = (i + 1) % SHOWCASE.length;
    lastIndex = i;
    return i;
  }

  function figureNode(entry) {
    const S = window.Abyss.Sprites;
    if (entry.kind === "hero") {
      const img = document.createElement("img");
      img.src = entry.src;
      img.alt = "";
      img.setAttribute("onerror", "this.style.display='none'");
      return img;
    }
    if (!S) return document.createElement("div");
    if (entry.kind === "monster") return S.monsterNode(entry.id);
    if (entry.kind === "item") return S.itemNode(entry.id);
    return S.equipNode(entry.id);
  }

  // 換一個新的主視覺（進入主選單時呼叫）。
  function refreshShowcase() {
    const box = document.getElementById("menu-character");
    const fig = document.getElementById("menu-figure");
    if (!box || !fig) return;
    const entry = SHOWCASE[pickIndex()];

    box.className = "menu-character layer show-" + entry.kind;
    box.style.setProperty("--glow-color", entry.glow);
    box.setAttribute("data-name", entry.name);

    fig.innerHTML = "";
    fig.appendChild(figureNode(entry));

    // 重播淡入 / 光暈動畫。
    box.classList.remove("swap-in");
    void box.offsetWidth;
    box.classList.add("swap-in");
  }

  window.Abyss.Menu = {
    refreshShowcase: refreshShowcase,
    showcaseCount: function () { return SHOWCASE.length; }
  };
})();
