// js/sprites.js
// 怪物 / 物品 / 人物的視覺。優先使用 assets/images/ 內的正式圖，
// 檔案不存在時自動退回「程式繪製的占位剪影（SVG）」。
//
// 圖片放置位置（放進去、重新整理即自動顯示，毋須改程式）：
//   怪物 → assets/images/monsters/<id>.png        （id 同 data/monsters.js）
//   物品 → assets/images/items/<id>.png           （id 同 data/items.js）
//   人物 → assets/images/portraits/<classId>.png  （warrior/ranger/rogue/mage）
window.Abyss = window.Abyss || {};

window.Abyss.Sprites = (function () {
  "use strict";

  // 快取每個圖檔的處理結果：{status:'ok', data:<dataURL>} 或 {status:'missing'}
  var cache = {};
  var MAX_DIM = 440; // 縮圖上限：同時修正大圖的載入負擔與預覽截圖問題。

  // 去背：以「邊緣洪水填滿」移除與四角同色的近白背景（AI 出圖常見的假去背）。
  // 只移除與邊緣相連的背景，保留怪物內部的亮色（例如骨頭高光、玻璃反光）。
  // 使用內外雙門檻＋邊緣羽化＋收邊，把主體周圍那圈「白白的」殘留吃乾淨。
  function keyOutBackground(im, w, h) {
    var d = im.data;
    function corner(x, y) { var i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
    var cs = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
    for (var k = 0; k < 4; k++) if (cs[k][3] < 20) return "cutout"; // 已透明 → 原本就有去背，直接沿用
    // 背景是「淺色或中灰」才去背（涵蓋近白與 Q 版的灰底）；深色背景（如場景半身圖）→ 回報 framed，改用哥德外框呈現。
    function light(c) { return c[0] > 165 && c[1] > 165 && c[2] > 165; }
    for (k = 0; k < 4; k++) if (!light(cs[k])) return "framed";
    var sr = (cs[0][0] + cs[1][0] + cs[2][0] + cs[3][0]) / 4;
    var sg = (cs[0][1] + cs[1][1] + cs[2][1] + cs[3][1]) / 4;
    var sb = (cs[0][2] + cs[1][2] + cs[2][2] + cs[3][2]) / 4;
    var inner = 50, outer = 130;              // 內門檻＝純背景；內~外之間＝邊緣白邊（羽化）
    var inner2 = inner * inner, outer2 = outer * outer;
    var visited = new Uint8Array(w * h);
    var stack = [];
    function dist2(i) { var dr = d[i] - sr, dg = d[i + 1] - sg, db = d[i + 2] - sb; return dr * dr + dg * dg + db * db; }
    // 「偏白/偏灰」判定：夠亮且彩度低，才當成白邊來羽化，避免吃到彩色主體邊緣。
    function whitish(i) {
      var r = d[i], g = d[i + 1], b = d[i + 2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mx > 150 && (mx - mn) < 52;
    }
    function tryPush(x, y) {
      var p = y * w + x; if (visited[p]) return; visited[p] = 1;
      var i = p * 4, dd = dist2(i);
      if (dd < inner2) {                       // 純背景：全透明、繼續往內擴散
        d[i + 3] = 0; stack.push(p);
      } else if (dd < outer2 && whitish(i)) {  // 邊緣白邊：依接近程度羽化，並穿過它繼續擴散
        var t = (Math.sqrt(dd) - inner) / (outer - inner); // 0（接近背景）~1（接近主體）
        var a = Math.round(255 * t * t);       // 平方讓白邊退得更透
        if (a < d[i + 3]) d[i + 3] = a;
        // 去白溢色：把殘留往較暗、較中性推一點，避免半透明白邊在暗底上發灰。
        d[i] = Math.round(d[i] * 0.7); d[i + 1] = Math.round(d[i + 1] * 0.7); d[i + 2] = Math.round(d[i + 2] * 0.7);
        stack.push(p);
      }
      // 否則：主體像素，不動也不擴散。
    }
    for (var x = 0; x < w; x++) { tryPush(x, 0); tryPush(x, h - 1); }
    for (var y = 0; y < h; y++) { tryPush(0, y); tryPush(w - 1, y); }
    while (stack.length) {
      var p = stack.pop(), px = p % w, py = (p - px) / w;
      if (px > 0) tryPush(px - 1, py);
      if (px < w - 1) tryPush(px + 1, py);
      if (py > 0) tryPush(px, py - 1);
      if (py < h - 1) tryPush(px, py + 1);
    }

    // 補內洞：被主體圈住、顏色幾乎等於背景的封閉區塊（例如戒指中間的洞）不與邊緣相連、
    // 洪水填不到 → 用很嚴的顏色門檻直接清掉；門檻嚴才不會吃到主體亮面（骨頭/蠟高光）。
    var holeIn2 = 30 * 30;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var hi = (y * w + x) * 4;
      if (d[hi + 3] !== 0 && dist2(hi) < holeIn2 && whitish(hi)) d[hi + 3] = 0;
    }

    // 收邊：仍不透明、但四鄰有透明且偏白的像素，再壓一次 alpha，消掉最外圈 1px 白框。
    var na = new Uint8Array(w * h);
    for (var q = 0; q < w * h; q++) na[q] = d[q * 4 + 3];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var pp = y * w + x, ii = pp * 4;
      if (d[ii + 3] === 0) continue;
      var touchesBg = (x > 0 && d[(pp - 1) * 4 + 3] === 0) || (x < w - 1 && d[(pp + 1) * 4 + 3] === 0) ||
        (y > 0 && d[(pp - w) * 4 + 3] === 0) || (y < h - 1 && d[(pp + w) * 4 + 3] === 0);
      if (touchesBg && whitish(ii)) na[pp] = Math.round(d[ii + 3] * 0.3);
    }
    for (q = 0; q < w * h; q++) d[q * 4 + 3] = na[q];
    return "cutout";
  }

  // 載入 → 縮圖 → 去背 → 回傳 dataURL。
  function processImage(img) {
    var scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.max(1, Math.round(img.naturalWidth * scale));
    var h = Math.max(1, Math.round(img.naturalHeight * scale));
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var framed = false;
    try {
      var im = ctx.getImageData(0, 0, w, h);
      var mode = keyOutBackground(im, w, h);
      if (mode === "framed") {
        framed = true;               // 深色背景：不去背，改由外框（見 CSS .sprite-wrap.framed）呈現
      } else {
        ctx.putImageData(im, 0, 0);  // 白底/已透明：套用去背結果
      }
    } catch (e) { /* 跨域污染等情況：略過去背 */ }
    return { data: c.toDataURL("image/png"), framed: framed };
  }

  function ensure(url, cb) {
    if (cache[url]) { cb(cache[url]); return; }
    var img = new Image();
    img.onload = function () {
      var out;
      try { out = processImage(img); } catch (e) { out = { data: url, framed: false }; }
      cache[url] = { status: "ok", data: out.data, framed: out.framed };
      cb(cache[url]);
    };
    img.onerror = function () { cache[url] = { status: "missing" }; cb(cache[url]); };
    img.src = url;
  }

  // 建立一個容器：先放占位 SVG，若同名正式圖存在則處理後淡入替換。
  function node(url, placeholderSvg, extraClass) {
    var wrap = document.createElement("div");
    wrap.className = "sprite-wrap " + (extraClass || "");
    var e = cache[url];
    if (e && e.status === "ok") {
      if (e.framed) wrap.className += " framed";
      wrap.innerHTML = "<img class='sprite-img' src='" + e.data + "' alt=''>";
      return wrap;
    }
    wrap.innerHTML = placeholderSvg;
    if (!e || e.status !== "missing") {
      ensure(url, function (res) {
        if (res.status === "ok") {
          if (res.framed) wrap.className += " framed";
          wrap.innerHTML = "<img class='sprite-img fade-in' src='" + res.data + "' alt=''>";
        }
      });
    }
    return wrap;
  }

  function svg(defs, body, cls) {
    return "<svg class='art-svg " + (cls || "") + "' viewBox='0 0 100 100' " +
      "xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>" +
      (defs ? "<defs>" + defs + "</defs>" : "") + body + "</svg>";
  }

  function rg(id, stops, cx, cy, r) {
    return "<radialGradient id='" + id + "' cx='" + (cx || 50) + "%' cy='" + (cy || 40) + "%' r='" + (r || 65) + "%'>" + stops + "</radialGradient>";
  }
  function lg(id, stops, x2, y2) {
    return "<linearGradient id='" + id + "' x1='0%' y1='0%' x2='" + (x2 || 0) + "%' y2='" + (y2 || 100) + "%'>" + stops + "</linearGradient>";
  }
  function stop(off, col, op) { return "<stop offset='" + off + "%' stop-color='" + col + "'" + (op != null ? " stop-opacity='" + op + "'" : "") + "/>"; }
  function shadow() { return "<ellipse cx='50' cy='93' rx='30' ry='6' fill='rgba(0,0,0,0.45)'/>"; }

  // ---------- 怪物占位剪影（有體積、光影、細節） ----------
  var MON = {
    // 偷盔鼠：肥灰鼠戴過大青銅頭盔。
    helmet_rat: function () {
      var defs =
        rg("hr_body", stop(0, "#8b8177") + stop(60, "#6b6258") + stop(100, "#4c463f"), 42, 40, 70) +
        lg("hr_helm", stop(0, "#c9ab56") + stop(45, "#9c7f3f") + stop(100, "#5f4c26")) +
        rg("hr_snout", stop(0, "#9a8f83") + stop(100, "#6f665c"), 40, 45, 70);
      var body =
        shadow() +
        "<path d='M74 74 q20 6 15 24' stroke='#5c544b' stroke-width='6' fill='none' stroke-linecap='round'/>" +
        "<ellipse cx='53' cy='70' rx='32' ry='22' fill='url(#hr_body)'/>" +
        "<ellipse cx='40' cy='84' rx='8' ry='5' fill='#4c463f'/><path d='M35 86 l-3 5 m6 -5 l0 6 m5 -6 l3 5' stroke='#2c2822' stroke-width='1.6' stroke-linecap='round'/>" +
        "<ellipse cx='28' cy='66' rx='13' ry='10' fill='url(#hr_snout)'/>" +
        "<circle cx='17' cy='65' r='3' fill='#c98a8a'/>" +
        "<path d='M20 60 l-9 -3 m9 6 l-10 1' stroke='#8a8177' stroke-width='1' opacity='0.7'/>" +
        "<rect x='22' y='70' width='3' height='5' rx='1' fill='#f2ead6'/><rect x='26' y='70' width='3' height='5' rx='1' fill='#f2ead6'/>" +
        "<circle cx='33' cy='58' r='3' fill='#141210'/><circle cx='34' cy='57' r='1' fill='#fff' opacity='0.8'/>" +
        "<path d='M64 40 a30 26 0 0 1 -2 20 l-40 0 a30 26 0 0 1 4 -30 a30 26 0 0 1 38 10z' fill='url(#hr_helm)'/>" +
        "<rect x='20' y='48' width='52' height='8' rx='3' fill='#6f5d38'/>" +
        "<rect x='44' y='24' width='5' height='16' rx='2' fill='#a5372f'/><ellipse cx='46' cy='22' rx='5' ry='3' fill='#c0453b'/>" +
        "<path d='M45 40 l0 16' stroke='#2c2418' stroke-width='2.5'/>" +
        "<circle cx='28' cy='44' r='1.6' fill='#4a3c1e'/><circle cx='60' cy='44' r='1.6' fill='#4a3c1e'/><circle cx='44' cy='38' r='1.6' fill='#4a3c1e'/>" +
        "<path d='M24 40 a30 26 0 0 1 12 -14' stroke='#e6c877' stroke-width='2' fill='none' opacity='0.4'/>";
      return svg(defs, body);
    },
    // 背燭史萊姆：半透明黏液，體內燭芯、骨片、戒指。
    candle_slime: function () {
      var defs =
        rg("cs_body", stop(0, "#a9d0a0") + stop(55, "#6fae82") + stop(100, "#3f7a5a"), 45, 40, 70);
      var body =
        shadow() +
        "<path d='M16 84 q-6 -46 34 -46 q40 0 34 46 q-8 6 -18 4 q-8 4 -16 0 q-8 4 -16 0 q-10 2 -18 -4z' fill='url(#cs_body)' fill-opacity='0.86' stroke='#8fc79a' stroke-width='1.5'/>" +
        "<path d='M30 52 q6 -10 16 -9' stroke='#eafff0' stroke-width='4' fill='none' stroke-linecap='round' opacity='0.5'/>" +
        "<rect x='46' y='40' width='6' height='15' rx='2' fill='#d8c8a8'/>" +
        "<path d='M49 30 q6 7 0 14 q-6 -7 0 -14z' fill='#f2b64e'/><path d='M49 33 q3 4 0 8 q-3 -4 0 -8z' fill='#ffe08a'/>" +
        "<path d='M35 70 q5 4 10 0' stroke='#e8dcc0' stroke-width='2.4' fill='none' opacity='0.75'/>" +
        "<circle cx='60' cy='64' r='4.5' fill='none' stroke='#c9a24a' stroke-width='2' opacity='0.7'/>" +
        "<circle cx='40' cy='60' r='2.6' fill='#20302a'/><circle cx='39' cy='59' r='0.9' fill='#eafff0'/>" +
        "<circle cx='58' cy='60' r='2.6' fill='#20302a'/><circle cx='57' cy='59' r='0.9' fill='#eafff0'/>" +
        "<path d='M43 74 q6 3 12 0' stroke='#20302a' stroke-width='1.6' fill='none' opacity='0.6'/>" +
        "<circle cx='30' cy='86' r='3' fill='#6fae82' fill-opacity='0.7'/><circle cx='70' cy='87' r='2.4' fill='#6fae82' fill-opacity='0.7'/>";
      return svg(defs, body);
    },
    // 腐朽骷髏：神殿守衛制服、鏽劍、盾。
    rotten_skeleton: function () {
      var defs =
        rg("sk_skull", stop(0, "#efe7d0") + stop(70, "#cabfa2") + stop(100, "#9a8f72"), 45, 38, 70) +
        lg("sk_sword", stop(0, "#b8b2a4") + stop(100, "#7a7266"));
      var body =
        shadow() +
        "<path d='M32 52 l36 0 l-4 34 l-28 0z' fill='#5a4a3a'/><path d='M46 54 l8 0 l-1 30 l-6 0z' fill='#6f5d38' opacity='0.7'/>" +
        "<circle cx='50' cy='70' r='4' fill='none' stroke='#8a7238' stroke-width='1.5'/><path d='M50 66 l0 8 M46 70 l8 0' stroke='#8a7238' stroke-width='1.2'/>" +
        "<rect x='68' y='30' width='4' height='44' rx='1' fill='url(#sk_sword)'/><path d='M67 40 l6 6 m-6 8 l6 -3' stroke='#7a5a3a' stroke-width='1.4' opacity='0.7'/><rect x='62' y='50' width='16' height='4' rx='1' fill='#6f5d38'/>" +
        "<circle cx='28' cy='58' r='12' fill='#6b5c47'/><circle cx='28' cy='58' r='12' fill='none' stroke='#8a7238' stroke-width='2'/><circle cx='28' cy='58' r='4' fill='#8a7238'/><path d='M28 48 l0 20 M18 58 l20 0' stroke='#8a7238' stroke-width='1.4'/>" +
        "<path d='M36 38 a14 15 0 0 1 28 0 q0 12 -6 15 l-16 0 q-6 -3 -6 -15z' fill='url(#sk_skull)'/>" +
        "<path d='M42 55 l4 6 4 -6 4 6 4 -6' fill='none' stroke='#5a5040' stroke-width='1.4'/>" +
        "<ellipse cx='44' cy='40' rx='4' ry='5' fill='#1c1712'/><ellipse cx='56' cy='40' rx='4' ry='5' fill='#1c1712'/>" +
        "<circle cx='44' cy='41' r='1.6' fill='#e6a94a' opacity='0.75'/><circle cx='56' cy='41' r='1.6' fill='#e6a94a' opacity='0.75'/>" +
        "<path d='M50 44 l-2 6 4 0z' fill='#3a3226'/>" +
        "<path d='M40 30 q10 -6 20 0' stroke='#5a5040' stroke-width='1' fill='none' opacity='0.6'/>";
      return svg(defs, body);
    },
    // 碎牙蝙蝠：殘破翅膀、不整齊牙。
    broken_fang_bat: function () {
      var defs = rg("bt_body", stop(0, "#5a5260") + stop(100, "#2c2830"), 50, 45, 70);
      var body =
        shadow() +
        "<path d='M50 50 q-28 -26 -46 -12 q14 0 16 8 q-12 2 -6 12 q10 -8 20 -4 q8 -6 16 -4z' fill='#3a3440'/>" +
        "<path d='M50 50 q28 -26 46 -12 q-14 0 -16 8 q12 2 6 12 q-10 -8 -20 -4 q-8 -6 -16 -4z' fill='#3a3440'/>" +
        "<path d='M10 40 l6 6 M8 52 l7 2 M90 40 l-6 6 M92 52 l-7 2' stroke='#221e28' stroke-width='1.4'/>" +
        "<circle cx='22' cy='44' r='2' fill='#0d0b10'/><circle cx='78' cy='44' r='2' fill='#0d0b10'/>" +
        "<ellipse cx='50' cy='54' rx='13' ry='15' fill='url(#bt_body)'/>" +
        "<path d='M42 42 l-3 -8 6 5z M58 42 l3 -8 -6 5z' fill='#2c2830'/>" +
        "<circle cx='45' cy='51' r='3' fill='#e6a94a'/><circle cx='55' cy='51' r='3' fill='#e6a94a'/><circle cx='44' cy='50' r='1' fill='#fff'/><circle cx='54' cy='50' r='1' fill='#fff'/>" +
        "<path d='M45 62 l2 7 2 -7 M53 62 l1 5 2 -6' fill='none' stroke='#efe7d0' stroke-width='1.8' stroke-linecap='round'/>";
      return svg(defs, body);
    },
    // 哭臉蘑菇：哭臉紋菌傘、噴孢子。
    crying_mushroom: function () {
      var defs =
        rg("cm_cap", stop(0, "#b25a4e") + stop(70, "#8a4038") + stop(100, "#5f2a26"), 45, 30, 75) +
        lg("cm_stem", stop(0, "#efe7d0") + stop(100, "#c3b79a"));
      var body =
        shadow() +
        "<path d='M14 56 q6 -38 36 -38 q30 0 36 38 q-36 10 -72 0z' fill='url(#cm_cap)'/>" +
        "<ellipse cx='32' cy='38' rx='5' ry='7' fill='#e8dcc0' opacity='0.85'/><ellipse cx='66' cy='42' rx='4' ry='5' fill='#e8dcc0' opacity='0.7'/><ellipse cx='50' cy='30' rx='3.5' ry='4.5' fill='#e8dcc0' opacity='0.8'/>" +
        "<path d='M18 55 q32 8 64 0' stroke='#4a221e' stroke-width='2' fill='none' opacity='0.6'/>" +
        "<path d='M40 56 l-2 26 24 0 -2 -26 q-10 4 -20 0z' fill='url(#cm_stem)'/>" +
        "<path d='M42 60 h16 M42 66 h16' stroke='#b7ab8c' stroke-width='1' opacity='0.6'/>" +
        "<ellipse cx='43' cy='46' rx='2.6' ry='3.4' fill='#1c1712'/><ellipse cx='57' cy='46' rx='2.6' ry='3.4' fill='#1c1712'/>" +
        "<path d='M43 51 q-1 6 -3 12 M57 51 q1 6 3 12' stroke='#6f9bc0' stroke-width='2' fill='none' stroke-linecap='round'/>" +
        "<circle cx='40' cy='66' r='1.6' fill='#6f9bc0'/><circle cx='60' cy='68' r='1.6' fill='#6f9bc0'/>" +
        "<path d='M45 52 q5 4 10 0' stroke='#1c1712' stroke-width='1.6' fill='none'/>" +
        "<circle cx='24' cy='24' r='2.4' fill='#c8b98f' opacity='0.5'/><circle cx='78' cy='28' r='2' fill='#c8b98f' opacity='0.45'/><circle cx='60' cy='18' r='1.6' fill='#c8b98f' opacity='0.4'/>";
      return svg(defs, body);
    },
    // 無面守門人・赫爾蒙（Boss）：重甲、無臉黑盔、胸甲裂縫透金火、神殿盾。
    hermon: function () {
      var defs =
        lg("hm_plate", stop(0, "#6a6d7e") + stop(50, "#454754") + stop(100, "#26272f")) +
        rg("hm_glow", stop(0, "#ffd27a") + stop(50, "#e6a94a") + stop(100, "rgba(230,169,74,0)"), 50, 50, 60) +
        rg("hm_shield", stop(0, "#a98c4f") + stop(100, "#5f4c26"), 50, 45, 70);
      var body =
        "<ellipse cx='52' cy='94' rx='30' ry='6' fill='rgba(0,0,0,0.5)'/>" +
        "<ellipse cx='52' cy='52' rx='40' ry='40' fill='url(#hm_glow)' opacity='0.5'/>" +
        "<path d='M32 30 q0 -10 8 -12 M72 30 q0 -10 -8 -12' stroke='#3a3c46' stroke-width='0' fill='none'/>" +
        "<path d='M30 40 q22 -14 44 0 l-2 44 q-20 12 -40 0z' fill='url(#hm_plate)'/>" +
        "<path d='M24 44 q-4 12 2 24 q8 -2 8 -10 l-2 -18z' fill='#3a3c46'/>" +
        "<path d='M80 44 q4 12 -2 24 q-8 -2 -8 -10 l2 -18z' fill='#3a3c46'/>" +
        "<path d='M34 34 a18 18 0 0 1 36 0 l0 14 q-18 8 -36 0z' fill='#1a1a20'/>" +
        "<path d='M50 26 l0 20 M40 40 l20 0' stroke='#0c0c10' stroke-width='3'/>" +
        "<ellipse cx='44' cy='36' rx='2.6' ry='3.4' fill='#e6a94a'/><ellipse cx='58' cy='36' rx='2.6' ry='3.4' fill='#e6a94a'/>" +
        "<path d='M48 56 l6 -2 -3 9 5 3 -8 4 2 8 -6 -3 -4 6 1 -9 -5 -2 6 -4z' fill='#ffcf72'/>" +
        "<path d='M46 54 l10 22' stroke='#7a3a1e' stroke-width='1' opacity='0.5'/>" +
        "<path d='M12 44 q-6 22 8 40 q14 -18 8 -40 q-8 -5 -16 0z' fill='url(#hm_shield)' stroke='#3a2f18' stroke-width='1.5'/>" +
        "<circle cx='20' cy='64' r='7' fill='none' stroke='#3a2f18' stroke-width='1.6'/><circle cx='20' cy='64' r='2.4' fill='#e6a94a'/>" +
        "<path d='M20 54 l0 -5 M20 74 l0 5 M10 64 l-5 0 M30 64 l5 0' stroke='#3a2f18' stroke-width='1.4'/>";
      return svg(defs, body, "boss-art");
    }
  };

  // ---------- 物品占位圖示 ----------
  var ITEM = {
    red_potion: function () {
      var defs = lg("ip_r", stop(0, "#e0605a") + stop(100, "#7c211d"));
      return svg(defs,
        "<rect x='42' y='16' width='16' height='10' rx='2' fill='#7a5a3a'/>" +
        "<path d='M40 26 l20 0 l6 18 a22 22 0 1 1 -32 0z' fill='#2a2230'/>" +
        "<path d='M40 40 a20 20 0 1 0 20 0z' fill='url(#ip_r)'/>" +
        "<ellipse cx='44' cy='52' rx='5' ry='8' fill='#ff9a94' opacity='0.5'/>" +
        "<circle cx='50' cy='58' r='3' fill='#ffd0cc' opacity='0.6'/>");
    },
    mana_dew: function () {
      var defs = lg("ip_m", stop(0, "#5aa0e0") + stop(100, "#204a7c"));
      return svg(defs,
        "<path d='M50 16 q14 22 14 34 a14 14 0 1 1 -28 0 q0 -12 14 -34z' fill='url(#ip_m)'/>" +
        "<path d='M44 44 a10 10 0 1 0 8 -2' fill='none' stroke='#bfe0ff' stroke-width='2' opacity='0.6'/>" +
        "<circle cx='46' cy='40' r='3' fill='#dff0ff' opacity='0.7'/>");
    },
    ash_bandage: function () {
      return svg("",
        "<circle cx='50' cy='52' r='30' fill='#8a8177'/>" +
        "<path d='M24 40 q26 8 52 0 M22 52 q28 8 56 0 M24 64 q26 6 52 0' stroke='#d8cdb4' stroke-width='6' fill='none' stroke-linecap='round'/>" +
        "<path d='M30 34 l40 40 M70 34 l-40 40' stroke='#6b6258' stroke-width='2' opacity='0.4'/>" +
        "<circle cx='50' cy='52' r='6' fill='#a5372f' opacity='0.5'/>");
    }
  };

  // ---------- 職業占位頭像 ----------
  function portraitSvg(classId) {
    var col = { warrior: "#a5372f", ranger: "#5c8a5a", rogue: "#6b5c7a", mage: "#3f6fae" }[classId] || "#8a7238";
    var defs = rg("pt_" + classId, stop(0, "#3a3330") + stop(100, "#1a1518"), 50, 30, 80);
    var hood =
      "<path d='M50 20 q26 0 26 30 l0 34 -52 0 0 -34 q0 -30 26 -30z' fill='" + col + "' opacity='0.32'/>" +
      "<path d='M50 26 q20 0 20 26 l0 30 -40 0 0 -30 q0 -26 20 -26z' fill='#2a2530'/>";
    var face =
      "<ellipse cx='50' cy='54' rx='13' ry='16' fill='#c9ad92'/>" +
      "<path d='M40 48 q10 -6 20 0' stroke='#3a2c22' stroke-width='1.4' fill='none'/>" +
      "<circle cx='45' cy='54' r='2' fill='#241a14'/><circle cx='55' cy='54' r='2' fill='#241a14'/>" +
      "<path d='M46 64 q4 3 8 0' stroke='#3a2c22' stroke-width='1.4' fill='none'/>";
    var badge = "<circle cx='50' cy='84' r='6' fill='" + col + "'/><circle cx='50' cy='84' r='6' fill='none' stroke='#e6c877' stroke-width='1'/>";
    return svg(defs, "<rect x='6' y='10' width='88' height='84' rx='8' fill='url(#pt_" + classId + ")'/>" + hood + face + badge, "portrait-art");
  }

  // ---------- 對外 API ----------
  function monster(baseId) { return (MON[baseId] || MON.helmet_rat)(); }

  function monsterNode(baseId) {
    return node("assets/images/monsters/" + baseId + ".png", monster(baseId), "mon");
  }
  function itemNode(itemId) {
    var ph = (ITEM[itemId] ? ITEM[itemId]() : svg("", "<circle cx='50' cy='52' r='26' fill='#6b5c47'/>"));
    return node("assets/images/items/" + itemId + ".png", ph, "item");
  }
  function portraitNode(classId) {
    return node("assets/images/portraits/" + classId + ".png", portraitSvg(classId), "portrait");
  }

  function equipPlaceholder() {
    return svg("", "<path d='M50 12 l32 20 -13 42 -38 0 -13 -42z' fill='#4a4238' stroke='#8a7238' stroke-width='2'/>" +
      "<circle cx='50' cy='46' r='11' fill='none' stroke='#e6a94a' stroke-width='2' opacity='0.8'/>");
  }
  function equipNode(id) {
    return node("assets/images/equipment/" + id + ".png", equipPlaceholder(), "equip");
  }

  // 預先載入一批圖（載好＋去背處理後放進快取）。之後顯示就直接出真圖、不會先閃占位剪影。
  function preload(urls, done) {
    if (!urls || !urls.length) { if (done) done(); return; }
    var left = urls.length;
    urls.forEach(function (u) { ensure(u, function () { if (--left === 0 && done) done(); }); });
  }

  return {
    monster: monster,
    monsterNode: monsterNode,
    itemNode: itemNode,
    portraitNode: portraitNode,
    equipNode: equipNode,
    load: ensure,     // 取得處理後的圖：load(url, function(res){ res.status==='ok' → res.data })
    preload: preload  // 預先載入一批 url
  };
})();
