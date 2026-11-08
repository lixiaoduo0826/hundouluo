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
  get liquid(){return liquid}, get fleeSquad(){return fleeSquad}, get holes(){return holes},
  get runExitX(){return runExitX}, get runStartX(){return runStartX},
  respawnInRun, hurtPlayer,
  startAlienLair, spawnMini, shootBulletOnly,
  safeSpawnPoint, get HUNTER_CFG(){return HUNTER_CFG},
  get mini(){return mini}, get miniSpawned(){return miniSpawned},
  get MINI_ARENA_L(){return MINI_ARENA_L}, get MINI_ARENA_R(){return MINI_ARENA_R},
  get L4_W(){return L4_W},
  advanceTo, startStageBreak,
  get miniArena(){return miniArena},
  get STAGE_BREAK(){return STAGE_BREAK}, get STAGE_INFO(){return STAGE_INFO},
  stageLabel:(n)=>stageLabel(n), themePal:(n)=>themePal(n),
  get L5_W(){return L5_W}, get L6_W(){return L6_W}, get L7_W(){return L7_W}, get L8_W(){return L8_W},
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
t2.alerted = true; t2.st = "charge"; t2.stT = 4;   // 已锁定主角（未锁定时只巡场，不冲锋/不倒退）
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

// 坦克炮不能向上打（已锁定目标后才开火）
D.ebullets.length = 0; D.enemies.length = 0;
const t4 = D.mkTank(2400); D.enemies.push(t4);
pp.x = t4.x - 200; pp.y = t4.y - 260; pp.vy = 0; pp.inv = 999; pp.onGround = false;
t4.cd = 1; t4.alerted = true;
step(3);
const shotsNow = D.ebullets.slice();
let steep = shotsNow.filter(s => Math.abs(s.vy) > 0.01);
ok("主炮只做水平前射（打不到高空）", t4.gunA > -0.05 && steep.length === 0,
   "gunA=" + t4.gunA.toFixed(2) + " 有俯仰的弹=" + steep.length);

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
const tk = D.mkTank(1200); tk.cd = 2; D.enemies.push(tk);
q = D.p; q.x = 240; q.y = D.groundYAt(251) - q.h; q.vy = 0; q.onGround = true; q.inv = 999;
D.setCam(0);
let farShots = 0, prevEb = 0;
for (let i = 0; i < 150; i++) {
  step(1);
  if (D.ebullets.length > prevEb) farShots += D.ebullets.length - prevEb;
  prevEb = D.ebullets.length;
}
ok("坦克在视野外不开火（不会一开局就射）", farShots === 0 && !tk.alerted,
   "远处炮弹=" + farShots + " alerted=" + tk.alerted + " dist=" + Math.abs((q.x+q.w/2)-(tk.x+tk.w/2)).toFixed(0));

// 靠近后：先「察觉」再开火，炮弹从炮口水平向前
D.ebullets.length = 0;
q.x = 1010; q.y = D.groundYAt(1021) - q.h; q.vy = 0; q.onGround = true; q.inv = 999;
D.setCam(800);
let tkShots = 0, tkWarn = false, firstShell = null, alertFrame = -1;
for (let i = 0; i < 150; i++) {
  step(1);
  if (tk.alerted && alertFrame < 0) alertFrame = i;
  if (D.ebullets.length > prevEb) {
    const fresh = D.ebullets.slice(-(D.ebullets.length - prevEb));
    const shells = fresh.filter(b => b.shell);
    tkShots += shells.length;
    if (!firstShell && shells.length) firstShell = shells[0];
  }
  prevEb = D.ebullets.length;
  if (tk.aim > 0 || tk.recoil > 0) tkWarn = true;
}
ok("坦克发现主角后才开炮", tkShots >= 1 && alertFrame > 20, "察觉帧=" + alertFrame + " 150 帧内 " + tkShots + " 发");
ok("坦克开火前有瞄准线预警", tkWarn, "aim 线出现过 = " + tkWarn);
ok("炮弹从炮口水平向前飞（vy=0）", !!firstShell && Math.abs(firstShell.vy) < 0.01 && Math.abs(firstShell.vx) > 5,
   firstShell ? "vx=" + firstShell.vx.toFixed(2) + " vy=" + firstShell.vy.toFixed(2) : "没打出炮弹");

