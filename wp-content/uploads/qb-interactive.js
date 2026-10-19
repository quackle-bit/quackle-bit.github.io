/*
 * Quackle.bit — interactive extras
 *  1. Silly duck (all pages): wanders, talks, eats/drags bits of the page (always restored).
 *     Click = he hides (long neck peeks from an edge), click the head = he falls back in.
 *     Drag = reposition. Konami code = duck parade.
 *  2. Portfolio: small ▶ icon on game cards (the card links to the game on itch.io).
 *  3. About: team "character select" stats, awards as achievements.
 * Edit the CONFIG block below to change text/stats. Remove the <script> tag to disable everything.
 */
(function () {
  "use strict";

  /* ======================= CONFIG ======================= */
  var CONFIG = {
    duck: {
      enabled: true,
      lines: [
        "Quack!",
        "Welcome to Quackle.bit!",
        "Stories told in pixels.",
        "Have you tried Anotherland Above?",
        "Psst... try the Konami code.",
        "Made with love (and pixels).",
        "Quack quack!",
      ],
    },
    // Team "character select" — placeholder stats, edit freely (0–100)
    team: {
      Rein: {
        player: "P1",
        cls: "Game Designer",
        stats: { "Game Design": 92, "Pixel Art": 84, "Worldbuilding": 88, "Coffee": 75 },
        special: "Turns wild ideas into playable systems.",
      },
      Sylph: {
        player: "P2",
        cls: "Art Director",
        stats: { "Pixel Art": 96, "Art Direction": 94, "Storytelling": 86, "Snacks": 80 },
        special: "Every pixel has a purpose.",
      },
    },
  };
  /* ===================================================== */

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var path = location.pathname;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------- tiny sound (Web Audio, no files) ---------- */
  var audio;
  function quackSound() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(620, t);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(audio.destination);
      o.start(t); o.stop(t + 0.2);
    } catch (e) { /* no audio, no problem */ }
  }
  function chime() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1320].forEach(function (f, i) {
        var t = audio.currentTime + i * 0.08, o = audio.createOscillator(), g = audio.createGain();
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.13);
      });
    } catch (e) {}
  }

  /* ======================= 1. DUCK ======================= */
  /* A silly guide duck. He wanders and talks on his own, comments on content as you scroll,
     flies short hops, and sometimes bites a piece of the page or drags it around (always put back).
     You can: click him -> he flaps off and hides (only a long neck + head peek in from a screen edge),
              click the peeking head -> he tumbles in from the sky, gets stunned, then walks again,
              drag him (mouse or finger) -> reposition him. */
  var BODY = [
    "................",
    "......oooo......",
    ".....owwwwo.....",
    "....owwwwwwo....",
    "....owwwwwowo...",
    "....owwwwwwwbbbo",
    "....owwwwwwobbo.",
    ".oo.otttttto....",
    "owwoowwwwwwwo...",
    "owwwwwwwswwwwo..",
    "owwwwwwsswwwwo..",
    ".owwwwwwwwwwo...",
    "..oowwwwwwoo....",
    "....oooooo......",
  ];
  var FEET = {
    walk1: [".....b...b......", "....bb..bb......"],
    walk2: ["......b.b.......", ".....bb.bb......"],
    jump: ["......bb........", "................"],
  };
  var WING_UP = ["oo...", "owo..", "owwo.", "owwwo", ".owwo", "..oo."];     // drawn at (1,3)
  var WING_DOWN = ["..oo.", ".owwo", "owwwo", "owwo.", "owo..", "oo..."];   // drawn at (0,9)
  var PEEK = BODY.slice(1, 7).concat(
    Array.apply(null, Array(14)).map(function () { return "......owwo......"; }));   // straight neck
  var PAL = { o: "#2f2f24", w: "#f5f1e6", s: "#d6ceba", b: "#e8a33c", t: "#469ca0" };
  var SCALE = 4, SIZE = 16 * SCALE, PEEK_H = PEEK.length * SCALE, PEEK_VIS = 58;

  function drawRows(ctx, rows, flip, ox, oy) {
    for (var y = 0; y < rows.length; y++)
      for (var x = 0; x < rows[y].length; x++) {
        var c = rows[y][x];
        if (!c || c === ".") continue;
        var px = x + (ox || 0);
        ctx.fillStyle = PAL[c];
        ctx.fillRect((flip ? 15 - px : px) * SCALE, (y + (oy || 0)) * SCALE, SCALE, SCALE);
      }
  }
  function drawFrame(ctx, feet, flip, wing) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawRows(ctx, BODY.concat(FEET[feet]), flip);
    if (wing === 1) drawRows(ctx, WING_UP, flip, 1, 3);
    else if (wing === 2) drawRows(ctx, WING_DOWN, flip, 0, 9);
  }

  /* ---------- juice: particles, floating text, sounds ---------- */
  var HAS_WAAPI = typeof Element !== "undefined" && !!Element.prototype.animate;
  function burst(x, y, n, o) {
    if (!HAS_WAAPI || reduceMotion) return;
    o = o || {};
    var cols = o.colors || ["#f5f1e6"], sz = o.size || [3, 6];
    for (var i = 0; i < n; i++) {
      var p = el("div", "qb-p"), s = Math.round(rnd(sz[0], sz[1]));
      var ang = o.ang != null ? o.ang + rnd(-(o.spread || 1) / 2, (o.spread || 1) / 2) : rnd(0, Math.PI * 2);
      var v = rnd(o.v0 || 30, o.v1 || 90), dx = Math.cos(ang) * v, dy = Math.sin(ang) * v + (o.g || 40);
      p.style.cssText = "left:" + Math.round(x) + "px;top:" + Math.round(y) + "px;width:" + s + "px;height:" + s + "px;background:" + cols[i % cols.length];
      document.body.appendChild(p);
      var a = p.animate([
        { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
        { transform: "translate(" + dx + "px," + dy + "px) rotate(" + rnd(-300, 300) + "deg) scale(" + (o.shrink === false ? 1 : 0.3) + ")", opacity: 0 }
      ], { duration: rnd(o.t0 || 450, o.t1 || 800), easing: "cubic-bezier(.2,.7,.4,1)" });
      a.onfinish = function (pp) { return function () { pp.remove(); }; }(p);
    }
  }
  function popText(x, y, text, color) {
    if (!HAS_WAAPI) return;
    var t = el("div", "qb-poptext", text); t.style.left = Math.round(x) + "px"; t.style.top = Math.round(y) + "px";
    if (color) t.style.color = color;
    document.body.appendChild(t);
    var a = t.animate([
      { transform: "translate(-50%,0) scale(.4) rotate(-8deg)", opacity: 0 },
      { transform: "translate(-50%,-14px) scale(1.25) rotate(4deg)", opacity: 1, offset: 0.3 },
      { transform: "translate(-50%,-38px) scale(1) rotate(-3deg)", opacity: 0 }
    ], { duration: 750, easing: "ease-out" });
    a.onfinish = function () { t.remove(); };
  }
  function actx() { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); return audio; }
  function noise(dur, freq, vol, sweep) {
    try {
      var c = actx(), len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      var src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; fl.type = "bandpass"; fl.frequency.setValueAtTime(freq, c.currentTime);
      if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, c.currentTime + dur);
      g.gain.value = vol; src.connect(fl); fl.connect(g); g.connect(c.destination); src.start();
    } catch (e) {}
  }
  function tone(type, f0, f1, dur, vol) {
    try {
      var c = actx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function crunch() { noise(0.09, 2200 + Math.random() * 800, 0.35); tone("square", 180, 90, 0.07, 0.04); }
  function whoosh() { noise(0.35, 400, 0.18, 2400); }
  function thud() { tone("sine", 140, 40, 0.18, 0.2); noise(0.08, 300, 0.15); }
  function boing() { tone("sine", 260, 640, 0.22, 0.07); }
  function burpSound() { tone("sawtooth", 120, 60, 0.4, 0.07); }
  function flap() { noise(0.05, 900, 0.07); }

  var SAY = {
    hello: ["Quack! I'm the duck. Don't mind me.", "Welcome to Quackle.bit!", "Hi! Click me if you dare.", "I live here. Rent-free."],
    idle: ["Quack!", "Stories told in pixels.", "Have you tried Anotherland Above?", "Psst... try the Konami code.", "Made with love (and pixels).", "Quack quack!", "Drag me somewhere nicer.", "I'm a professional guide. Probably."],
    stunned: ["x_x", "Ow... who put the ground there?", "I meant to do that.", "Quack... stars."],
    drag: ["Whee!", "Put me down!", "Hey!", "New view!"],
    drop: ["Okay, I live here now.", "Nice spot.", "Thanks, I think."],
    eat: ["Nom nom nom!", "Is this edible?", "Tastes like pixels.", "Mmm, content."],
    burp: ["*BURP* ...sorry.", "Okay, you can have it back.", "Too crunchy."],
    carry: ["Mine now!", "Moving day!", "Let me redecorate...", "Help me carry this!"],
    oops: ["Oops!", "Heavy!", "Fine, back it goes."],
    flit: ["Wheee!", "Look, I can fly!", "Flap flap!", "Beep beep, coming through!"],
    scroll: {
      ".team-item": ["Meet the team!", "These two make the magic."],
      ".clients-item": ["Shiny awards! Can I eat one?", "Look at all these awards!"],
      ".qb-journey": ["Our journey so far!", "Still walking this path."],
      ".press-coverage-card": ["We made the news!", "Famous duck, famous studio."],
      ".press-kit-facts": ["Fun facts! I know them all."],
      ".press-kit-projects": ["All the games in one place."],
      ".press-kit-socials": ["Follow us! Quack."],
      ".footer": ["That's the end. Thanks for scrolling!", "Nothing down here but me."],
      "h1": ["That's the big title!", "Hello there, big title."],
      "h2": ["Ooh, a new section.", "Keep scrolling!"],
      ".qb-featured-label": ["Psst, this one is new!"],
      ".gallery img, .portfolio img, .elementor-shortcode img": ["Pretty pixels!", "I'd eat that one. Hm."],
      ".meeek-bio-links-inner-container": ["Click one! They're good links."],
      ".title_inner": ["Ooh, a new section.", "Keep scrolling!", "I wonder what's next."],
    },
  };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function bitePoly(p) {   // jagged "bitten" left edge, p = % eaten from the left
    var q = function (v) { return Math.min(100, v) + "%"; };
    return "polygon(" + q(p) + " 0%,100% 0%,100% 100%," + q(p) + " 100%," + q(p + 3) + " 85%," + q(p) + " 70%," + q(p + 3) + " 55%," + q(p) + " 40%," + q(p + 3) + " 25%," + q(p) + " 10%)";
  }

  function Duck() {
    var self = this;
    this.size = SIZE;
    this.wrap = el("div", "qb-duck");
    this.canvas = el("canvas"); this.canvas.width = this.canvas.height = SIZE;
    this.bubble = el("div", "qb-duck-bubble");
    this.bubble.setAttribute("role", "status"); this.bubble.setAttribute("aria-live", "polite");
    this.stars = el("div", "qb-duck-stars", "★ ✦ ★");
    this.wrap.appendChild(this.bubble); this.wrap.appendChild(this.stars); this.wrap.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.peek = el("div", "qb-peek");
    this.pcanvas = el("canvas"); this.pcanvas.width = SIZE; this.pcanvas.height = PEEK_H;
    this.peek.appendChild(this.pcanvas);
    this.pcanvas.getContext("2d").clearRect(0, 0, SIZE, PEEK_H);
    drawRows(this.pcanvas.getContext("2d"), PEEK, false);
    [this.wrap, this.peek].forEach(function (n) {
      n.setAttribute("role", "button"); n.setAttribute("tabindex", "0");
      n.addEventListener("pointerdown", function (e) { self.down(e, n); });
      n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.activate(); } });
      n.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });
    this.wrap.setAttribute("aria-label", "Silly duck. Click to make him hide, drag to move him.");
    this.peek.setAttribute("aria-label", "The duck is hiding. Click to bring him back.");
    this.wrap.title = "Click: hide · Drag: move"; this.peek.title = "Click to bring him back";
    this.peek.style.display = "none";
    document.body.appendChild(this.wrap); document.body.appendChild(this.peek);

    this.lane = 6;
    this.x = innerWidth * 0.15; this.y = this.homeY(); this.dir = 1; this.speed = 0.9;
    this.mode = "walk"; this.paused = false; this.frame = 0; this.tick = 0;
    this.nextThink = 0; this.nextActAt = performance.now() + 8000; this.lastAction = 0; this.lastSay = 0; this.act = null;
    this.edge = "bottom"; this.edgePos = 0.5; this.vy = 0; this.drag = null;
    this.sx = 1; this.sy = 1; this.rot = 0; this.flying = false; this.fc = 0;
    this.render(false);
  }
  Duck.prototype.sz = function () { return this.wrap.offsetWidth || SIZE; };
  Duck.prototype.homeY = function () { return Math.max(0, innerHeight - this.sz() - this.lane); };
  Duck.prototype.say = function (text, ms, force) {
    var now = performance.now();
    if (this.mode === "hidden" || this.mode === "fall" || this.mode === "leave") return;
    if (!force && now - this.lastSay < 5000) return;
    this.lastSay = now;
    var b = this.bubble, s = this.sz();
    b.textContent = text; b.classList.add("show");
    var bw = b.offsetWidth, cx = this.x + s / 2;
    var left = Math.min(Math.max(cx - bw / 2, 8), Math.max(8, innerWidth - 8 - bw));
    b.style.left = Math.round(left - this.x) + "px";
    b.style.setProperty("--tail", Math.round(Math.min(Math.max(cx - left, 16), bw - 16)) + "px");
    b.classList.toggle("below", this.y < 80);
    clearTimeout(this._sayT);
    this._sayT = setTimeout(function () { b.classList.remove("show"); }, ms || 2600);
  };
  Duck.prototype.squash = function (sx, sy) { this.sx = sx; this.sy = sy; };
  Duck.prototype.feet = function () { return { x: this.x + this.sz() / 2, y: this.y + this.sz() }; };
  Duck.prototype.dust = function () {
    var p = this.feet(), c = ["#d9d4c4", "#bdb7a6", "#f5f1e6"];
    burst(p.x, p.y - 4, 5, { colors: c, size: [4, 8], ang: 0, spread: 0.6, v0: 30, v1: 80, g: -6 });
    burst(p.x, p.y - 4, 5, { colors: c, size: [4, 8], ang: Math.PI, spread: 0.6, v0: 30, v1: 80, g: -6 });
  };
  Duck.prototype.land = function () {
    this.flying = false; this.squash(1.4, 0.6); this.dust(); thud();
  };
  Duck.prototype.activate = function () {
    if (this.mode === "hidden") this.respawn(); else if (this.mode === "walk" || this.mode === "act" || this.mode === "drag" || this.mode === "stunned" || this.mode === "fall") this.hide();
  };

  /* ----- pointer: click = hide / respawn, drag = reposition ----- */
  Duck.prototype.down = function (e, node) {
    if (e.button != null && e.button !== 0) return;
    var self = this;
    this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: this.x, y0: this.y, moved: false, node: node, hidden: this.mode === "hidden" };
    try { node.setPointerCapture(e.pointerId); } catch (_) {}
    function move(ev) {
      var d = self.drag; if (!d || ev.pointerId !== d.id) return;
      var dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 7) return;
      if (!d.moved) { d.moved = true; self.startDrag(); }
      if (d.hidden) self.dragPeek(ev.clientX, ev.clientY);
      else {
        var s = self.sz();
        self.x = Math.min(Math.max(d.x0 + dx, 0), innerWidth - s);
        self.y = Math.min(Math.max(d.y0 + dy, 0), innerHeight - s);
        self.render(false);
      }
      ev.preventDefault();
    }
    function up(ev) {
      var d = self.drag; if (!d || ev.pointerId !== d.id) return;
      node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up);
      self.drag = null;
      if (d.moved) self.endDrag(d.hidden); else if (ev.type === "pointerup") self.activate();
    }
    node.addEventListener("pointermove", move); node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
  };
  Duck.prototype.startDrag = function () {
    if (this.mode === "hidden") { this.peek.classList.add("is-dragging"); this.peek.style.transition = "none"; return; }
    this.abortAct(true);
    this.flying = false; this.mode = "drag"; this.wrap.classList.add("is-dragging"); this.wrap.classList.remove("is-stunned");
    this.squash(0.85, 1.2); whoosh();
    this.say(pick(SAY.drag), 1800, true);
  };
  Duck.prototype.endDrag = function (wasHidden) {
    if (wasHidden) { this.peek.classList.remove("is-dragging"); this.peek.style.transition = ""; this.placePeek(true); this.scheduleRelocate(); return; }
    this.wrap.classList.remove("is-dragging");
    this.lane = Math.max(0, innerHeight - (this.y + this.sz()));
    this.mode = "walk"; this.nextThink = 0; this.rot = 0;
    this.squash(1.3, 0.7); boing(); this.dust();
    this.say(pick(SAY.drop), 2200, true);
  };

  /* ----- hide: flap off the screen edge, then only a long neck + head peeks back in ----- */
  Duck.prototype.hide = function () {
    this.abortAct(true);                       // anything he holds / is eating goes straight back
    var s = this.sz();
    burst(this.x + s / 2, this.y + s / 2, 10, { colors: ["#f5f1e6", "#d6ceba", "#e8a33c"], v0: 40, v1: 100, g: 30 });
    popText(this.x + s / 2, this.y, "Eek!");
    quackSound();
    this.mode = "hidden"; this.flying = false; this.bubble.classList.remove("show");
    this.wrap.style.display = "none"; this.wrap.classList.remove("is-stunned", "is-dragging");
    this.edge = pick(["left", "right", "top", "bottom"]); this.edgePos = rnd(0.2, 0.8);
    this.peek.style.display = "block"; this.placePeek(false);
    var self = this; requestAnimationFrame(function () { requestAnimationFrame(function () { self.placePeek(true); }); });
    this.scheduleRelocate();
  };
  Duck.prototype.peekXY = function (shown) {
    var horiz = this.edge === "left" || this.edge === "right";
    var w = horiz ? PEEK_H : SIZE, h = horiz ? SIZE : PEEK_H;
    var off = shown ? PEEK_VIS : 0, x, y, along = this.edgePos;
    if (this.edge === "left") { x = off - w; y = along * (innerHeight - h); }
    else if (this.edge === "right") { x = innerWidth - off; y = along * (innerHeight - h); }
    else if (this.edge === "top") { x = along * (innerWidth - w); y = off - h; }
    else { x = along * (innerWidth - w); y = innerHeight - off; }
    return { x: Math.round(x), y: Math.round(y), w: w, h: h };
  };
  Duck.prototype.placePeek = function (shown) {
    var p = this.peekXY(shown), rot = { left: 90, right: -90, top: 180, bottom: 0 }[this.edge];
    this.peek.style.width = p.w + "px"; this.peek.style.height = p.h + "px";
    this.peek.style.transform = "translate(" + p.x + "px," + p.y + "px)";
    this.pcanvas.style.rotate = rot + "deg";
    this.peek.dataset.edge = this.edge;
  };
  Duck.prototype.dragPeek = function (px, py) {
    var dl = px, dr = innerWidth - px, dt = py, db = innerHeight - py, m = Math.min(dl, dr, dt, db);
    this.edge = m === dl ? "left" : m === dr ? "right" : m === dt ? "top" : "bottom";
    var horiz = this.edge === "left" || this.edge === "right";
    var span = horiz ? innerHeight - SIZE : innerWidth - SIZE;
    this.edgePos = Math.min(1, Math.max(0, ((horiz ? py : px) - SIZE / 2) / span));
    this.placePeek(true);
  };
  Duck.prototype.scheduleRelocate = function () {
    var self = this; clearTimeout(this._relT);
    this._relT = setTimeout(function () {
      if (self.mode !== "hidden" || self.drag) return self.scheduleRelocate();
      self.placePeek(false);
      setTimeout(function () {
        if (self.mode !== "hidden") return;
        self.edge = pick(["left", "right", "top", "bottom"]); self.edgePos = rnd(0.15, 0.85);
        self.placePeek(false);
        requestAnimationFrame(function () { requestAnimationFrame(function () { self.placePeek(true); }); });
        self.scheduleRelocate();
      }, 650);
    }, 7350);                                   // slide away (0.65s) + pop up elsewhere = every 8s
  };
  Duck.prototype.respawn = function () {
    clearTimeout(this._relT);
    this.placePeek(false);
    var self = this;
    setTimeout(function () { self.peek.style.display = "none"; }, 350);
    whoosh();
    this.mode = "fall";
    var s = this.sz();
    this.x = rnd(innerWidth * 0.2, Math.max(innerWidth * 0.2 + 1, innerWidth * 0.8 - s));
    this.y = -s - 30; this.vy = 0; this.dir = Math.random() < 0.5 ? -1 : 1; this.rot = 0; this.spin = this.dir * rnd(14, 24);
    this.wrap.style.display = "block"; this.bounced = false; this.fc = 0;
    this.render(false);
  };

  /* ----- autonomous acts: bite a piece of the page / carry it / flit around (content always restored) ----- */
  var EAT_SEL = "p, h1, h2, h3, h4, li, .qb-map li small, .qb-map li strong, .press-coverage-card-body, .clients-item, .team-item .image";
  var CARRY_SEL = "img, .clients-item, .team-item, .qb-map li, .press-coverage-card, .meeek-bio-links-inner-container";
  function usable(n, minW, maxW, minH, maxH) {
    if (n.closest("header, nav, footer, form, a, button, [role=button], .qb-modal, .qb-duck, .qb-peek, .qb-toasts")) return false;
    if (n.querySelector("a, button, input, textarea, select")) return false;
    if (n.classList.contains("qb-eaten") || n.classList.contains("qb-gone") || n.dataset.qbBusy) return false;
    var r = n.getBoundingClientRect();
    if (r.width < minW || r.width > maxW || r.height < minH || r.height > maxH) return false;
    var cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    if (cy < 70 || cy > innerHeight - 40 || cx < 10 || cx > innerWidth - 10) return false;
    var cs = getComputedStyle(n);
    return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.5;
  }
  function candidates(sel, minW, maxW, minH, maxH) {
    var out = [], nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) if (usable(nodes[i], minW, maxW, minH, maxH)) out.push(nodes[i]);
    return out;
  }
  Duck.prototype.startAct = function (now) {
    var roll = Math.random(), kind = roll < 0.1 ? "flit" : roll < 0.6 ? "eat" : "carry", list = [];
    if (kind === "flit") {
      var s = this.sz();
      this.act = { kind: "flit", phase: "go", tx: rnd(10, Math.max(11, innerWidth - s - 10)), ty: rnd(70, Math.max(71, innerHeight * 0.55)) };
      this.mode = "act"; this.nextActAt = now + 12000; this.say(pick(SAY.flit), 1800, true); return true;
    }
    var ce = function () { return candidates(EAT_SEL, 30, innerWidth, 10, 300); }, cc = function () { return candidates(CARRY_SEL, 40, innerWidth * 0.8, 30, 520); };
    list = kind === "eat" ? ce() : cc();
    if (!list.length) { kind = kind === "eat" ? "carry" : "eat"; list = kind === "eat" ? ce() : cc(); }
    if (!list.length) { this.say("Nothing tasty on screen...", 2200, true); return false; }
    var target = pick(list);
    target.dataset.qbBusy = "1";
    this.act = { kind: kind, el: target, phase: "go", t: now };
    this.mode = "act"; this.nextActAt = now + 12000;
    return true;
  };
  Duck.prototype.abortAct = function (restoreNow) {
    var a = this.act; if (!a) return;
    this.act = null;
    if (a.kind === "carry") this.releaseCarry(a, false);
    else if (a.kind === "eat") { if (a.phase === "go") delete a.el.dataset.qbBusy; else if (!a.restoring) this.finishEat(a, restoreNow ? 0 : 1000); }
    if (this.mode === "act") this.mode = "walk";
  };
  Duck.prototype.stepTo = function (tx, ty, spd, f) {
    var dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 3) { if (this.flying) this.land(); return true; }
    if (!this.flying && d > 170 && !reduceMotion) { this.flying = true; this.squash(0.8, 1.25); whoosh(); }
    var sp = this.flying ? spd * 1.7 : spd, m = Math.min(d, sp * f);
    this.x += dx / d * m; this.y += dy / d * m;
    if (Math.abs(dx) > 2) this.dir = dx > 0 ? 1 : -1;
    this.moving = true; return false;
  };
  Duck.prototype.finishEat = function (a, delay) {
    var n = a.el; a.restoring = true;
    function restore() {
      n.classList.remove("qb-gone", "qb-eaten"); n.style.clipPath = ""; n.style.transition = ""; void n.offsetWidth;
      n.classList.add("qb-back"); delete n.dataset.qbBusy;
      var r = n.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) { burst(r.left + r.width / 2, r.top + r.height / 2, 12, { colors: ["#e8a33c", "#f5f1e6", "#469ca0"], v0: 50, v1: 130, g: 20 }); boing(); }
      setTimeout(function () { n.classList.remove("qb-back"); }, 700);
    }
    if (delay <= 0) restore(); else { n.classList.add("qb-gone"); setTimeout(restore, delay); }
  };
  Duck.prototype.releaseCarry = function (a, spring) {
    var n = a.el;
    n.style.transition = spring ? "translate .5s cubic-bezier(.3,1.7,.5,1)" : "none";
    n.style.translate = "0px 0px";
    setTimeout(function () { n.style.transition = ""; n.style.translate = ""; if (a.madePos) n.style.position = ""; n.style.zIndex = ""; delete n.dataset.qbBusy; }, spring ? 600 : 30);
  };
  Duck.prototype.updateAct = function (now, f) {
    var a = this.act, s = this.sz(), homeY = this.homeY();
    if (a.kind === "flit") {
      if (a.phase === "go") { if (this.stepTo(a.tx, a.ty, 3.2, f)) { a.phase = "hover"; a.t = now; this.flying = true; burst(this.x + s / 2, this.y + s / 2, 6, { colors: ["#f5f1e6", "#d6ceba"], v0: 20, v1: 60, g: 50 }); } }
      else if (a.phase === "hover") { this.moving = true; this.y += Math.sin(now / 90) * 0.6; if (now - a.t > 900) { a.phase = "home"; } }
      else if (a.phase === "home") { this.flying = true; if (this.stepTo(this.x, homeY, 3.2, f)) { this.act = null; this.mode = "walk"; this.nextThink = 0; } }
      return;
    }
    var n = a.el;
    if (!n.isConnected) { this.act = null; this.mode = "walk"; return; }
    var r = n.getBoundingClientRect();
    if ((r.bottom < 40 || r.top > innerHeight - 20) && a.phase !== "home" && a.phase !== "bites" && a.phase !== "gulp") { this.abortAct(true); return; }
    if (a.kind === "eat") {
      var ty = Math.min(innerHeight - s, Math.max(0, r.bottom - s * 0.75));
      if (a.phase === "go") {
        if (this.stepTo(r.left - s * 0.5, ty, 2.4, f)) {
          a.phase = "bites"; a.t = now; a.bite = 0; a.N = 6;
          a.nextBite = now + 200; n.classList.add("qb-eaten"); n.style.transition = "clip-path .12s steps(3)"; n.style.clipPath = bitePoly(0);
          this.dir = 1; this.say(pick(SAY.eat), 1800, true);
        }
      } else if (a.phase === "bites") {
        var prog = a.bite / a.N;
        this.x += (r.left + prog * r.width - s * 0.45 - this.x) * Math.min(1, 0.25 * f); this.y += (ty - this.y) * Math.min(1, 0.25 * f); this.dir = 1;
        this.sy = 1 - 0.1 * Math.abs(Math.sin(now / 55)); this.sx = 1 + 0.06 * Math.abs(Math.sin(now / 55));   // chewing
        if (now > a.nextBite) {
          a.bite++; var p = a.bite / a.N * 100, bx = r.left + a.bite / a.N * r.width, by = r.top + r.height / 2;
          n.style.clipPath = bitePoly(p);
          burst(bx, by, 9, { colors: ["#f5f1e6", "#e8a33c", "#d6ceba", "#469ca0"], size: [3, 7], ang: -Math.PI / 2, spread: 2.4, v0: 40, v1: 110, g: 90 });
          if (HAS_WAAPI) n.animate([{ transform: "none" }, { transform: "scale(.95) rotate(-1.2deg)" }, { transform: "none" }], { duration: 170 });
          this.squash(1.3, 0.75); crunch();
          if (a.bite % 2 === 1) popText(bx, r.top - 4, pick(["Nom", "Chomp", "Crunch", "Munch"]));
          a.nextBite = now + 300;
          if (a.bite >= a.N) { a.phase = "gulp"; a.t = now; }
        }
      } else if (a.phase === "gulp") {
        var k = (now - a.t) / 250;                       // belly puffs up, then BURP
        this.sx = 1 + 0.35 * Math.sin(Math.min(1, k) * Math.PI * 0.6); this.sy = this.sx; this.rot = Math.sin(now / 40) * 3 * (1 - Math.min(1, k));
        if (k >= 1) {
          a.phase = "home"; this.rot = 0; this.squash(0.7, 1.35); burpSound();
          burst(this.x + s * (this.dir > 0 ? 0.95 : 0.05), this.y + s * 0.4, 8, { colors: ["#bfe3a8", "#d7efc6"], size: [5, 9], ang: this.dir > 0 ? 0 : Math.PI, spread: 0.8, v0: 25, v1: 70, g: -15, t0: 600, t1: 900 });
          popText(this.x + s / 2, this.y - 6, "Burp!");
          this.finishEat(a, 0); this.say(pick(SAY.burp), 2200, true);
        }
      } else if (a.phase === "home") {
        if (this.stepTo(this.x, homeY, 2.4, f)) { this.act = null; this.mode = "walk"; this.nextThink = 0; }
      }
    } else {
      var right = r.right + 260 < innerWidth - s;
      if (a.phase === "go") {
        a.right = right;
        var gx = right ? r.right - s * 0.3 : r.left - s * 0.7, gy = Math.min(innerHeight - s, Math.max(0, r.bottom - s * 0.8));
        if (this.stepTo(gx, gy, 2.4, f)) {
          a.phase = "pull"; a.t = now; a.x0 = this.x; a.dist = rnd(110, 180);
          var pos = getComputedStyle(n).position;
          if (pos === "static") { n.style.position = "relative"; a.madePos = true; }
          n.style.zIndex = "30"; n.style.transition = "none";
          this.say(pick(SAY.carry), 1800, true); this.dir = a.right ? 1 : -1; this.squash(1.2, 0.8); crunch();
        }
      } else if (a.phase === "pull") {
        this.x += (a.right ? 1 : -1) * 2.4 * f; this.moving = true; this.dir = a.right ? 1 : -1;
        this.rot = (a.right ? 1 : -1) * 9;                 // leaning into the pull
        var off = this.x - a.x0;
        n.style.translate = Math.round(off) + "px 0px";
        if (this.tick % 14 === 0) burst(this.x + s / 2, this.y + s - 2, 2, { colors: ["#d9d4c4"], size: [3, 5], ang: a.right ? Math.PI : 0, spread: 0.5, v0: 15, v1: 40, g: -8 });
        if (Math.abs(off) > a.dist || this.x < 4 || this.x > innerWidth - s - 4) { a.phase = "hold"; a.t = now; this.rot = 0; this.say(pick(SAY.oops), 1800, true); this.squash(0.8, 1.25); }
      } else if (a.phase === "hold") {
        if (now - a.t > 600) { a.phase = "home"; this.releaseCarry(a, true); boing(); }
      } else if (a.phase === "home") {
        if (this.stepTo(this.x, homeY, 2.4, f)) { this.act = null; this.mode = "walk"; this.nextThink = 0; }
      }
    }
  };

  /* ----- main update ----- */
  Duck.prototype.update = function (now, f) {
    this.moving = false;
    var s = this.sz();
    // squash/stretch + rotation spring back to normal
    var k = Math.min(1, 0.2 * f);
    this.sx += (1 - this.sx) * k; this.sy += (1 - this.sy) * k;
    if (this.mode !== "fall" && this.mode !== "stunned" && this.mode !== "drag" && !(this.act && this.act.phase === "pull")) this.rot += (0 - this.rot) * k;

    if (this.mode === "walk") {
      if (!reduceMotion && now >= this.nextActAt) {
        if (this.startAct(now)) return this.render(true);
        this.nextActAt = now + 3000;
      }
      if (this.y !== this.homeY()) this.y += (this.homeY() - this.y) * Math.min(1, 0.15 * f);
      if (now > this.nextThink) {
        var r = Math.random();
        this.paused = r < 0.3;
        if (r > 0.78) this.dir *= -1;
        this.nextThink = now + 1200 + Math.random() * 2800;
        if (Math.random() < 0.18) this.say(pick(SAY.idle), 2600);
      }
      if (!this.paused && !reduceMotion) { this.x += this.dir * this.speed * f; this.moving = true; }
    } else if (this.mode === "act") {
      this.updateAct(now, f);
    } else if (this.mode === "leave") {
      var e = this.leaveEdge, tx = e === "left" ? -s - 20 : e === "right" ? innerWidth + 20 : this.x, ty = e === "top" ? -s - 20 : this.y - 30;
      var dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 9 * f);
      this.x += dx / d * m; this.y += dy / d * m; this.moving = true;
      if (d < 10) return this.finishHide();
    } else if (this.mode === "fall") {
      this.vy += 0.7 * f; this.y += this.vy * f; this.rot += (this.spin || 0) * f * 0.5;
      if (++this.fc % 5 === 0) burst(this.x + s / 2, this.y + s / 2, 1, { colors: ["#f5f1e6"], size: [3, 5], ang: -Math.PI / 2, spread: 1, v0: 10, v1: 30, g: -20 });
      var hy = this.homeY();
      if (this.y >= hy) {
        this.y = hy; this.rot = 0; this.spin = 0;
        if (!this.bounced) { this.bounced = true; this.vy = -this.vy * 0.3; this.squash(1.6, 0.45); this.dust(); thud(); }
        else { this.vy = 0; this.mode = "stunned"; this.stunUntil = now + 2300; this.wrap.classList.add("is-stunned"); this.squash(1.25, 0.75); thud(); this.say(pick(SAY.stunned), 2000, true); }
      }
    } else if (this.mode === "stunned") {
      this.rot = Math.sin(now / 130) * 11;
      if (this.tick++ % 22 === 0) burst(this.x + s / 2 + rnd(-14, 14), this.y + 4, 1, { colors: ["#e8a33c", "#f5f1e6"], size: [4, 6], ang: -Math.PI / 2, spread: 1.4, v0: 15, v1: 35, g: 10 });
      if (now > this.stunUntil) { this.wrap.classList.remove("is-stunned"); this.mode = "walk"; this.nextThink = 0; this.nextActAt = now + 12000; this.rot = 0; }
    } else if (this.mode === "drag") {
      this.rot = Math.sin(now / 120) * 9;
    }
    if (this.flying && this.mode !== "hidden") {
      if (++this.fc % 7 === 0) { burst(this.x + s / 2, this.y + s * 0.6, 2, { colors: ["#f5f1e6", "#d6ceba"], size: [3, 5], ang: Math.PI / 2, spread: 1.6, v0: 10, v1: 35, g: 60, t0: 600, t1: 900 }); flap(); }
    }
    if (this.mode !== "drag" && this.mode !== "hidden" && this.mode !== "leave") {
      if (this.x < 0) { this.x = 0; this.dir = 1; } else if (this.x > innerWidth - s) { this.x = innerWidth - s; this.dir = -1; }
    }
    if (this.mode !== "hidden") {
      if ((this.moving || this.flying) && ++this.tick % (this.flying ? 4 : 9) === 0) this.frame ^= 1;
      this.render(this.moving);
    }
  };
  Duck.prototype.render = function (moving) {
    var air = this.mode === "fall" || this.mode === "drag" || this.flying;
    var feet = air ? "jump" : moving ? (this.frame ? "walk2" : "walk1") : "walk1";
    var wing = this.flying ? (this.frame ? 1 : 2) : (this.mode === "fall" ? (this.frame ? 1 : 2) : 0);
    drawFrame(this.ctx, feet, this.dir < 0, wing);
    var bob = (moving && !air) ? -Math.abs(Math.sin(this.tick * 0.35)) * 2.5 : (this.flying ? Math.sin(this.tick * 0.8) * 2 : 0);
    this.wrap.style.transform = "translate(" + Math.round(this.x) + "px," + Math.round(this.y + bob) + "px)";
    this.canvas.style.transform = "rotate(" + this.rot.toFixed(1) + "deg) scale(" + this.sx.toFixed(3) + "," + this.sy.toFixed(3) + ")";
  };
  Duck.prototype.reflow = function () {
    var s = this.sz();
    if (this.mode === "hidden") return this.placePeek(true);
    this.x = Math.min(this.x, innerWidth - s);
    if (this.mode === "walk" || this.mode === "stunned") this.y = this.homeY(); else this.y = Math.min(this.y, innerHeight - s);
  };

  /* what he says while you scroll */
  function watchContent(duck) {
    if (!("IntersectionObserver" in window)) return;
    var seen = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || seen.has(en.target)) return;
        seen.add(en.target);
        var lines = en.target.__qbLines;
        if (lines && !duck.drag && (duck.mode === "walk" || duck.mode === "act")) duck.say(pick(lines), 3000, true);
      });
    }, { threshold: 0.25 });
    function scan() {
      Object.keys(SAY.scroll).forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (n) { if (!n.__qbLines) { n.__qbLines = SAY.scroll[sel]; io.observe(n); } });
      });
    }
    scan(); setTimeout(scan, 2500);
  }

  function startDuck() {
    if (!CONFIG.duck.enabled || !document.body) return;
    var main = new Duck(), ducks = [main], last = performance.now();

    function loop(now) {
      var f = Math.min(3, (now - last) / 16.67); last = now;
      main.update(now, f);
      for (var i = ducks.length - 1; i >= 1; i--) {
        var d = ducks[i];
        if (d.dead) { ducks.splice(i, 1); continue; }
        d.update(now, f);
        if (d.x <= 0 || d.x >= innerWidth - SIZE) d.remove();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    addEventListener("resize", function () { main.reflow(); });
    document.addEventListener("visibilitychange", function () { last = performance.now(); });

    setTimeout(function () { var first = !sessionStorage.getItem("qbDuckHello"); try { sessionStorage.setItem("qbDuckHello", "1"); } catch (_) {} main.say(first ? pick(SAY.hello) : "Quack! Back again?", 3200, true); }, 1800);
    watchContent(main);

    // Konami code -> duck parade (hidden easter egg)
    var CODE = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"], pos = 0;
    addEventListener("keydown", function (e) {
      var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var k = e.key; pos = (k === CODE[pos] || k.toLowerCase() === CODE[pos]) ? pos + 1 : (k === CODE[0] ? 1 : 0);
      if (pos === CODE.length) {
        pos = 0; chime(); main.say("DUCK PARADE!", 3000, true);
        for (var i = 0; i < 12; i++) (function (i) {
          setTimeout(function () { var d = new ParadeDuck(); ducks.push(d); if (i % 3 === 0) quackSound(); }, i * 180);
        })(i);
      }
    });
  }

  function ParadeDuck() {
    this.wrap = el("div", "qb-duck qb-duck-parade");
    this.canvas = el("canvas"); this.canvas.width = this.canvas.height = SIZE;
    this.wrap.appendChild(this.canvas); this.ctx = this.canvas.getContext("2d");
    this.x = 1; this.dir = 1; this.speed = 2 + Math.random() * 2; this.tick = 0; this.frame = 0;
    this.wrap.style.top = "auto"; this.wrap.style.bottom = (6 + Math.random() * 30) + "px";
    document.body.appendChild(this.wrap);
  }
  ParadeDuck.prototype.update = function (now, f) {
    this.x += this.speed * f; if (++this.tick % 9 === 0) this.frame ^= 1;
    drawFrame(this.ctx, this.frame ? "walk2" : "walk1", false, 0);
    this.wrap.style.transform = "translate(" + Math.round(this.x) + "px,0)";
  };
  ParadeDuck.prototype.remove = function () { this.wrap.remove(); this.dead = true; };

  /* ================= 2. PLAY IN BROWSER ================= */
  function addPlayButtons() {
    var cards = document.querySelectorAll("a.qb-game[href*='itch.io/']");
    Array.prototype.forEach.call(cards, function (a) {
      var btn = el("span", "qb-play", "▶");   // small icon; the whole card already links to the itch.io page
      btn.setAttribute("aria-hidden", "true");
      btn.title = "Play on itch.io";
      a.appendChild(btn);
    });
  }

  /* ============ 3a. TEAM — CHARACTER SELECT ============ */
  function enhanceTeam() {
    var items = document.querySelectorAll(".section.team .team-item");
    Array.prototype.forEach.call(items, function (item) {
      var nameEl = item.querySelector(".name span");
      var name = nameEl && nameEl.textContent.trim();
      var data = CONFIG.team[name];
      if (!data) return;
      item.classList.add("qb-char");
      var bars = Object.keys(data.stats).map(function (k) {
        var v = data.stats[k];
        return '<div class="qb-stat"><span>' + k + '</span><i><b style="--v:' + v + '%"></b></i><em>' + v + "</em></div>";
      }).join("");
      var card = el("div", "qb-char-card",
        '<div class="qb-char-top"><span class="qb-char-player">' + data.player + '</span><span class="qb-char-class">Class: ' + data.cls + "</span></div>" +
        bars + '<div class="qb-char-special">★ ' + data.special + "</div>");
      var img = item.querySelector(".image");
      (img || item).appendChild(card);
      var badge = el("span", "qb-char-select", "PRESS TO SELECT");
      (img || item).appendChild(badge);
      item.setAttribute("tabindex", "0");
      function toggle(e) {
        if (e && e.target.closest("a")) return; // keep social links working
        var on = !item.classList.contains("is-selected");
        Array.prototype.forEach.call(items, function (o) { o.classList.remove("is-selected"); });
        if (on) { item.classList.add("is-selected"); item.classList.remove("qb-off"); chime(); }
        else { item.classList.add("qb-off"); item.blur(); }   // back to the image, even while the mouse is still over it
      }
      item.addEventListener("mouseleave", function () { item.classList.remove("qb-off"); });
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", function (e) { if (e.key === "Enter") toggle(e); });
    });
  }

  /* ============ 3b. AWARDS — ACHIEVEMENTS ============ */
  function enhanceAwards() {
    var imgs = document.querySelectorAll(".section.clients .clients-item img[alt]");
    var list = [];
    Array.prototype.forEach.call(imgs, function (img) {
      var alt = img.getAttribute("alt");
      if (!alt) return;
      var parts = alt.split(" – "); // "Winner – Best Narrative, Miracle Akademi"
      var rank = parts[0], rest = (parts[1] || "").split(", ");
      var item = img.closest(".clients-item");
      item.classList.add("qb-ach");
      var a = item.querySelector("a[href='#']");
      if (a) { a.removeAttribute("href"); a.setAttribute("tabindex", "0"); }
      var tip = el("div", "qb-ach-tip",
        '<span class="qb-ach-icon">🏆</span><span><small>Achievement · ' + rank + "</small><strong>" + rest[0] + "</strong><em>" + (rest.slice(1).join(", ") || "") + "</em></span>");
      item.appendChild(tip);
      list.push({ rank: rank, title: rest[0], by: rest.slice(1).join(", ") });
    });
    if (!list.length) return;

    // Achievement toasts once when the awards scroll into view (once per session)
    var section = document.querySelector(".section.clients");
    if (!("IntersectionObserver" in window) || sessionStorage.getItem("qb-ach-shown")) return;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      sessionStorage.setItem("qb-ach-shown", "1");
      var stack = el("div", "qb-toasts");
      document.body.appendChild(stack);
      var shown = list.slice(0, 3);
      shown.forEach(function (a, i) {
        setTimeout(function () {
          var t = el("div", "qb-toast",
            '<span class="qb-ach-icon">🏆</span><span><small>Achievement unlocked</small><strong>' + a.rank + ": " + a.title + "</strong></span>");
          stack.appendChild(t);
          if (i === 0) chime();
          setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 400); }, 3200);
        }, i * 700);
      });
      if (list.length > 3) setTimeout(function () {
        var t = el("div", "qb-toast qb-toast-more", "<span>+" + (list.length - 3) + " more achievements · hover the laurels</span>");
        stack.appendChild(t);
        setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); stack.remove(); }, 400); }, 3200);
      }, 3 * 700);
    }, { threshold: 0.35 });
    io.observe(section);
  }

  /* ======================= BOOT ======================= */
  function boot() {
    startDuck();
    if (/^\/portfolio\/?/.test(path)) addPlayButtons();
    if (/^\/about-us\/?/.test(path)) { enhanceTeam(); enhanceAwards(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
