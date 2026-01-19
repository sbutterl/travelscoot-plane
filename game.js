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

  function joyS