// ================= 摄像头：单发 + 数量 =================
console.log("\n【12】摄像头削弱为单发 / 数量增多");
const camCount = D.triggers.filter(t => t.type === "cam").length;
ok("摄像头数量 ≥ 20", camCount >= 20, "摄像头 " + camCount + " 台");
// 开局段（前 1500px）只允许一台摄像头，且不能有两台贴在一起
const earlyCams = D.triggers.filter(t => t.type === "cam" && t.px < 1500);
ok("开局只有一台摄像头", earlyCams.length === 1,
   "前 1500px 摄像头=" + earlyCams.map(t=>t.px).join(",") + " px");
const camPx = D.triggers.filter(t => t.type === "cam").map(t => t.px).sort((a,b)=>a-b);
let minGap = 1e9;
for (let i = 1; i < camPx.length; i++) minGap = Math.min(minGap, camPx[i] - camPx[i-1]);
ok("摄像头不会并排堵路（间距 ≥ 120px）", minGap >= 120, "最小间距=" + minGap + "px");
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

// 红液接触即死（过场结束时就已切到第三关，这里检查过场里的液面蔓延）
// ===== 第三关：反向逃生 =====
console.log("\n【18b】第三关：掉头往出口跑，红液在后面追");
clearKeys(); step(2);
const p3 = D.p, L3 = D.liquid;
ok("第三关在反应堆旁起跑", p3.x > D.runStartX - 60 && p3.x < D.runStartX + 60,
   "x=" + p3.x.toFixed(0) + " 开始位=" + D.runStartX);
ok("红液浪头就在身后", L3 && L3.x > p3.x, "液面 x=" + (L3 ? L3.x.toFixed(0) : "无") + " 主角 x=" + p3.x.toFixed(0));
ok("出口在左前方很远处", D.runExitX < p3.x - 2000, "出口 x=" + D.runExitX + " 距离 " + (p3.x - D.runExitX).toFixed(0) + "px");
ok("有一群士兵一起逃命", D.fleeSquad.length >= 8, "同跑士兵 " + D.fleeSquad.length + " 人");
const fx0 = D.fleeSquad.map(s => s.x).reduce((a,b)=>a+b,0) / D.fleeSquad.length;
const lvRun = D.lives;
key("ArrowLeft");
step(150);
ok("主角往左跑（向后撤离）", D.p.vx < -1 || D.p.x < p3.x - 100, "x " + p3.x.toFixed(0) + " → " + D.p.x.toFixed(0));
const fx1 = D.fleeSquad.filter(s=>!s.dead).map(s => s.x);
ok("士兵也跟着往左跑", fx1.length && (fx1.reduce((a,b)=>a+b,0)/fx1.length) < fx0 - 120,
   "平均 x " + fx0.toFixed(0) + " → " + (fx1.length ? (fx1.reduce((a,b)=>a+b,0)/fx1.length).toFixed(0) : "-"));
ok("跑动中没被液面追上（还活着）", D.lives === lvRun && D.state === "play",
   "命 " + lvRun + " → " + D.lives + " state=" + D.state);

// 站着不动 → 液面追上就死
clearKeys();
let caught = false, caughtAt = 0;
for (let i = 0; i < 700; i++) { step(1); if (D.lives < lvRun) { caught = true; caughtAt = i; break; } }
ok("停住不动会被液面吞掉", caught, "第 " + caughtAt + " 帧被追上，命 " + lvRun + " → " + D.lives);
ok("被吞后重生在液面前方", D.liquid && D.p.x + D.p.w < D.liquid.x,
   "主角 x=" + D.p.x.toFixed(0) + " 液面 x=" + D.liquid.x.toFixed(0));

