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
    { name: 'Clap', short: 'CLP', play: clap }
  ];
  // Default groove: a simple backbeat
  var pattern = [
    [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
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
    row.className = 'drum-row';
    row.setAttribute('role', 'row');

    var label = document.createElement('button');
    label.className = 'drum-label';
    label.type = 'button';
    label.title = 'Play ' + tr.name;
    label.textContent = narrow.matches ? tr.short : tr.name;
    label.addEventListener('click', function () { ensureCtx(); tr.play(ctx.currentTime); flash(label); });
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
          pattern[r][c] = pattern[r][c] ? 0 : 1;
          render(r, c);
          if (pattern[r][c] && !playing) { ensureCtx(); tr.play(ctx.currentTime); }
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
    var on = !!pattern[r][c];
    cells[r][c].classList.toggle('on', on);
    cells[r][c].setAttribute('aria-pressed', on);
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
      master.connect(ctx.destination);
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
  function clap(t) {
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1600;
    f.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    [0, 0.012, 0.024].forEach(function (o) {
      g.gain.setValueAtTime(0.8, t + o);
      g.gain.exponentialRampToValueAtTime(0.05, t + o + 0.01);
    });
    g.gain.setValueAtTime(0.6, t + 0.036);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    noise(t, 0.25).connect(f);
    f.connect(g);
    g.connect(master);
  }

  // ----- Scheduler (look-ahead) -----
  var playing = false, step = 0, nextTime = 0, timer = null, queue = [], lastDrawn = -1;
  function bpm() { return +bpmIn.value; }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.12) {
      for (var r = 0; r < tracks.length; r++) if (pattern[r][step]) tracks[r].play(nextTime);
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
    var p = [[], [], [], []];
    for (var c = 0; c < STEPS; c++) {
      var beat = c % 4 === 0, back = c % 8 === 4;
      p[0][c] = (c === 0 || (beat && Math.random() < 0.5) || (!back && Math.random() < 0.15)) ? 1 : 0;
      p[1][c] = (back || (!beat && Math.random() < 0.08)) ? 1 : 0;
      p[2][c] = (c % 2 === 0 ? Math.random() < 0.9 : Math.random() < 0.35) ? 1 : 0;
      p[3][c] = (back && Math.random() < 0.4) || Math.random() < 0.05 ? 1 : 0;
    }
    pattern = p;
    renderAll();
  });

  // Don't keep drumming in a background tab
  document.addEventListener('visibilitychange', function () { if (document.hidden && playing) stop(); });
})();
