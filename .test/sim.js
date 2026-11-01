// headless 仿真：验证斜射 / 跳跃开火 / 滑铲开火 / 坦克行为
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let rafCb = null;
const listeners = {};
const canvasStyle = {};

function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  const ctx = new Proxy({}, {
    get(t, p) {
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => grad;
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "canvas") return { width: 960, height: 540 };
      if (p === "setLineDash") return noop;
      if (typeof p === "string" && ["fillStyle","strokeStyle","lineWidth","font","globalAlpha","textAlign","lineCap","lineJoin"].includes(p)) return t[p];
      return noop;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
  return ctx;
}

global.window = {
  innerWidth: 1280, innerHeight: 800,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  AudioContext: function () { throw new Error("no audio"); },
};
global.document = {
  getElementById(id) {
    return {
      style: canvasStyle,
      width: 960, height: 540,
      getContext() { return makeCtx(); },
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    };
  },
};
global.requestAnimationFrame = (cb) => { rafCb = cb; };
global.performance = { now: () => Date.now() };

const code = js + `
globalThis.__D = {
  get state(){return state}, set state(v){state=v},
  get p(){return player}, get enemies(){return enemies}, get bullets(){return bullets},
  get ebullets(){return ebullets}, get cam(){return cam}, set cam(v){cam=v},
  get lives(){return lives}, set lives(v){lives=v},
  get LEVEL_IDX(){return LEVEL_IDX},
  startGame, nextLevel, loadLevel, update, render, groundYAt,
  mkTank: (x)=>makeTank(x), mkTurret:(x,sp)=>{const g=groundYAt(x);return makeTurret(x,g-40,sp);},
  mkFort:(x,mode)=>makeFort(x,mode),
  mkCam:(x,y)=>makeCam(x,y),
  get platforms(){return platforms}, get triggers(){return triggers},
  get boss(){return boss}, get LEVEL_W(){return LEVEL_W},
  get ironBalls(){return ironBalls},
  spawnIronBall:(b)=>spawnIronBall(b), damageSniper:(d)=>damageSniper(d),
  sniperBox:()=>sniperBox(), get S(){return score}, get livesV(){return lives},
  setCam(v){cam=v}, get W(){return W}, get H(){return H},
  get crates(){return crates}, get redPools(){return redPools}, get debris(){return debris},
  get finalRun(){return finalRun}, killCore, startAftermath, startFinalRun, makeBoss,
  get score(){return score}, set score(v){score=v},
};
`;
(0, eval)(code);

const D = globalThis.__D;
const keys = {};
function key(code, down = true) {
  keys[code] = down;
  const type = down ? "keydown" : "keyup";
  for (const fn of listeners[type] || []) fn({ code, repeat: false, preventDefault() {} });
}
function clearKeys() { for (const k of Object.keys(keys)) key(k, false); }

let T = 0;
function step(n = 1) {
  for (let i = 0; i < n; i++) { T += 16.7; if (rafCb) rafCb(T); }
}
function tp(x) {
  const p = D.p;
  p.x = x; p.y = D.groundYAt(x + p.w / 2) - p.h; p.vy = 0; p.onGround = true; p.inv = 0;
  D.setCam(Math.max(0, x - D.W * 0.38));
}
const results = [];
function ok(name, cond, extra = "") {
  results.push([cond ? "PASS" : "FAIL", name, extra]);
  console.log((cond ? "  ✔ " : "  ✘ ") + name + (extra ? "  → " + extra : ""));
}

// ================= 第一关：向上开火 / 跳跃 / 滑铲 =================
D.startGame();
D.state = "play";
step(2);
tp(600);
clearKeys(); step(3);
D.p.inv = 0;

console.log("\n【1】↑+→ 按住：边走边朝正上方打");
key("ArrowRight"); key("ArrowUp");
step(6);
let p = D.p;
ok("抬枪角度 = 正上（-π/2，无斜射）", Math.abs(p.aimAng + Math.PI/2) < 0.02, "aimAng=" + p.aimAng.toFixed(3));
ok("朝向 = 右", p.face === 1, "face=" + p.face);
ok("人物在向前走", p.vx > 3, "vx=" + p.vx.toFixed(2) + " x=" + p.x.toFixed(1));
const x0 = p.x;
key("Digit1"); step(1);
let b = D.bullets[D.bullets.length - 1];
ok("按 1 射出正上子弹", b && Math.abs(b.vx) < 0.01 && b.vy < 0, b ? `vx=${b.vx.toFixed(2)} vy=${b.vy.toFixed(2)}` : "无子弹");
step(30);
ok("持续按住 1 = 连射", D.bullets.length >= 2, "场上子弹 " + D.bullets.length);
ok("边走边打（位移）", D.p.x > x0 + 60, "x " + x0.toFixed(0) + " → " + D.p.x.toFixed(0));
ok("连射期间仍朝正上", Math.abs(D.p.aimAng + Math.PI/2) < 0.02, "aimAng=" + D.p.aimAng.toFixed(3));

console.log("\n【2】↑+← 同样是正上（左斜上已移除）");
clearKeys(); key("ArrowLeft"); key("ArrowUp"); step(4);
p = D.p;
ok("朝向 = 左 / 角度 = 正上", p.face === -1 && Math.abs(p.aimAng + Math.PI/2) < 0.02,
   `face=${p.face} aim=${p.aimAng.toFixed(2)}`);
key("Digit1"); step(14);
const allUp = D.bullets.length > 0 && D.bullets.every(x => Math.abs(x.vx) < 0.01);
ok("不再产生任何斜向子弹", allUp, "场上子弹 " + D.bullets.length + "，带水平分量的 " + D.bullets.filter(x=>Math.abs(x.vx)>0.01).length);

console.log("\n【3】跳跃中开火");
clearKeys(); step(4); tp(900); clearKeys(); step(2); D.bullets = D.bullets;
D.p.inv = 0;
key("Digit2"); step(2);
ok("已起跳", !D.p.onGround && D.p.vy < 0, "vy=" + D.p.vy.toFixed(2));
const nB = D.bullets.length;
key("Digit1"); step(1);
ok("空中按 1 有子弹", D.bullets.length > nB, "子弹 " + nB + " → " + D.bullets.length);
let shots = 0, prevCd = D.p.fireCd;
for (let i=0;i<24;i++){ step(1); if (D.p.fireCd > prevCd) shots++; prevCd = D.p.fireCd; }
ok("空中持续连射", shots >= 2, "24 帧内开火 " + shots + " 次");

console.log("\n【4】滑铲中开火");
clearKeys(); step(40); tp(1200); clearKeys(); step(2); D.p.inv = 0;
D.p.slideCd = 0;
key("ArrowDown"); step(1); key("ArrowRight"); step(2);
ok("进入滑铲", D.p.slideT > 0, "slideT=" + D.p.slideT);
const nS = D.bullets.length;
key("Digit1"); step(1);
ok("滑铲中可开火", D.bullets.length > nS, "子弹 " + nS + " → " + D.bullets.length);
ok("滑铲平射（角度 0）", D.p.aimAng === 0, "aimAng=" + D.p.aimAng);
clearKeys();

// ================= 第二关：坦克 =================
console.log("\n【5】第二关坦克");
D.nextLevel();
D.state = "play";
step(2);
D.enemies.length = 0;
clearKeys();
tp(2000); step(2);
const tank = D.mkTank(2400);
D.enemies.push(tank);
ok("坦克血量提高", tank.hp >= 10, "hp=" + tank.hp + " 尺寸 " + tank.w + "×" + tank.h);

// 玩家在坦克右侧 400px：坦克应向前（向右）推进
tp(2900); clearKeys(); step(2);
const tx0 = tank.x, lvA = D.lives;
for (let i=0;i<120;i++){ D.p.inv = 999; D.p.x = 2900; step(1); }
ok("坦克主动向前推进", tank.x > tx0 + 40, "x " + tx0.toFixed(0) + " → " + tank.x.toFixed(0) + " st=" + tank.st + " lives " + lvA + "→" + D.lives);

// 玩家贴近：应被碾压
clearKeys();
D.p.x = tank.x + tank.w + 4; D.p.y = D.groundYAt(D.p.x + 10) - D.p.h; D.p.inv = 0;
const lv0 = D.lives;
let hit = false;
for (let i = 0; i < 90; i++) {
  step(1);
  if (D.lives < lv0) { hit = true; break; }
  D.p.x = Math.min(D.p.x, tank.x + tank.w + 2);
}
ok("坦克碾压造成伤害", hit, "lives " + lv0 + " → " + D.lives + " st=" + tank.st);

// 冲完没碾到 → 后退
D.enemies.length = 0; D.lives = 5;
const t2 = D.mkTank(2400); D.enemies.push(t2);
tp(2900); step(2);
t2.st = "charge"; t2.stT = 4;
const x1 = t2.x;
step(20);
ok("冲锋结束后转为后退", t2.st === "retreat" && t2.x < x1 + 4, "st=" + t2.st + " x " + x1.toFixed(0) + " → " + t2.x.toFixed(0));

// 站在坦克顶上：站得住，且不下落
D.enemies.length = 0; D.lives = 5;
const t3 = D.mkTank(2400); D.enemies.push(t3);
const pp = D.p;
pp.x = t3.x + 30; pp.y = t3.y - pp.h - 2; pp.vy = 0; pp.onGround = false; pp.inv = 999;
step(8);
ok("能踩到坦克顶上站立", Math.abs(pp.y + pp.h - t3.y) < 3 && pp.onGround,
   "脚=" + (pp.y + pp.h).toFixed(1) + " 车顶=" + t3.y.toFixed(1) + " onGround=" + pp.onGround);
// 车顶被带走：坦克 charge 时玩家 x 跟随
t3.st = "charge"; t3.stT = 60; t3.face = 1; t3.home = t3.x;
const px0 = pp.x;
step(30);
ok("车顶随车移动", Math.abs(pp.x - px0) > 20 || pp.x > px0 + 10, "x " + px0.toFixed(0) + " → " + pp.x.toFixed(0));

// 坦克炮不能向上打
D.ebullets.length = 0; D.enemies.length = 0;
const t4 = D.mkTank(2400); D.enemies.push(t4);
pp.x = t4.x - 200; pp.y = t4.y - 260; pp.vy = 0; pp.inv = 999; pp.onGround = false;
t4.cd = 1;
step(3);
const shotsNow = D.ebullets.slice();
let steep = shotsNow.filter(s => s.vy / Math.hypot(s.vx, s.vy) < -0.42);
ok("主炮仰角受限（打不到高空）", t4.gunA > -0.32 && steep.length === 0,
   "gunA=" + t4.gunA.toFixed(2) + " 仰角过大的弹=" + steep.length);

// ================= 空中前滚翻 =================
console.log("\n【7】空中前滚翻");
D.enemies.length = 0; D.ebullets.length = 0; D.bullets.length = 0;
tp(600); clearKeys(); step(3); D.p.inv = 999;
key("Digit2"); step(1); key("Digit2", false);
const pr = D.p;
ok("起跳进入翻滚", pr.rolling === true && !pr.onGround, "rolling=" + pr.rolling + " vy=" + pr.vy.toFixed(1));
let a0 = pr.rollAng, mono = true, maxA = 0;
for (let i = 0; i < 40; i++) {
  step(1);
  const a = Math.abs(pr.rollAng);
  if (a + 1e-6 < maxA) mono = false;
  maxA = Math.max(maxA, a);
  if (pr.onGround) break;
}
ok("空中持续翻转（角度递增）", mono && maxA > 3.0, "最大角度 " + maxA.toFixed(2) + " rad（≈" + (maxA / Math.PI * 180).toFixed(0) + "°）");
step(6);
ok("落地恢复站立", pr.onGround && !pr.rolling && Math.abs(Math.abs(pr.rollAng) - Math.PI*2) < 0.01,
   "onGround=" + pr.onGround + " rolling=" + pr.rolling + " ang=" + pr.rollAng.toFixed(2));

// ================= 炮台平滑转头 =================
console.log("\n【8】炮台转头");
D.enemies.length = 0; D.ebullets.length = 0;
const g1 = D.mkTurret(900, false); D.enemies.push(g1);
g1.cd = 0;
const pp2 = D.p;
pp2.x = 1250; pp2.y = D.groundYAt(pp2.x + pp2.w / 2) - pp2.h; pp2.vy = 0; pp2.onGround = true; pp2.dead = false;
D.setCam(200);
const gA0 = g1.gunA;
step(1);
const d1 = Math.abs(g1.gunA - gA0);
ok("炮塔逐帧转头（不是瞬间对准）", d1 > 0 && d1 <= 0.09, "首帧转动 " + d1.toFixed(3) + " rad");
let firedEarly = D.ebullets.length;
ok("未对准前不开火", firedEarly === 0, "场上敌弹 " + firedEarly);
step(70);
ok("对准后开火", D.ebullets.length > 0, "敌弹 " + D.ebullets.length + " gunA=" + g1.gunA.toFixed(2));
// 玩家换到左侧 → 炮塔反向转
pp2.x = 560; pp2.y = D.groundYAt(pp2.x + pp2.w / 2) - pp2.h; pp2.onGround = true;
const gA1 = g1.gunA;
step(6);
ok("玩家换边后炮塔反向转动", Math.abs(g1.gunA - gA1) > 0.1, "gunA " + gA1.toFixed(2) + " → " + g1.gunA.toFixed(2));

// ================= 工事兵：战壕 / 高塔 / 草丛 =================
console.log("\n【9】工事兵（战壕 / 高塔 / 草丛）");
D.enemies.length = 0;
const tren = D.mkFort(1000, "trencher");
const camper = D.mkFort(1120, "camper");
const tower = D.mkFort(1240, "tower");
D.enemies.push(tren, camper, tower);
pp2.x = 900; pp2.y = D.groundYAt(pp2.x + pp2.w / 2) - pp2.h; pp2.onGround = true; pp2.inv = 999;
let fortErr = null;
try { step(30); D.render(); } catch (e) { fortErr = e; }
ok("三种工事兵生成并渲染", !fortErr && D.enemies.length === 3, fortErr ? fortErr.message : "数量 " + D.enemies.length);
// 草丛伏兵：靠近后现身
pp2.x = 1060; step(4);
ok("草丛伏兵靠近即现身", camper.revealed === true, "revealed=" + camper.revealed);
// 战壕兵：抬头时才可被打，且会周期性抬头
tren.cd = 1; step(3);
ok("战壕兵周期性探头", tren.up > 0, "up=" + tren.up);
// 高塔狙击手比地面兵更高
ok("高塔狙击手位于高处", tower.y - 150 > 0 && tower.mode === "tower", "塔高基准 y=" + tower.y);


// ================= 第二关长栈桥 + 蹲下下穿 =================
console.log("\n【10】长栈桥 / 蹲下+2 下穿到下一层");
D.nextLevel();
D.state = "play";
step(2);
const plats = D.platforms;
const widest = Math.max(...plats.map(o => o.w));
ok("栈桥加长为连续长桥（单条 ≥ 600px）", widest >= 600, "最长 " + widest + "px，共 " + plats.length + " 段");
ok("栈桥上下两条路线（存在高架层）", plats.filter(o => o.y <= 260).length >= 3,
   "高架段 " + plats.filter(o => o.y <= 260).length + " 条");

let q = D.p;
q.x = 300; q.y = 348 - q.h; q.vy = 0; q.onGround = true; q.inv = 999;
D.setCam(0);
step(3);
ok("跳上长栈桥后可站立", q.onGround && Math.abs(q.y + q.h - 348) < 1.5,
   "脚部 y=" + (q.y + q.h).toFixed(1) + " platY=" + q.platY);
// 蹲下 + 2 → 下穿
key("ArrowDown"); step(5);
key("Digit2"); step(2);
ok("桥上蹲下按 2 触发下穿（不是起跳）", !q.onGround && q.y + q.h > 350,
   "onGround=" + q.onGround + " vy=" + q.vy.toFixed(1) + " 脚=" + (q.y + q.h).toFixed(1));
key("Digit2", false); key("ArrowDown", false);
for (let i = 0; i < 40; i++) { step(1); if (q.onGround) break; }
ok("下穿后落到下一行地面", q.onGround && Math.abs((q.y + q.h) - D.groundYAt(q.x + 11)) < 2,
   "脚=" + (q.y + q.h).toFixed(1) + " 地面=" + D.groundYAt(q.x + 11));
// 站着按 2 仍是正常起跳
const beforeY = q.y;
key("Digit2"); step(2);
ok("站着按 2 仍是起跳（不下穿）", !q.onGround && q.y < beforeY - 4, "y " + beforeY.toFixed(0) + " → " + q.y.toFixed(0));
key("Digit2", false);
step(60);

// ================= 坦克数量与开火 =================
console.log("\n【11】更多坦克 / 坦克开火");
const tankCount = D.triggers.filter(t => t.type === "tank" || t.type === "turret").length;
ok("第二关坦克触发点 ≥ 18", tankCount >= 18, "坦克 " + tankCount + " 辆");
D.enemies.length = 0; D.ebullets.length = 0;
const tk = D.mkTank(1200); tk.cd = 6; D.enemies.push(tk);
q = D.p; q.x = 1010; q.y = D.groundYAt(1021) - q.h; q.vy = 0; q.onGround = true; q.inv = 999;
D.setCam(800);
let tkShots = 0, prevEb = 0, tkWarn = false;
for (let i = 0; i < 60; i++) {
  step(1);
  if (D.ebullets.length > prevEb) tkShots += D.ebullets.length - prevEb;
  prevEb = D.ebullets.length;
  if (tk.aim > 0 || tk.recoil > 0) tkWarn = true;
}
ok("坦克会发射炮弹（带炮口预警）", tkShots >= 1, "60 帧内 " + tkShots + " 发");
ok("坦克开火前有瞄准线预警", tkWarn, "aim 线出现过 = " + tkWarn);

// ================= 摄像头：单发 + 数量 =================
console.log("\n【12】摄像头削弱为单发 / 数量增多");
const camCount = D.triggers.filter(t => t.type === "cam").length;
ok("摄像头数量 ≥ 20", camCount >= 20, "摄像头 " + camCount + " 台");
D.enemies.length = 0; D.ebullets.length = 0;
const camE = D.mkCam(1000, 78); camE.cd = 1; camE.warn = 0;
D.enemies.push(camE);
q.x = 1040; q.y = D.groundYAt(1051) - q.h; q.onGround = true; q.inv = 999;
let camShots = 0; prevEb = 0;
for (let i = 0; i < 120; i++) { step(1); if (D.ebullets.length > prevEb) camShots += D.ebullets.length - prevEb; prevEb = D.ebullets.length; }
ok("摄像头一次只打一发子弹", camShots === 1, "120 帧内 " + camShots + " 发");

// ================= 第二关 Boss 特殊攻击 =================
console.log("\n【13】Boss 非弹幕攻击（电弧 / 激光 / 落锤）");
const bs = D.boss;
q = D.p; q.x = 8950; q.y = D.groundYAt(8961) - q.h; q.vy = 0; q.onGround = true; q.inv = 999;
D.setCam(D.LEVEL_W - D.W);
bs.active = true; bs.t = 0; bs.spT = 109; bs.spIdx = -1; bs.specials = [];
step(1);
ok("① 地面电弧波", bs.specials.some(s => s.type === "arc"), "special=" + bs.specials.map(s=>s.type).join(","));
const arc = bs.specials.find(s => s.type === "arc");
const arX0 = arc ? arc.x : 0;
step(20);
ok("电弧先原地蓄能（有提前预兆）", arc && Math.abs(arc.x - arX0) < 0.01 && arc.warn > 0,
   arc ? "x 未动，warn=" + arc.warn : "无");
step(60);
ok("蓄能结束后贴地推进（不是子弹）", arc && Math.abs(arc.x - arX0) > 30,
   arc ? "x " + arX0.toFixed(0) + " → " + arc.x.toFixed(0) : "无");
bs.specials = []; bs.spT = 359; step(1);
ok("② 激光扫射", bs.specials.some(s => s.type === "laser"), "special=" + bs.specials.map(s=>s.type).join(","));
const lz = bs.specials.find(s => s.type === "laser");
const angA = lz ? lz.ang : 0; step(60);
ok("激光角度持续扫描", lz && Math.abs(lz.ang - angA) > 0.1, lz ? "ang " + angA.toFixed(2) + " → " + lz.ang.toFixed(2) : "无");
bs.specials = []; bs.spT = 609; step(1);
ok("③ 厂房落锤", bs.specials.some(s => s.type === "piston"), "special=" + bs.specials.map(s=>s.type).join(","));
const ps = bs.specials.find(s => s.type === "piston");
let pistonLanded = false;
for (let i = 0; i < 80; i++) { step(1); if (ps.hit) { pistonLanded = true; break; } }
ok("落锤砸到地面并回收", pistonLanded, "y=" + (ps ? ps.y.toFixed(0) : "-") + " hit=" + (ps ? ps.hit : "-"));
// 破防后不再发动特殊攻击
bs.core.dead = true; bs.specials = []; bs.spT = 0;
for (let i = 0; i < 400; i++) step(1);
ok("核心破防后不再发动特殊攻击", bs.specials.length === 0, "残留 " + bs.specials.length);


// ================= 黑铁巨弹（要塞首发） =================
console.log("\n【14】要塞首发黑铁巨弹：物理滚动 / 可击碎 / 撞人爆开");
D.startGame(); D.state = "play"; step(2);
D.setCam(D.LEVEL_W - D.W);
const bb = D.boss; bb.active = true; bb.ballT = 0; bb.sniper.cd = 99999;
let pp3 = D.p; pp3.x = 15300; pp3.y = D.groundYAt(15311) - pp3.h; pp3.onGround = true; pp3.inv = 999;
D.ironBalls.length = 0; D.ebullets.length = 0;
let bornAt = -1, firstEb = -1, vy0 = 0, vx0 = 0;
for (let i = 0; i < 40; i++) {
  step(1);
  if (D.ironBalls.length && bornAt < 0) { bornAt = i + 1; vy0 = D.ironBalls[0].vy; vx0 = D.ironBalls[0].vx; }
  if (D.ebullets.length && firstEb < 0) firstEb = i + 1;
}
ok("开战后第一发就是黑铁巨弹", bornAt > 0 && (firstEb < 0 || bornAt < firstEb),
   "黑铁弹第 " + bornAt + " 帧 / 第一颗子弹第 " + (firstEb < 0 ? "无" : firstEb + " 帧"));
ok("出手时是抛物线（向上抛出，不是直射）", vy0 < 0 && vx0 < 0, "vx=" + vx0.toFixed(2) + " vy=" + vy0.toFixed(2));
const ball1 = D.ironBalls[0];
let rolled = false;
for (let i = 0; i < 80; i++) { step(1); D.p.inv = 999; if (ball1.rolling) { rolled = true; break; } }
ok("落地后转为贴地向前滚动", rolled && ball1.rolling && ball1.vx < -2.5, "rolling=" + ball1.rolling + " vx=" + ball1.vx.toFixed(2));
const gyB = D.groundYAt(ball1.x);
ok("滚动时贴着地面（受地形起伏）", Math.abs(ball1.y + ball1.r - gyB) < 3, "球底=" + (ball1.y+ball1.r).toFixed(1) + " 地面=" + gyB);
let killedBall = false;
for (let k = 0; k < 8 && !killedBall; k++) {
  D.bullets.push({x: ball1.x - 34, y: ball1.y - 4, w: 8, h: 8, vx: 7, vy: 0, life: 30, dmg: 1});
  for (let i = 0; i < 10; i++) { step(1); if (ball1.hp <= 0) { killedBall = true; break; } }
}
step(3);
ok("子弹能打碎黑铁弹", killedBall && D.ironBalls.indexOf(ball1) < 0, "hp=" + ball1.hp + "，场上剩 " + D.ironBalls.length + " 颗");

D.ironBalls.length = 0; D.ebullets.length = 0;
D.spawnIronBall(bb);
const ball2 = D.ironBalls[D.ironBalls.length - 1];
pp3 = D.p; pp3.inv = 0; pp3.dead = false; pp3.x = 15300;
pp3.y = D.groundYAt(15311) - pp3.h; pp3.onGround = true;
ball2.rolling = true; ball2.vy = 0; ball2.vx = -4;
ball2.y = D.groundYAt(pp3.x + 11) - ball2.r; ball2.x = pp3.x + 24;
D.ebullets.length = 0;
const livesBefore = D.lives;
step(2);
const frags = D.ebullets.slice();
ok("撞到主角 → 掉命", D.lives < livesBefore, "命 " + livesBefore + " → " + D.lives);
ok("撞到主角 → 爆开并喷 6 颗子弹", frags.length === 6, "弹片 " + frags.length);
if (frags.length === 6) {
  const angs = frags.map(f => (Math.atan2(f.vy, f.vx) + Math.PI*2) % (Math.PI*2)).sort((a,b)=>a-b);
  let stepMin = 9;
  for (let k = 1; k < angs.length; k++) stepMin = Math.min(stepMin, angs[k] - angs[k-1]);
  const gap = (angs[0] + Math.PI*2) - angs[angs.length-1];
  stepMin = Math.min(stepMin, gap);
  ok("6 颗弹片朝四周均匀散开", stepMin > 0.8, "相邻最小夹角 " + (stepMin*180/Math.PI).toFixed(0) + "°");
}

// ================= 瞭望台狙击兵 + 5 秒增援 =================
console.log("\n【15】瞭望台狙击兵 / 阵亡 5 秒后增援接班");
D.startGame(); D.state = "play"; step(2);
D.setCam(D.LEVEL_W - D.W);
const b3 = D.boss; b3.active = true;
const sn = b3.sniper;
ok("要塞上方驻守一名狙击兵", !!sn && sn.st === "idle", "st=" + (sn && sn.st) + " y=" + (sn && sn.y));
const sbox = D.sniperBox();
ok("狙击兵有可命中的碰撞盒", sbox && sbox.w === 22 && Math.abs(sbox.y + 40 - 150) < 1,
   sbox ? "box y=" + sbox.y + " h=" + sbox.h : "无");
pp3 = D.p; pp3.x = 15000; pp3.y = D.groundYAt(15011) - pp3.h; pp3.onGround = true; pp3.inv = 999;
sn.cd = 1; D.ebullets.length = 0;
let warned = false, seenEb = 0;
for (let i = 0; i < 90; i++) { step(1); D.p.inv = 999; if (sn.warn > 0) warned = true; seenEb = Math.max(seenEb, D.ebullets.length); }
ok("开枪前有激光预警", warned, "warn 出现过=" + warned);
ok("狙击兵会开枪", seenEb > 0, "场上敌弹峰值 " + seenEb);
D.damageSniper(3);
ok("狙击兵可被打死", sn.st === "down" && sn.respawnT > 0, "st=" + sn.st + " 倒计时 " + sn.respawnT + " 帧");
const homeX = sn.homeX;
for (let i = 0; i < 295; i++) { step(1); D.p.inv = 999; }
ok("5 秒内不会立刻补人", sn.st === "down", "第 295 帧 st=" + sn.st);
for (let i = 0; i < 8; i++) { step(1); D.p.inv = 999; }
ok("5 秒后增援从台面右侧走入", sn.st === "walkin" && sn.x > homeX + 20, "st=" + sn.st + " x=" + sn.x.toFixed(0) + " 岗位=" + homeX);
let arrived = false;
for (let i = 0; i < 220; i++) { step(1); D.p.inv = 999; if (sn.st === "idle") { arrived = true; break; } }
ok("增援走到岗位接班（满血 + 重新开火）", arrived && Math.abs(sn.x - homeX) < 1 && sn.hp === 3,
   "st=" + sn.st + " x=" + sn.x.toFixed(0) + " hp=" + sn.hp);


// ================= 炸弹 / 激光 打碎木箱 + 炸弹锁定 Boss =================
console.log("\n【16】炸弹与激光能打碎木箱 / 炸弹能锁定 Boss");
D.startGame(); D.state = "play"; step(2);
tp(900); clearKeys(); step(3); D.p.inv = 999;
// —— 炸弹爆炸震碎木箱 ——
let cr = D.crates.find(c => !c.dead);
cr.hp = 4; D.bullets.length = 0;
D.bullets.push({bomb:true, x:cr.x, y:cr.y+4, w:14, h:14, tref:null, T:90,
                vx:0, vy:0, life:2});
let crDead = false;
for (let i=0;i<12;i++){ step(1); if (cr.dead) { crDead = true; break; } }
ok("炸弹爆炸能炸碎木箱", crDead && cr.dead, "hp=" + cr.hp + " dead=" + cr.dead);
// —— 镭射贯穿木箱 ——
cr = D.crates.find(c => !c.dead);
cr.hp = 3;
const pb = D.p;
pb.x = cr.x - 90; pb.y = D.groundYAt(pb.x+11) - pb.h; pb.onGround = true; pb.face = 1;
D.setCam(Math.max(0, pb.x - 300));
D.bullets.length = 0;
D.bullets.push({beam:true, x:pb.x+20, y:cr.y+20, dx:1, dy:0, life:8, hit:new Set(), bw:7, bd:3});
let crDead2 = false;
for (let i=0;i<6;i++){ step(1); if (cr.dead) { crDead2 = true; break; } }
ok("激光能烧穿木箱", crDead2, "hp=" + cr.hp + " dead=" + cr.dead);

// —— 炸弹自动锁定 Boss（炮舱 / 核心）——
D.nextLevel(); D.state = "play"; step(2);
const bb2 = D.boss; bb2.active = true; bb2.dead = false;
const ppb = D.p; ppb.x = bb2.core.x - 420; ppb.y = D.groundYAt(ppb.x+11) - ppb.h;
ppb.onGround = true; ppb.inv = 999; ppb.face = 1; ppb.dead = false;
ppb.weapon = "B"; ppb.wlv = {S:0,M:2,L:0,B:0}; ppb.fireCd = 0;
D.setCam(bb2.core.x - 900);
D.bullets.length = 0;
key("Digit1"); step(2); key("Digit1", false);
const bombs = D.bullets.filter(b => b.bomb);
ok("炸弹会锁定 Boss（炮舱/核心）", bombs.length > 0 && bombs.some(b => !!b.tref),
   "投出 " + bombs.length + " 颗，带锁定 " + bombs.filter(b=>b.tref).length);

// ================= 第二关 Boss 弹幕密度 =================
console.log("\n【17】第二关 Boss 弹幕变少");
D.nextLevel(); D.state = "play"; step(2);
const bd = D.boss; bd.active = true; bd.dead = false; bd.t = 0;
for (const c of bd.cannons){ c.dead = false; c.hp = c.maxHp; c.t = 0; }
bd.core.dead = false; bd.core.hp = bd.core.maxHp;
bd.specials = []; bd.spT = 0;
const pdn = D.p; pdn.x = bd.core.x - 300; pdn.y = D.groundYAt(pdn.x+11) - pdn.h;
pdn.onGround = true; pdn.inv = 999; pdn.dead = false;
D.setCam(bd.core.x - 900);
D.ebullets.length = 0; D.enemies.length = 0;
let peak = 0;
for (let i=0;i<420;i++){ step(1); D.enemies.length = 0; peak = Math.max(peak, D.ebullets.length); }
ok("第二关 Boss 弹幕峰值明显下降（≤40 颗）", peak <= 40, "420 帧内敌弹峰值 " + peak);

// ================= 红液 + 第三关 =================
console.log("\n【18】反应堆渗红液 → 第三关崩塌逃命");
D.nextLevel(); D.state = "play"; step(2);
D.boss.active = true;
D.startAftermath();
ok("Boss 倒下后进入「不对劲」过场", D.state === "aftermath", "state=" + D.state);
step(70);
ok("过场前期没有液体（先疑惑）", D.redPools.length === 0, "液池 " + D.redPools.length);
step(30);
ok("红液开始从反应堆渗出", D.redPools.length === 1 && D.redPools[0].w > 20,
   D.redPools.length ? "液面宽 " + D.redPools[0].w.toFixed(0) + "px" : "无");
let autoTo3 = false;
for (let i=0;i<520;i++){ step(1); if (D.LEVEL_IDX === 3 && D.state === "play") { autoTo3 = true; break; } }
ok("红液逼近后自动进入第三关", autoTo3 && D.finalRun === true,
   "关卡 " + D.LEVEL_IDX + " state=" + D.state + " finalRun=" + D.finalRun);

// 红液接触即死
step(120);
const pool0 = D.redPools[0];
const p3 = D.p;
p3.x = pool0.x + 20; p3.y = pool0.y - p3.h + 2; p3.onGround = true; p3.inv = 0; p3.dead = false;
const livesA = D.lives;
step(2);
ok("碰到红液立刻死掉（掉一条命）", D.lives < livesA, "命 " + livesA + " → " + D.lives);

// 工厂碎片砸断栈桥
step(30);
D.debris.length = 0;
const pl0 = D.platforms.find(pl => !pl.dead);
const pHP = D.p;
pHP.x = pl0.x + 40; pHP.y = 200; pHP.onGround = false; pHP.inv = 999;
D.debris.push({x: pl0.x + pl0.w/2, y: pl0.y - 30, w: 30, h: 22, vy: 4, vx: 0,
               rot: 0, spin: 0, tgt: pl0, dead:false, t:0});
let cracked = false;
for (let i=0;i<10;i++){ step(1); if (pl0.crackT > 0) { cracked = true; break; } }
ok("碎片砸中栈桥 → 桥面出现裂缝", cracked && pl0.crackT > 0,
   "crackT=" + pl0.crackT + "（约 " + (pl0.crackT/60).toFixed(1) + " 秒后断裂）");
ok("给出约 2 秒逃生时间", pl0.crackT >= 100 && pl0.crackT <= 120, "crackT=" + pl0.crackT);
let brokeAt = -1;
for (let i=0;i<160;i++){ step(1); pHP.inv = 999; if (pl0.dead) { brokeAt = i+1; break; } }
ok("倒计时结束栈桥断掉", pl0.dead === true, "第 " + brokeAt + " 帧断裂");

// 冲到出口 → 逃出演出 → 通关画面
const coreX = D.boss.core.x;
const pEnd = D.p;
pEnd.x = coreX - 60; pEnd.y = D.groundYAt(pEnd.x+11) - pEnd.h; pEnd.onGround = true; pEnd.inv = 999;
step(3);
ok("到达破口触发逃出演出", D.state === "escape", "state=" + D.state);
step(300);
ok("工厂倒塌后通关", D.state === "win" && D.LEVEL_IDX === 3, "state=" + D.state + " 关卡 " + D.LEVEL_IDX);

// ================= 渲染不报错 =================
console.log("\n【6】渲染");
let renderErr = null;
try {
  for (const st of ["title", "insert", "play", "walkin", "over", "win"]) {
    D.state = st;
    D.p.crouch = false; D.p.slideT = 0; D.p.aimAng = 0; D.render();
    D.p.slideT = 20; D.p.aimAng = 0; D.render();
    D.p.slideT = 0; D.p.crouch = true; D.render();
    D.p.crouch = false;
    D.p.aimAng = -0.61; D.render(); D.p.aimAng = -Math.PI / 2; D.render();
    D.p.aimAng = Math.PI / 2; D.render(); D.p.aimAng = 0;
  }
} catch (e) { renderErr = e; }
ok("所有状态/姿态渲染通过", !renderErr, renderErr ? renderErr.message : "");

console.log("\n===== 汇总 =====");
const fail = results.filter(r => r[0] === "FAIL");
console.log(`通过 ${results.length - fail.length}/${results.length}`);
if (fail.length) { console.log("失败项："); fail.forEach(f => console.log(" - " + f[1] + " " + f[2])); process.exit(1); }
