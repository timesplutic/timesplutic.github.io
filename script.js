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
