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
    papers.forEach(function (p) { if (matches(p, f)) n++; });
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

// ---------- Figure lightbox ----------
// Click a paper figure to enlarge it, click anywhere (or press Esc) to put it back.
// The figure flies from its spot in the card to the center and back again.
(function () {
  var figs = document.querySelectorAll('.paper-fig');
  if (!figs.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE = 'cubic-bezier(.2, .8, .2, 1)';

  var box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Enlarged figure');
  var frame = document.createElement('div');
  frame.className = 'lightbox-frame';
  var big = document.createElement('img');
  frame.appendChild(big);
  var hint = document.createElement('p');
  hint.className = 'lightbox-hint';
  hint.textContent = window.matchMedia('(hover: none)').matches
    ? 'drag to tilt \u00b7 tap to close'
    : 'click anywhere to close';
  box.appendChild(frame);
  box.appendChild(hint);
  document.body.appendChild(box);

  var current = null, busy = false;

  // Transform that maps the enlarged image back onto the thumbnail's box
  function flip(from, to) {
    var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    var sx = from.width / to.width, sy = from.height / to.height;
    return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')';
  }
  function frames(start) {
    return reduce.matches
      ? [{ transform: 'scale(0.96)', opacity: 0 }, { transform: 'none', opacity: 1 }]
      : [{ transform: start }, { transform: 'none' }];
  }

  function open(fig) {
    if (busy || current) return;
    var img = fig.querySelector('img');
    current = fig;
    busy = true;
    var card = fig.closest('.paper');
    if (card) card.dispatchEvent(new PointerEvent('pointerleave'));  // drop any tilt first

    var scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.classList.add('lightbox-open');
    document.body.style.paddingRight = scrollbar ? scrollbar + 'px' : '';

    frame.classList.toggle('is-holo', !!fig.closest('.paper-featured'));
    resetTilt();
    big.alt = img.alt;
    big.src = img.currentSrc || img.src;
    box.hidden = false;

    var go = function () {
      var from = fig.getBoundingClientRect();
      var to = frame.getBoundingClientRect();
      // Perspective scales with the frame, so a small phone frame still visibly tilts
      frame.style.setProperty('--persp', Math.round(Math.max(600, Math.min(1600, to.width * 1.35))) + 'px');
      fig.classList.add('is-zoomed');
      box.classList.add('is-open');
      var anim = frame.animate(frames(flip(from, to)), { duration: reduce.matches ? 200 : 450, easing: EASE });
      anim.onfinish = function () { busy = false; };
      box.focus({ preventScroll: true });
    };
    if (big.complete && big.naturalWidth) go(); else big.onload = go;
  }

  function close() {
    if (busy || !current) return;
    busy = true;
    var fig = current;
    var from = fig.getBoundingClientRect();
    resetTilt();
    var to = frame.getBoundingClientRect();
    box.classList.remove('is-open');
    var anim = frame.animate(frames(flip(from, to)).reverse(), { duration: reduce.matches ? 180 : 380, easing: EASE, fill: 'forwards' });
    anim.onfinish = function () {
      box.hidden = true;
      anim.cancel();
      fig.classList.remove('is-zoomed');
      document.documentElement.classList.remove('lightbox-open');
      document.body.style.paddingRight = '';
      current = null;
      busy = false;
      fig.focus({ preventScroll: true });
    };
  }

  // Same card tilt and glare as in the list, on the enlarged figure
  var MAX = 8, MAX_TOUCH = 14, tiltRaf = null, tiltEv = null;
  var pct = function (v) { return (Math.max(0, Math.min(1, v)) * 100).toFixed(1) + '%'; };
  function resetTilt() {
    if (tiltRaf) { cancelAnimationFrame(tiltRaf); tiltRaf = null; }
    frame.classList.remove('is-tilting');
    frame.style.setProperty('--rx', '0deg');
    frame.style.setProperty('--ry', '0deg');
  }
  function tilt() {
    tiltRaf = null;
    var r = frame.getBoundingClientRect();
    var clamp = function (v) { return Math.max(-1, Math.min(1, v)); };
    var nx = clamp((tiltEv.clientX - (r.left + r.width / 2)) / (r.width / 2));
    var ny = clamp((tiltEv.clientY - (r.top + r.height / 2)) / (r.height / 2));
    var max = tiltEv.pointerType === 'touch' ? MAX_TOUCH : MAX;
    frame.style.setProperty('--ry', (nx * max).toFixed(2) + 'deg');
    frame.style.setProperty('--rx', (-ny * max).toFixed(2) + 'deg');
    frame.style.setProperty('--gx', pct((tiltEv.clientX - r.left) / r.width));
    frame.style.setProperty('--gy', pct((tiltEv.clientY - r.top) / r.height));
  }
  frame.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || busy) return;
    tiltEv = e;
    frame.classList.add('is-tilting');
    if (!tiltRaf) tiltRaf = requestAnimationFrame(tilt);
  });
  frame.addEventListener('pointerleave', resetTilt);

  // Touch: dragging a finger anywhere on the overlay tilts the figure, a plain
  // tap still closes it. A second finger (pinch zoom) cancels the tilt.
  var touchId = null, startX = 0, startY = 0, dragged = false, skipClick = false;
  box.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch' || busy) return;
    skipClick = false;
    if (touchId !== null) { touchId = null; dragged = true; resetTilt(); return; }
    touchId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    dragged = false;
  });
  box.addEventListener('pointermove', function (e) {
    if (e.pointerId !== touchId) return;
    if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) dragged = true;
    if (!dragged) return;
    // Like the mouse, the effect only runs while the finger is over the figure
    var r = frame.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      resetTilt();
      return;
    }
    tiltEv = e;
    frame.classList.add('is-tilting');
    if (!tiltRaf) tiltRaf = requestAnimationFrame(tilt);
  });
  function endTouch(e) {
    if (e.pointerId !== touchId) return;
    touchId = null;
    if (dragged) { skipClick = true; resetTilt(); }
  }
  box.addEventListener('pointerup', endTouch);
  box.addEventListener('pointercancel', endTouch);

  box.tabIndex = -1;
  box.addEventListener('click', function () {
    if (skipClick) { skipClick = false; return; }
    close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  figs.forEach(function (fig) {
    fig.setAttribute('role', 'button');
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('aria-label', 'Enlarge figure');
    var hint = document.createElement('span');
    hint.className = 'fig-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>Click to enlarge';
    fig.appendChild(hint);
    fig.addEventListener('click', function () { open(fig); });
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(fig); }
    });
  });
})();