// 落后的小兵会被液面卷走
key("ArrowLeft"); step(6); clearKeys();
const f0 = D.fleeSquad.length;
if (D.fleeSquad.length) { D.fleeSquad[0].x = D.liquid.x + 4; D.fleeSquad[0].dead = false; }
step(4);
ok("被追上的士兵会被吞掉", D.fleeSquad.length < f0 || D.fleeSquad.some(s => s.dead),
   "士兵 " + f0 + " → " + D.fleeSquad.length);

// 碎片砸穿地板 → 裂缝预警 → 塌出洞
D.debris.length = 0; D.holes.length = 0;
const pHP = D.p;
pHP.x = 7000; pHP.y = D.groundYAt(7011) - pHP.h; pHP.onGround = true; pHP.inv = 999;
D.setCam(6600);
const gyH = D.groundYAt(6800);
D.debris.push({x: 6800, y: gyH - 46, w: 30, h: 22, vy: 6, vx: 0, rot: 0, spin: 0, tgt: null, dead:false, t:0});
let holed = false;
for (let i=0;i<8;i++){ step(1); if (D.holes.length) { holed = true; break; } }
ok("碎片砸地 → 地板出现裂缝（先预警）", holed && D.holes[0].crackT > 0,
   D.holes.length ? "crackT=" + D.holes[0].crackT + "（约 " + (D.holes[0].crackT/60).toFixed(1) + " 秒）" : "没砸出裂缝");
ok("裂缝阶段地板还没塌（能踩）", D.groundYAt(6800) < Infinity, "地面 y=" + D.groundYAt(6800).toFixed(0));
let holeAt = -1;
for (let i=0;i<140;i++){ step(1); pHP.inv = 999; if (D.groundYAt(6800) === Infinity) { holeAt = i+1; break; } }
ok("倒计时结束后地板塌成洞", holeAt > 0, "第 " + holeAt + " 帧塌陷");

// 冲到左端逃生门 → 逃出演出 → 通关
clearKeys();
const pe = D.p;
pe.x = D.runExitX + 40; pe.y = D.groundYAt(pe.x+11) - pe.h; pe.vy = 0; pe.onGround = true; pe.inv = 999;
key("ArrowLeft");
step(20);
ok("冲进逃生门触发逃出演出", D.state === "escape", "state=" + D.state);
step(320);
ok("工厂塌陷后进入第四关过场", D.state === "reveal", "state=" + D.state);
step(340);
ok("过场结束后进入第四关 · 外星巢穴", D.LEVEL_IDX === 4 && D.state === "play",
   "关卡 " + D.LEVEL_IDX + " state=" + D.state);

// ================= 关卡切换：第三关残留必须被清干净 =================
console.log("\n【5e】阵亡重开清场");
clearKeys();
D.startGame();
step(2);
const baseGround = [];
for (let x = 0; x < D.LEVEL_W; x += 25) baseGround.push(D.groundYAt(x));
// 进第三关，跑一会儿，再补一个"已塌陷"的坑（真实情况由碎片砸地产生）
D.startFinalRun();
step(30);
D.holes.push({ x: 3000, w: 70, y: D.groundYAt(3005), crackT: 0 });
const beforeHole = D.holes.length, beforeFlee = D.fleeSquad.length;
ok("第三关里确实有液面/逃命士兵/坑洞", beforeHole > 0 && beforeFlee > 0 && !!D.liquid,
   "坑 " + beforeHole + " 士兵 " + beforeFlee + " 液面 " + (D.liquid ? "有" : "无"));
// 把命耗光 → over（模拟第三关阵亡）
D.lives = 0; D.p.inv = 0; D.p.dead = false;
D.hurtPlayer(true);
ok("阵亡后进入游戏结束", D.state === "over", "state=" + D.state);
// 重开：从第一关开始
D.startGame();
step(2);
ok("重开后液面被清空", D.liquid === null, "liquid=" + D.liquid);
ok("重开后逃命士兵被清空", D.fleeSquad.length === 0, "剩下 " + D.fleeSquad.length + " 人");
ok("重开后坑洞被清空", D.holes.length === 0, "剩下 " + D.holes.length + " 个");
ok("重开后碎片/红液洼地/逃生段标记被清空",
   D.debris.length === 0 && D.redPools.length === 0 && D.finalRun === false,
   "debris=" + D.debris.length + " redPools=" + D.redPools.length + " finalRun=" + D.finalRun);
