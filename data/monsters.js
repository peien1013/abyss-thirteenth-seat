window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.monsters = {
  helmet_rat: {
    id: "helmet_rat",
    name: "偷盔鼠",
    maxHp: 24,
    attack: 7,
    defense: 3,
    speed: 9,
    exp: 8,
    skills: ["bite", "hide_in_helmet"],
    codexId: "monster_001"
  },
  candle_slime: {
    id: "candle_slime",
    name: "背燭史萊姆",
    maxHp: 28,
    attack: 6,
    defense: 2,
    speed: 5,
    exp: 9,
    skills: ["slime_hit", "ember"],
    codexId: "monster_002"
  },
  rotten_skeleton: {
    id: "rotten_skeleton",
    name: "腐朽骷髏",
    maxHp: 34,
    attack: 9,
    defense: 5,
    speed: 6,
    exp: 11,
    skills: ["rusty_slash", "guard"],
    codexId: "monster_003"
  },
  broken_fang_bat: {
    id: "broken_fang_bat",
    name: "碎牙蝙蝠",
    maxHp: 15,
    attack: 5,
    defense: 1,
    speed: 14,
    exp: 5,
    skills: ["dive", "screech"],
    codexId: "monster_004"
  },
  crying_mushroom: {
    id: "crying_mushroom",
    name: "哭臉蘑菇",
    maxHp: 18,
    attack: 5,
    defense: 2,
    speed: 4,
    exp: 6,
    skills: ["spore", "cry"],
    codexId: "monster_005"
  },
  hermon: {
    id: "hermon",
    name: "無面守門人・赫爾蒙",
    maxHp: 150,
    attack: 15,
    defense: 10,
    speed: 8,
    exp: 60,
    boss: true,
    skills: ["gate_slash", "shield_bash", "last_guest"],
    codexId: "boss_001"
  }
};
