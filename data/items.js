window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.items = {
  red_potion: {
    id: "red_potion",
    name: "微光紅藥水",
    type: "consumable",
    effect: { healHp: 35 }
  },
  mana_dew: {
    id: "mana_dew",
    name: "魔力露水",
    type: "consumable",
    effect: { restoreMp: 25 }
  },
  ash_bandage: {
    id: "ash_bandage",
    name: "灰燼止血粉",
    type: "consumable",
    effect: { healHp: 15, removeStatus: "bleeding" }
  }
};
