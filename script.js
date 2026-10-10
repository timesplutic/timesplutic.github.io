/*!
 * timesplutic.github.io
 * Design and code by Junhyeok Kim (https://timesplutic.github.io/)
 * Copyright (c) 2026 Junhyeok Kim. All rights reserved.
 * Do not copy or reuse without permission. See LICENSE.
 */
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Theme toggle ----------
  var toggle = document.getElementById('theme-toggle');
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  toggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // ---------- Nav border on scroll ----------
  var nav = document.querySelector('.nav');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Reveal on scroll ----------
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // ---------- Paper filters ----------
  var chips = document.querySelectorAll('.chip');
  var papers = document.querySelectorAll('.paper');
  var empty = document.getElementById('empty-state');

  function matches(paper, filter) {
    if (filter === 'all') return true;
    return (paper.getAttribute('data-tags') || '').split(/\s+/).indexOf(filter) !== -1;
  }

  chips.forEach(function (chip) {
    var f = chip.getAttribute('data-filter');
    var n = 0;
    // in-progress cards are shown but not counted
    papers.forEach(function (p) { if (!p.classList.contains('wip') && matches(p, f)) n++; });
    chip.querySelector('.count').textContent = n;

    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('is-active'); });
      chip.classList.add('is-active');
      var shown = 0;
      papers.forEach(function (p) {
        var ok = matches(p, f);
        p.classList.toggle('is-hidden', !ok);
        if (ok) { p.classList.add('in'); shown++; }
      });
      empty.hidden = shown !== 0;
    });
  });

  // ---------- Attention-map grid ----------
  var grid = document.getElementById('attn-grid');
  if (!grid) return;

  var cells = [];
  var cols = 0, rows = 0;

  function build() {
    var w = grid.clientWidth;
    var h = grid.clientHeight;
    var target = w < 600 ? 22 : 34; // approx cell size in px
    cols = Math.max(8, Math.round(w / target));
    var cell = w / cols;
    rows = Math.max(4, Math.floor(h / cell));
    grid.style.setProperty('--cols', cols);
    grid.innerHTML = '';
    cells = [];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < cols * rows; i++) {
      var s = document.createElement('span');
      frag.appendChild(s);
      cells.push(s);
    }
    grid.appendChild(frag);
  }

  function paint(cx, cy, spread) {
    var rect = grid.getBoundingClientRect();
    var cw = rect.width / cols;
    var ch = rect.height / rows;
    var accent = getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff5b3a';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = rect.left + (c + 0.5) * cw;
        var y = rect.top + (r + 0.5) * ch;
        var d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (spread * spread);
        var a = Math.exp(-d2);
        var el = cells[r * cols + c];
        if (a > 0.04) {
          el.classList.add('hot');
          el.style.backgroundColor = 'color-mix(in srgb, ' + accent + ' ' + Math.round(a * 85) + '%, transparent)';
        } else if (el.classList.contains('hot')) {
          el.classList.remove('hot');
          el.style.backgroundColor = '';
        }
      }
    }
  }

  build();
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  if (reduceMotion) return;

  var hero = document.querySelector('.hero');
  var pointerActive = false;
  var raf = null;
  var px = 0, py = 0;

  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    pointerActive = true;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(function () { raf = null; paint(px, py, 110); });
  });
  hero.addEventListener('pointerleave', function () { pointerActive = false; });

  // Idle drift: a few "heads" wandering around when the cursor is away
  var t0 = performance.now();
  function idle(now) {
    if (!pointerActive) {
      var rect = grid.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        var t = (now - t0) / 1000;
        var cx = rect.left + rect.width * (0.65 + 0.22 * Math.sin(t * 0.35));
        var cy = rect.top + rect.height * (0.4 + 0.25 * Math.sin(t * 0.5 + 1.3));
        paint(cx, cy, 130);
      }
    }
    setTimeout(function () { requestAnimationFrame(idle); }, 80);
  }
  requestAnimationFrame(idle);
})();