let diffN = 0, firstDiff = -1;
for (let i = 0; i < baseGround.length; i++) {
  const x = i * 25;
  if (D.groundYAt(x) !== baseGround[i]) { diffN++; if (firstDiff < 0) firstDiff = x; }
}
ok("重开后第一关地形与初始完全一致（没有隐形空洞）", diffN === 0,
   diffN ? diffN + " 处不一致，首个 x=" + firstDiff : "全部一致 " + baseGround.length + " 个采样点");

// ================= 跨关装备保留 + 抬枪松手即复位 =================
console.log("\n【5f】跨关装备 / 抬枪复位");
clearKeys();
D.startGame(); step(2);
D.state = "play";
D.p.weapon = "M"; D.p.wlv.M = 2; D.p.wlv.B = 1;
D.nextLevel(); step(2);
ok("第一关的枪带进第二关（枪型+等级）", D.p.weapon === "M" && D.p.wlv.M === 2 && D.p.wlv.B === 1,
   "第二关开局 " + D.p.weapon + " Lv" + (D.p.wlv.M + 1));
D.startFinalRun(); step(2);
ok("第二关的枪带进第三关", D.p.weapon === "M" && D.p.wlv.M === 2,
   "第三关开局 " + D.p.weapon + " Lv" + (D.p.wlv.M + 1));
D.startGame(); step(2); D.state = "play";
ok("重开一局回到空手（新游戏不继承）", D.p.weapon === "N" && D.p.wlv.M === 0,
   "重开 " + D.p.weapon + " Lv" + D.p.wlv.M);

clearKeys();
step(2);
key("ArrowUp"); step(2);
const aimUp = D.p.aimAng;
key("ArrowUp", false); step(1);
const aimAfterRelease = D.p.aimAng;
ok("按住 ↑ 抬枪朝正上方", Math.abs(aimUp + Math.PI / 2) < 0.01, "aimAng=" + aimUp.toFixed(3));
ok("松开 ↑ 的当帧就恢复平射（无延迟残留）", aimAfterRelease === 0, "aimAng=" + aimAfterRelease);
key("ArrowUp"); step(2); key("ArrowUp", false); step(8);
ok("松手 8 帧后仍是平射（不会被旧的余量拉住）", D.p.aimAng === 0, "aimAng=" + D.p.aimAng);

