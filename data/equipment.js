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
  },
  iron_dagger: {
    id: "iron_dagger", name: "鐵匕首", slot: "weapon",
    bonus: { attack: 4 }, desc: "最普通的鐵匕首，勝在順手。"
  },
  hunter_bow: {
    id: "hunter_bow", name: "獵人長弓", slot: "weapon",
    bonus: { attack: 5, speed: 2 }, desc: "獵人代代相傳的紫杉長弓。"
  },
  trident_fang: {
    id: "trident_fang", name: "三叉尖牙", slot: "weapon",
    bonus: { attack: 7, critRate: 0.06 }, desc: "三股利刃如毒蛇獠牙。"
  },
  ember_maul: {
    id: "ember_maul", name: "燼火巨槌", slot: "weapon",
    bonus: { attack: 11 }, desc: "槌心嵌著一顆滾燙的餘燼。"
  },
  round_buckler: {
    id: "round_buckler", name: "圓木盾", slot: "armor",
    bonus: { defense: 4 }, desc: "包鐵邊的圓木盾，輕便耐用。"
  },
  bronze_shield: {
    id: "bronze_shield", name: "青銅大盾", slot: "armor",
    bonus: { defense: 7, maxHp: 12 }, desc: "厚重的青銅大盾，擋得住重擊。"
  },
  chain_coif: {
    id: "chain_coif", name: "鎖甲頭巾", slot: "armor",
    bonus: { defense: 5 }, desc: "細密鎖環織成的頭巾。"
  },
  shadow_boots: {
    id: "shadow_boots", name: "潛影長靴", slot: "armor",
    bonus: { defense: 3, speed: 3 }, desc: "踩在石板上悄然無聲。"
  },
  iron_helm: {
    id: "iron_helm", name: "鐵盔", slot: "armor",
    bonus: { defense: 6, maxHp: 12 }, desc: "面甲低垂的舊式鐵盔。"
  },
  candle_charm: {
    id: "candle_charm", name: "燭光護符", slot: "accessory",
    bonus: { maxHp: 15, maxMp: 8 }, desc: "微光護符，驅散一點黑暗。"
  },
  pearl_ring: {
    id: "pearl_ring", name: "珍珠戒", slot: "accessory",
    bonus: { maxMp: 15, magicAttack: 2 }, desc: "嵌著一顆溫潤珍珠的銀戒。"
  },
  wraith_amulet: {
    id: "wraith_amulet", name: "幽魂護符", slot: "accessory",
    bonus: { magicAttack: 5, maxMp: 10 }, desc: "護符裡似有幽魂低語。"
  },
  ruby_band: {
    id: "ruby_band", name: "血玉指環", slot: "accessory",
    bonus: { attack: 3, critRate: 0.06 }, desc: "血紅寶玉，越戰越熱。"
  },
  fallen_crown: {
    id: "fallen_crown", name: "殞落王冠", slot: "accessory",
    bonus: { maxHp: 20, magicAttack: 3 }, desc: "早已無主的殘破王冠。"
  }
};
