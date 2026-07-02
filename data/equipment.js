window.GAME_DATA = window.GAME_DATA || {};

// 裝備資料（與程式邏輯分離）。
// slot：weapon 武器 / armor 防具 / accessory 飾品。
// bonus：穿上後增加的屬性（attack 攻擊、defense 防禦、maxHp 生命、maxMp 魔力、
//        magicAttack 魔攻、speed 速度、critRate 暴擊率）。
// 圖片放在 assets/images/equipment/<id>.png，沒有圖時用占位圖示。
window.GAME_DATA.equipment = {
  blood_dagger: {
    id: "blood_dagger",
    name: "染血短劍",
    slot: "weapon",
    bonus: { attack: 5, critRate: 0.05 },
    desc: "鑲著血色寶石的短劍，握柄纏著舊皮。"
  },
  gate_shield: {
    id: "gate_shield",
    name: "門印圓盾",
    slot: "armor",
    bonus: { defense: 5, maxHp: 15 },
    desc: "刻著神殿大門的青銅圓盾。"
  },
  lily_ring: {
    id: "lily_ring",
    name: "百合印戒",
    slot: "accessory",
    bonus: { attack: 2, critRate: 0.06 },
    desc: "刻有百合紋章的斑駁金戒。"
  },
  vow_amulet: {
    id: "vow_amulet",
    name: "誓約燭護符",
    slot: "accessory",
    bonus: { maxHp: 20, maxMp: 10 },
    desc: "護符裡封著一小簇不滅燭火。"
  },
  winged_emblem: {
    id: "winged_emblem",
    name: "翼劍徽記",
    slot: "accessory",
    bonus: { attack: 3, speed: 2 },
    desc: "翼劍紋章的神殿徽記。"
  }
};
