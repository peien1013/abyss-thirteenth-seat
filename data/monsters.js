window.GAME_DATA = window.GAME_DATA || {};
// 數值已整體強化（2026-07-07）：提升攻擊力（威脅玩家的關鍵）與 HP、經驗，防禦小幅增加。
window.GAME_DATA.monsters = {
  helmet_rat: {
    id: "helmet_rat",
    name: "偷盔鼠",
    maxHp: 38,
    attack: 11,
    defense: 4,
    speed: 9,
    exp: 13,
    skills: ["bite", "hide_in_helmet"],
    codexId: "monster_001"
  },
  candle_slime: {
    id: "candle_slime",
    name: "背燭史萊姆",
    maxHp: 42,
    attack: 10,
    defense: 3,
    speed: 5,
    exp: 14,
    skills: ["slime_hit", "ember"],
    codexId: "monster_002"
  },
  rotten_skeleton: {
    id: "rotten_skeleton",
    name: "腐朽骷髏",
    maxHp: 50,
    attack: 13,
    defense: 6,
    speed: 6,
    exp: 16,
    skills: ["rusty_slash", "guard"],
    codexId: "monster_003"
  },
  broken_fang_bat: {
    id: "broken_fang_bat",
    name: "碎牙蝙蝠",
    maxHp: 24,
    attack: 10,
    defense: 2,
    speed: 14,
    exp: 9,
    skills: ["dive", "screech"],
    codexId: "monster_004"
  },
  crying_mushroom: {
    id: "crying_mushroom",
    name: "哭臉蘑菇",
    maxHp: 28,
    attack: 9,
    defense: 3,
    speed: 4,
    exp: 10,
    skills: ["spore", "cry"],
    codexId: "monster_005"
  },
  fallen_knight: {
    id: "fallen_knight",
    name: "殞落甲騎",
    maxHp: 68,
    attack: 18,
    defense: 9,
    speed: 6,
    exp: 28,
    skills: ["grave_cleave", "guard"],
    codexId: "monster_006"
  },
  winged_fiend: {
    id: "winged_fiend",
    name: "裂喉翼魔",
    maxHp: 46,
    attack: 17,
    defense: 5,
    speed: 13,
    exp: 23,
    skills: ["dive", "rend"],
    codexId: "monster_007"
  },
  mourning_saint: {
    id: "mourning_saint",
    name: "縞衣哀聖",
    maxHp: 56,
    attack: 16,
    defense: 6,
    speed: 8,
    exp: 24,
    skills: ["wail", "curse"],
    codexId: "monster_008"
  },
  candle_watcher: {
    id: "candle_watcher",
    name: "千燭窺眼",
    maxHp: 60,
    attack: 15,
    defense: 7,
    speed: 5,
    exp: 24,
    skills: ["gaze", "ember"],
    codexId: "monster_009"
  },
  gaunt_ghoul: {
    id: "gaunt_ghoul",
    name: "枯屍餓鬼",
    maxHp: 48,
    attack: 16,
    defense: 5,
    speed: 9,
    exp: 20,
    skills: ["claw", "feast"],
    codexId: "monster_010"
  },
  chained_hound: {
    id: "chained_hound",
    name: "焰鏈獄犬",
    maxHp: 52,
    attack: 18,
    defense: 6,
    speed: 12,
    exp: 23,
    skills: ["bite", "ember"],
    codexId: "monster_011"
  },
  raven_priest: {
    id: "raven_priest",
    name: "渡鴉祭司",
    maxHp: 54,
    attack: 16,
    defense: 7,
    speed: 9,
    exp: 24,
    skills: ["curse", "screech"],
    codexId: "monster_012"
  },
  stone_gargoyle: {
    id: "stone_gargoyle",
    name: "守殿石魔",
    maxHp: 76,
    attack: 17,
    defense: 13,
    speed: 4,
    exp: 30,
    skills: ["stone_slam", "guard"],
    codexId: "monster_013"
  },
  fungal_ent: {
    id: "fungal_ent",
    name: "腐林蕈魔",
    maxHp: 64,
    attack: 14,
    defense: 9,
    speed: 3,
    exp: 22,
    skills: ["spore", "root_bind"],
    codexId: "monster_014"
  },
  bound_wraith: {
    id: "bound_wraith",
    name: "縛魂囚徒",
    maxHp: 46,
    attack: 17,
    defense: 4,
    speed: 10,
    exp: 22,
    skills: ["soul_flame", "wail"],
    codexId: "monster_015"
  },
  mimic_chest: {
    id: "mimic_chest",
    name: "擬態噬客",
    maxHp: 68,
    attack: 19,
    defense: 8,
    speed: 7,
    exp: 38,
    skills: ["ambush", "chomp"],
    codexId: "monster_016"
  },
  hermon: {
    id: "hermon",
    name: "無面守門人・赫爾蒙",
    maxHp: 220,
    attack: 21,
    defense: 13,
    speed: 8,
    exp: 95,
    boss: true,
    skills: ["gate_slash", "shield_bash", "last_guest"],
    codexId: "boss_001"
  }
};