// ---------- Mini drum machine ----------
(function () {
  var root = document.getElementById('drum');
  if (!root) return;

  var STEPS = 16;
  var tracks = [
    { name: 'Kick', short: 'KCK', play: kick },
    { name: 'Snare', short: 'SNR', play: snare },
    { name: 'Hi-hat', short: 'HAT', play: hat },
    { name: 'Rim', short: 'RIM', play: rim },
    { name: 'Cowbell', short: 'COW', play: cowbell },
    { name: 'Bass', short: 'BAS', play: bass, melodic: true }
  ];
  var BASS = 5; // index of the bass track
  // Bass cells cycle through a C minor pentatonic scale, then back to off
  var NOTES = [
    { name: 'C', freq: 65.41 },
    { name: 'E\u266d', freq: 77.78 },
    { name: 'F', freq: 87.31 },
    { name: 'G', freq: 98.0 },
    { name: 'B\u266d', freq: 116.54 }
  ];
  // Default groove: a simple backbeat. Bass values are 1-based note indices.
  var pattern = [
    [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
    [0,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,1,0],
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0],
    [1,0,0,1, 0,0,2,0, 1,0,1,0, 3,0,4,0]
  ];

  var gridEl = document.getElementById('drum-grid');
  var playBtn = document.getElementById('drum-play');
  var bpmIn = document.getElementById('drum-bpm');
  var bpmOut = document.getElementById('drum-bpm-out');
  var cells = [];
  var labels = [];
  var narrow = window.matchMedia('(max-width: 560px)');

  tracks.forEach(function (tr, r) {
    var row = document.createElement('div');
    row.className = 'drum-row' + (tr.melodic ? ' is-melodic' : '');
    row.setAttribute('role', 'row');

    var label = document.createElement('button');
    label.className = 'drum-label';
    label.type = 'button';
    label.title = 'Play ' + tr.name;
    label.textContent = narrow.matches ? tr.short : tr.name;
    label.addEventListener('click', function () { ensureCtx(); tr.play(ctx.currentTime, 1); flash(label); });
    row.appendChild(label);
    labels.push(label);

    cells[r] = [];
    for (var c = 0; c < STEPS; c++) {
      var cell = document.createElement('button');
      cell.className = 'drum-cell';
      cell.type = 'button';
      cell.setAttribute('aria-label', tr.name + ' step ' + (c + 1));
      (function (r, c, cell) {
        cell.addEventListener('click', function () {
          var max = tr.melodic ? NOTES.length : 1;
          pattern[r][c] = (pattern[r][c] + 1) % (max + 1);
          render(r, c);
          if (pattern[r][c] && !playing) { ensureCtx(); tr.play(ctx.currentTime, pattern[r][c]); }
        });
      })(r, c, cell);
      row.appendChild(cell);
      cells[r][c] = cell;
    }
    gridEl.appendChild(row);
  });

  narrow.addEventListener && narrow.addEventListener('change', function () {
    labels.forEach(function (l, i) { l.textContent = narrow.matches ? tracks[i].short : tracks[i].name; });
  });

  function render(r, c) {
    var v = pattern[r][c];
    var cell = cells[r][c];
    cell.classList.toggle('on', !!v);
    cell.setAttribute('aria-pressed', !!v);
    if (tracks[r].melodic) {
      cell.textContent = v ? NOTES[v - 1].name : '';
      cell.setAttribute('aria-label', tracks[r].name + ' step ' + (c + 1) + (v ? ', ' + NOTES[v - 1].name : ''));
    }
  }
  function renderAll() {
    for (var r = 0; r < tracks.length; r++) for (var c = 0; c < STEPS; c++) render(r, c);
  }
  renderAll();

  function flash(el) {
    el.classList.add('hit');
    setTimeout(function () { el.classList.remove('hit'); }, 120);
  }

  // ----- Audio -----
  var ctx = null, master = null, noiseBuf = null;
  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.15;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function env(t, peak, decay) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    g.connect(master);
    return g;
  }
  function noise(t, dur) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.start(t);
    s.stop(t + dur);
    return s;
  }

  function kick(t) {
    var o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(env(t, 1, 0.45));
    o.start(t);
    o.stop(t + 0.5);
  }
  function snare(t) {
    var f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    noise(t, 0.25).connect(f);
    f.connect(env(t, 0.55, 0.2));
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    o.connect(env(t, 0.5, 0.1));
    o.start(t);
    o.stop(t + 0.15);
  }
  function hat(t) {
    var f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    noise(t, 0.08).connect(f);
    f.connect(env(t, 0.3, 0.05));
  }
  function rim(t) {
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1750, t);
    o.connect(env(t, 0.5, 0.03));
    o.start(t);
    o.stop(t + 0.05);
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3000;
    noise(t, 0.03).connect(f);
    f.connect(env(t, 0.6, 0.025));
  }
  // Classic 808 cowbell: two detuned squares through a bandpass
  function cowbell(t) {
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 800;
    f.Q.value = 1.5;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    f.connect(g);
    g.connect(master);
    [540, 800].forEach(function (hz) {
      var o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = hz;
      o.connect(f);
      o.start(t);
      o.stop(t + 0.4);
    });
  }
  // 808-style sub bass: a sine with a short pitch punch, soft-clipped so it
  // still has some growl on laptop speakers. Monophonic: a new note cuts the last.
  var bassDrive = null, bassVoice = null;
  function bass(t, v) {
    var note = NOTES[(v || 1) - 1];
    var len = Math.min(0.9, 60 / bpm() * 0.9);

    if (!bassDrive) {
      bassDrive = ctx.createWaveShaper();
      var curve = new Float32Array(1024);
      for (var i = 0; i < curve.length; i++) {
        var x = i / (curve.length - 1) * 2 - 1;
        curve[i] = Math.tanh(3 * x);
      }
      bassDrive.curve = curve;
      var tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 900;
      var out = ctx.createGain();
      out.gain.value = 0.7;
      bassDrive.connect(tone);
      tone.connect(out);
      out.connect(master);
    }

    if (bassVoice && bassVoice.end > t) {
      bassVoice.g.gain.cancelScheduledValues(t);
      bassVoice.g.gain.setTargetAtTime(0, t, 0.008);
    }

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(note.freq * 2, t);
    o.frequency.exponentialRampToValueAtTime(note.freq, t + 0.035);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.006);
    g.gain.setTargetAtTime(0.55, t + 0.04, 0.12);
    g.gain.setTargetAtTime(0.0001, t + len * 0.7, len * 0.12);
    // Quiet octave layer so the note still reads on small speakers
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(note.freq * 4, t);
    o2.frequency.exponentialRampToValueAtTime(note.freq * 2, t + 0.035);
    var g2 = ctx.createGain();
    g2.gain.value = 0.18;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(bassDrive);
    o.start(t);
    o2.start(t);
    o.stop(t + len + 0.2);
    o2.stop(t + len + 0.2);
    bassVoice = { g: g, end: t + len + 0.2 };
  }

  // ----- Scheduler (look-ahead) -----
  var playing = false, step = 0, nextTime = 0, timer = null, queue = [], lastDrawn = -1;
  function bpm() { return +bpmIn.value; }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.12) {
      for (var r = 0; r < tracks.length; r++) if (pattern[r][step]) tracks[r].play(nextTime, pattern[r][step]);
      queue.push({ step: step, time: nextTime });
      nextTime += 60 / bpm() / 4;
      step = (step + 1) % STEPS;
    }
    timer = setTimeout(schedule, 25);
  }

  function draw() {
    if (!playing) return;
    var cur = lastDrawn;
    while (queue.length && queue[0].time <= ctx.currentTime) cur = queue.shift().step;
    if (cur !== lastDrawn) {
      setNow(lastDrawn, false);
      setNow(cur, true);
      for (var r = 0; r < tracks.length; r++) if (pattern[r][cur]) flash(labels[r]);
      lastDrawn = cur;
    }
    requestAnimationFrame(draw);
  }
  function setNow(c, on) {
    if (c < 0) return;
    for (var r = 0; r < tracks.length; r++) cells[r][c].classList.toggle('now', on);
  }

  function start() {
    ensureCtx();
    playing = true;
    step = 0;
    queue = [];
    nextTime = ctx.currentTime + 0.05;
    root.classList.add('is-playing');
    playBtn.setAttribute('aria-label', 'Stop');
    schedule();
    requestAnimationFrame(draw);
  }
  function stop() {
    playing = false;
    clearTimeout(timer);
    setNow(lastDrawn, false);
    lastDrawn = -1;
    root.classList.remove('is-playing');
    playBtn.setAttribute('aria-label', 'Play');
  }

  playBtn.addEventListener('click', function () { playing ? stop() : start(); });
  bpmIn.addEventListener('input', function () { bpmOut.textContent = bpmIn.value; });

  document.getElementById('drum-clear').addEventListener('click', function () {
    pattern = pattern.map(function (row) { return row.map(function () { return 0; }); });
    renderAll();
  });

  // Musically biased random groove rather than pure noise
  document.getElementById('drum-random').addEventListener('click', function () {
    var p = tracks.map(function () { return []; });
    for (var c = 0; c < STEPS; c++) {
      var beat = c % 4 === 0, back = c % 8 === 4, off = c % 2 === 1;
      p[0][c] = (c === 0 || (beat && Math.random() < 0.5) || (!back && Math.random() < 0.15)) ? 1 : 0;
      p[1][c] = (back || (!beat && Math.random() < 0.08)) ? 1 : 0;
      p[2][c] = (c % 2 === 0 ? Math.random() < 0.9 : Math.random() < 0.35) ? 1 : 0;
      p[3][c] = (!beat && !back && Math.random() < 0.18) ? 1 : 0;
      p[4][c] = ((off && Math.random() < 0.15) || (beat && Math.random() < 0.12)) ? 1 : 0;
      // Bass leans on the root and follows the kick a bit
      var playBass = c === 0 || (p[0][c] && Math.random() < 0.7) || Math.random() < 0.2;
      p[BASS][c] = playBass ? (Math.random() < 0.45 ? 1 : 1 + Math.ceil(Math.random() * (NOTES.length - 1))) : 0;
    }
    pattern = p;
    renderAll();
  });

  // Don't keep drumming in a background tab
  document.addEventListener('visibilitychange', function () { if (document.hidden && playing) stop(); });
})();

