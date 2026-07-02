// js/effects.js
// 戰鬥特效管理器（EffectsManager）。
// Canvas 畫粒子 / 投射物 / 劍光 / 爆炸；CSS 負責畫面震動與變色；DOM 顯示傷害數字。
// 對外主要用 playAttack(kind, targetEl, opts) 播放整段技能動畫，
// 動畫結束時呼叫 opts.onDone —— 戰鬥流程靠這個等動畫播完才進入下一回合（鎖輸入）。
window.Abyss = window.Abyss || {};

window.Abyss.Effects = (function () {
  "use strict";

  let scene = null, canvas = null, ctx = null, domLayer = null;
  let W = 0, H = 0, dpr = 1;
  let objs = [];       // 劍光 / 光環 / 投射物 / 閃光
  let particles = [];  // 火花
  let running = false, lastT = 0;

  function nowMs() {
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }

  function ensure() {
    scene = document.getElementById("battle-scene");
    if (!scene) return false;
    if (!canvas || canvas.parentNode !== scene) {
      canvas = document.createElement("canvas");
      canvas.className = "fx-canvas";
      scene.appendChild(canvas);
      domLayer = document.createElement("div");
      domLayer.className = "fx-dom";
      scene.appendChild(domLayer);
      ctx = canvas.getContext("2d");
      window.addEventListener("resize", resize);
    }
    resize();
    return true;
  }

  function resize() {
    if (!scene || !canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = scene.clientWidth; H = scene.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 每場戰鬥開始時清乾淨。
  function reset() {
    objs = []; particles = [];
    if (domLayer) domLayer.innerHTML = "";
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  // 目標怪物在舞台內的座標（命中點取偏上一點的身體位置）。
  function rectOf(el) {
    const sr = scene.getBoundingClientRect(), r = el.getBoundingClientRect();
    return {
      cx: r.left - sr.left + r.width / 2,
      cy: r.top - sr.top + r.height * 0.42,
      w: r.width, h: r.height
    };
  }
  function playerX() { return W * 0.5; }
  function playerY() { return H * 0.95; } // 玩家視角在畫面下方

  function start() { if (!running) { running = true; lastT = nowMs(); requestAnimationFrame(loop); } }

  function loop() {
    const t = nowMs(); const k = Math.min(3, (t - lastT) / 16); lastT = t;
    ctx.clearRect(0, 0, W, H);
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]; o.t += (t - (o._lt || t)); o._lt = t;
      drawObj(o);
      if (o.t >= o.dur) objs.splice(i, 1);
    }
    for (let j = particles.length - 1; j >= 0; j--) {
      const p = particles[j];
      p.life -= (t - (p._lt || t)); p._lt = t;
      if (p.life <= 0) { particles.splice(j, 1); continue; }
      p.vy += (p.grav || 0) * k;
      p.x += p.vx * k; p.y += p.vy * k;
      drawParticle(p);
    }
    if (objs.length || particles.length) requestAnimationFrame(loop);
    else running = false;
  }

  function drawParticle(p) {
    const a = Math.max(0, p.life / p.maxlife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function drawObj(o) {
    let p = o.t / o.dur; if (p > 1) p = 1;
    ctx.save();
    if (o.type === "slash") {
      const e = Math.min(1, p * 2), a = Math.sin(p * Math.PI);
      const mx = o.ax + (o.bx - o.ax) * e, my = o.ay + (o.by - o.ay) * e;
      ctx.globalAlpha = a; ctx.lineCap = "round";
      ctx.strokeStyle = o.color; ctx.lineWidth = o.width; ctx.shadowColor = o.color; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(o.ax, o.ay); ctx.lineTo(mx, my); ctx.stroke();
      ctx.globalAlpha = a * 0.95; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = o.width * 0.4;
      ctx.beginPath(); ctx.moveTo(o.ax, o.ay); ctx.lineTo(mx, my); ctx.stroke();
    } else if (o.type === "ring") {
      const r = o.r0 + (o.r1 - o.r0) * p;
      ctx.globalAlpha = 1 - p; ctx.strokeStyle = o.color; ctx.lineWidth = o.width || 3;
      ctx.shadowColor = o.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.stroke();
    } else if (o.type === "flash") {
      const r = o.r * (1 + p * 3 * (o.scale || 1)), a = 1 - p;
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
      g.addColorStop(0, o.color.replace("A", (a * 0.9).toFixed(3)));
      g.addColorStop(1, o.color.replace("A", "0"));
      ctx.fillStyle = g; ctx.fillRect(o.x - r, o.y - r, r * 2, r * 2);
    } else if (o.type === "proj") {
      const px = o.sx + (o.tx - o.sx) * p, py = o.sy + (o.ty - o.sy) * p;
      const ang = Math.atan2(o.ty - o.sy, o.tx - o.sx);
      if (o.style === "arrow") {
        ctx.translate(px, py); ctx.rotate(ang);
        ctx.strokeStyle = o.color; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.shadowColor = o.color; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(6, 0);
        ctx.moveTo(6, 0); ctx.lineTo(-1, -4); ctx.moveTo(6, 0); ctx.lineTo(-1, 4); ctx.stroke();
      } else {
        particles.push({ x: px, y: py, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), life: 220, maxlife: 220, color: "#ff9a3a", size: 2 + Math.random() * 2, grav: 0, _lt: nowMs() });
        const fg = ctx.createRadialGradient(px, py, 0, px, py, 11);
        fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.4, "#ffcf72"); fg.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
      }
      if (p >= 1 && !o.arrived) { o.arrived = true; if (o.onArrive) o.onArrive(); }
    }
    ctx.restore();
  }

  // ---- 生成器 ----
  function addSlash(ax, ay, bx, by, dur, color, width) {
    objs.push({ type: "slash", ax: ax, ay: ay, bx: bx, by: by, dur: dur, t: 0, color: color, width: width, _lt: nowMs() });
    start();
  }
  function addRing(x, y, r0, r1, dur, color, width) {
    objs.push({ type: "ring", x: x, y: y, r0: r0, r1: r1, dur: dur, t: 0, color: color, width: width, _lt: nowMs() });
    start();
  }
  function addFlash(x, y, color, scale) {
    objs.push({ type: "flash", x: x, y: y, r: 10, dur: 240, t: 0, color: color, scale: scale || 1, _lt: nowMs() });
    start();
  }
  function addProj(sx, sy, tx, ty, dur, style, color, onArrive) {
    objs.push({ type: "proj", sx: sx, sy: sy, tx: tx, ty: ty, dur: dur, t: 0, style: style, color: color, onArrive: onArrive, arrived: false, _lt: nowMs() });
    start();
  }
  function burst(x, y, n, colors, scale) {
    scale = scale || 1;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = (1.4 + Math.random() * 3.4) * scale;
      particles.push({
        x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1,
        life: 420 + Math.random() * 320, maxlife: 720, color: colors[i % colors.length],
        size: 1.6 + Math.random() * 2.4 * scale, grav: 0.22, _lt: nowMs()
      });
    }
    start();
  }

  // ---- 畫面 / DOM 回饋 ----
  function shake(hard) {
    if (!scene) return;
    scene.classList.remove("shake", "shake-hard");
    void scene.offsetWidth;
    scene.classList.add(hard ? "shake-hard" : "shake");
  }
  function recoil(el) {
    if (!el) return;
    el.classList.remove("struck");
    void el.offsetWidth;
    el.classList.add("struck");
  }
  function tint(color, dur, z) {
    if (!scene) return;
    const t = document.createElement("div");
    t.className = "fx-tint";
    t.style.background = color;
    t.style.zIndex = z || 45;
    scene.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = "1"; });
    window.setTimeout(function () { t.style.opacity = "0"; }, dur * 0.55);
    window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, dur);
  }
  function damageNumber(x, y, dmg, crit) {
    if (!domLayer) return;
    const el = document.createElement("div");
    el.className = "dmg-num" + (crit ? " crit" : "");
    el.textContent = String(dmg);
    el.style.left = x + "px";
    el.style.top = y + "px";
    domLayer.appendChild(el);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950);
  }
  function stickArrow(el, r) {
    if (!domLayer) return;
    const a = document.createElement("div");
    a.className = "stuck-arrow";
    a.style.left = r.cx + "px";
    a.style.top = r.cy + "px";
    domLayer.appendChild(a);
    window.setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 450);
  }

  // 共通受擊：後仰、閃白、火花、傷害數字、震動。
  function impact(r, el, crit, dmg, pal) {
    recoil(el);
    addFlash(r.cx, r.cy, pal.flash, crit ? 1.35 : 1);
    burst(r.cx, r.cy, crit ? 26 : 13, pal.spark, crit ? 1.5 : 1);
    if (dmg != null) damageNumber(r.cx, r.cy - r.h * 0.16, dmg, crit);
    shake(crit);
  }

  // ---- 四職業招式 ----
  const SKILLS = {
    // 戰士：白金色大範圍劍光、命中火花、後仰。
    sword: function (r, el, crit, dmg, onDone) {
      const pal = { flash: "rgba(255,250,232,A)", spark: ["#ffffff", "#ffe9b0", "#ffd27a"] };
      addSlash(r.cx - r.w * 0.75, r.cy - r.h * 0.55, r.cx + r.w * 0.75, r.cy + r.h * 0.5, 260, "#fff6d8", crit ? 10 : 8);
      window.setTimeout(function () { addSlash(r.cx + r.w * 0.72, r.cy - r.h * 0.45, r.cx - r.w * 0.72, r.cy + r.h * 0.6, 240, "#ffe9b0", crit ? 8 : 6); }, 90);
      window.setTimeout(function () { impact(r, el, crit, dmg, pal); }, 140);
      window.setTimeout(onDone, crit ? 540 : 460);
    },
    // 弓箭手：箭矢飛行、命中火花爆點、箭短暫插在目標上。
    arrow: function (r, el, crit, dmg, onDone) {
      addProj(playerX() - W * 0.32, playerY() * 0.82, r.cx, r.cy, 240, "arrow", "#ffe6a0", function () {
        impact(r, el, crit, dmg, { flash: "rgba(255,240,200,A)", spark: ["#ffe6a0", "#ffb24a", "#ffffff"] });
        stickArrow(el, r);
      });
      window.setTimeout(onDone, 560);
    },
    // 盜賊：畫面短暫變暗、紫白匕首刀光、快速雙斬、殘影。
    dagger: function (r, el, crit, dmg, onDone) {
      tint("rgba(18,4,30,0.5)", 340, 45);
      window.setTimeout(function () {
        addSlash(r.cx - r.w * 0.55, r.cy - r.h * 0.5, r.cx + r.w * 0.55, r.cy + r.h * 0.5, 180, "#e6c8ff", crit ? 7 : 5);
        window.setTimeout(function () { addSlash(r.cx + r.w * 0.55, r.cy - r.h * 0.45, r.cx - r.w * 0.55, r.cy + r.h * 0.5, 170, "#ffffff", crit ? 6 : 4); }, 70);
      }, 90);
      window.setTimeout(function () { impact(r, el, crit, dmg, { flash: "rgba(220,200,255,A)", spark: ["#e6c8ff", "#ffffff", "#b98cff"] }); }, 210);
      window.setTimeout(onDone, 470);
    },
    // 魔法師：魔法環聚能、火焰飛射、命中爆炸、殘留火花。
    magic: function (r, el, crit, dmg, onDone) {
      addRing(playerX(), H * 0.9, 6, 40, 250, "#ffb24a", 3);
      addRing(playerX(), H * 0.9, 4, 26, 260, "#ffd27a", 2);
      window.setTimeout(function () {
        addProj(playerX(), H * 0.9, r.cx, r.cy, 300, "fire", "#ff9a3a", function () {
          addFlash(r.cx, r.cy, "rgba(255,170,80,A)", crit ? 1.7 : 1.35);
          addRing(r.cx, r.cy, 8, r.w * 0.95, 340, "#ffb24a", 3);
          burst(r.cx, r.cy, crit ? 34 : 20, ["#ffe6a0", "#ff7a2a", "#ff9a3a"], crit ? 1.7 : 1.3);
          impact(r, el, crit, dmg, { flash: "rgba(255,190,110,A)", spark: ["#ffe6a0", "#ff7a2a"] });
        });
      }, 250);
      window.setTimeout(onDone, crit ? 740 : 690);
    }
  };

  // ---- 對外 API ----
  function playAttack(kind, targetEl, opts) {
    opts = opts || {};
    const done = opts.onDone || function () {};
    if (!ensure() || !targetEl) { done(); return; }
    const r = rectOf(targetEl);
    const fn = SKILLS[kind] || SKILLS.sword;
    fn(r, targetEl, !!opts.crit, opts.damage, done);
  }

  // 玩家受傷：畫面閃紅 + 震動（heavy=重擊時加強）。
  function playHurt(heavy) {
    if (!ensure()) return;
    tint(heavy ? "rgba(170,20,20,0.5)" : "rgba(150,25,25,0.34)", heavy ? 420 : 320, 58);
    shake(!!heavy);
  }

  return {
    reset: reset,
    playAttack: playAttack,
    playHurt: playHurt
  };
})();
