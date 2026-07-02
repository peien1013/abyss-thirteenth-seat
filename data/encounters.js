window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.encounters = {
  floor01: {
    encounterRate: 0.18,
    countWeights: {
      1: 30,
      2: 28,
      3: 22,
      4: 13,
      5: 7
    },
    strengthMultipliers: {
      1: 1.00,
      2: 0.75,
      3: 0.55,
      4: 0.40,
      5: 0.28
    },
    monsterPool: [
      "helmet_rat",
      "candle_slime",
      "rotten_skeleton",
      "broken_fang_bat",
      "crying_mushroom"
    ],
    bossId: "hermon"
  }
};
