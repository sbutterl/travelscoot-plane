(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");

  const touchControls = document.getElementById("touchControls");
  const joy = document.getElementById("joy");
  const knob = document.getElementById("knob");
  const boostBtn = document.getElementById("boostBtn");

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);

  // Photo asset
  const scootImg = new Image();
  scootImg.src = "assets/travelscoot.png";
  let scootReady = false;
  scootImg.onload = () => { scootReady = true; };

  const State = { BUILD: "build", TRANSFORM: "transform", FLY: "fly" };
  let state = State.BUILD;

  let camX = 0;
  let camY = 0;

  let stars = [];
  let skyDinos = [];
  let score = 0;

  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","w","a","s","d","W","A","S","D"].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.key);
  }, { passive:false });
  window.addEventListener("keyup", (e) => keys.delete(e.key));

  // Touch joystick
  let joyVec = { x: 0, y: 0 };
  let boostTouch = false;

  const isTouch = () => matchMedia("(pointer: coarse)").matches;
  function setTouchUI() {
    if (isTouch()) {
      touchControls.classList.remove("hidden");
      touchControls.setAttribute("aria-hidden", "false");
    } else {
      touchControls.classList.add("hidden");
      touchControls.setAttribute("aria-hidden", "true");
    }
  }
  setTouchUI();
  window.addEventListener("resize", setTouchUI);

  let joyActive = false;
  let joyCenter = { x: 0, y: 0 };
  const joyRadius = 46;

  function setKnob(x, y) {
    knob.style.left = `${x}px`;
    knob.style.top = `${y}px`;
  }
  function resetKnob() {
    setKnob(joy.clientWidth / 2, joy.clientHeight / 2);
  }
  resetKnob();

  function joyStart(e){
    joyActive = true;
    const rect = joy.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    joyMove(e);
  }
  function joyMove(e){
    if(!joyActive) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - joyCenter.x;
    const dy = t.clientY - joyCenter.y;
    const len = Math.hypot(dx, dy);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    const mag = Math.min(1, len / joyRadius);

    joyVec.x = nx * mag;
    joyVec.y = ny * mag;

    const kx = joy.clientWidth/2 + joyVec.x * joyRadius;
    const ky = joy.clientHeight/2 + joyVec.y * joyRadius;
    setKnob(kx, ky);
  }
  function joyEnd(){
    joyActive = false;
    joyVec.x = 0; joyVec.y = 0;
    resetKnob();
  }

  joy.addEventListener("pointerdown", joyStart);
  window.addEventListener("pointermove", joyMove);
  window.addEventListener("pointerup", joyEnd);
  joy.addEventListener("touchstart", joyStart, {passive:false});
  window.addEventListener("touchmove", joyMove, {passive:false});
  window.addEventListener("touchend", joyEnd);

  boostBtn.addEventListener("pointerdown", () => boostTouch = true);
  boostBtn.addEventListener("pointerup", () => boostTouch = false);
  boostBtn.addEventListener("pointerleave", () => boostTouch = false);

  // Builder parts
  const parts = [
    { id:"wings", label:"Wings", w:180, h:60, color:"#7aa7ff", placed:false, x:0, y:0, homeX:0, homeY:0 },
    { id:"tail",  label:"Tail",  w:90,  h:55, color:"#7cf7c2", placed:false, x:0, y:0, homeX:0, homeY:0 },
    { id:"prop",  label:"Prop",  w:70,  h:70, color:"#ffd36b", placed:false, x:0, y:0, homeX:0, homeY:0 },
    { id:"dino",  label:"Dino Sticker", w:110, h:70, color:"#ff6b7a", placed:false, x:0, y:0, homeX:0, homeY:0 },
  ];

  const targets = {
    wings: { ox: 30,  oy: -20, r: 40 },
    tail:  { ox: 170, oy: -35, r: 35 },
    prop:  { ox: -30, oy: 5,   r: 35 },
    dino:  { ox: 40,  oy: -38, r: 38 },
  };

  const craft = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    angle: 0,
    boost: 0,
    transformT: 0,
  };

  let dragging = null;
  let dragOff = { x:0, y:0 };

  function layoutBuild() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    craft.x = w * 0.52;
    craft.y = h * 0.52;

    const baseY = h * 0.78;
    const gap = 14;
    const totalW = parts.reduce((s,p)=>s+p.w,0) + gap*(parts.length-1);
    let startX = (w - totalW)/2;

    for (const p of parts) {
      p.homeX = startX + p.w/2;
      p.homeY = baseY;
      if (!p.placed) {
        p.x = p.homeX; p.y = p.homeY;
      }
      startX += p.w + gap;
    }
  }

  function resetGame() {
    state = State.BUILD;
    score = 0;
    stars = [];
    skyDinos = [];
    camX = 0; camY = 0;
    craft.vx = 0; craft.vy = 0;
    craft.angle = 0;
    craft.boost = 0;
    craft.transformT = 0;

    for (const p of parts) p.placed = false;

    layoutBuild();
    statusEl.textContent = "Drag parts onto the scoot. They’ll snap!";
    document.querySelector(".badge").textContent = "Build";
  }

  resetBtn.addEventListener("click", resetGame);

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
    const clientY = (e.touches ? e.touches[0].clientY : e.clientY);
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function hitPart(px, py, p) {
    return Math.abs(px - p.x) <= p.w/2 && Math.abs(py - p.y) <= p.h/2;
  }

  function onDown(e) {
    if (state !== State.BUILD) return;
    const {x,y} = pointerPos(e);

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.placed) continue;
      if (hitPart(x,y,p)) {
        dragging = p;
        dragOff.x = x - p.x;
        dragOff.y = y - p.y;
        parts.splice(i,1);
        parts.push(p);
        e.preventDefault();
        return;
      }
    }
  }

  function onMove(e) {
    if (!dragging) return;
    const {x,y} = pointerPos(e);
    dragging.x = x - dragOff.x;
    dragging.y = y - dragOff.y;
    e.preventDefault();
  }

  function trySnap(p) {
    const t = targets[p.id];
    const tx = craft.x + t.ox;
    const ty = craft.y + t.oy;
    const d = Math.hypot(p.x - tx, p.y - ty);
    if (d <= t.r) {
      p.placed = true;
      p.x = tx; p.y = ty;
      return true;
    }
    return false;
  }

  function startTransform() {
    state = State.TRANSFORM;
    statusEl.textContent = "Transforming… ✨";
    document.querySelector(".badge").textContent = "Transform";
  }

  function onUp(e) {
    if (!dragging) return;

    const snapped = trySnap(dragging);
    if (!snapped) {
      dragging.x = dragging.homeX;
      dragging.y = dragging.homeY;
    } else {
      statusEl.textContent = `${dragging.label} snapped!`;
      if (parts.every(p => p.placed)) {
        startTransform();
      }
    }
    dragging = null;
    e.preventDefault();
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive:false });
  window.addEventListener("pointerup", onUp, { passive:false });

  canvas.addEventListener("touchstart", onDown, { passive:false });
  window.addEventListener("touchmove", onMove, { passive:false });
  window.addEventListener("touchend", onUp, { passive:false });

  function drawRoundedRect(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function drawPart(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.id === "wings") {
      ctx.fillStyle = "rgba(122,167,255,.25)";
      ctx.strokeStyle = "rgba(122,167,255,.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-p.w/2, 0);
      ctx.quadraticCurveTo(0, -p.h/1.4, p.w/2, 0);
      ctx.quadraticCurveTo(0, p.h/1.4, -p.w/2, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,.18)";
      drawRoundedRect(-18, -10, 36, 20, 10);
      ctx.fill();
    }

    if (p.id === "tail") {
      ctx.fillStyle = "rgba(124,247,194,.22)";
      ctx.strokeStyle = "rgba(124,247,194,.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-p.w/2, p.h/4);
      ctx.quadraticCurveTo(-p.w/5, -p.h/2, p.w/2, -p.h/6);
      ctx.quadraticCurveTo(0, p.h/2, -p.w/2, p.h/4);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    if (p.id === "prop") {
      ctx.strokeStyle = "rgba(255,211,107,.95)";
      ctx.fillStyle = "rgba(255,211,107,.18)";
      ctx.lineWidth = 4;

      for (let i=0;i<3;i++){
        ctx.save();
        ctx.rotate((i*Math.PI*2)/3);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.quadraticCurveTo(28, -8, 34, 0);
        ctx.quadraticCurveTo(28, 8, 0, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.beginPath();
      ctx.arc(0,0,10,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (p.id === "dino") {
      // Cute dino sticker
      ctx.fillStyle = "rgba(255,107,122,.20)";
      ctx.strokeStyle = "rgba(255,107,122,.95)";
      ctx.lineWidth = 3;

      // body blob
      ctx.beginPath();
      ctx.ellipse(-10, 6, 32, 24, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // head
      ctx.beginPath();
      ctx.ellipse(22, -4, 18, 16, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // eye
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(28, -7, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "rgba(10,16,32,.85)";
      ctx.beginPath();
      ctx.arc(29.5, -7, 1.8, 0, Math.PI*2);
      ctx.fill();

      // spikes
      ctx.fillStyle = "rgba(255,211,107,.55)";
      ctx.strokeStyle = "rgba(255,211,107,.85)";
      ctx.lineWidth = 2;
      for (let i=0;i<4;i++){
        const x = -26 + i*14;
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.lineTo(x+6, -26);
        ctx.lineTo(x+12, -10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }

      // little legs
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, 28); ctx.lineTo(-18, 36);
      ctx.moveTo(-2, 28);  ctx.lineTo(-2, 36);
      ctx.stroke();
    }

    if (!p.placed && state === State.BUILD) {
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText(p.label, 0, p.h/2 + 18);
    }

    ctx.restore();
  }

  function drawTargets() {
    if (state !== State.BUILD) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.setLineDash([6,6]);
    for (const p of parts) {
      if (p.placed) continue;
      const t = targets[p.id];
      const tx = craft.x + t.ox;
      const ty = craft.y + t.oy;
      ctx.beginPath();
      ctx.arc(tx, ty, t.r, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawScootAndPlane() {
    ctx.save();
    ctx.translate(craft.x, craft.y);

    if (state === State.FLY) ctx.rotate(craft.angle);

    const t = craft.transformT;

    if (scootReady) {
      const imgW = 260;
      const imgH = 170;
      ctx.globalAlpha = 1 - t;
      ctx.drawImage(scootImg, -imgW/2, -imgH/2, imgW, imgH);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = "rgba(255,255,255,.10)";
      drawRoundedRect(-120, -40, 240, 80, 22);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = t;

    // fuselage
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.lineWidth = 2;
    drawRoundedRect(-140, -28, 280, 56, 28);
    ctx.fill(); ctx.stroke();

    // cockpit
    ctx.fillStyle = "rgba(122,167,255,.22)";
    drawRoundedRect(-40, -22, 70, 28, 14);
    ctx.fill();

    // silly rainbow-ish stripe hint (just a bright line)
    ctx.strokeStyle = "rgba(255,211,107,.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-110, -2);
    ctx.lineTo(110, -2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function spawnStars() {
    stars = [];
    for (let i=0;i<25;i++){
      stars.push({
        x: (Math.random()*2000) - 500,
        y: (Math.random()*1200) - 600,
        r: 10 + Math.random()*8,
        taken:false
      });
    }
  }

  function spawnSkyDinos() {
    skyDinos = [];
    for (let i=0;i<10;i++){
      skyDinos.push({
        x: (Math.random()*2200) - 600,
        y: (Math.random()*1300) - 650,
        s: 0.7 + Math.random()*0.8,
        flap: Math.random()*Math.PI*2
      });
    }
  }

  function drawBackground() {
    ctx.save();
    ctx.globalAlpha = 0.7;
    for (let i=0;i<12;i++){
      const wx = (i*220 + (camX*0.15)) % (canvas.clientWidth + 260) - 130;
      const wy = (i*90 + (camY*0.10)) % (canvas.clientHeight + 180) - 90;
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.beginPath();
      ctx.ellipse(wx, wy, 70, 34, 0, 0, Math.PI*2);
      ctx.ellipse(wx+55, wy+8, 56, 28, 0, 0, Math.PI*2);
      ctx.ellipse(wx-50, wy+10, 50, 24, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStars() {
    if (state !== State.FLY) return;

    for (const s of stars) {
      if (s.taken) continue;
      const sx = (canvas.clientWidth/2) + (s.x - camX);
      const sy = (canvas.clientHeight/2) + (s.y - camY);
      if (sx < -60 || sx > canvas.clientWidth + 60 || sy < -60 || sy > canvas.clientHeight + 60) continue;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = "rgba(255,211,107,.85)";
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 2;

      ctx.beginPath();
      for (let i=0;i<5;i++){
        const a = (i*2*Math.PI)/5 - Math.PI/2;
        const a2 = a + Math.PI/5;
        ctx.lineTo(Math.cos(a)*s.r, Math.sin(a)*s.r);
        ctx.lineTo(Math.cos(a2)*(s.r*0.45), Math.sin(a2)*(s.r*0.45));
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "800 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Stars: ${score}`, 16, 28);
    ctx.restore();
  }

  function drawSkyDinos(tNow) {
    if (state !== State.FLY) return;

    for (const d of skyDinos) {
      const sx = (canvas.clientWidth/2) + (d.x - camX);
      const sy = (canvas.clientHeight/2) + (d.y - camY);
      if (sx < -120 || sx > canvas.clientWidth + 120 || sy < -120 || sy > canvas.clientHeight + 120) continue;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(d.s, d.s);

      const flap = Math.sin((tNow/180) + d.flap) * 10;

      ctx.strokeStyle = "rgba(124,247,194,.35)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.quadraticCurveTo(-18, -18 - flap, 0, -6);
      ctx.quadraticCurveTo(18, -18 + flap, 40, 0);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,211,107,.45)";
      ctx.beginPath();
      ctx.arc(8, -8, 4, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();
    }
  }

  function update(dt) {
    if (state === State.TRANSFORM) {
      craft.transformT = Math.min(1, craft.transformT + dt * 0.6);
      if (craft.transformT >= 1) {
        state = State.FLY;
        document.querySelector(".badge").textContent = "Fly";
        statusEl.textContent = "Fly! Collect stars ✨ (Dinosaurs are in the sky!)";
        spawnStars();
        spawnSkyDinos();
      }
    }

    if (state === State.FLY) {
      const accel = 520;
      const maxV = 560;

      let ix = 0, iy = 0;
      if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) ix -= 1;
      if (keys.has("ArrowRight")|| keys.has("d") || keys.has("D")) ix += 1;
      if (keys.has("ArrowUp")   || keys.has("w") || keys.has("W")) iy -= 1;
      if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) iy += 1;

      ix += joyVec.x;
      iy += joyVec.y;

      const boost = (keys.has(" ") || boostTouch) ? 1 : 0;
      craft.boost = boost;

      const bMult = boost ? 1.7 : 1.0;
      craft.vx += ix * accel * bMult * dt;
      craft.vy += iy * accel * bMult * dt;

      craft.vx *= Math.pow(0.12, dt);
      craft.vy *= Math.pow(0.12, dt);

      craft.vx = Math.max(-maxV, Math.min(maxV, craft.vx));
      craft.vy = Math.max(-maxV, Math.min(maxV, craft.vy));

      camX += craft.vx * dt;
      camY += craft.vy * dt;

      craft.angle = Math.max(-0.5, Math.min(0.5, craft.vx / maxV * 0.9));

      for (const s of stars) {
        if (s.taken) continue;
        const d = Math.hypot((s.x - camX), (s.y - camY));
        if (d < 42) {
          s.taken = true;
          score += 1;
        }
      }
    }
  }

  function render() {
    ctx.clearRect(0,0,canvas.clientWidth, canvas.clientHeight);

    if (state === State.FLY) {
      drawBackground();
      drawSkyDinos(performance.now());
    }

    drawTargets();

    if (state === State.FLY) {
      craft.x = canvas.clientWidth/2;
      craft.y = canvas.clientHeight/2;
    }

    drawScootAndPlane();

    if (state === State.BUILD) {
      for (const p of parts) drawPart(p);
    } else if (state === State.TRANSFORM || state === State.FLY) {
      for (const p of parts) {
        if (!p.placed) continue;
        const t = targets[p.id];
        const baseX = craft.x + t.ox;
        const baseY = craft.y + t.oy;
        const oldX = p.x, oldY = p.y;
        p.x = baseX; p.y = baseY;
        drawPart(p);
        p.x = oldX; p.y = oldY;
      }
    }

    drawStars();

    if (!scootReady) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("Tip: add /assets/travelscoot.png for the real photo ✨", 16, canvas.clientHeight - 18);
      ctx.restore();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  resize();
  layoutBuild();
  resetGame();
  requestAnimationFrame(loop);

  const ro = new ResizeObserver(() => {
    resize();
    if (state === State.BUILD) layoutBuild();
  });
  ro.observe(canvas);
})();
