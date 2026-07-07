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
  },
  crescent_saber: {
    id: "crescent_saber",
    name: "殘月彎刀",
    slot: "weapon",
    bonus: { attack: 6, critRate: 0.08 },
    desc: "刃如殘月，出鞘見血。"
  },
  knell_hammer: {
    id: "knell_hammer",
    name: "喪鐘戰錘",
    slot: "weapon",
    bonus: { attack: 9 },
    desc: "每一擊都像敲響喪鐘。"
  },
  ash_staff: {
    id: "ash_staff",
    name: "灰燼法杖",
    slot: "weapon",
    bonus: { magicAttack: 8, maxMp: 12 },
    desc: "杖頂封著永不熄滅的餘燼。"
  },
  bone_cuirass: {
    id: "bone_cuirass",
    name: "枯骨胸甲",
    slot: "armor",
    bonus: { defense: 6, maxHp: 22 },
    desc: "以殉道者枯骨接成的胸甲。"
  },
  faded_robe: {
    id: "faded_robe",
    name: "褪色聖袍",
    slot: "armor",
    bonus: { defense: 3, maxMp: 22, magicAttack: 2 },
    desc: "褪了色的祭司長袍，仍餘一絲聖息。"
  },
  dead_finger: {
    id: "dead_finger",
    name: "亡者指骨",
    slot: "accessory",
    bonus: { attack: 4 },
    desc: "據說仍會在暗處輕輕彎曲。"
  },
  waxtear_pendant: {
    id: "waxtear_pendant",
    name: "燭淚墜飾",
    slot: "accessory",
    bonus: { maxHp: 28 },
    desc: "凝結的燭淚，溫熱如心跳。"
  },
  swift_feather: {
    id: "swift_feather",
    name: "疾風之羽",
    slot: "accessory",
    bonus: { speed: 4, critRate: 0.04 },
    desc: "墜落天使遺下的一根輕羽。"
  }
};