// ---------- Card footer ----------
// "MICV LAB  ●  1/10" along the bottom of each card, numbered in list order.
// In-progress cards are left out of the numbering and the total.
(function () {
  var papers = document.querySelectorAll('.paper:not(.wip)');
  papers.forEach(function (paper, i) {
    var face = paper.querySelector('.card-face');
    if (!face) return;
    var foot = document.createElement('p');
    foot.className = 'card-foot';
    foot.innerHTML = '<span>MICV LAB</span><span aria-hidden="true">\u25cf</span><span>' + (i + 1) + '/' + papers.length + '</span>';
    face.appendChild(foot);
  });
})();

// ---------- In-progress cards ----------
// Papers marked "wip" get a dashed, see-through outline over the unprinted part
(function () {
  document.querySelectorAll('.paper.wip .card').forEach(function (card) {
    card.insertAdjacentHTML('beforeend',
      '<div class="wip-ghost" aria-hidden="true"></div>' +
      '<p class="wip-label"><b>IN PROGRESS</b><span>Under review</span></p>');
  });
})();

// ---------- Paper card tilt ----------
// Each paper card turns toward the cursor like a physical trading card, and
// eases back when the cursor leaves. Mouse only, so touch scrolling never triggers it.
(function () {
  var MAX = 12; // degrees
  // Light position as a percentage, kept inside the element so the foil never runs off its edge
  var pct = function (v) { return (Math.max(0, Math.min(1, v)) * 100).toFixed(1) + '%'; };
  document.querySelectorAll('.paper').forEach(function (paper) {
    var card = paper.querySelector('.card');
    var fig = paper.querySelector('.paper-fig');
    if (!card) return;
    var raf = null, ev = null;

    function update() {
      raf = null;
      var c = card.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, (ev.clientX - c.left) / c.width));
      var y = Math.max(0, Math.min(1, (ev.clientY - c.top) / c.height));
      card.style.setProperty('--ry', ((x - 0.5) * 2 * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - y) * 2 * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--gx', pct(x));
      card.style.setProperty('--gy', pct(y));
      if (fig) {
        var r = fig.getBoundingClientRect();
        fig.style.setProperty('--gx', pct((ev.clientX - r.left) / r.width));
        fig.style.setProperty('--gy', pct((ev.clientY - r.top) / r.height));
      }
    }

    paper.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      ev = e;
      card.classList.add('is-tilting');
      if (fig) fig.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(update);
    });
    paper.addEventListener('pointerleave', function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      card.classList.remove('is-tilting');
      if (fig) fig.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
})();

