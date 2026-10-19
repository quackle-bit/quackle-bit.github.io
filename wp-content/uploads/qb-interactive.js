/*
 * Quackle.bit — interactive extras
 *  1. Duck mascot (all pages): walks around, click it to quack; arrow keys / A-D to walk,
 *     W / ↑ to jump, Q to quack once you've clicked it. Konami code = duck parade.
 *  2. Portfolio: "Play in browser" on games with an itch.io web build (opens a popup).
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
    // itch.io "embed-upload" ids, found on each game's itch.io page
    games: {
      "anotherland-above": { id: 8389537, title: "Anotherland Above" },
      "aftermarket": { id: 4239776, title: "Aftermarket" },
      "lunartale": { id: 7675720, title: "Project Lunartale" },
      "bloomtales": { id: 2420560, title: "Bloomtales" },
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
  var PAL = { o: "#2f2f24", w: "#f5f1e6", s: "#d6ceba", b: "#e8a33c", t: "#469ca0" };
  var SCALE = 4, SIZE = 16 * SCALE;

  function drawFrame(ctx, feet, flip) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    var rows = BODY.concat(FEET[feet]);
    for (var y = 0; y < rows.length; y++)
      for (var x = 0; x < 16; x++) {
        var c = rows[y][x];
        if (c === ".") continue;
        ctx.fillStyle = PAL[c];
        ctx.fillRect((flip ? 15 - x : x) * SCALE, y * SCALE, SCALE, SCALE);
      }
  }

  function Duck(opts) {
    opts = opts || {};
    var self = this;
    this.wrap = el("div", "qb-duck" + (opts.parade ? " qb-duck-parade" : ""));
    this.canvas = el("canvas");
    this.canvas.width = this.canvas.height = SIZE;
    this.bubble = el("div", "qb-duck-bubble");
    this.wrap.appendChild(this.bubble);
    this.wrap.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.x = opts.x != null ? opts.x : Math.random() * (innerWidth - SIZE);
    this.y = 0; this.vy = 0; this.dir = opts.dir || 1; this.speed = opts.speed || 0.8;
    this.walking = !reduceMotion; this.frame = 0; this.tick = 0;
    this.controlled = false; this.keys = {};
    this.nextThink = 0;
    if (!opts.parade) {
      this.wrap.setAttribute("role", "button");
      this.wrap.setAttribute("tabindex", "0");
      this.wrap.setAttribute("aria-label", "Quackle.bit duck mascot. Click to quack.");
      this.wrap.title = "Click me!";
      this.wrap.addEventListener("click", function () { self.poke(); });
      this.wrap.addEventListener("keydown", function (e) { if (e.key === "Enter") self.poke(); });
    }
    document.body.appendChild(this.wrap);
    this.render();
  }
  Duck.prototype.say = function (text, ms) {
    var b = this.bubble;
    b.textContent = text; b.classList.add("show");
    clearTimeout(this._sayT);
    this._sayT = setTimeout(function () { b.classList.remove("show"); }, ms || 2200);
  };
  Duck.prototype.jump = function () { if (this.y === 0) this.vy = 7; };
  Duck.prototype.quack = function () { quackSound(); this.jump(); };
  Duck.prototype.poke = function () {
    this.quack();
    if (!this.controlled) {
      this.controlled = true;
      this.wrap.classList.add("is-controlled");
      this.say(matchMedia("(pointer: coarse)").matches ? "Quack! Tap me again!" : "You control me now! ← → walk, ↑ jump, Q quack", 3800);
    } else {
      var L = CONFIG.duck.lines;
      this.say(L[Math.floor(Math.random() * L.length)]);
    }
  };
  Duck.prototype.update = function (now) {
    var moving = false;
    if (this.controlled && (this.keys.left || this.keys.right)) {
      this.dir = this.keys.left ? -1 : 1;
      this.x += this.dir * 2.6; moving = true; this.nextThink = now + 4000;
    } else if (this.walking) {
      if (now > this.nextThink) {
        // wander: sometimes stop, sometimes turn
        var r = Math.random();
        this.paused = r < 0.3;
        if (r > 0.75) this.dir *= -1;
        this.nextThink = now + 1500 + Math.random() * 3500;
      }
      if (!this.paused) { this.x += this.dir * this.speed; moving = true; }
    }
    var maxX = innerWidth - SIZE;
    if (this.x < 0) { this.x = 0; this.dir = 1; }
    if (this.x > maxX) { this.x = maxX; this.dir = -1; }
    if (this.y > 0 || this.vy > 0) { this.y += this.vy; this.vy -= 0.45; if (this.y <= 0) { this.y = 0; this.vy = 0; } }
    if (moving && ++this.tick % 9 === 0) this.frame ^= 1;
    this.render(moving);
  };
  Duck.prototype.render = function (moving) {
    var feet = this.y > 0 ? "jump" : moving ? (this.frame ? "walk2" : "walk1") : "walk1";
    drawFrame(this.ctx, feet, this.dir < 0);
    if (!this.parade) {
      var f = document.querySelector("footer.footer") || document.querySelector("footer");
      var base = f ? f.getBoundingClientRect().top + pageYOffset : document.documentElement.scrollHeight;
      this.wrap.style.top = Math.round(base - this.wrap.offsetHeight + 4) + "px";
    }
    this.wrap.style.transform = "translate(" + Math.round(this.x) + "px," + -Math.round(this.y) + "px)";
  };
  Duck.prototype.remove = function () { this.wrap.remove(); this.dead = true; };

  function startDuck() {
    if (!CONFIG.duck.enabled || !document.body) return;
    var ducks = [];
    var main = new Duck({ x: innerWidth * 0.15 });
    ducks.push(main);

    function loop(now) {
      for (var i = ducks.length - 1; i >= 0; i--) {
        var d = ducks[i];
        if (d.dead) { ducks.splice(i, 1); continue; }
        d.update(now);
        if (d.parade && (d.x <= 0 || d.x >= innerWidth - SIZE)) d.remove();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // first-visit hello
    setTimeout(function () { main.say("Quack! Click me 🦆", 3000); }, 2500);

    // keyboard control (only after the duck was clicked, and never while typing)
    var KMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      konami(e.key);
      if (!main.controlled) return;
      if (KMAP[e.key]) { main.keys[KMAP[e.key]] = true; e.preventDefault(); }
      else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { main.jump(); e.preventDefault(); }
      else if (e.key === "q" || e.key === "Q") main.quack();
      else if (e.key === "Escape") { main.controlled = false; main.keys = {}; main.wrap.classList.remove("is-controlled"); main.say("Bye! Click me to play again."); }
    });
    addEventListener("keyup", function (e) { if (KMAP[e.key]) main.keys[KMAP[e.key]] = false; });

    // Konami code -> duck parade
    var CODE = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"], pos = 0;
    function konami(k) {
      pos = (k === CODE[pos] || k.toLowerCase() === CODE[pos]) ? pos + 1 : (k === CODE[0] ? 1 : 0);
      if (pos === CODE.length) {
        pos = 0; chime(); main.say("DUCK PARADE!", 3000);
        for (var i = 0; i < 12; i++) (function (i) {
          setTimeout(function () {
            var d = new Duck({ parade: true, x: 1, dir: 1, speed: 2 + Math.random() * 2 });
            d.parade = true; d.walking = true; d.nextThink = Infinity; d.paused = false;
            ducks.push(d); if (i % 3 === 0) quackSound();
          }, i * 180);
        })(i);
      }
    }
  }

  /* ================= 2. PLAY IN BROWSER ================= */
  function openPlayer(slug) {
    var g = CONFIG.games[slug];
    var overlay = el("div", "qb-modal", 
      '<div class="qb-modal-box" role="dialog" aria-modal="true" aria-label="Play ' + g.title + '">' +
        '<div class="qb-modal-head"><strong>▶ ' + g.title + '</strong>' +
          '<span><a href="https://quacklebit.itch.io/' + slug + '" target="_blank" rel="noopener">Open on itch.io ↗</a>' +
          '<button type="button" class="qb-modal-close" aria-label="Close">✕</button></span></div>' +
        '<div class="qb-modal-frame"><iframe src="https://itch.io/embed-upload/' + g.id + '?color=1e1e1e" allowfullscreen allow="autoplay; fullscreen *; gamepad" title="' + g.title + '"></iframe></div>' +
        '<p class="qb-modal-note">Tip: click inside the game first. Best played on desktop with a keyboard. Press Esc or ✕ to close.</p>' +
      "</div>");
    function close() { overlay.remove(); document.documentElement.classList.remove("qb-modal-open"); removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay || e.target.closest(".qb-modal-close")) close(); });
    addEventListener("keydown", onKey);
    document.documentElement.classList.add("qb-modal-open");
    document.body.appendChild(overlay);
    overlay.querySelector(".qb-modal-close").focus();
  }

  function addPlayButtons() {
    var cards = document.querySelectorAll("a.qb-game[href*='quacklebit.itch.io/']");
    Array.prototype.forEach.call(cards, function (a) {
      var slug = (a.getAttribute("href").split("quacklebit.itch.io/")[1] || "").replace(/\/.*$/, "");
      if (!CONFIG.games[slug]) return;
      var btn = el("span", "qb-play", "▶ Play in browser");
      btn.setAttribute("role", "button");
      btn.setAttribute("tabindex", "0");
      function go(e) { e.preventDefault(); e.stopPropagation(); openPlayer(slug); }
      btn.addEventListener("click", go);
      btn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") go(e); });
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
        if (on) { item.classList.add("is-selected"); chime(); }
      }
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
