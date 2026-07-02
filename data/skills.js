window.GAME_DATA = window.GAME_DATA || {};

// 玩家職業技能。
// power：以基礎攻擊（物理用 attack、魔法用 magicAttack）為基準的倍率。
// mpCost：消耗魔力。cooldown：冷卻回合（適用於無魔力的職業，例如戰士）。
window.GAME_DATA.skills = {
  heavy_strike: {
    id: "heavy_strike",
    name: "重擊",
    desc: "造成 150% 物理傷害，有機率使敵人暈眩。",
    target: "enemy",
    type: "physical",
    power: 1.5,
    mpCost: 0,
    cooldown: 2,
    stunChance: 0.3
  },
  aimed_shot: {
    id: "aimed_shot",
    name: "瞄準射擊",
    desc: "指定目標，造成 140% 傷害且必定命中。",
    target: "enemy",
    type: "physical",
    power: 1.4,
    mpCost: 6,
    cooldown: 0,
    trueHit: true
  },
  backstab: {
    id: "backstab",
    name: "背刺",
    desc: "造成 130% 傷害，對滿血敵人必定暴擊。",
    target: "enemy",
    type: "physical",
    power: 1.3,
    mpCost: 5,
    cooldown: 0,
    fullHpGuaranteedCrit: true
  },
  spark: {
    id: "spark",
    name: "火花術",
    desc: "消耗魔力造成魔法傷害，有機率附加燃燒。",
    target: "enemy",
    type: "magic",
    power: 1.4,
    mpCost: 8,
    cooldown: 0,
    burnChance: 0.35,
    burnDamage: 4,
    burnTurns: 2
  }
};
