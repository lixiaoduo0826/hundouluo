const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");

const inject = `
<script>
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
    } else if (mode === "tankshell") {
      nextLevel(); state = "play"; stateTimer = 0; bannerT = 0;
      enemies.length = 0; ebullets.length = 0;
      place(2200); cam = 2050;
      p.face = 1; p.aimAng = 0; p.inv = 0;
      const tk = makeTank(2450); tk.cd = 14; tk.aim = 14; tk.gunA = -0.05;
      enemies.push(tk);
      ebullets.push({x:2320, y:groundYAt(2320)-52, w:7, h:7, vx:-5.6, vy:-0.1, life:200, shell:true, r:5.6});
      ebullets.push({x:2180, y:groundYAt(2180)-58, w:7, h:7, vx:-5.6, vy:-0.1, life:200, shell:true, r:5.6});
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