// ---------- Card view ----------
// Click or tap a paper card to lift it, enlarged, to the center of the screen.
// The cursor (or a finger drag on touch screens) tilts it. Clicking the card
// flips it over to the shared card back, clicking outside the card closes it.
(function () {
  var touchScreen = window.matchMedia('(hover: none)');
  var papers = document.querySelectorAll('.paper');
  if (!papers.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE = 'cubic-bezier(.2, .8, .2, 1)';
  var MAX = 16; // degrees, finger drag
  var MAX_MOUSE = 12;
  var pct = function (v) { return (Math.max(0, Math.min(1, v)) * 100).toFixed(1) + '%'; };

  var view = document.createElement('div');
  view.className = 'card-view';
  view.hidden = true;
  view.setAttribute('role', 'dialog');
  view.setAttribute('aria-modal', 'true');
  view.setAttribute('aria-label', 'Paper card');
  var hint = document.createElement('p');
  hint.className = 'lightbox-hint';
  hint.textContent = 'drag to tilt · tap to close';
  view.appendChild(hint);
  document.body.appendChild(view);

  var src = null, clone = null, card = null, fig = null, busy = false, flipped = false, turns = 0;

  // The back of the card, the same for every paper: a ViT-style patch grid
  // with a name plate, like the back of a trading card
  function buildBack() {
    var back = document.createElement('div');
    back.className = 'card-back';
    back.innerHTML =
      '<div class="back-patches"></div>' +
      '<p class="back-title">Paper Collection</p>' +
      '<div class="back-plate">' +
        '<p class="back-name">Junhyeok Kim</p>' +
        '<p class="back-email">timespt@yonsei.ac.kr</p>' +
      '</div>' +
      '<p class="back-lab">MICV Lab</p>';
    return back;
  }

  // Every flip turns the card another half turn the same way, so it never
  // swings back the way it came
  function setFlip(on) {
    if (!card || on === flipped) return;
    flipped = on;
    turns++;
    card.classList.add('is-flipping');
    card.style.setProperty('--flip', (-180 * turns) + 'deg');
    clearTimeout(card._flipTimer);
    card._flipTimer = setTimeout(function () { if (card) card.classList.remove('is-flipping'); }, 700);
  }

  function flip(from, to) {
    var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + (from.width / to.width) + ')';
  }

  function open(paper, viaTouch) {
    if (busy || src) return;
    hint.textContent = viaTouch
      ? 'tap to flip \u00b7 drag to tilt \u00b7 tap outside to close'
      : 'click card to flip \u00b7 click outside to close';
    busy = true;
    src = paper;
    clone = paper.cloneNode(true);
    clone.classList.remove('reveal', 'in');
    clone.querySelectorAll('.card-hint').forEach(function (el) { el.remove(); });
    clone.querySelectorAll('[tabindex]').forEach(function (el) {
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
    });
    clone.querySelectorAll('img').forEach(function (img) { img.loading = 'eager'; });
    paper.dispatchEvent(new PointerEvent('pointerleave'));  // drop the list tilt first
    view.insertBefore(clone, hint);
    card = clone.querySelector('.card');
    fig = clone.querySelector('.paper-fig');
    flipped = false;
    turns = 0;
    card.appendChild(buildBack());

    document.documentElement.classList.add('lightbox-open');
    view.hidden = false;
    var from = paper.querySelector('.card').getBoundingClientRect();
    var to = card.getBoundingClientRect();
    paper.style.visibility = 'hidden';
    requestAnimationFrame(function () { view.classList.add('is-open'); });
    var frames = reduce.matches
      ? [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }]
      : [{ transform: flip(from, to) }, { transform: 'none' }];
    clone.animate(frames, { duration: 420, easing: EASE }).onfinish = function () { busy = false; };
  }

  function close() {
    if (busy || !src) return;
    busy = true;
    resetTilt();
    if (flipped) setFlip(false);
    var to = src.querySelector('.card').getBoundingClientRect();
    var from = card.getBoundingClientRect();
    view.classList.remove('is-open');
    var frames = reduce.matches
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ transform: 'none' }, { transform: flip(to, from) }];
    clone.animate(frames, { duration: 360, easing: EASE, fill: 'forwards' }).onfinish = function () {
      src.style.visibility = '';
      clone.remove();
      view.hidden = true;
      document.documentElement.classList.remove('lightbox-open');
      src = clone = card = fig = null;
      busy = false;
    };
  }

  function resetTilt() {
    if (!card) return;
    card.classList.remove('is-tilting');
    if (fig) fig.classList.remove('is-tilting');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }

  // A drag over the card tilts it, a tap anywhere closes the view
  var touchId = null, startX = 0, startY = 0, dragged = false;
  view.addEventListener('pointerdown', function (e) {
    if (busy) return;
    if (touchId !== null) return;
    touchId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    dragged = false;
  });
  function tiltTo(e) {
    var r = card.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      resetTilt();
      return;
    }
    var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    var max = e.pointerType === 'mouse' ? MAX_MOUSE : MAX;
    card.classList.add('is-tilting');
    card.style.setProperty('--ry', ((x - 0.5) * 2 * max).toFixed(2) + 'deg');
    card.style.setProperty('--rx', ((0.5 - y) * 2 * max).toFixed(2) + 'deg');
    card.style.setProperty('--gx', pct(x));
    card.style.setProperty('--gy', pct(y));
    if (fig) {
      var f = fig.getBoundingClientRect();
      fig.classList.add('is-tilting');
      fig.style.setProperty('--gx', pct((e.clientX - f.left) / f.width));
      fig.style.setProperty('--gy', pct((e.clientY - f.top) / f.height));
    }
  }
  view.addEventListener('pointermove', function (e) {
    if (busy || !card) return;
    if (e.pointerType === 'mouse') { tiltTo(e); return; }  // a mouse tilts on hover
    if (e.pointerId !== touchId) return;
    if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) dragged = true;
    if (dragged) tiltTo(e);
  });
  function endTouch(e) {
    if (e.pointerId !== touchId) return;
    touchId = null;
    if (dragged) { if (e.pointerType !== 'mouse') resetTilt(); return; }
    if (e.type !== 'pointerup' || e.target.closest('a')) return;
    // A click on the card flips it, a click outside closes the view
    if (card && card.contains(e.target)) setFlip(!flipped);
    else close();
  }
  // A mouse that leaves the window lays the card flat again. Left tilted and
  // still, the browser can redraw the card at a lower resolution after a moment.
  view.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse' && card && !busy) resetTilt();
  });
  view.addEventListener('pointerup', endTouch);
  view.addEventListener('pointercancel', endTouch);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    else if ((e.key === 'Enter' || e.key === ' ') && src && !busy) { e.preventDefault(); setFlip(!flipped); }
  });

  papers.forEach(function (paper) {
    var src = paper.querySelector('.card');
    if (!src) return;
    src.setAttribute('role', 'button');
    src.setAttribute('tabindex', '0');
    src.setAttribute('aria-label', 'Enlarge card');
    var tip = document.createElement('span');
    tip.className = 'card-hint';
    tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>Click to enlarge';
    src.appendChild(tip);
    paper.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      open(paper, e.pointerType ? e.pointerType !== 'mouse' : touchScreen.matches);
    });
    src.addEventListener('keydown', function (e) {
      if (e.target !== src) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(paper, false); }
    });
  });
})();

