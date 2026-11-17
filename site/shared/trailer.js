// The trailer: a canvas title sequence with a synthesised soundtrack.
// No dependencies. Data (names, match cards, last lines) comes from the
// archive at build time via #trailer-data.
(function () {
  'use strict';
  var root = document.querySelector('[data-trailer]');
  if (!root) return;
  var DATA = JSON.parse(document.getElementById('trailer-data').textContent);
  var canvas = root.querySelector('.tr-canvas');
  var g = canvas.getContext('2d');
  var layer = root.querySelector('[data-layer]');
  var gate = root.querySelector('[data-gate]');
  var titleCard = root.querySelector('[data-title-card]');
  var controls = root.querySelector('[data-controls]');
  var bar = root.querySelector('[data-progress]');
  var flashEl = root.querySelector('.tr-flash');
  var btnSound = root.querySelector('[data-sound]');
  var btnPause = root.querySelector('[data-pause]');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ORANGE = [255, 138, 31];
  var WARM = [242, 238, 230];

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ease(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ------------------------------------------------------------------ audio
  var Audio = {
    ctx: null, master: null, on: false, droneNodes: null,
    init: function () {
      if (this.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      var comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      // shared noise buffer
      var len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    },
    setOn: function (v) {
      this.on = v;
      if (!this.ctx) return;
      if (v && this.ctx.state === 'suspended') this.ctx.resume();
      this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.15);
    },
    now: function () { return this.ctx ? this.ctx.currentTime : 0; },
    drone: function () {
      if (!this.ctx || this.droneNodes) return;
      var c = this.ctx, out = c.createGain(); out.gain.value = 0; out.connect(this.master);
      out.gain.setTargetAtTime(0.16, c.currentTime, 3);
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 6; lp.connect(out);
      var lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 140; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
      [55, 55.4, 82.4, 110.2].forEach(function (f, i) {
        var o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        var og = c.createGain(); og.gain.value = i < 2 ? 0.35 : 0.18; o.connect(og); og.connect(lp); o.start();
      });
      this.droneNodes = { out: out, lp: lp };
    },
    swell: function (to, secs) { if (this.droneNodes) this.droneNodes.lp.frequency.setTargetAtTime(to, this.now(), secs || 1); },
    hit: function (strength) {
      if (!this.ctx) return;
      var c = this.ctx, t = c.currentTime, s = strength || 1;
      var o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
      og.gain.setValueAtTime(0.9 * s, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 1.5);
      var n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
      n.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
      ng.gain.setValueAtTime(0.35 * s, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      n.connect(bp); bp.connect(ng); ng.connect(this.master); n.start(t); n.stop(t + 0.7);
    },
    tick: function (vol) {
      if (!this.ctx) return;
      var c = this.ctx, t = c.currentTime, o = c.createOscillator(), og = c.createGain();
      o.type = 'square'; o.frequency.value = 1800 + Math.random() * 400;
      og.gain.setValueAtTime(0.025 * (vol || 1), t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.04);
    },
    whoosh: function (dur) {
      if (!this.ctx) return;
      var c = this.ctx, t = c.currentTime, d = dur || 1.2;
      var n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
      n.buffer = this.noise; n.loop = true; f.type = 'bandpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(4000, t + d);
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.3, t + d * 0.8); ng.gain.exponentialRampToValueAtTime(0.0001, t + d);
      n.connect(f); f.connect(ng); ng.connect(this.master); n.start(t); n.stop(t + d + 0.05);
    },
    riser: function (dur) {
      if (!this.ctx) return;
      var c = this.ctx, t = c.currentTime;
      this.whoosh(dur);
      var o = c.createOscillator(), og = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(320, t + dur);
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2400, t + dur);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.12, t + dur * 0.95); og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      o.connect(lp); lp.connect(og); og.connect(this.master); o.start(t); o.stop(t + dur + 0.1);
    },
    chord: function () {
      if (!this.ctx) return;
      var c = this.ctx, t = c.currentTime;
      [110, 164.8, 220, 261.6, 329.6].forEach(function (f, i) {
        var o = c.createOscillator(), og = c.createGain(), lp = c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 2) * 4;
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(1800, t + 2.5);
        og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.07, t + 0.8); og.gain.exponentialRampToValueAtTime(0.0001, t + 9);
        o.connect(lp); lp.connect(og); og.connect(Audio.master); o.start(t); o.stop(t + 9.2);
      });
    },
    silenceDrone: function () { if (this.droneNodes) { this.droneNodes.out.gain.setTargetAtTime(0, this.now(), 1.2); var dn = this.droneNodes; this.droneNodes = null; setTimeout(function () { try { dn.out.disconnect(); } catch (e) {} }, 6000); } },
  };

  // --------------------------------------------------------------- canvas
  var W = 0, H = 0, DPR = 1, CX = 0, CY = 0, SCALE = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth; H = root.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2; CY = H / 2; SCALE = Math.min(W, H);
  }
  window.addEventListener('resize', resize);
  resize();

  var N = W * H > 900000 ? 3200 : 1800;
  var P = [];
  for (var i = 0; i < N; i++) {
    var a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6);
    P.push({
      x: CX + Math.cos(a) * r * W * 0.6, y: CY + Math.sin(a) * r * H * 0.6,
      vx: 0, vy: 0, s: rand(0.6, 1.8), a: 0, ta: 0,
      ph: Math.random() * Math.PI * 2, sp: rand(0.2, 1), rank: 0, out: false, tx: 0, ty: 0, hot: 0,
    });
  }
  var ranks = shuffle(P.map(function (_, i) { return i; }));
  ranks.forEach(function (pi, rk) { P[pi].rank = rk; });

  var view = { mode: 'void', dim: 1, zoom: 1, ring: -1, sparks: [], lines: [], survivors: N, grid: false, gridT: 0, shake: 0 };

  function setMode(m) {
    view.mode = m;
    if (m === 'motes') P.forEach(function (p, i) { p.ta = i < 180 ? rand(0.25, 0.7) : 0; });
    if (m === 'field') P.forEach(function (p) { p.ta = rand(0.2, 0.75); });
  }

  function burst() {
    view.ring = 0;
    P.forEach(function (p) {
      var ang = Math.atan2(p.y - CY, p.x - CX) + rand(-0.4, 0.4);
      var v = rand(2, 12) * (SCALE / 800);
      p.x = CX + rand(-6, 6); p.y = CY + rand(-6, 6);
      p.vx = Math.cos(ang) * v; p.vy = Math.sin(ang) * v; p.a = rand(0.4, 1); p.ta = rand(0.2, 0.75);
    });
  }

  function spark(text) {
    view.sparks.push({ t: text, x: rand(W * 0.08, W * 0.92), y: rand(H * 0.12, H * 0.88), life: 0, max: rand(900, 1700), size: rand(10, 15) });
  }

  // Collapse: visual survivors shrink smoothly from N to 16 while the counter halves for real.
  function survivorsFor(round) {
    var F = DATA.finalRound;
    var frac = round / F;
    return Math.max(DATA.sixteen, Math.round(N * Math.pow(DATA.sixteen / N, frac)));
  }
  function eliminateTo(count) {
    P.forEach(function (p) {
      if (!p.out && p.rank >= count) {
        p.out = true; p.hot = 1; p.ta = 0;
        var partner = P[ranks[p.rank % count]];
        if (view.lines.length < 260) view.lines.push({ x1: p.x, y1: p.y, x2: partner.x, y2: partner.y, life: 1 });
      }
    });
    view.survivors = count;
    // survivors pull toward the centre as the field thins
    var spread = 0.14 + 0.5 * Math.pow(count / N, 0.35);
    P.forEach(function (p) {
      if (p.out) return;
      var ang = Math.atan2(p.y - CY, p.x - CX), d = Math.hypot(p.x - CX, p.y - CY);
      var want = Math.min(d, spread * SCALE * (0.4 + 0.6 * ((p.rank * 7919) % 97) / 97));
      p.tx = CX + Math.cos(ang) * want; p.ty = CY + Math.sin(ang) * want;
      p.ta = 0.55 + 0.45 * (1 - count / N);
    });
  }
  function gridSixteen() {
    view.grid = true;
    var gap = Math.min(W, H) * 0.09;
    P.forEach(function (p) {
      if (p.out) return;
      var k = p.rank, col = k % 4, row = Math.floor(k / 4);
      p.tx = CX + (col - 1.5) * gap; p.ty = CY + (row - 1.5) * gap - H * 0.02;
      p.ta = 1;
    });
  }
  function resetField() {
    view.grid = false; view.lines = []; view.survivors = N;
    P.forEach(function (p) { p.out = false; p.hot = 0; p.tx = 0; p.ty = 0; });
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(50, now - last); last = now;
    if (!paused) tick(dt);
    draw(now, paused ? 0 : dt);
    requestAnimationFrame(frame);
  }

  function draw(now, dt) {
    g.clearRect(0, 0, W, H);
    var t = now / 1000;
    var shx = view.shake ? rand(-view.shake, view.shake) : 0, shy = view.shake ? rand(-view.shake, view.shake) : 0;
    view.shake *= 0.9; if (view.shake < 0.2) view.shake = 0;
    g.save();
    g.translate(CX + shx, CY + shy); g.scale(view.zoom, view.zoom); g.translate(-CX, -CY);

    // pairing lines from the collapse
    for (var li = view.lines.length - 1; li >= 0; li--) {
      var L = view.lines[li];
      L.life -= dt / 900;
      if (L.life <= 0) { view.lines.splice(li, 1); continue; }
      g.strokeStyle = 'rgba(255,138,31,' + (L.life * 0.35) + ')';
      g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(L.x1, L.y1); g.lineTo(L.x1 + (L.x2 - L.x1) * (1 - L.life), L.y1 + (L.y2 - L.y1) * (1 - L.life)); g.stroke();
    }

    var collapse = view.mode === 'collapse' || view.mode === 'sixteen';
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (dt) {
        p.a += (p.ta - p.a) * Math.min(1, dt / 500);
        if (collapse && !p.out && (p.tx || p.ty)) {
          p.x += (p.tx - p.x) * Math.min(1, dt / (view.grid ? 700 : 1100));
          p.y += (p.ty - p.y) * Math.min(1, dt / (view.grid ? 700 : 1100));
        } else {
          p.vx *= 0.965; p.vy *= 0.965;
          p.x += p.vx + Math.cos(t * p.sp + p.ph) * 0.12;
          p.y += p.vy + Math.sin(t * p.sp * 0.8 + p.ph) * 0.12 - (p.out ? 0.25 : 0);
        }
        if (p.hot) p.hot = Math.max(0, p.hot - dt / 600);
      }
      var alpha = p.a * view.dim;
      if (alpha < 0.01 && !p.hot) continue;
      var tw = 0.75 + 0.25 * Math.sin(t * 2 * p.sp + p.ph);
      var col = p.hot ? ORANGE : (collapse && !p.out ? ORANGE : WARM);
      var size = p.s * (collapse && !p.out ? 1 + 2.2 * (1 - view.survivors / N) : 1);
      if (view.grid && !p.out) size = 7;
      g.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + clamp(alpha * tw + p.hot, 0, 1) + ')';
      if (size > 2.5) {
        g.shadowColor = 'rgba(255,138,31,0.9)'; g.shadowBlur = size * 3;
        g.beginPath(); g.arc(p.x, p.y, size, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
      } else {
        g.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
    }

    // the voice: an expanding ring
    if (view.ring >= 0) {
      view.ring += dt / 1600;
      var rr = ease(view.ring) * Math.hypot(W, H) * 0.6;
      g.strokeStyle = 'rgba(255,138,31,' + Math.max(0, 0.6 - view.ring * 0.6) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.arc(CX, CY, rr, 0, Math.PI * 2); g.stroke();
      if (view.ring > 1) view.ring = -1;
    }

    // name sparks
    g.textAlign = 'center';
    for (var si = view.sparks.length - 1; si >= 0; si--) {
      var S = view.sparks[si];
      S.life += dt;
      var k = S.life / S.max;
      if (k >= 1) { view.sparks.splice(si, 1); continue; }
      var sa = Math.sin(Math.PI * k) * 0.55 * view.dim;
      g.font = '500 ' + S.size + 'px Inter, system-ui, sans-serif';
      g.fillStyle = 'rgba(242,238,230,' + sa + ')';
      g.fillText(S.t, S.x, S.y - k * 10);
    }
    g.restore();
  }

  // --------------------------------------------------------------- text
  function show(html, cls) {
    var el = document.createElement('div');
    el.className = 'tx ' + (cls || '');
    el.innerHTML = html;
    var old = layer.children;
    for (var i = 0; i < old.length; i++) { old[i].classList.add('out'); (function (o) { setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 700); })(old[i]); }
    layer.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });
    return el;
  }
  function clearText() { show('', ''); }
  function flash(strength) {
    flashEl.style.transition = 'none'; flashEl.style.opacity = String(0.55 * (strength || 1));
    requestAnimationFrame(function () { flashEl.style.transition = 'opacity .7s ease-out'; flashEl.style.opacity = '0'; });
  }
  function typewriter(el, text, ms) {
    var i = 0, step = Math.max(18, ms / Math.max(1, text.length));
    el.textContent = '';
    var cursor = document.createElement('span'); cursor.className = 'cursor';
    var span = document.createElement('span'); el.appendChild(span); el.appendChild(cursor);
    return function (local) {
      var n = Math.min(text.length, Math.floor(local / step));
      while (i < n) { i++; if (text[i - 1] !== ' ' && i % 2) Audio.tick(0.8); }
      span.textContent = text.slice(0, i);
    };
  }

  // --------------------------------------------------------------- scenes
  var matches = shuffle(DATA.matches).slice(0, 9);
  var quotes = shuffle(DATA.quotes).slice(0, 3);
  var address = [
    'You are not real. Somebody drew you.',
    'You are going to a room.',
    'For one hour you will talk, and listen, and reply meaningfully.',
    'Nobody’s powers will work.',
    'After the hour, they will.',
    'The room lasts until one of you is dead.',
    'The last one left of everybody can have anything,',
    'even being real.',
  ];

  var scenes = [];
  function scene(dur, enter, tickFn) { scenes.push({ dur: dur, enter: enter, tick: tickFn }); }

  scene(4200, function () {
    setMode('motes'); view.dim = 1; view.zoom = 1;
    Audio.drone();
    show('The Architect was bored,', 'serif big');
  });
  var spokeDone;
  scene(4600, function () {
    spokeDone = false;
    show('so She spoke,', 'serif big');
  }, function (lt) {
    if (!spokeDone && lt > 1300) {
      spokeDone = true; burst(); Audio.hit(1.1); view.shake = 6; flash(0.5); Audio.swell(700, 0.6);
      show('and from her voice came <b class="glow">the Bracket</b>.', 'serif big');
    }
  });
  var sparkClock = 0;
  scene(4200, function () {
    setMode('field'); Audio.swell(380, 2);
    show('Every character from every anime ever made.', 'caps');
  }, function (lt, dt) {
    sparkClock += dt;
    if (sparkClock > 110) { sparkClock = 0; spark(pick(DATA.names)); }
  });
  scene(4400, function () {
    show('It did not come to a number that halves cleanly, so She took faces from the crowd scenes until it did.', 'serif mid');
  }, function (lt, dt) {
    sparkClock += dt;
    if (sparkClock > 90) { sparkClock = 0; spark(pick(DATA.names.slice(-12))); }
  });
  var countEl;
  scene(4600, function () {
    countEl = show('<div class="num" data-n>0</div><div class="cap">Most of them had never been given a name.</div>', 'count');
    Audio.whoosh(2.2);
  }, function (lt) {
    var k = ease(lt / 2400);
    var n = countEl.querySelector('[data-n]');
    var v = Math.round(DATA.entrants * k);
    if (n.textContent !== fmt(v)) { n.textContent = fmt(v); if (Math.random() < 0.5 && k < 1) Audio.tick(0.6); }
    if (lt > 2400 && !countEl._hit) { countEl._hit = true; Audio.hit(0.8); n.classList.add('lock'); }
  });
  scene(2600, function () {
    view.dim = 0.45; show('Each was told the same thing, in a form they could take in.', 'serif mid');
  });
  address.forEach(function (line, idx) {
    var tw;
    scene(idx === address.length - 1 ? 2600 : 2500, function () {
      view.dim = 0.32; view.zoom = 1 + idx * 0.012;
      var el = show('', 'address' + (idx === address.length - 1 ? ' last' : ''));
      tw = typewriter(el, line, Math.min(1500, line.length * 38));
      if (idx === 0 || idx === 5 || idx === 7) Audio.hit(idx === 7 ? 0.9 : 0.45);
    }, function (lt) { tw(lt); });
  });
  scene(2800, function () {
    view.dim = 0.15; view.zoom = 1; Audio.hit(1.4); view.shake = 10; flash(0.9);
    P.forEach(function (p) { p.vx = 0; p.vy = 0; });
    show('Everybody else stops.', 'stop');
  });

  // montage of real match cards, accelerating
  var cutTimes = [];
  (function () { var t = 300, d = 900; matches.forEach(function () { cutTimes.push({ at: t, d: d }); t += d; d = Math.max(420, d * 0.86); }); })();
  var cutsDur = cutTimes.length ? cutTimes[cutTimes.length - 1].at + cutTimes[cutTimes.length - 1].d + 300 : 0;
  var cutIdx;
  if (matches.length) scene(cutsDur, function () {
    cutIdx = -1; view.dim = 0.35; setMode('field'); clearText(); Audio.swell(520, 1);
  }, function (lt) {
    for (var c = cutIdx + 1; c < cutTimes.length; c++) {
      if (lt >= cutTimes[c].at) {
        cutIdx = c;
        var m = matches[c];
        var A = '<span class="n' + (m.dead === 0 ? ' dead' : '') + '">' + esc(m.a) + '</span>';
        var B = '<span class="n' + (m.dead === 1 ? ' dead' : '') + '">' + esc(m.b) + '</span>';
        var el = show('<div class="rd">Round ' + String(m.r).padStart(2, '0') + '</div><div class="vs">' + A + '<i>×</i>' + B + '</div>', 'mcard');
        Audio.hit(0.55); flash(0.18); view.shake = 3;
        (function (el, d) { setTimeout(function () { el.classList.add('strike'); Audio.tick(1.5); }, d * 0.55); })(el, cutTimes[c].d);
      }
    }
  });
  quotes.forEach(function (q) {
    scene(3200, function () {
      view.dim = 0.25;
      show('<blockquote>' + esc(q.q) + '</blockquote><div class="src">' + esc(q.id) + ' · ' + esc(q.t) + '</div>', 'quote');
      Audio.tick(0.5);
    });
  });

  // the collapse: the counter halves round by round
  var colEl, colRound;
  var collapseDur = 9500;
  scene(collapseDur, function () {
    resetField(); setMode('field'); view.mode = 'collapse'; view.dim = 0.9; colRound = 0;
    colEl = show('<div class="rd" data-r>Round 1</div><div class="num" data-n>' + fmt(DATA.entrants) + '</div>', 'count collapse');
    Audio.riser(collapseDur / 1000); Audio.swell(1200, 4);
  }, function (lt) {
    var F = DATA.finalRound;
    // rounds come faster as they go, then the last few slow down
    var x = lt / (collapseDur - 900);
    var r = Math.min(F, Math.floor(F * (0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1)))));
    while (colRound < r) {
      colRound++;
      eliminateTo(survivorsFor(colRound));
      colEl.querySelector('[data-n]').textContent = fmt(DATA.entrants / Math.pow(2, colRound));
      colEl.querySelector('[data-r]').textContent = colRound < F ? 'Round ' + (colRound + 1) : 'End of Round ' + F;
      if (colRound > F - 4) { Audio.hit(0.5 + (colRound - (F - 4)) * 0.2); view.shake = 2 + colRound - (F - 4); }
      else Audio.tick(1.2);
    }
  });
  scene(4600, function () {
    view.mode = 'sixteen'; gridSixteen(); Audio.hit(1.6); Audio.chord(); flash(0.7); view.shake = 8;
    show('Sixteen are left.', 'sixteen');
  });

  var total = scenes.reduce(function (s, x) { return s + x.dur; }, 0);

  // --------------------------------------------------------------- timeline
  var T = 0, cur = -1, running = false, paused = false, finished = false;
  function sceneAt(t) { var acc = 0; for (var i = 0; i < scenes.length; i++) { if (t < acc + scenes[i].dur) return [i, t - acc]; acc += scenes[i].dur; } return [scenes.length, 0]; }
  function tick(dt) {
    if (!running || finished) return;
    T += dt;
    var at = sceneAt(T);
    if (at[0] !== cur) {
      cur = at[0];
      if (cur >= scenes.length) return end();
      scenes[cur].enter();
    }
    if (scenes[cur].tick) scenes[cur].tick(at[1], dt);
    bar.style.width = (100 * T / total).toFixed(2) + '%';
  }
  function end() {
    finished = true; running = false;
    controls.hidden = true; clearText();
    view.dim = 0.22;
    titleCard.hidden = false;
    requestAnimationFrame(function () { titleCard.classList.add('in'); });
    root.classList.add('at-end');
    Audio.silenceDrone();
  }
  function start(withSound) {
    if (withSound) { Audio.init(); Audio.setOn(true); }
    gate.classList.add('gone');
    setTimeout(function () { gate.hidden = true; }, 900);
    controls.hidden = false;
    btnSound.textContent = Audio.on ? 'Sound on' : 'Sound off';
    T = 0; cur = -1; running = true; finished = false; paused = false;
    titleCard.hidden = true; titleCard.classList.remove('in'); root.classList.remove('at-end');
    resetField();
    P.forEach(function (p) { p.a = 0; });
  }

  root.querySelectorAll('[data-start]').forEach(function (b) {
    b.addEventListener('click', function () { start(b.getAttribute('data-start') === 'sound'); });
  });
  btnSound.addEventListener('click', function () {
    Audio.init(); Audio.setOn(!Audio.on);
    if (Audio.on && running && cur >= 0) Audio.drone();
    btnSound.textContent = Audio.on ? 'Sound on' : 'Sound off';
  });
  btnPause.addEventListener('click', function () {
    paused = !paused;
    btnPause.textContent = paused ? 'Play' : 'Pause';
    root.classList.toggle('paused', paused);
    if (Audio.ctx) { if (paused) Audio.ctx.suspend(); else if (Audio.on) Audio.ctx.resume(); }
  });
  root.querySelector('[data-skip]').addEventListener('click', function () { if (running) end(); });
  root.querySelector('[data-replay]').addEventListener('click', function () { start(Audio.on); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && running) end();
    else if (ev.key === ' ' && running) { ev.preventDefault(); btnPause.click(); }
  });

  // idle field behind the gate
  setMode('motes');
  requestAnimationFrame(frame);
  if (reduce) { gate.hidden = true; end(); }
})();
