// js/player.js
// 玩家資料：職業套用、屬性、技能狀態、經驗與升級。
window.Abyss = window.Abyss || {};

window.Abyss.Player = (function () {
  "use strict";

  const BAG_MAX = 10; // 包包最多 10 格（暗黑風）
  const START_BAG = [
    { kind: "consumable", id: "red_potion", count: 3 },
    { kind: "consumable", id: "mana_dew", count: 2 },
    { kind: "consumable", id: "ash_bandage", count: 2 }
  ];

  // 依職業建立一名新玩家。
  function create(classId) {
    const classes = (window.GAME_DATA && window.GAME_DATA.classes) || {};
    const cls = classes[classId];
    if (!cls) throw new Error("未知職業: " + classId);

    const s = cls.baseStats;
    return {
      classId: cls.id,
      className: cls.name,
      level: 1,
      exp: 0,
      maxHp: s.maxHp,
      hp: s.maxHp,
      maxMp: s.maxMp || 0,
      mp: s.maxMp || 0,
      attack: s.attack,
      magicAttack: s.magicAttack || 0,
      defense: s.defense,
      speed: s.speed,
      critRate: s.critRate || 0.05,
      accuracy: 0.95,
      skillId: cls.startingSkill,
      cooldowns: {},
      bag: START_BAG.map(function (s) { return Object.assign({}, s); }), // 包包（消耗品＋未穿的裝備），最多 10 格
      gold: 0, // 本輪金幣（結束時帶回家）
      equipment: { weapon: null, armor: null, accessory: null }, // 穿在身上的裝備 id
      status: {}, // 例如 { burn: {turns, dmg}, accuracyDown: {turns} }
      stats: { kills: 0, steps: 0 }
    };
  }

  function equipData(id) {
    return ((window.GAME_DATA && window.GAME_DATA.equipment) || {})[id] || null;
  }

  // 套用（sign=+1）或移除（sign=-1）一件裝備的加成。
  // 直接調整玩家目前的屬性值，戰鬥程式讀到的就是含裝備的數值，不需改動。
  function applyBonus(p, item, sign) {
    const b = (item && item.bonus) || {};
    if (b.attack) p.attack += sign * b.attack;
    if (b.defense) p.defense += sign * b.defense;
    if (b.magicAttack) p.magicAttack += sign * b.magicAttack;
    if (b.speed) p.speed += sign * b.speed;
    if (b.critRate) p.critRate = Math.max(0, p.critRate + sign * b.critRate);
    if (b.maxHp) { p.maxHp += sign * b.maxHp; if (sign > 0) p.hp += b.maxHp; else p.hp = Math.min(p.hp, p.maxHp); }
    if (b.maxMp) { p.maxMp += sign * b.maxMp; if (sign > 0) p.mp += b.maxMp; else p.mp = Math.min(p.mp, p.maxMp); }
  }

  // ---- 包包（最多 10 格；消耗品堆疊、裝備一件一格）----
  function bagUsed(p) { return p.bag.length; }
  function bagHasSpace(p) { return p.bag.length < BAG_MAX; }

  function bagFindConsumable(p, id) {
    for (let i = 0; i < p.bag.length; i++) {
      if (p.bag[i].kind === "consumable" && p.bag[i].id === id) return p.bag[i];
    }
    return null;
  }
  function consumableCount(p, id) { const s = bagFindConsumable(p, id); return s ? s.count : 0; }
  function consumableList(p) {
    return p.bag.filter(function (s) { return s.kind === "consumable" && s.count > 0; })
      .map(function (s) { return { id: s.id, count: s.count }; });
  }
  function useConsumable(p, id) {
    const s = bagFindConsumable(p, id);
    if (!s || s.count <= 0) return false;
    s.count -= 1;
    if (s.count <= 0) p.bag.splice(p.bag.indexOf(s), 1);
    return true;
  }

  function equipmentInBag(p) {
    return p.bag.filter(function (s) { return s.kind === "equipment"; }).map(function (s) { return s.id; });
  }
  function ownsEquipment(p, id) {
    if (equipmentInBag(p).indexOf(id) >= 0) return true;
    return p.equipment.weapon === id || p.equipment.armor === id || p.equipment.accessory === id;
  }

  // 撿東西進包包。回傳 true=成功、false=滿了。
  function bagAddConsumable(p, id, n) {
    const s = bagFindConsumable(p, id);
    if (s) { s.count += n; return true; }
    if (!bagHasSpace(p)) return false;
    p.bag.push({ kind: "consumable", id: id, count: n });
    return true;
  }
  function bagAddEquipment(p, id) {
    if (!bagHasSpace(p)) return false;
    p.bag.push({ kind: "equipment", id: id, count: 1 });
    return true;
  }
  function bagRemoveEquipment(p, id) {
    for (let i = 0; i < p.bag.length; i++) {
      if (p.bag[i].kind === "equipment" && p.bag[i].id === id) { p.bag.splice(i, 1); return true; }
    }
    return false;
  }

  // 穿上包包裡的一件裝備（換裝時舊的回到包包，格數不變）。
  function equip(p, id) {
    const item = equipData(id);
    if (!item) return false;
    const slot = item.slot;
    if (!bagRemoveEquipment(p, id)) return false; // 必須在包包裡才能穿
    const old = p.equipment[slot];
    if (old) { applyBonus(p, equipData(old), -1); p.bag.push({ kind: "equipment", id: old, count: 1 }); }
    p.equipment[slot] = id;
    applyBonus(p, item, 1);
    return true;
  }

  // 脫下裝備放回包包（包包滿了就脫不下）。
  function unequip(p, slot) {
    const id = p.equipment[slot];
    if (!id) return false;
    if (!bagHasSpace(p)) return false;
    applyBonus(p, equipData(id), -1);
    p.equipment[slot] = null;
    p.bag.push({ kind: "equipment", id: id, count: 1 });
    return true;
  }

  // 升級所需經驗：25 + 等級 × 20。
  function expToNext(level) {
    return 25 + level * 20;
  }

  function isMagicClass(p) {
    return (p.magicAttack || 0) > 0;
  }

  // 升一級：提升基礎屬性並回復部分 HP / MP。
  function levelUp(p) {
    p.level += 1;
    p.maxHp += 8;
    p.attack += 2;
    p.defense += 1;
    p.speed += 1;
    if (isMagicClass(p)) {
      p.magicAttack += 2;
      p.maxMp += 5;
    } else if (p.maxMp > 0) {
      p.maxMp += 3;
    }
    // 升級回復：HP 40%、MP 50%。
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.4));
    p.mp = Math.min(p.maxMp, p.mp + Math.round(p.maxMp * 0.5));
  }

  // 取得經驗，可能連續升級。回傳升級訊息陣列。
  function gainExp(p, amount) {
    p.exp += Math.max(0, Math.round(amount));
    const messages = [];
    while (p.exp >= expToNext(p.level)) {
      p.exp -= expToNext(p.level);
      levelUp(p);
      messages.push("升級！現在是 Lv." + p.level + "（HP/MP 已回復）。");
    }
    return messages;
  }

  return {
    create, expToNext, gainExp, levelUp, isMagicClass, equip, unequip,
    consumableList, useConsumable, consumableCount,
    bagAddConsumable, bagAddEquipment, bagHasSpace, bagUsed, ownsEquipment, equipmentInBag,
    BAG_MAX
  };
})();