{
// ================= 第四关：外星巢穴 =================
console.log("\n【7】第四关 · 外星巢穴");
clearKeys();
D.startAlienLair();
step(3);
ok("过场后进入第四关", D.LEVEL_IDX === 4 && D.state === "play", "关卡 " + D.LEVEL_IDX + " state=" + D.state);
let voidN = 0, voidAt = -1;
for (let x = 0; x < D.L4_W; x += 40) {
  if (D.groundYAt(x) === Infinity) { voidN++; if (voidAt < 0) voidAt = x; }
}
ok("第四关地面连续（没有断崖/空洞）", voidN === 0, voidN ? voidN + " 处悬空，首个 x=" + voidAt : "全长 " + D.L4_W + "px 连续");
ok("第四关路上有外星守军", D.triggers.some(t => ["claw","spit","eye"].includes(t.type)),
   "外星兵触发点 " + D.triggers.filter(t => ["claw","spit","eye"].includes(t.type)).length + " 个");

// ---- 小 Boss：孵化厅守卫 ----
D.p.x = D.MINI_ARENA_L + 80;
D.p.y = D.groundYAt(D.p.x + 11) - D.p.h; D.p.onGround = true; D.p.vy = 0; D.p.inv = 99999;
step(3);
ok("走进孵化厅触发小 Boss", !!D.mini && D.mini.kind === "mini", D.mini ? "hp=" + D.mini.hp : "没刷出来");
D.p.x = D.MINI_ARENA_L - 400; step(2);
ok("小 Boss 不再锁场（主角可以自由后退离开孵化厅）", D.p.x < D.MINI_ARENA_L - 300,
   "p.x=" + D.p.x.toFixed(0) + " 左边界=" + D.MINI_ARENA_L);
const stSeen = new Set();
let alienSpawned = false;
for (let i = 0; i < 600; i++) {
  step(1); D.p.inv = 99999;
  if (D.mini && !D.mini.dead) stSeen.add(D.mini.st);
  if (D.enemies.some(e => e.kind === "alien")) alienSpawned = true;
}
const atk = ["wind","charge","spit","summon"].filter(x => stSeen.has(x));
ok("小 Boss 会蓄力冲撞 / 吐酸 / 召唤", atk.length >= 2, "出现过：" + atk.join("、"));
ok("小 Boss 会召唤爪兵助战", alienSpawned, "场上有外星兵 = " + alienSpawned);

// 小 Boss 的血量与体型
ok("小 Boss 是独立血条的大块头", D.mini.maxHp >= 60 && D.mini.w >= 90,
   "hp=" + D.mini.maxHp + " 尺寸 " + D.mini.w + "x" + D.mini.h);
const miniLife0 = D.lives;
D.mini.hp = 0; D.mini.dead = true;
step(4);
ok("击败小 Boss 有奖励（加命 + 掉落）", D.lives > miniLife0 || D.mini.rewarded,
   "命 " + miniLife0 + " → " + D.lives);
D.p.x = D.MINI_ARENA_R + 260;
D.p.y = D.groundYAt(D.p.x + 11) - D.p.h; D.p.onGround = true;
step(3);
ok("小 Boss 死后解除封锁，可以继续前进", D.p.x > D.MINI_ARENA_R,
   "p.x=" + D.p.x.toFixed(0) + " 右边界=" + D.MINI_ARENA_R);

// ---- 最终 Boss：外星主脑 ----
D.p.x = D.boss.wallX - 160;
D.p.y = D.groundYAt(D.p.x + 11) - D.p.h; D.p.onGround = true; D.p.inv = 99999;
step(4);
ok("走到母舰核心激活外星主脑", D.boss.active && D.boss.kind === "alien", "active=" + D.boss.active);
let sawWarn = false, sawBeam = false;
for (let i = 0; i < 420; i++) {
  step(1); D.p.inv = 99999;
  for (const c of D.boss.cannons) { if (c.warnT > 0) sawWarn = true; if (c.beamT > 0) sawBeam = true; }
}
ok("眼睛先亮红色预警线，再放光束", sawWarn && sawBeam, "预警=" + sawWarn + " 光束=" + sawBeam);
ok("三只眼没打完时核心带护盾", D.boss.core.shielded === true, "shielded=" + D.boss.core.shielded);
for (const c of D.boss.cannons) { c.hp = 0; c.dead = true; }
step(2);
ok("打掉三只眼后核心破盾", D.boss.core.shielded === false, "shielded=" + D.boss.core.shielded);
let sawTentacle = false;
for (let i = 0; i < 320; i++) { step(1); D.p.inv = 99999; if (D.boss.tentacles.length) sawTentacle = true; }
ok("破盾后会有地面触须攻击（带预警圈）", sawTentacle, "触须出现过 = " + sawTentacle);
D.boss.core.hp = 0; D.boss.core.dead = true;
D.killCore();
ok("击穿主脑核心 → 母舰崩解", D.boss.dead === true, "boss.dead=" + D.boss.dead);

// ================= 碎片击碎 / 炸弹双发 =================
console.log("\n【8】碎片可击碎 + 炸弹武器同时开枪");
D.startGame(); D.state = "play"; step(2);
const pwb = D.p;
pwb.weapon = "B"; pwb.wlv.B = 0; pwb.fireCd = 0; pwb.bulletCd = 0;
D.bullets.length = 0; D.debris.length = 0;
D.crates.length = 0; D.enemies.length = 0;          // 清掉挡在弹道上的木箱/敌人
D.debris.push({x: pwb.x + 70, y: pwb.y + 2, w: 30, h: 20, vy: 0, vx: 0,
               rot: 0, spin: 0, tgt: null, dead: false, t: 0, hp: 1, maxHp: 1, flash: 0});
D.bullets.push({x: pwb.x + 40, y: pwb.y + 10, w: 6, h: 6, vx: 9, vy: 0, life: 70, dmg: 1});
step(4);
ok("子弹能打掉头顶掉落的碎片", D.debris.length === 0, "剩 " + D.debris.length + " 块");

D.bullets.length = 0;
pwb.fireCd = 0; pwb.bulletCd = 0; pwb.face = 1;
key("Digit1"); step(1); key("Digit1", false);
const bombs = D.bullets.filter(b => b.bomb).length;
const shots = D.bullets.filter(b => !b.bomb).length;
ok("炸弹武器投弹的同时枪口也在射击", bombs >= 1 && shots >= 1,
   "炸弹 " + bombs + " 颗 / 子弹 " + shots + " 发");
ok("炸弹武器的子弹有自己的冷却（不会和投弹抢节奏）", pwb.bulletCd > 0 && pwb.fireCd > 0,
   "bulletCd=" + pwb.bulletCd + " fireCd=" + pwb.fireCd);

}
// ================= 第五~八关：全球母舰 =================
console.log("\n【9】第五~八关 · 全球母舰");
{
  const WID = {5: D.L5_W, 6: D.L6_W, 7: D.L7_W, 8: D.L8_W};
  for (const n of [5, 6, 7, 8]) {
    D.p.weapon = "L"; D.p.wlv.L = 2;
    D.advanceTo(n);
    step(2);
    ok(`第 ${n} 关 载入（${D.stageLabel(n)}）`, D.LEVEL_IDX === n && D.state === "play",
       "关卡 " + D.LEVEL_IDX + " state=" + D.state);
    let voids = 0, firstVoid = -1;
    for (let x = 0; x < WID[n]; x += 40) {
      if (D.groundYAt(x) === Infinity) { voids++; if (firstVoid < 0) firstVoid = x; }
    }
    ok(`第 ${n} 关 地面全程连续（无断崖）`, voids === 0,
       voids ? voids + " 处悬空，首个 x=" + firstVoid : "全长 " + WID[n] + "px");
    const aliens = D.triggers.filter(t => ["claw", "spit", "eye"].includes(t.type)).length;
    ok(`第 ${n} 关 沿途有外星守军`, aliens >= 8, "外星兵触发点 " + aliens + " 个");
    ok(`第 ${n} 关 武器跨关保留`, D.p.weapon === "L" && D.p.wlv.L === 2,
       D.p.weapon + " Lv" + (D.p.wlv.L + 1));
    const expectKind = n === 8 ? "carrier" : (n === 6 ? "hunterAir" : "hunter");
    const expectNodes = n === 8 ? 5 : 0;
    ok(`第 ${n} 关 Boss 是「${D.boss.name}」`, D.boss.kind === expectKind && D.boss.cannons.length === expectNodes,
       D.boss.kind + " / 节点 " + D.boss.cannons.length + " / 核心 " + D.boss.core.maxHp);
  }

  // 血量与难度阶梯
  D.advanceTo(4); step(2);
  const l4 = { core: D.boss.core.maxHp, eye: D.boss.cannons[0].maxHp, mini: D.miniArena.hp };
  D.advanceTo(5); step(2);
  const l5 = { core: D.boss.core.maxHp, mini: D.miniArena.hp };
  D.advanceTo(8); step(2);
  const l8 = { core: D.boss.core.maxHp, node: D.boss.cannons[0].maxHp, mini: D.miniArena.hp };
  ok("第四关 Boss 大幅强化（核心 70→150 / 眼睛 14→26）", l4.core >= 150 && l4.eye >= 26,
     "核心 " + l4.core + " / 眼 " + l4.eye);
  ok("第四关小 Boss 血量翻倍（90→170）", l4.mini >= 170, "hp=" + l4.mini);
  ok("Boss 血量逐关抬升（4→5→8）", l4.core < l5.core && l5.core < l8.core,
     l4.core + " → " + l5.core + " → " + l8.core);
  ok("小 Boss 血量逐关抬升", l4.mini < l5.mini && l5.mini < l8.mini,
     l4.mini + " → " + l5.mini + " → " + l8.mini);

  // 小 Boss 二阶段狂暴
  D.advanceTo(5); step(2);
  D.p.x = D.miniArena.l + 80;
  D.p.y = D.groundYAt(D.p.x + 11) - D.p.h; D.p.onGround = true; D.p.vy = 0; D.p.inv = 99999;
  step(3);
  ok("第五关 走进母舰中段触发守卫", !!D.mini && D.mini.hp === D.miniArena.hp,
     D.mini ? D.mini.name + " hp=" + D.mini.hp : "没刷出来");
  const rage0 = D.mini.rage;
  D.mini.hp = Math.ceil(D.mini.maxHp * 0.45);
  step(2);
  ok("小 Boss 半血进入狂暴（攻速/速度提升）", D.mini.rage === true && !rage0,
     "rage=" + D.mini.rage);
  D.mini.hp = 0; D.mini.dead = true;
  step(4);
  ok("击败守卫解锁通道", D.mini.rewarded === true, "rewarded=" + D.mini.rewarded);

  // 第五关：移动型 Boss —— 会走、会跳、会蹲、会抬枪点射，打完有冷却
  D.advanceTo(5); step(2);
  D.p.x = Math.max(60, D.boss.core.x - 520);
  D.p.y = D.groundYAt(D.p.x + 11) - D.p.h; D.p.onGround = true; D.p.vy = 0; D.p.inv = 99999;
  step(4);
  ok("走近后移动型 Boss 激活", D.boss.active === true, "active=" + D.boss.active);
  const bx0 = D.boss.core.x;
  let sawWarn = false, sawBurst = false, sawCd = false, sawJump = false, sawDuck = false;
  let minDist = 1e9;
  for (let i = 0; i < 1500; i++) {
    step(1); D.p.inv = 99999;
    const c = D.boss.core;
    if (c.warnT > 0) sawWarn = true;
    if (c.burst > 0) sawBurst = true;
    if (sawBurst && c.burst <= 0 && c.shootCd > 0) sawCd = true;
    if (c.vy < -3) sawJump = true;
    if (c.crouchT > 0) sawDuck = true;
    minDist = Math.min(minDist, Math.abs((D.p.x + D.p.w/2) - (c.x + c.w/2)));
  }
  ok("移动型 Boss 会主动接近主角（不再钉在墙上）",
     Math.abs(D.boss.core.x - bx0) > 30 || minDist < 420,
     "x " + bx0.toFixed(0) + " → " + D.boss.core.x.toFixed(0) + " / 最近距离 " + minDist.toFixed(0));
  ok("移动型 Boss 开火有前摇（红色预警线）", sawWarn, "warnT 出现过=" + sawWarn);
  ok("移动型 Boss 点射后进入冷却（玩家有喘息）", sawBurst && sawCd,
     "点射=" + sawBurst + " 冷却=" + sawCd);
  ok("移动型 Boss 会跳跃", sawJump, "vy<-3 出现过=" + sawJump);
  ok("移动型 Boss 会蹲下（躲平射）", sawDuck, "crouch 出现过=" + sawDuck);
  D.boss.core.hp = 0; D.boss.core.dead = true;
  D.killCore();
  ok("击穿移动型 Boss", D.boss.dead === true, "boss.dead=" + D.boss.dead);

  // 关卡过场：字幕 → 下一关
  D.startStageBreak(6);
  step(2);
  ok("击穿后进入关卡过场（剧情字幕）", D.state === "stagebreak" && !D.boss,
     "state=" + D.state);
  step(340);
  ok("过场结束自动进入下一艘母舰", D.LEVEL_IDX === 6 && D.state === "play",
     "关卡 " + D.LEVEL_IDX + " state=" + D.state);

  // 第八关通关 → 结局
  D.advanceTo(8); step(2);
  ok("最终关是轨道母巢", D.LEVEL_IDX === 8 && D.boss.kind === "carrier" && D.boss.tint === "space",
     D.boss.name);
  D.boss.active = true;
  D.boss.core.hp = 0; D.boss.core.dead = true;
  D.killCore();
  ok("击穿母巢核心 → 全剧终判定", D.boss.dead === true, "boss.dead=" + D.boss.dead);
  const tints = [5, 6, 7, 8].map(n => D.themePal(n).accent);
  ok("五~八关各有独立配色主题", new Set(tints).size === 4, tints.join(" "));
}

