// js/maze.js
// 地圖讀取、玩家位置與面向、移動與碰撞、Canvas 偽 3D 繪製、小地圖。
window.Abyss = window.Abyss || {};

window.Abyss.Maze = (function () {
  "use strict";

  const DIRS = {
    north: { dx: 0, dy: -1 },
    east: { dx: 1, dy: 0 },
    south: { dx: 0, dy: 1 },
    west: { dx: -1, dy: 0 }
  };
  const LEFT = { north: "west", west: "south", south: "east", east: "north" };
  const RIGHT = { north: "east", east: "south", south: "west", west: "north" };
  const FACE_ARROW = { north: "▲", east: "▶", south: "▼", west: "◀" };

  const MAX_DEPTH = 5;
  const DEPTH_SCALE = 0.55; // 每往深一格縮小的比例。

  let floor = null;
  let grid = [];
  let pos = { x: 0, y: 0 };
  let facing = "north";
  let explored = new Set();
  let minimapZoom = 1;

  function load(floorData) {
    floor = floorData;
    grid = floorData.grid.slice();
    pos = { x: floorData.start.x, y: floorData.start.y };
    facing = floorData.start.facing || "north";
    explored = new Set();
    markExplored(pos.x, pos.y);
  }

  // 從外部（存檔）還原位置。
  function restore(state) {
    if (!state) return;
    pos = { x: state.x, y: state.y };
    facing = state.facing || "north";
    explored = new Set(state.explored || []);
    markExplored(pos.x, pos.y);
  }

  function serialize() {
    return { x: pos.x, y: pos.y, facing: facing, explored: Array.from(explored) };
  }

  function inBounds(x, y) {
    return y >= 0 && y < floor.height && x >= 0 && x < floor.width;
  }

  function tileAt(x, y) {
    if (!inBounds(x, y)) return "#";
    return grid[y].charAt(x) || "#";
  }

  function isWall(x, y) {
    return tileAt(x, y) === "#";
  }

  function markExplored(x, y) {
    explored.add(x + "," + y);
  }

  function cellInfo(x, y) {
    const t = tileAt(x, y);
    return {
      x: x,
      y: y,
      tile: t,
      wall: t === "#",
      start: t === "S",
      boss: t === "B",
      exit: t === "E",
      treasure: t === "T",
      // 一般可觸發遭遇的走道（排除起點、Boss、出口、寶箱）。
      encounterZone: t === "."
    };
  }

  // 開過的寶箱格 → 變回普通走道，避免重複觸發（同一次遊戲內有效）。
  function consumeTile(x, y) {
    if (!inBounds(x, y)) return;
    const row = grid[y];
    grid[y] = row.substring(0, x) + "." + row.substring(x + 1);
  }

  function current() {
    return cellInfo(pos.x, pos.y);
  }

  // 移動一格。forward=true 前進，false 後退。
  // 回傳 { blocked:boolean, cell:cellInfo }
  function move(forward) {
    const dir = DIRS[facing];
    const sign = forward ? 1 : -1;
    const nx = pos.x + dir.dx * sign;
    const ny = pos.y + dir.dy * sign;
    if (isWall(nx, ny)) {
      return { blocked: true, cell: current() };
    }
    pos.x = nx;
    pos.y = ny;
    markExplored(nx, ny);
    return { blocked: false, cell: current() };
  }

  function turn(direction) {
    facing = direction === "left" ? LEFT[facing] : RIGHT[facing];
    return facing;
  }

  function getState() {
    return { pos: { x: pos.x, y: pos.y }, facing: facing };
  }

  // ---- 偽 3D 繪製 ----

  function rectAt(W, H, d) {
    const s = Math.pow(DEPTH_SCALE, d);
    const hw = (W / 2) * s;
    const hh = (H / 2) * s;
    const cx = W / 2;
    const cy = H / 2;
    return { left: cx - hw, right: cx + hw, top: cy - hh, bottom: cy + hh };
  }

  function shade(hex, factor) {
    // hex 如 "#8a7a5c"，factor 0..1 變暗。
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Math.round(r * factor);
    g = Math.round(g * factor);
    b = Math.round(b * factor);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function polygon(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // 以格子座標產生穩定亂數，讓裂縫 / 血跡 / 符文固定不閃爍。
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function cellSeed(x, y) { return (((x + 7) * 73856093) ^ ((y + 13) * 19349663)) >>> 0; }

  const WALL_BASE = "#786249";  // 暖褐石（偏地窖燭光色）
  const FLOOR_BASE = "#2b221c";  // 較深較暖，配合濕滑反光
  const CEIL_BASE = "#161019";

  // 正面牆：石塊接縫、明暗、潮濕與少量裂縫 / 血跡 / 符文。
  function stoneFace(ctx, l, t, r, b, ds, sx, sy) {
    const w = r - l, h = b - t;
    if (w <= 1 || h <= 1) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(l, t, w, h); ctx.clip();
    ctx.fillStyle = shade(WALL_BASE, ds);
    ctx.fillRect(l, t, w, h);
    // 火把側光：中央偏亮、邊緣偏暗。
    const lg = ctx.createLinearGradient(l, 0, r, 0);
    lg.addColorStop(0, "rgba(0,0,0,0.30)");
    lg.addColorStop(0.5, "rgba(255,220,160,0.06)");
    lg.addColorStop(1, "rgba(0,0,0,0.30)");
    ctx.fillStyle = lg; ctx.fillRect(l, t, w, h);
    // 潮濕：底部略暗偏冷。
    const dg = ctx.createLinearGradient(0, t, 0, b);
    dg.addColorStop(0, "rgba(0,0,0,0)");
    dg.addColorStop(1, "rgba(10,20,25,0.28)");
    ctx.fillStyle = dg; ctx.fillRect(l, t, w, h);
    // 石塊接縫（磚砌錯位）。
    const rows = 4, rh = h / rows, cols = 3, cw = w / cols;
    ctx.lineWidth = Math.max(1, w * 0.006);
    for (let ri = 0; ri < rows; ri++) {
      const yy = t + ri * rh;
      ctx.strokeStyle = "rgba(0,0,0,0.38)";
      ctx.beginPath(); ctx.moveTo(l, yy); ctx.lineTo(r, yy); ctx.stroke();
      ctx.strokeStyle = "rgba(255,235,200,0.05)";
      ctx.beginPath(); ctx.moveTo(l, yy + ctx.lineWidth); ctx.lineTo(r, yy + ctx.lineWidth); ctx.stroke();
      const off = (ri % 2) ? cw / 2 : 0;
      for (let ci = 0; ci <= cols; ci++) {
        const xx = l + off + ci * cw;
        if (xx > l && xx < r) {
          ctx.strokeStyle = "rgba(0,0,0,0.34)";
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + rh); ctx.stroke();
        }
      }
    }
    // 固定裝飾（稀疏、低調）。
    const rnd = seeded(cellSeed(sx, sy));
    if (rnd() < 0.5) { // 裂縫
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = Math.max(1, w * 0.008);
      let px = l + w * (0.2 + rnd() * 0.6), py = t + h * 0.08;
      ctx.beginPath(); ctx.moveTo(px, py);
      const segs = 4 + Math.floor(rnd() * 3);
      for (let s = 0; s < segs; s++) { px += (rnd() - 0.5) * w * 0.18; py += h / segs; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    if (rnd() < 0.16) { // 血跡（小而低調，避免正對牆面時變成大紅斑）
      ctx.fillStyle = "rgba(82,20,16,0.42)";
      const bx = l + w * (0.15 + rnd() * 0.7), by = t + h * (0.2 + rnd() * 0.6), br = w * (0.018 + rnd() * 0.022);
      ctx.beginPath(); ctx.ellipse(bx, by, br, br * 1.6, 0, 0, Math.PI * 2); ctx.fill();
      // 幾滴垂流。
      ctx.strokeStyle = "rgba(82,20,16,0.3)"; ctx.lineWidth = Math.max(1, br * 0.35);
      ctx.beginPath(); ctx.moveTo(bx, by + br); ctx.lineTo(bx, by + br * 3.2); ctx.stroke();
    }
    if (rnd() < 0.14) { // 神紋符文（燭火琥珀）
      ctx.strokeStyle = "rgba(230,169,74,0.28)"; ctx.lineWidth = Math.max(1, w * 0.01);
      const rx = l + w * (0.3 + rnd() * 0.4), ry = t + h * (0.35 + rnd() * 0.3), rr = w * 0.06;
      ctx.beginPath();
      ctx.moveTo(rx - rr, ry - rr); ctx.lineTo(rx + rr, ry - rr);
      ctx.lineTo(rx - rr, ry + rr); ctx.lineTo(rx + rr, ry + rr);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 側牆梯形：近亮遠暗漸層 + 收斂接縫。
  function stoneSide(ctx, nearX, farX, nearTop, nearBottom, farTop, farBottom, ds) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(nearX, nearTop); ctx.lineTo(farX, farTop);
    ctx.lineTo(farX, farBottom); ctx.lineTo(nearX, nearBottom);
    ctx.closePath(); ctx.clip();
    const minX = Math.min(nearX, farX), maxX = Math.max(nearX, farX);
    const top = Math.min(nearTop, farTop), bot = Math.max(nearBottom, farBottom);
    const g = ctx.createLinearGradient(nearX, 0, farX, 0);
    g.addColorStop(0, shade(WALL_BASE, ds * 0.92));
    g.addColorStop(1, shade(WALL_BASE, ds * 0.45));
    ctx.fillStyle = g; ctx.fillRect(minX, top, maxX - minX, bot - top);
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
    for (let f = 0.22; f < 1; f += 0.22) {
      const ny = nearTop + (nearBottom - nearTop) * f;
      const fy = farTop + (farBottom - farTop) * f;
      ctx.beginPath(); ctx.moveTo(nearX, ny); ctx.lineTo(farX, fy); ctx.stroke();
    }
    for (let v = 0.33; v < 1; v += 0.33) {
      const vx = nearX + (farX - nearX) * v;
      const vt = nearTop + (farTop - nearTop) * v;
      const vb = nearBottom + (farBottom - nearBottom) * v;
      ctx.beginPath(); ctx.moveTo(vx, vt); ctx.lineTo(vx, vb); ctx.stroke();
    }
    ctx.restore();
  }

  // 迷宮走廊「多視圖」：依玩家前/左/右是否有路，顯示對應的走廊圖（放進 assets/images/scenes/ 即自動使用）。
  //   前有路：corridor(直走) / corridor_left(左有路) / corridor_right(右有路) / corridor_both(左右都有路)
  //   前是牆：wall(死路) / wall_left(牆前・可左轉) / wall_right(牆前・可右轉) / wall_both(牆前・可左右轉)
  // 鍵＝「前_左_右」(1=有路 0=牆)。找不到對應視圖 → 退回單張 maze_bg（＋程式疊牆與開口）；都沒有才用純程式偽 3D。
  const VIEW_NAMES = {
    "1_0_0": "corridor", "1_1_0": "corridor_left", "1_0_1": "corridor_right", "1_1_1": "corridor_both",
    "0_0_0": "wall", "0_1_0": "wall_left", "0_0_1": "wall_right", "0_1_1": "wall_both"
  };
  const sceneCache = {}; // name -> Image / "missing" / null(載入中)
  function loadScene(name, i) {
    const urls = ["assets/images/scenes/" + name + ".jpg", "assets/images/scenes/" + name + ".png"];
    if (i >= urls.length) { sceneCache[name] = "missing"; return; }
    const img = new Image();
    img.onload = function () {
      sceneCache[name] = img;
      if (window.Abyss.Game && window.Abyss.Game.refreshMaze) window.Abyss.Game.refreshMaze();
    };
    img.onerror = function () { loadScene(name, i + 1); };
    img.src = urls[i];
  }
  function ensureScene(name) {
    if (name in sceneCache) return;
    sceneCache[name] = null;
    loadScene(name, 0);
  }
  function scene(name) { const s = sceneCache[name]; return (s && s !== "missing") ? s : null; }
  ensureScene("maze_bg");
  Object.keys(VIEW_NAMES).forEach(function (k) { ensureScene(VIEW_NAMES[k]); });

  function softVignette(ctx, W, H) {
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.84);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(4,2,2,0.42)");
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  }
  function drawCover(ctx, img, W, H) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }

  // 側邊開口：在底圖的側牆上畫一道往側面深處延伸的暗色通道，提示「這裡可以轉彎」。
  function darkPassage(ctx, nearX, farX, nearTop, nearBottom, farTop, farBottom) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(nearX, nearTop); ctx.lineTo(farX, farTop);
    ctx.lineTo(farX, farBottom); ctx.lineTo(nearX, nearBottom);
    ctx.closePath();
    const g = ctx.createLinearGradient(nearX, 0, farX, 0);
    g.addColorStop(0, "rgba(6,4,4,0.5)");   // 近端半暗
    g.addColorStop(1, "rgba(2,1,2,0.92)");  // 深處近全黑（開口）
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }

  function render(canvas) {
    if (!canvas || !floor) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    const dir = DIRS[facing];
    const leftDir = DIRS[LEFT[facing]];
    const rightDir = DIRS[RIGHT[facing]];

    // 正前方第一道牆的深度。
    let stopD = MAX_DEPTH;
    for (let d = 1; d <= MAX_DEPTH; d++) {
      if (isWall(pos.x + dir.dx * d, pos.y + dir.dy * d)) { stopD = d; break; }
    }

    // 玩家前 / 左 / 右是否有路（1=路 0=牆）。
    const fOpen = isWall(pos.x + dir.dx, pos.y + dir.dy) ? 0 : 1;
    const lOpen = isWall(pos.x + leftDir.dx, pos.y + leftDir.dy) ? 0 : 1;
    const rOpen = isWall(pos.x + rightDir.dx, pos.y + rightDir.dy) ? 0 : 1;

    // ---- (1) 有「對應這個路口的專屬視圖」→ 直接顯示（圖本身已畫出正確的牆與開口）＋淡暗角 ----
    const viewImg = scene(VIEW_NAMES[fOpen + "_" + lOpen + "_" + rOpen]);
    if (viewImg) {
      drawCover(ctx, viewImg, W, H);
      softVignette(ctx, W, H);
      return;
    }

    // ---- (2) 只有單張走廊底圖 maze_bg → 用程式疊「正前方的牆」＋「兩側可轉彎的暗色開口」 ----
    const bgImg = scene("maze_bg");
    if (bgImg) {
      drawCover(ctx, bgImg, W, H);
      for (let d = stopD; d >= 1; d--) {
        const ccx = pos.x + dir.dx * d, ccy = pos.y + dir.dy * d;
        if (isWall(ccx, ccy)) continue;
        const o = rectAt(W, H, d - 1), n = rectAt(W, H, d);
        if (!isWall(ccx + leftDir.dx, ccy + leftDir.dy)) darkPassage(ctx, o.left, n.left, o.top, o.bottom, n.top, n.bottom);
        if (!isWall(ccx + rightDir.dx, ccy + rightDir.dy)) darkPassage(ctx, o.right, n.right, o.top, o.bottom, n.top, n.bottom);
      }
      const wcx = pos.x + dir.dx * stopD, wcy = pos.y + dir.dy * stopD;
      if (isWall(wcx, wcy)) {
        if (stopD <= 1) stoneFace(ctx, W * 0.05, H * 0.02, W * 0.95, H * 0.98, 0.72, wcx, wcy);
        else { const n = rectAt(W, H, stopD); stoneFace(ctx, n.left, n.top, n.right, n.bottom, Math.max(0.34, 1 - stopD * 0.14), wcx, wcy); }
      }
      softVignette(ctx, W, H);
      return;
    }

    // ---- (3) 沒有任何底圖：純程式偽 3D 繪製（後備）----
    ctx.fillStyle = "#0a0809";
    ctx.fillRect(0, 0, W, H);

    // 由遠到近繪製，近處覆蓋遠處。深度越遠對比越低。
    for (let d = stopD; d >= 1; d--) {
      const outer = rectAt(W, H, d - 1);
      const inner = rectAt(W, H, d);
      const cx = pos.x + dir.dx * d, cy = pos.y + dir.dy * d;
      const depthShade = Math.max(0.22, 1 - d * 0.17);

      polygon(ctx, [
        [outer.left, outer.bottom], [outer.right, outer.bottom],
        [inner.right, inner.bottom], [inner.left, inner.bottom]
      ], shade(FLOOR_BASE, depthShade));
      polygon(ctx, [
        [outer.left, outer.top], [outer.right, outer.top],
        [inner.right, inner.top], [inner.left, inner.top]
      ], shade(CEIL_BASE, depthShade * 0.85));

      if (isWall(cx, cy)) {
        stoneFace(ctx, inner.left, inner.top, inner.right, inner.bottom, depthShade, cx, cy);
      } else {
        const sideShade = depthShade * 0.82;
        if (isWall(cx + leftDir.dx, cy + leftDir.dy)) {
          stoneSide(ctx, outer.left, inner.left, outer.top, outer.bottom, inner.top, inner.bottom, sideShade);
        }
        if (isWall(cx + rightDir.dx, cy + rightDir.dy)) {
          stoneSide(ctx, outer.right, inner.right, outer.top, outer.bottom, inner.top, inner.bottom, sideShade);
        }
      }
    }

    // 濕滑地面反光。
    const wet = ctx.createLinearGradient(0, H * 0.6, 0, H);
    wet.addColorStop(0, "rgba(0,0,0,0)");
    wet.addColorStop(0.72, "rgba(150,95,45,0.05)");
    wet.addColorStop(1, "rgba(210,150,75,0.13)");
    ctx.fillStyle = wet; ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // 火把暖光。
    const torch = ctx.createRadialGradient(W / 2, H * 0.80, H * 0.04, W / 2, H * 0.78, H * 0.84);
    torch.addColorStop(0, "rgba(248,182,96,0.30)");
    torch.addColorStop(0.45, "rgba(212,136,60,0.12)");
    torch.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = torch; ctx.fillRect(0, 0, W, H);

    // 深處暖霧。
    const haze = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.02, W / 2, H * 0.44, H * 0.5);
    haze.addColorStop(0, "rgba(92,62,44,0.22)");
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H);

    // 暗角（暖黑）。
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.16, W / 2, H / 2, H * 0.8);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(6,3,2,0.66)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  // ---- 小地圖：只顯示已探索區域 ----
  function renderMinimap(canvas) {
    if (!canvas || !floor) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0c0b10";
    ctx.fillRect(0, 0, W, H);

    const cell = Math.floor(Math.min(W / floor.width, H / floor.height) * minimapZoom);
    let ox, oy;
    if (minimapZoom <= 1) {
      ox = Math.floor((W - cell * floor.width) / 2);
      oy = Math.floor((H - cell * floor.height) / 2);
    } else {
      // 放大時以玩家為中心捲動。
      ox = Math.floor(W / 2 - (pos.x + 0.5) * cell);
      oy = Math.floor(H / 2 - (pos.y + 0.5) * cell);
    }

    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (!explored.has(x + "," + y)) continue;
        const t = tileAt(x, y);
        const px = ox + x * cell;
        const py = oy + y * cell;
        let color = "#2c2a33"; // 走道
        if (t === "#") color = "#141319";
        else if (t === "B") color = "#7a2f3a";
        else if (t === "E") color = "#3f7a4a";
        else if (t === "S") color = "#3a5a7a";
        else if (t === "T") color = "#b58a3a"; // 寶箱＝金色
        ctx.fillStyle = color;
        ctx.fillRect(px, py, cell - 1, cell - 1);
      }
    }

    // 玩家位置與面向。
    const pxx = ox + pos.x * cell;
    const pyy = oy + pos.y * cell;
    ctx.fillStyle = "#f4d774";
    ctx.font = Math.max(8, cell - 2) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(FACE_ARROW[facing], pxx + cell / 2, pyy + cell / 2 + 1);
  }

  // 已探索的可走格數 / 全部可走格數（%），供 HUD 探索進度使用。
  function explorePercent() {
    if (!floor) return 0;
    let total = 0, seen = 0;
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (tileAt(x, y) === "#") continue;
        total++;
        if (explored.has(x + "," + y)) seen++;
      }
    }
    return total ? Math.round((seen / total) * 100) : 0;
  }

  // 小地圖縮放（1～3 級），dir>0 放大、dir<0 縮小；回傳目前級數。
  function zoomMinimap(dir) {
    minimapZoom = Math.max(1, Math.min(3, minimapZoom + (dir < 0 ? -1 : 1)));
    return minimapZoom;
  }

  return {
    load,
    restore,
    serialize,
    move,
    turn,
    current,
    getState,
    render,
    renderMinimap,
    explorePercent,
    zoomMinimap,
    consumeTile,
    get floor() { return floor; }
  };
})();
