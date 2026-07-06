window.GAME_DATA = window.GAME_DATA || {};
window.GAME_DATA.floors = window.GAME_DATA.floors || {};

// 第一層「沉眠門廊」固定主結構。
// 地圖以字元格表示，每格為一個可站立單位：
//   '#' = 牆　'.' = 走道　'S' = 起點　'B' = Boss 房　'E' = 通往第二層的出口　'T' = 寶箱（開箱有機率是擬態噬客）
// 蜿蜒動線由起點（下方）通往 Boss 房（上方），出口在 Boss 房正上方，
// 玩家必須先經過 Boss 房才能抵達出口。
// 名義上的區域（供劇情參考）：
//   下方橫廊＝入口與染血走廊；中段橫廊＝中央門廊、西側儲藏室、東側禮拜堂；
//   上方橫廊＝廢棄兵器庫與封印大門前廳；B＝無面守門人的 Boss 房。
window.GAME_DATA.floors.floor01 = {
  id: "floor01",
  name: "沉眠門廊",
  width: 9,
  height: 9,
  start: { x: 4, y: 7, facing: "north" },
  bossRoom: { x: 4, y: 1 },
  exit: { x: 4, y: 0 },
  grid: [
    "####E####",
    "#...B...#",
    "#.#####.#",
    "#T.....T#",
    "####.####",
    "#......T#",
    "#.#####.#",
    "#...S...#",
    "#########"
  ]
};