// ================= 小 Boss 跟随 / 不锁场 / 重生点 / 连铲 =================
console.log("\n【10】小 Boss 不锁场 · 全图跟随 · 重生点修复 · 连续滑铲");
{
  D.advanceTo(5); step(2);
  D.p.x = D.miniArena.l + 90;
  D.p.y = D.groundYAt(D.p.x + 11) - D.p.h; D.p.onGround = true; D.p.vy = 0; D.p.inv = 99999;
  step(3);
  ok("第五关 中段小 Boss 刷出", !!D.mini && !D.mini.dead, D.mini ? D.mini.name : "没刷出来");

  // 主角一路冲过原来的场地右界
  const arenaR = D.miniArena.r;
  D.p.x = arenaR + 800;
  D.p.y = D.groundYAt(D.p.x + 11) - D.p.h; D.p.onGround = true; D.p.vy = 0; D.p.inv = 99999;
  step(2);
  ok("小 Boss 不再把主角夹在场地里", D.p.x > arenaR + 700,
     "p.x=" + D.p.x.toFixed(0) + " / 场地右界 " + arenaR);
  const gap0 = Math.abs(D.mini.x - D.p.x);
  for (let i = 0; i < 420; i++) { step(1); D.p.inv = 99999; }
  const gap1 = Math.abs(D.mini.x - D.p.x);
  ok("小 Boss 会一路追到主角身边", gap1 < 300,
     "距离 " + gap0.toFixed(0) + " → " + gap1.toFixed(0));

  // 掉出世界也不会永久消失
  D.mini.y = D.H + 200;
  step(4); D.p.inv = 99999;
  ok("小 Boss 掉出世界会自动爬回来", D.mini.y < D.H, "y=" + D.mini.y.toFixed(0));

  // 重生点：检查点压在断崖上也能落到实地
  D.advanceTo(1); step(2);
  let voidX = -1;
  for (let x = 200; x < D.LEVEL_W - 200; x += 10) {
    if (D.groundYAt(x) === Infinity) { voidX = x; break; }
  }
  ok("第一关存在断崖（测试前提）", voidX > 0, "首个断崖 x=" + voidX);
  const sp = D.safeSpawnPoint(voidX);
  ok("重生点自动避开断崖（不再卡进地底连死）",
     isFinite(sp.y) && D.groundYAt(sp.x + 11) < Infinity,
     "x=" + sp.x.toFixed(0) + " y=" + sp.y.toFixed(0));

  // 连续滑铲
  D.startGame(); D.state = "play"; step(2);
  D.enemies.length = 0;
  D.p.x = 400; D.p.y = D.groundYAt(411) - D.p.h; D.p.onGround = true; D.p.vy = 0; D.p.inv = 99999;
  clearKeys(); step(2);
  key("ArrowDown"); step(2); key("ArrowRight");
  const sl0 = D.p.x;
  step(20);
  const sl1 = D.p.x;
  step(110);
  const sl2 = D.p.x;
  ok("按住 ↓+→ 会自己开启滑铲", sl1 - sl0 > 30, "20 帧位移 " + (sl1 - sl0).toFixed(0));
  ok("按住不放能一直连铲（不用反复点按）", sl2 - sl1 > 200,
     "之后 110 帧位移 " + (sl2 - sl1).toFixed(0));
  clearKeys(); step(24);
  ok("松开方向键后恢复站立", D.p.slideT === 0 && !D.p.crouch,
     "slideT=" + D.p.slideT + " crouch=" + D.p.crouch);
}

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
