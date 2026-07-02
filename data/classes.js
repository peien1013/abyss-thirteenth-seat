window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.classes = {
  warrior: {
    id: "warrior",
    name: "戰士",
    baseStats: { maxHp: 130, maxMp: 0, attack: 14, defense: 10, speed: 7, critRate: 0.05 },
    startingSkill: "heavy_strike"
  },
  ranger: {
    id: "ranger",
    name: "弓箭手",
    baseStats: { maxHp: 100, maxMp: 20, attack: 12, defense: 6, speed: 11, critRate: 0.10 },
    startingSkill: "aimed_shot"
  },
  rogue: {
    id: "rogue",
    name: "盜賊",
    baseStats: { maxHp: 90, maxMp: 20, attack: 11, defense: 5, speed: 13, critRate: 0.18 },
    startingSkill: "backstab"
  },
  mage: {
    id: "mage",
    name: "魔法師",
    baseStats: { maxHp: 75, maxMp: 70, attack: 8, magicAttack: 16, defense: 3, speed: 8, critRate: 0.06 },
    startingSkill: "spark"
  }
};