// ---------- Album shelf ----------
// Each "music" link opens that year's albums right inside the music card.
// Hovering (or tapping) a sleeve peeks its record out and names the album.
(function () {
  var links = document.querySelectorAll('.music-list a[href*="topster_"]');
  var card = document.querySelector('.misc-music');
  if (!links.length || !card) return;
  var BASE = 'images/misc/topster/';
  var data = null, year = null, closeTimer = null;

  var shelf = document.createElement('div');
  shelf.className = 'shelf';
  shelf.innerHTML =
    '<div class="shelf-inner"><div class="shelf-head">' +
      '<span class="shelf-now" aria-live="polite"></span>' +
      '<button class="shelf-close">close \u2715</button>' +
    '</div><div class="shelf-grid"></div></div>';
  card.appendChild(shelf);
  var grid = shelf.querySelector('.shelf-grid'), now = shelf.querySelector('.shelf-now');

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function idle() { now.textContent = 'My ' + year + ' \u00b7 ' + data[year].albums.length + ' albums'; }
  function show(i) {
    var a = data[year].albums[i];
    now.innerHTML = '<b>' + pad(i + 1) + '</b>';
    now.appendChild(document.createTextNode(a[0] + ' \u00b7 ' + a[1]));
  }

  function render(y) {
    year = y;
    var d = data[y];
    shelf.style.setProperty('--sprite', 'url("' + BASE + y + '.jpg")');
    shelf.style.setProperty('--rows-pct', d.rows * 100 + '%');
    grid.innerHTML = d.albums.map(function (a, i) {
      var p = (i % 5) * 25 + '% ' + Math.floor(i / 5) / (d.rows - 1) * 100 + '%';
      return '<button class="shelf-tile" data-i="' + i + '" style="--i:' + i + ';--c:' + a[2] + '" aria-label="' +
        (i + 1) + '. ' + a[0].replace(/"/g, '&quot;') + ', ' + a[1].replace(/"/g, '&quot;') + '">' +
        '<span class="tile-disc"></span><span class="tile-cover" style="background-position:' + p + '"></span></button>';
    }).join('');
    idle();
    links.forEach(function (l) {
      l.classList.toggle('is-active', l.dataset.year === y);
      l.setAttribute('aria-expanded', l.dataset.year === y ? 'true' : 'false');
    });
  }

  function open(y) {
    clearTimeout(closeTimer);
    render(y);
    shelf.classList.add('is-open');
  }
  function close() {
    shelf.classList.remove('is-open');
    links.forEach(function (l) { l.classList.remove('is-active'); l.setAttribute('aria-expanded', 'false'); });
    year = null;
    closeTimer = setTimeout(function () { grid.innerHTML = ''; }, 500);
  }

  links.forEach(function (a) {
    var m = a.getAttribute('href').match(/topster_(\d{4})/);
    if (!m) return;
    a.dataset.year = m[1];
    a.setAttribute('aria-expanded', 'false');
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;  // "open in new tab" still gets the PNG
      e.preventDefault();
      if (year === m[1]) { close(); return; }
      var go = function () { open(m[1]); };
      if (data) return go();
      fetch(BASE + 'albums.json').then(function (r) { return r.json(); })
        .then(function (j) { data = j; go(); })
        .catch(function () { window.location.href = a.href; });
    });
  });
  shelf.querySelector('.shelf-close').addEventListener('click', close);

  var on = null;
  function setOn(t) {
    if (on) on.classList.remove('is-on');
    on = t;
    if (t) { t.classList.add('is-on'); show(+t.dataset.i); } else if (year) idle();
  }
  grid.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'mouse') setOn(e.target.closest('.shelf-tile'));
  });
  grid.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') setOn(null); });
  grid.addEventListener('focusin', function (e) {
    var t = e.target.closest('.shelf-tile');
    if (t && t.matches(':focus-visible')) setOn(t);
  });
  grid.addEventListener('focusout', function (e) { if (e.target === on) setOn(null); });
  // On a touch screen a tap peeks the record, a second tap puts it back
  grid.addEventListener('click', function (e) {
    var t = e.target.closest('.shelf-tile');
    if (!t || e.pointerType === 'mouse') return;
    setOn(t === on ? null : t);
  });
})();
