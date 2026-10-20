/*
 * Quackle.bit — interactive extras
 *  1. Silly duck (all pages): wanders, talks, eats/drags bits of the page (always restored).
 *     Click = he hides (long neck peeks from an edge), click the head = he falls back in.
 *     Drag = reposition. Konami code = duck parade.
 *  2. Portfolio: small ▶ icon on game cards (the card links to the game on itch.io).
 *  3. About: team "character select" stats, awards as achievements.
 * Edit the CONFIG block below to change stats; the duck's lines live in SAY (section 1). Remove the <script> tag to disable everything.
 */
(function () {
  "use strict";

  /* ======================= CONFIG ======================= */
  var CONFIG = {
    duck: {
      enabled: true,
      // Optional real quack recording. Put the file in wp-content/uploads/qb-duck/ and set its name here
      // (e.g. "quack.mp3"). Leave "" to use the built-in synthesized quack.
      quackFile: "quack.mp3",
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

  var audio, master, dry;

  /* ======================= 1. DUCK ======================= */
  /* A silly guide duck. He wanders and talks on his own, comments on content as you scroll,
     flies short hops, and sometimes bites a piece of the page or drags it around (always put back).
     You can: click him -> he flaps off and hides (only a long neck + head peek in from a screen edge),
              click the peeking head -> he tumbles in from the sky, gets stunned, then walks again,
              drag him (mouse or finger) -> reposition him. */
  /* Sprite art (exported from art/duck/*.aseprite): wp-content/uploads/qb-duck/duck.png is a strip of
     26x26 frames, peek.png is the 16x20 head+neck. Durations are in ms, straight from the Aseprite tags. */
  var ART = "/wp-content/uploads/qb-duck/";
  var FR = 26, PW = 16, PH = 20;
  var TAGS = {
    idle: { from: 0, d: [400, 300, 400, 300] },
    sleepy: { from: 4, d: [300, 200, 200, 300] },
    walk: { from: 8, d: [100, 100] },
    jump: { from: 10, d: [100] },
    fly: { from: 11, d: [100, 100] },
    eat: { from: 13, d: [100, 100] },
    gulp: { from: 15, d: [200] },
    burp: { from: 16, d: [300] },
    stunned: { from: 17, d: [200, 200, 200, 200, 200] },
    land: { from: 22, d: [100] },
    fall: { from: 23, d: [100, 100] },
  };
  var SHEET = new Image(); SHEET.src = ART + "duck.png";
  var PEEKIMG = new Image(); PEEKIMG.src = ART + "peek.png";
  function scl() { return innerWidth <= 767 ? 2.5 : 3; }             // CSS pixels per sprite pixel
  function dsz() { return FR * scl(); }
  function peekW() { return PW * scl(); }
  function peekH() { return PH * scl(); }
  function setScale() { document.documentElement.style.setProperty("--qb-px", scl() + "px"); }
  function frameAt(tag, t) {                                         // looping tag -> frame index at time t
    var T = TAGS[tag], total = 0, i;
    for (i = 0; i < T.d.length; i++) total += T.d[i];
    var m = t % total;
    for (i = 0; i < T.d.length; i++) { if (m < T.d[i]) return T.from + i; m -= T.d[i]; }
    return T.from;
  }
  function drawFrame(ctx, idx, flip) {
    ctx.clearRect(0, 0, FR, FR);
    if (!SHEET.complete || !SHEET.naturalWidth) return;
    if (flip) { ctx.save(); ctx.translate(FR, 0); ctx.scale(-1, 1); }
    ctx.drawImage(SHEET, idx * FR, 0, FR, FR, 0, 0, FR, FR);
    if (flip) ctx.restore();
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
  /* ---------- sound (Web Audio, no files): soft, short and quiet; he is a side character ---------- */
  var VOL = 1;                                  // master volume for every duck sound (0 = mute, 1 = loud)
  function actx() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      var lp = audio.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;   // rounds off any harshness
      master = audio.createGain(); master.gain.value = VOL;
      master.connect(lp); lp.connect(audio.destination);
      dry = audio.createGain(); dry.gain.value = VOL; dry.connect(audio.destination);   // samples skip the dulling filter
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }
  function jit(v, amt) { return v * (1 + (Math.random() * 2 - 1) * amt); }      // tiny random pitch so repeats never sound identical
  // a soft blip: quick fade in, smooth fade out, optional pitch glide
  function blip(type, f0, f1, dur, vol, delay) {
    try {
      var c = actx(), t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(0.012, dur / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  // soft breath/rustle: filtered noise with a gentle swell instead of a hard click
  function puff(dur, f0, f1, vol, delay) {
    try {
      var c = actx(), t = c.currentTime + (delay || 0), len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) { var k = i / len; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k); }
      var src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; fl.type = "lowpass"; fl.Q.value = 0.7; fl.frequency.setValueAtTime(f0, t);
      if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.value = vol; src.connect(fl); fl.connect(g); g.connect(master); src.start(t);
    } catch (e) {}
  }
  // A duck quack: a buzzy sawtooth that drops in pitch, squeezed through nasal "formant" filters and
  // wobbled by a fast tremolo (that is the raspy "qua-ck"). n = how many quacks in a row.
  function quackOne(delay, pitch) {
    try {
      var c = actx(), t = c.currentTime + (delay || 0), dur = 0.2, f = jit(pitch || 430, 0.07);
      var o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), am = c.createGain(), env = c.createGain();
      var lfo = c.createOscillator(), lg = c.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.62, t + dur);
      f1.type = "bandpass"; f1.frequency.value = 950; f1.Q.value = 2.2;           // nasal "waa"
      f2.type = "peaking"; f2.frequency.value = 2300; f2.gain.value = 7; f2.Q.value = 3;   // bite
      am.gain.value = 0.62; lfo.type = "square"; lfo.frequency.value = 52; lg.gain.value = 0.38;   // raspy tremolo
      lfo.connect(lg); lg.connect(am.gain);
      env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.36, t + 0.014);
      env.gain.linearRampToValueAtTime(0.29, t + dur * 0.62); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // short sustain, then a quick drop
      o.connect(f1); f1.connect(f2); f2.connect(am); am.connect(env); env.connect(master);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.03); lfo.stop(t + dur + 0.03);
    } catch (e) {}
  }
  var quackBuf = null, quackState = 0;                   // 0 = not requested, 1 = loading, 2 = ready, 3 = failed
  function loadQuack() {                                  // decoded offline, so no AudioContext is needed before the first click
    var file = CONFIG.duck.quackFile;
    if (!file || quackState) return;
    quackState = 1;
    try {
      var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, c = new OC(1, 1, 44100);
      fetch(ART + file).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (ok, no) { var p = c.decodeAudioData(b, ok, no); if (p && p.catch) p.catch(no); }); })
        .then(function (buf) { quackBuf = buf; quackState = 2; })
        .catch(function () { quackState = 3; });
    } catch (e) { quackState = 3; }
  }
  var QUACK_RATE = [1.2, 1.65];                           // every quack is played this much faster/higher, picked at random
  function quackSample(delay) {
    try {
      var c = actx(), t = c.currentTime + (delay || 0), s = c.createBufferSource(), g = c.createGain();
      var rate = QUACK_RATE[0] + Math.random() * (QUACK_RATE[1] - QUACK_RATE[0]), len = Math.min(quackBuf.duration / rate, 0.7);
      s.buffer = quackBuf; s.playbackRate.value = rate;
      g.gain.setValueAtTime(0.3, t); g.gain.setValueAtTime(0.3, t + len * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + len);   // soft tail, no click
      s.connect(g); g.connect(dry); s.start(t); s.stop(t + len + 0.02);
    } catch (e) {}
  }
  function quackSound(n, pitch) {
    loadQuack();
    for (var i = 0; i < (n || 1); i++) {
      if (quackState === 2) quackSample(i * 0.27);
      else quackOne(i * 0.21, (pitch || 430) * (1 - i * 0.06));
    }
  }
  function chime() { [660, 880, 1320].forEach(function (f, i) { blip("sine", f, f, 0.24, 0.05, i * 0.08); }); }
  function crunch() { puff(0.08, jit(900, 0.2), 380, 0.13); blip("sine", jit(230, 0.12), 130, 0.08, 0.1); }   // a soft little nom
  function whoosh() { puff(0.34, 300, 1500, 0.16); }
  function thud() { blip("sine", jit(120, 0.08), 48, 0.18, 0.22); puff(0.07, 500, 200, 0.07); }
  function boing() { var f = jit(300, 0.1); blip("sine", f, f * 1.9, 0.18, 0.08); blip("sine", f * 1.9, f * 1.5, 0.13, 0.045, 0.1); }
  function burpSound() { blip("triangle", 125, 68, 0.32, 0.11); blip("sine", 380, 560, 0.08, 0.05, 0.22); }
  function flap() { puff(0.06, 650, 350, 0.08); }
  function bloop() { blip("sine", jit(420, 0.06), 760, 0.1, 0.07); }

  /* ---------- who he is ----------
     The Quackle.bit studio duck. Self-appointed "Head of Quality Quacking": he "tests" everything by
     eating it, sitting on it or dragging it somewhere. Proud, food-driven, a little dramatic, never mean.
     Knows the studio by heart (Bandung roots, Tokyo base, two founders, six games) and takes it personally
     that Bloomtales has a "Duck Stomp" level. Is a duck. Not a goose. Keep lines short: one breath, one joke. */
  var SAY = {
    hello: ["Quack! Welcome to Quackle.bit.", "Oh! A visitor. Act natural.", "Hi! I'm the studio duck. Unpaid.", "Welcome! Mind the pixels."],
    helloBack: ["Quack! You're back!", "Oh hey, it's you again!", "Welcome back. I kept your spot warm."],
    idle: ["Stories told in pixels. I'm one of them.", "I'm in charge of quality quacking.", "Every pixel here is placed by hand.", "I am a duck. Not a goose. Please.",
      "Psst... try the Konami code.", "Small studio. Big heart. One duck.", "I playtest everything. By sitting on it.", "Bandung to Tokyo. I flew, obviously.",
      "Drag me somewhere with a view."],
    night: ["It's late. Even pixels sleep.", "Shh... the devs are resting.", "Night owl? I'm a night duck."],
    stunned: ["x_x", "Who put the floor there?", "I meant to do that.", "Seeing stars... pixel ones."],
    drag: ["Whee!", "Hey, I'm walking here!", "Careful, I'm handmade!", "Ooh, a new view!"],
    drop: ["Okay. I live here now.", "Nice spot. Five stars.", "Thanks... I think."],
    eat: ["Quality check! Nom.", "Tastes like pixels.", "Hmm, needs more story.", "Nom nom. Very heartfelt."],
    burp: ["*BURP* ...pardon me.", "Okay, you can have it back.", "Approved. Mostly."],
    carry: ["Just tidying the layout!", "Redesign time!", "This goes... over here.", "Art direction, duck style!"],
    oops: ["Oops!", "Heavy!", "Fine, back it goes."],
    flit: ["Wheee!", "Windy up here! Very Anotherland.", "Flap flap!", "Beep beep, coming through!"],
    chase: ["Ooh, what's that?", "Shiny cursor!", "Is it food?!", "Wait for me!"],
    caught: ["Gotcha!", "Mine now!", "Hehe, caught it!", "Quack! Victory!"],
    slip: ["Whoa!", "Waaah!", "Wait wai-", "Oops-"],
    themeLight: ["Bright!", "My eyes!", "Good morning, pixels!", "Ooh, shiny."],
    themeDark: ["Lights out...", "Cozy mode.", "Ahh, night mode.", "zzz... just kidding."],
    scroll: {
      ".team-item": ["Meet the humans!", "These two make the magic. I supervise."],
      ".clients-item": ["Shiny awards! Can I eat one?", "Look at all these awards!"],
      ".qb-journey": ["Our journey! I'm somewhere around 2024.", "From a tiger to the sky. What a trip."],
      ".press-coverage-card": ["We made the news!", "Famous studio. Famous duck. Probably."],
      ".press-kit-facts": ["Fun facts! I know them all."],
      ".press-kit-projects": ["All six games in one place!"],
      ".press-kit-socials": ["Follow us! Quack."],
      ".footer": ["The end! Thanks for scrolling.", "Nothing down here but me."],
      "h1": ["Big title! Very important."],
      "h2": ["Ooh, a new section.", "Keep going!"],
      ".qb-featured-label": ["That's our newest game! It's windy."],
      ".gallery img, .portfolio img, .elementor-shortcode img": ["Pretty pixels!", "I'd eat that one. Hm."],
      // after the generic image line, so this one wins when both come into view together
      ".qb-item[data-name='Duck Stomp Level']": ["Duck STOMP level?! Excuse me?", "I'm filing a complaint about this one."],
      ".meeek-bio-links-inner-container": ["Click one! They're all good links."],
      ".title_inner": ["Ooh, a new section.", "Keep scrolling!"],
    },
  };
  /* page-specific lines, mixed in with the general ones */
  var PAGE = /^\/about-us/.test(path) ? "about" : /^\/portfolio/.test(path) ? "portfolio" : /^\/press-kit/.test(path) ? "press" : /^\/social/.test(path) ? "social" : "home";
  var PAGE_SAY = {
    home: { hello: ["Welcome to Quackle.bit! I'm the duck.", "Hi! Stories told in pixels. And quacks."],
      idle: ["Anotherland Above! Hit 'Play here'!", "That button plays a game. Go on.", "Quirky little indie studio. I'm the quirk."] },
    about: { hello: ["This is us! Well, them. And me.", "About us? Ask the duck."],
      idle: ["Founded in 2024. I hatched shortly after.", "Two founders. One duck. Zero geese.", "Bandung roots, Tokyo vibes.", "Pixel art, stories, worlds. And quacking."] },
    portfolio: { hello: ["Our games! I playtested all of them.", "Welcome to the gallery! Touch nothing."],
      idle: ["Use the tags to filter. Very fancy.", "Click a picture for a closer look!", "Jagatwana has a tiger. I keep my distance.", "Bayao dives. I just float.",
        "Aftermarket: one night to live. Relatable.", "Bloomtales has a Duck Stomp level. Rude."] },
    press: { hello: ["Press? Quick, get my good side.", "Journalists! Act natural."],
      idle: ["Team size: 2 people. Plus one duck.", "Need logos? Scroll down!", "Quote me on this: 'Quack.'"] },
    social: { hello: ["Come find us everywhere!", "Follow us! I'm on all of them. Sort of."],
      idle: ["Itch.io has our games. Go play!", "Say hi on Bluesky!", "Email us! I don't read it. They do."] },
  };
  function talk(key) {                         // a line for this moment: page-specific, late-night, or general
    var pg = PAGE_SAY[PAGE], h = new Date().getHours();
    if (key === "idle" && (h >= 23 || h < 5) && Math.random() < 0.3) return pick(SAY.night);
    if (pg && pg[key] && Math.random() < 0.6) return pick(pg[key]);
    return pick(SAY[key]);
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function bitePoly(p) {   // jagged "bitten" left edge, p = % eaten from the left
    var q = function (v) { return Math.min(100, v) + "%"; };
    return "polygon(" + q(p) + " 0%,100% 0%,100% 100%," + q(p) + " 100%," + q(p + 3) + " 85%," + q(p) + " 70%," + q(p + 3) + " 55%," + q(p) + " 40%," + q(p + 3) + " 25%," + q(p) + " 10%)";
  }

  function Duck() {
    var self = this;
    this.size = dsz();
    this.wrap = el("div", "qb-duck");
    this.canvas = el("canvas"); this.canvas.width = this.canvas.height = FR;
    this.bubble = el("div", "qb-duck-bubble");
    this.bubble.setAttribute("role", "status"); this.bubble.setAttribute("aria-live", "polite");
    this.stars = el("div", "qb-duck-stars", "★ ✦ ★");
    this.wrap.appendChild(this.bubble); this.wrap.appendChild(this.stars); this.wrap.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.peek = el("div", "qb-peek");
    this.pcanvas = el("canvas"); this.pcanvas.width = PW; this.pcanvas.height = PH;
    this.peek.appendChild(this.pcanvas);
    var pctx = this.pcanvas.getContext("2d");
    this.drawPeek = function (blink) {
      pctx.clearRect(0, 0, PW, PH);
      if (!PEEKIMG.complete || !PEEKIMG.naturalWidth) return;
      pctx.drawImage(PEEKIMG, 0, 0);
      if (blink) { pctx.fillStyle = "#d6ceba"; pctx.fillRect(8, 2, 1, 1); }          // upper eye pixel -> the eye shuts
    };
    this.drawPeek(false); PEEKIMG.addEventListener("load", function () { self.drawPeek(false); });
    this.peek.addEventListener("pointerenter", function () {                       // curious: leans out a bit when hovered
      self.curious = true; if (self.mode === "hidden" && !self.drag) self.placePeek(true);
      var t = performance.now(); if (self.mode === "hidden" && t - self.lastBloop > 1500) { self.lastBloop = t; bloop(); }
    });
    this.peek.addEventListener("pointerleave", function () { self.curious = false; if (self.mode === "hidden" && !self.drag) self.placePeek(true); });
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
    this.landUntil = 0; this.burpUntil = 0; this.idleSince = 0; this.talkUntil = 0;
    this.hoverT0 = 0; this.lastNear = 0; this.revs = 0; this.px = 0; this.lastSg = 0; this.chaseCooldown = 0;
    this.mx = 0; this.my = 0; this.mt = 0; this.lookv = 0; this.lastFace = 0; this.moodUntil = 0; this.moodPose = "idle";
    this.dist = 0; this.lx = this.x; this.shown = this.dir; this.turnT0 = 0; this.curious = false; this.nextBlink = 0; this.blinkEnd = 0; this.lastBloop = 0;
    this.render(false);
  }
  Duck.prototype.sz = function () { return this.wrap.offsetWidth || dsz(); };
  Duck.prototype.homeY = function () { return Math.max(0, innerHeight - this.sz() - this.lane); };
  Duck.prototype.say = function (text, ms, force) {
    var now = performance.now();
    if (this.mode === "hidden" || this.mode === "fall" || this.mode === "leave") return;
    if (!force && now - this.lastSay < 5000) return;
    this.lastSay = now;
    var b = this.bubble, s = this.sz();
    b.textContent = text; b.classList.add("show");
    this.talkUntil = now + Math.min(ms || 2600, 500 + text.length * 40);
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
    this.flying = false; this.landUntil = performance.now() + 180; this.squash(1.4, 0.6); this.dust(); thud();
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
    var s = this.sz(), cx = this.x + s / 2;
    burst(cx, this.y + s / 2, 8, { colors: ["#f5f1e6", "#d6ceba", "#e8a33c"], v0: 40, v1: 100, g: 30 });
    popText(cx, this.y, "Eek!");
    quackSound(); whoosh();
    // flap off toward the nearest side (sometimes straight up), then only the head peeks back in
    this.leaveEdge = (this.y < innerHeight * 0.3 || Math.random() < 0.2) ? "top" : (cx < innerWidth / 2 ? "left" : "right");
    if (this.leaveEdge !== "top") this.dir = this.leaveEdge === "left" ? -1 : 1;
    this.leaveY = Math.max(0, this.y - 40); this.leaveT0 = performance.now();
    this.mode = "leave"; this.flying = true; this.bubble.classList.remove("show"); this.wrap.classList.remove("is-stunned", "is-dragging");
    this.squash(0.8, 1.25);
  };
  Duck.prototype.finishHide = function () {
    var s = this.sz(), pw = peekW(), e = this.leaveEdge;
    this.mode = "hidden"; this.flying = false;
    this.wrap.style.display = "none";
    this.edge = e;
    this.edgePos = e === "top" ? Math.min(0.9, Math.max(0.1, this.x / Math.max(1, innerWidth - pw))) : Math.min(0.9, Math.max(0.1, (this.y + s / 2 - pw / 2) / Math.max(1, innerHeight - pw)));
    this.peek.style.display = "block"; this.placePeek(false); this.drawPeek(false);
    var self = this; requestAnimationFrame(function () { requestAnimationFrame(function () { self.placePeek(true); bloop(); }); });
    this.scheduleRelocate();
  };
  Duck.prototype.peekXY = function (shown) {
    var horiz = this.edge === "left" || this.edge === "right";
    var PH_ = peekH(), PW_ = peekW(), w = horiz ? PH_ : PW_, h = horiz ? PW_ : PH_;
    var off = shown ? Math.round(PH_ * (this.curious ? 0.86 : 0.72)) : 0, x, y, along = this.edgePos;
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
    var pw = peekW(), span = horiz ? innerHeight - pw : innerWidth - pw;
    this.edgePos = Math.min(1, Math.max(0, ((horiz ? py : px) - pw / 2) / span));
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
    if (!list.length) { this.say("Nothing tasty here. Quality approved.", 2200, true); return false; }
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
    if (a.kind === "chase") {
      var cx = Math.min(Math.max(this.mx - s / 2, 0), innerWidth - s), cy = Math.min(Math.max(this.my - s * 0.55, 0), innerHeight - s);
      if (a.phase === "go") {
        if (now - a.t > 6000) { a.phase = "home"; return; }
        if (++this.fc % 6 === 0) {                           // juice: dust kicked up behind him, or air streaks when flying
          var ft = this.feet();
          burst(ft.x - this.dir * 10, this.flying ? this.y + s * 0.6 : ft.y - 4, this.flying ? 2 : 3, { colors: ["#d9d4c4", "#f5f1e6"], size: [3, 5], ang: this.dir > 0 ? Math.PI : 0, spread: 0.7, v0: 15, v1: 45, g: this.flying ? 0 : -8, t0: 300, t1: 520 });
        }
        if (Math.hypot(cx - this.x, cy - this.y) < 6 || this.stepTo(cx, cy, 2.0, f)) {
          if (Math.random() < 0.5) {                         // caught it!
            a.phase = "catch"; a.t = now; this.flying = true; this.squash(1.35, 0.7); boing(); quackSound(1);
            burst(this.x + s / 2, this.y + s / 2, 14, { colors: ["#e8a33c", "#f5f1e6", "#469ca0"], size: [3, 7], v0: 50, v1: 130, g: 40 });
            popText(this.x + s / 2, this.y - 4, "Gotcha!", "#e8a33c"); this.say(pick(SAY.caught), 1700, true);
          } else {                                           // ...or trips over his own feet
            popText(this.x + s / 2, this.y - 4, "Whoa!", "#e8a33c"); this.say(pick(SAY.slip), 1400, true);
            this.act = null; this.flying = false; this.mode = "fall"; this.bounced = false; this.fc = 0;
            this.vy = -7; this.spin = (this.dir > 0 ? 1 : -1) * rnd(16, 26); this.squash(1.3, 0.75);
            blip("sine", 720, 190, 0.32, 0.07); whoosh();   // slide-whistle slip
          }
        }
      } else if (a.phase === "catch") {
        this.moving = true; this.y += Math.sin(now / 70) * 0.9; this.rot = Math.sin(now / 90) * 8;    // victory wiggle
        if (this.tick % 9 === 0) burst(this.x + s / 2 + rnd(-14, 14), this.y + 6, 1, { colors: ["#e8a33c", "#f5f1e6"], size: [3, 5], ang: -Math.PI / 2, spread: 1.6, v0: 20, v1: 45, g: 30 });
        if (now - a.t > 900) { a.phase = "home"; this.rot = 0; }
      } else if (a.phase === "home") {
        this.flying = true; if (this.stepTo(this.x, homeY, 3.2, f)) { this.act = null; this.mode = "walk"; this.nextThink = 0; }
      }
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
          a.phase = "home"; this.rot = 0; this.burpUntil = now + 450; this.squash(0.7, 1.35); burpSound();
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
    if (this.mode === "hidden") this.peekTick(now);
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
        if (Math.random() < 0.18) this.say(talk("idle"), 2600); else if (Math.random() < 0.07) this.quack(now);
      }
      if (!this.paused && !reduceMotion) { this.x += this.dir * this.speed * f; this.moving = true; }
      if (this.paused && !this.moving && !reduceMotion) this.look(now); else this.lookv *= 0.85;
      this.checkInterest(now);
    } else if (this.mode === "act") {
      this.updateAct(now, f); this.lookv *= 0.85;
    } else if (this.mode === "leave") {
      var e = this.leaveEdge, tx = e === "left" ? -s - 20 : e === "right" ? innerWidth + 20 : this.x, ty = e === "top" ? -s - 20 : this.leaveY;
      var dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 9 * f);
      this.x += dx / d * m; this.y += dy / d * m; this.moving = true;
      if (d < 10 || now - this.leaveT0 > 2600) return this.finishHide();
    } else if (this.mode === "fall") {
      this.vy += 0.7 * f; this.y += this.vy * f; this.rot += (this.spin || 0) * f * 0.5;
      if (++this.fc % 5 === 0) burst(this.x + s / 2, this.y + s / 2, 1, { colors: ["#f5f1e6"], size: [3, 5], ang: -Math.PI / 2, spread: 1, v0: 10, v1: 30, g: -20 });
      var hy = this.homeY();
      if (this.y >= hy) {
        this.y = hy; this.rot = 0; this.spin = 0;
        if (!this.bounced) { this.bounced = true; this.landUntil = now + 180; this.vy = -this.vy * 0.3; this.squash(1.6, 0.45); this.dust(); thud(); }
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
      if (this.moving || this.flying) this.tick++;
      this.render(this.moving);
    }
  };
  Duck.prototype.pose = function (moving, now) {
    var a = this.act;
    if (this.mode === "fall") return "fall";
    if (this.mode === "stunned") return "stunned";
    if (this.mode === "drag") return "jump";
    if (this.flying) return "fly";
    if (now < this.moodUntil && this.mode === "walk") return this.moodPose;
    if (now < this.burpUntil) return "burp";
    if (a && a.kind === "eat" && a.phase === "bites") return "eat";
    if (a && a.kind === "eat" && a.phase === "gulp") return "gulp";
    if (now < this.landUntil) return "land";
    if (moving) return "walk";
    return this.idleSince && now - this.idleSince > 3500 ? "sleepy" : "idle";
  };
  /* curiosity: the cursor wiggling back and forth near him for ~1.5s sometimes makes him run after it */
  Duck.prototype.noteMove = function (x, y, now) {
    var s = this.sz(), near = Math.hypot(x - (this.x + s / 2), y - (this.y + s / 2)) < 280;
    if (!near) { this.hoverT0 = 0; this.revs = 0; this.lastSg = 0; return; }
    if (!this.hoverT0 || now - this.lastNear > 700) { this.hoverT0 = now; this.revs = 0; this.lastSg = 0; this.px = x; }   // lost it for a moment: start over
    this.lastNear = now;
    var dx = x - this.px;
    if (Math.abs(dx) > 4) { var sg = dx > 0 ? 1 : -1; if (this.lastSg && sg !== this.lastSg) this.revs++; this.lastSg = sg; this.px = x; }
  };
  Duck.prototype.checkInterest = function (now) {
    if (reduceMotion || this.drag || !this.hoverT0 || now < this.chaseCooldown) return;
    if (now - this.lastNear > 700) { this.hoverT0 = 0; return; }              // the cursor stopped or left
    if (now - this.hoverT0 < 500 || this.revs < 2) return;                    // needs ~0.5s of back-and-forth
    this.hoverT0 = 0; this.revs = 0;
    if (Math.random() < 0.5) this.startChase(now); else this.chaseCooldown = now + 3000;   // "sometimes"
  };
  Duck.prototype.startChase = function (now) {
    this.act = { kind: "chase", phase: "go", t: now };
    this.mode = "act"; this.nextActAt = now + 12000; this.chaseCooldown = now + 8000;
    this.say(pick(SAY.chase), 1500, true);
    this.squash(0.8, 1.3); bloop(); popText(this.x + this.sz() / 2, this.y, "!", "#e8a33c");
    burst(this.x + this.sz() / 2, this.y + this.sz() * 0.8, 6, { colors: ["#d9d4c4", "#f5f1e6"], size: [3, 6], ang: Math.PI * 1.5, spread: 1.2, v0: 25, v1: 60, g: 20 });
  };
  Duck.prototype.look = function (now) {        // standing around: face the cursor and lean a little toward it
    var tgt = 0, s = this.sz();
    if (this.mt && now - this.mt < 4000) {
      var dx = this.mx - (this.x + s / 2), dy = this.my - (this.y + s / 2);
      if (Math.abs(dx) < 420 && Math.abs(dy) < 320) {
        tgt = Math.max(-1, Math.min(1, dx / 140));
        var nd = dx > 0 ? 1 : -1;
        if (Math.abs(dx) > 40 && nd !== this.dir && now - this.lastFace > 1400) { this.dir = nd; this.lastFace = now; }
      }
    }
    this.lookv += (tgt - this.lookv) * 0.15;
  };
  Duck.prototype.reactTheme = function (light) {   // the light/dark switch: bright -> a startled hop, dark -> a sleepy yawn
    if (this.mode !== "walk" || this.drag) return;
    var now = performance.now();
    this.paused = true; this.nextThink = now + 1900; this.nextActAt = Math.max(this.nextActAt, now + 3000);
    if (light) { this.moodPose = "jump"; this.moodUntil = now + 420; this.squash(0.85, 1.25); bloop(); this.say(pick(SAY.themeLight), 1800, true); }
    else { this.moodPose = "sleepy"; this.moodUntil = now + 1800; this.squash(1.12, 0.9); blip("sine", 300, 170, 0.3, 0.06); this.say(pick(SAY.themeDark), 2000, true); }
  };
  Duck.prototype.quack = function (now) {      // rare and quiet: one or two little quacks, a hop and a tiny "quack"
    if (this.mode !== "walk" || this.drag) return;
    var n = Math.random() < 0.35 ? 2 : 1;
    quackSound(n); this.squash(1.1, 0.92); this.talkUntil = now + 220 * n + 160;
    popText(this.x + this.sz() / 2, this.y + 4, n > 1 ? "quack quack" : "quack", "#e8a33c");
  };
  Duck.prototype.peekTick = function (now) {   // while only his head shows: an occasional blink (sometimes two)
    if (!this.nextBlink) this.nextBlink = now + rnd(1500, 3500);
    if (this.blinkEnd && now > this.blinkEnd) { this.blinkEnd = 0; this.drawPeek(false); }
    if (now > this.nextBlink && !this.blinkEnd) {
      this.drawPeek(true); this.blinkEnd = now + 130;
      this.nextBlink = now + (Math.random() < 0.25 ? 260 : rnd(2200, 5200));
    }
  };
  Duck.prototype.render = function (moving) {
    var now = performance.now(), air = this.mode === "fall" || this.mode === "drag" || this.flying;
    if (moving || air || this.mode !== "walk") this.idleSince = 0; else if (!this.idleSince) this.idleSince = now;
    var tag = this.pose(moving, now);
    if (tag !== this.tag) { this.tag = tag; this.tagT0 = now; }
    // walk cycle follows the distance he actually covers, so his feet never slide
    this.dist += Math.abs(this.x - this.lx); this.lx = this.x;
    var idx;
    if (tag === "walk") idx = TAGS.walk.from + (Math.floor(this.dist / ((this.act ? 2.4 : this.speed) * 8)) & 1);
    else idx = frameAt(tag, now - this.tagT0);
    // turning around: he narrows to a sliver, then widens facing the other way
    var showDir = this.shown, tx = 1;
    if (this.dir === this.shown) this.turnT0 = 0;
    else if (reduceMotion || this.mode === "drag" || this.mode === "fall") { this.shown = showDir = this.dir; this.turnT0 = 0; }
    else {
      if (!this.turnT0) this.turnT0 = now;
      var k = (now - this.turnT0) / 170;
      if (k >= 1) { this.shown = showDir = this.dir; this.turnT0 = 0; }
      else { tx = Math.max(0.12, Math.abs(1 - 2 * k)); if (k >= 0.5) showDir = this.dir; }
    }
    drawFrame(this.ctx, idx, showDir < 0);
    var talking = now < this.talkUntil && !moving && !air, nod = talking ? Math.abs(Math.sin(now / 70)) : 0;
    var bob = this.flying ? Math.sin(this.tick * 0.8) * 2 : -nod * 2;
    this.wrap.style.transform = "translate(" + Math.round(this.x) + "px," + Math.round(this.y + bob) + "px)";
    this.canvas.style.transform = "rotate(" + (this.rot + this.lookv * 3).toFixed(1) + "deg) scale(" + (this.sx * tx).toFixed(3) + "," + (this.sy * (1 + nod * 0.03)).toFixed(3) + ")";
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
    setScale(); addEventListener("resize", setScale); loadQuack();
    var main = new Duck(), ducks = [main], last = performance.now();

    function loop(now) {
      var f = Math.min(3, (now - last) / 16.67); last = now;
      main.update(now, f);
      for (var i = ducks.length - 1; i >= 1; i--) {
        var d = ducks[i];
        if (d.dead) { ducks.splice(i, 1); continue; }
        d.update(now, f);
        if (d.x <= 0 || d.x >= innerWidth - dsz()) d.remove();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    addEventListener("resize", function () { main.reflow(); });
    addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; main.mx = e.clientX; main.my = e.clientY; main.mt = performance.now(); main.noteMove(e.clientX, e.clientY, main.mt); }, { passive: true });
    document.addEventListener("change", function (e) { if (e.target && e.target.id === "mode-switch-radio") main.reactTheme(e.target.checked); });
    document.addEventListener("visibilitychange", function () { last = performance.now(); });

    setTimeout(function () { var first = !sessionStorage.getItem("qbDuckHello"); try { sessionStorage.setItem("qbDuckHello", "1"); } catch (_) {} main.say(first ? talk("hello") : pick(SAY.helloBack), 3200, true); }, 1800);
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
    this.canvas = el("canvas"); this.canvas.width = this.canvas.height = FR;
    this.wrap.appendChild(this.canvas); this.ctx = this.canvas.getContext("2d");
    this.x = 1; this.dir = 1; this.speed = 2 + Math.random() * 2; this.tick = 0; this.frame = 0;
    this.wrap.style.top = "auto"; this.wrap.style.bottom = (6 + Math.random() * 30) + "px";
    document.body.appendChild(this.wrap);
  }
  ParadeDuck.prototype.update = function (now, f) {
    this.x += this.speed * f; this.tick++;
    drawFrame(this.ctx, frameAt("walk", now), false);
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
