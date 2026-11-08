const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");

const inject = `
<script>
window.onerror = function(m, s, l, c, e){ document.title = "JSERR: " + m + " @" + l + ":" + c; };
window.addEventListener("load", () => {
  const q = new URLSearchParams(location.search);
  const mode = q.get("m") || "stand";
  setTimeout(() => {
    startGame();
    state = "play"; stateTimer = 0; bannerT = 0;
    enemies.length = 0; ebullets.length = 0; bullets.length = 0; particles.length = 0;
    const place = (px) => { player.x = px; player.y = groundYAt(px + 11) - player.h; };
    const p = player;
    p.inv = 0; p.wlv = {S:2,M:2,L:2,B:2};
    if (mode === "l2" || mode === "l2b") {
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0;
      if (mode === "l2") {
        place(2380); cam = 2050;
        const t = makeTank(2500); enemies.push(t);
        const s = makeSoldier(2760, groundYAt(2760)-40, "runner"); enemies.push(s);
        p.face = 1; p.aimAng = 0;
      } else {
        place(2500); cam = 2200;
        const t = makeTank(2380); enemies.push(t);
        p.y = t.y - p.h; p.onGround = true;
        p.face = 1; p.aimAng = -0.61; p.aimLatch = 75; p.diagDir = 1;
      }
    } else if (mode === "l2long") {
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0;
      place(1200); cam = 980;
      p.x = 1200; p.y = 298 - p.h; p.onGround = true; p.platY = 298;
      p.face = 1; p.aimAng = 0;
      const t1 = makeTank(1450); enemies.push(t1);
      const t2 = makeTank(1700); enemies.push(t2);
      enemies.push(makeCam(1300, 120));
      enemies.push(makeRoller(1900));
    } else if (mode === "iron") {
      place(15330); cam = LEVEL_W - W;
      p.face = 1; p.aimAng = -Math.PI/2; p.inv = 0;
      boss.active = true; boss.t = 210;
      boss.sniper.warn = 16; boss.sniper.cd = 60; boss.sniper.aim = 2.6; boss.sniper.face = -1;
      ironBalls.push({x:15420, y:groundYAt(15420)-22, r:22, vx:-4.6, vy:0, hp:5, maxHp:5, rolling:true, spin:0.9, flash:0, t:40, dead:false});
      ironBalls.push({x:15590, y:groundYAt(15590)-44, r:22, vx:-6.4, vy:-1.6, hp:5, maxHp:5, rolling:false, spin:0.2, flash:0, t:8, dead:false});
    } else if (mode === "snipdown") {
      place(15330); cam = LEVEL_W - W;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      boss.active = true; boss.t = 100;
      boss.sniper.st = "down"; boss.sniper.dead = true; boss.sniper.respawnT = 168;
    } else if (mode === "snipwalk") {
      place(15330); cam = LEVEL_W - W;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      boss.active = true; boss.t = 100;
      boss.sniper.st = "walkin"; boss.sniper.x = boss.sniper.homeX + 96;
      boss.sniper.animT = 14; boss.sniper.hp = 2; boss.sniper.warn = 0;
    } else if (mode === "bossfx") {
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      place(8860); cam = LEVEL_W - W;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      boss.active = true; boss.t = 300;
      boss.specials = [
        {type:"arc", x: 8760, dir:1, t:20, gy: groundYAt(8760)},
        {type:"laser", t:70, ang:-0.12, a0:-0.95, a1:0.44, dur:96},
        {type:"piston", x: 8620, t:60, y: 232, vy:6, hit:false}
      ];
    } else if (mode === "arcwarn") {
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      place(8760); cam = LEVEL_W - W;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      boss.active = true; boss.t = 300;
      boss.specials = [
        {type:"arc", x: 8600, dir: 1, t: 18, warn: 28, gy: groundYAt(8600)},
        {type:"laser", t: 10, ang:-0.42, a0:-0.95, a1:0.44, dur:96}
      ];
    } else if (mode === "aftermath") {
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0; ironBalls.length = 0;
      boss.active = true; boss.core.dead = true; boss.core.hp = 0;
      for (const c of boss.cannons) c.dead = true;
      place(8720); cam = LEVEL_W - W;
      p.face = 1; p.aimAng = 0;
      startAftermath();
      stateTimer = 210;
      redPools.push({x: boss.core.x - 330, y: groundYAt(boss.core.x - 330) - 10,
                     w: 300, h: 12, grow: 2.4, maxW: 620, t: 120});
    } else if (mode === "l3") {
      startFinalRun();
      state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      place(2100); cam = 1900;
      p.x = 2120; p.y = 298 - p.h; p.onGround = true; p.platY = 298; p.inv = 999;
      p.face = 1; p.aimAng = 0;
      const plA = platforms.find(o => o.w > 500);
      if (plA) plA.crackT = 78;
      debris.length = 0;
      debris.push({x: 2160, y: 140, w: 34, h: 24, vy: 5, vx:0, rot: 0.6, spin:0.1, tgt:null, dead:false, t:20});
      debris.push({x: 2300, y: 60, w: 46, h: 30, vy: 4, vx:0, rot: 1.4, spin:-0.12, tgt:null, dead:false, t:12});
      debris.push({x: 2450, y: 200, w: 26, h: 18, vy: 6, vx:0, rot: 2.2, spin:0.16, tgt:null, dead:false, t:8});
    } else if (mode === "run") {
      // 第三关逃亡现场：主角往左跑，红液在后面追，一队士兵跟着跑
      startFinalRun();
      state = "play"; stateTimer = 0; bannerT = 0;
      const p2 = player;
      p2.x = 8420; p2.y = groundYAt(8431) - p2.h; p2.onGround = true;
      p2.face = -1; p2.inv = 0; p2.animT = 14; p2.aimAng = 0;
      cam = Math.max(0, p2.x - W*0.55);
      liquid.x = p2.x + 390;
      fleeSquad.length = 0;
      for (let i=0;i<9;i++) spawnFlee(p2.x - 30 + i*52 + Math.random()*16);
      debris.length = 0;
      debris.push({x: p2.x - 250, y: 120, w: 38, h: 26, vy: 5, vx:0, rot: 0.7, spin:0.1, tgt:null, dead:false, t:20});
      debris.push({x: p2.x + 260, y: 60,  w: 46, h: 28, vy: 5, vx:0, rot: 1.9, spin:-0.1, tgt:null, dead:false, t:16});
      holes.length = 0;
      holes.push({x: p2.x - 330, w: 78, y: groundYAt(p2.x - 300), crackT: 42, seed: 3});
      holes.push({x: p2.x + 190, w: 72, y: groundYAt(p2.x + 220), crackT: 0, seed: 1});
    } else if (mode === "exit") {
      // 第三关：冲向左端逃生门
      startFinalRun();
      state = "play"; stateTimer = 0; bannerT = 0;
      const p3 = player;
      p3.x = runExitX + 210; p3.y = groundYAt(p3.x + 11) - p3.h; p3.onGround = true;
      p3.face = -1; p3.inv = 0; p3.animT = 8; p3.aimAng = 0;
      cam = Math.max(0, p3.x - W*0.55);
      liquid.x = p3.x + 700;
      fleeSquad.length = 0;
      for (let i=0;i<6;i++) spawnFlee(p3.x - 20 + i*58);
    } else if (mode === "tankshell") {
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      place(2200); cam = 2050;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      const tk = makeTank(2450); tk.cd = 12; tk.aim = 12; tk.alerted = true; tk.gunA = 0;
      enemies.push(tk);
      ebullets.push({x:2360, y:groundYAt(2360)-41, w:7, h:7, vx:-6, vy:0, life:200, shell:true, r:5.6});
      ebullets.push({x:2210, y:groundYAt(2210)-41, w:7, h:7, vx:-6, vy:0, life:200, shell:true, r:5.6});
    } else if (mode === "tankspot") {
      // 坦克「刚发现主角」：感叹号 + 观察窗闪红，还没开炮
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      place(2480); cam = 2250;
      p.face = -1; p.aimAng = 0; p.inv = 0;
      const tk = makeTank(2700); tk.spot = 22; tk.alerted = false;
      enemies.push(tk);
    } else if (mode === "restart") {
      // 复现 BUG：第三关阵亡 → 从第一关重开，画面里不该再有红液浪头 / 逃命士兵 / 坑洞
      startFinalRun();
      for (let i = 0; i < 40; i++) { player.inv = 999; update(); }
      holes.push({ x: 3000, w: 70, y: groundYAt(3005), crackT: 0 });
      lives = 0; player.inv = 0; player.dead = false;
      hurtPlayer(true);
      startGame();
      state = "play"; stateTimer = 0; bannerT = 0;
      for (let i = 0; i < 40; i++) update();
      enemies.length = 0; ebullets.length = 0; bullets.length = 0;
      player.x = 900; player.y = groundYAt(911) - player.h;
      player.inv = 0; player.face = 1; player.aimAng = 0;
      cam = 520;
    } else if (mode === "turret") {
      place(600); cam = 430;
      enemies.push(makeTurret(760, groundYAt(760)-40, false));
      enemies.push(makeTurret(880, groundYAt(880)-40, true));
      enemies.push(makeSoldier(690, groundYAt(690)-40, "sniper"));
      enemies.push(makeSoldier(820, groundYAt(820)-40, "bomber"));
      p.face = 1; p.aimAng = -0.61; p.aimLatch = 75; p.diagDir = 1;
    } else if (mode === "slide") {
      place(700); cam = 520;
      p.slideT = 22; p.slideV = 6; p.slideDir = 1; p.face = 1; p.crouch = true; p.onGround = true;
    } else if (mode === "crouch") {
      place(700); cam = 520;
      p.crouch = true; p.face = 1; p.aimAng = 0;
    } else if (mode === "jump") {
      place(700); cam = 520;
      p.y -= 90; p.onGround = false; p.vy = -2; p.face = 1; p.aimAng = Math.PI/2;
    } else if (mode === "l5" || mode === "l6" || mode === "l7" || mode === "l8") {
      const n = +mode.slice(1);
      advanceTo(n); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      const base = { 5: 1500, 6: 1600, 7: 1700, 8: 1800 }[n];
      place(base); cam = base - 260;
      player.face = 1; player.aimAng = 0; player.inv = 0;
      enemies.push(makeAlien(base + 160, groundYAt(base + 160), "claw"));
      enemies.push(makeAlien(base - 90, groundYAt(base - 90), "spit"));
      enemies.push(makeAlien(base + 300, 200, "eye"));
      player.weapon = "L"; player.wlv.L = 2;
      ebullets.push({x: base + 380, y: p.y + 8, w: 7, h: 7, vx: -6, vy: 0, life: 200, shell: true, r: 5.6});
    } else if (mode === "l5boss" || mode === "l6boss" || mode === "l7boss" || mode === "l8boss") {
      const n = +mode.slice(1, 2);
      advanceTo(n); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      boss.active = true; boss.t = 220;
      if (n === 8) {
        boss.core.hp = Math.floor(boss.core.maxHp * 0.4);
        boss.specials.push({type:"rail", t: 60, warn: 0, fire: 60, y0: 300, y1: 300, hit: false});
        for (const c of boss.cannons) { c.hp = 0; c.dead = true; }
        place(boss.wallX - 360); cam = boss.wallX - 760;
        player.face = 1; player.aimAng = 0; player.inv = 0;
      } else {
        const bc = boss.core;
        const bx = LEVEL_W - 640;
        bc.x = bx;
        bc.y = groundYAt(bx + bc.w/2) - bc.h - (boss.air ? 140 : 0);
        player.x = bx - 400; player.y = groundYAt(player.x + 11) - player.h;
        player.onGround = true; player.face = 1; player.aimAng = 0; player.inv = 99999;
        player.weapon = "L"; player.wlv.L = 2;
        cam = Math.max(0, player.x - W*0.40);
        bc.warnT = 16;
        bc.aimA = Math.atan2((player.y + player.h*0.45) - (bc.y + bc.h*0.38),
                             (player.x + player.w/2) - (bc.x + bc.w/2));
        bc.hp = Math.floor(bc.maxHp * (n === 7 ? 0.44 : 0.92));
        if (n === 7) { boss.rage = true; bc.windDash = 22; }
        ebullets.push({x: player.x + 320, y: player.y + 24, w: 9, h: 9, r: 5,
                       vx: -5, vy: 0, life: 200, alien: true});
      }
    } else if (mode === "minichase") {
      // 小 Boss 全图追击：主角已跑出原场地，小 Boss 跟在身后
      startAlienLair(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      spawnMini();
      place(6900); cam = 6900 - 300;
      mini.x = 6900 - 330; mini.y = groundYAt(mini.x + 52) - mini.h; mini.vy = 0;
      mini.face = 1; mini.st = "idle"; mini.stT = 0;
      p.face = 1; p.aimAng = 0; p.inv = 99999;
      player.weapon = "L"; player.wlv.L = 2;
    } else if (mode === "stagebreak") {
      state = "stagebreak"; stateTimer = 200; nextStageIdx = 6;
      boss = null;
    } else if (mode === "l4") {
      startAlienLair(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      place(1200); cam = 900;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      enemies.push(makeAlien(1330, groundYAt(1330), "claw"));
      enemies.push(makeAlien(1120, groundYAt(1120), "spit"));
      enemies.push(makeAlien(1450, 214, "eye"));
      powerups.push({type:"B", x:1260, y:318, w:34, h:26, taken:false, bob:0});
    } else if (mode === "l4mini") {
      startAlienLair(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      spawnMini();
      mini.st = "wind"; mini.warnT = 22;
      place(4880); cam = 4560;
      p.face = 1; p.aimAng = 0; p.inv = 0;
    } else if (mode === "l4boss") {
      startAlienLair(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      boss.active = true; boss.t = 120;
      boss.cannons[0].warnT = 18; boss.cannons[0].gunA = Math.PI - 0.12;
      boss.cannons[1].beamT = 12; boss.cannons[1].gunA = Math.PI - 0.03;
      place(boss.wallX - 430); cam = boss.wallX - 760;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      boss.tentacles.push({x: p.x + 120, t: 40, warn: 0, up: 1, hit: false});
      boss.tentacles.push({x: p.x + 320, t: 14, warn: 22, up: 0, hit: false});
    } else if (mode === "reveal") {
      state = "reveal"; stateTimer = 200;
    } else if (mode === "cover") {
      // 封面：三关标题
      state = "title";
    } else if (mode === "carry") {
      // 第一关带枪进第二关：HUD 应该直接显示手里的枪和等级
      player.weapon = "L"; player.wlv.L = 2;
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0; bullets.length = 0;
      cam = 0;
    } else if (mode === "l3banner") {
      // 第三关开场标题卡：第 3 关 · 逃出基地
      startFinalRun(); state = "play"; stateTimer = 0;
      enemies.length = 0; ebullets.length = 0; bullets.length = 0;
    } else if (mode === "up") {
      place(700); cam = 520;
      p.face = 1; p.aimAng = -Math.PI/2; p.aimLatch = 75;
    } else {
      place(700); cam = 520;
      p.face = 1; p.aimAng = -0.61; p.aimLatch = 75; p.diagDir = 1;
      enemies.push(makeSoldier(820, groundYAt(820)-40, "runner"));
      enemies.push(makeSoldier(900, groundYAt(900)-40, "sniper"));
    }
    player.inv = 0; player.rolling = false; player.slideT = 0; player.crouch = false;
    update = function(){};       // 冻结逻辑，保留画面
    // 放大画面便于检查模型细节
    if (q.get("zoom")) {
      const cv = document.getElementById("game");
      cv.width = 960*3; cv.height = 540*3;
      ctx.scale(3,3);
      document.getElementById("tip").style.display = "none";
      document.body.style.margin = "0";
      window.scrollTo(0,0);
    }
    render();
  }, 120);
});
</script>
</body>`;

html = html.replace("</body>", inject);
fs.writeFileSync(path.join(__dirname, "shot.html"), html);
console.log("shot.html written");
