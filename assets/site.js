/* Max Dodson — site · shared behaviour
   Everything here is progressive: without JS the pages read fine and show every image. */
(() => {
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  doc.classList.add('js');

  /* ---------- Header: solid on scroll, hide on scroll down ---------- */
  const head = $('[data-head]');
  if (head) {
    let lastY = scrollY;
    const onScroll = () => {
      const y = scrollY;
      head.classList.toggle('is-scrolled', y > 8);
      head.classList.toggle('is-hidden', y > 320 && y > lastY && !head.contains(document.activeElement));
      lastY = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Light / dark switch (remembers the visitor's choice) ---------- */
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const themeNow = () => doc.dataset.theme || (darkMq.matches ? 'dark' : 'light');
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') doc.dataset.theme = saved;
  } catch {}
  $$('[data-theme-toggle]').forEach(sw => {
    const label = $('[data-theme-label]', sw);
    const paint = () => {
      const dark = themeNow() === 'dark';
      sw.setAttribute('aria-checked', dark ? 'true' : 'false');
      if (label) label.textContent = dark ? 'Dark' : 'Light';
    };
    sw.addEventListener('click', () => {
      const next = themeNow() === 'dark' ? 'light' : 'dark';
      doc.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch {}
      paint();
    });
    darkMq.addEventListener('change', paint);
    paint();
  });

  /* ---------- Word split for load-in rise ---------- */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const wrap = node => {
      const w = document.createElement('span');
      w.className = 'w';
      const inner = node.nodeType === 1 && node.classList.contains('inline-media') ? node : document.createElement('span');
      if (inner !== node) inner.textContent = node.textContent;
      w.style.setProperty('--i', i++);
      w.appendChild(inner);
      return w;
    };
    [...el.childNodes].forEach(node => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
          else { const t = document.createTextNode(part); frag.appendChild(wrap(t)); }
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === 1 && node.classList.contains('inline-media')) {
        const w = document.createElement('span');
        w.className = 'w';
        w.style.setProperty('--i', i++);
        el.replaceChild(w, node);
        w.appendChild(node);
      } else if (node.nodeType === 1) {
        // an inline element like <span class="muted">: split its words, keep the wrapper
        const words = node.textContent.split(/(\s+)/);
        node.textContent = '';
        words.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) node.appendChild(document.createTextNode(' '));
          else node.appendChild(wrap(document.createTextNode(part)));
        });
      }
    });
  });

  /* ---------- Scroll reveal (only for things below the fold at load) ---------- */
  const revealEls = $$('[data-reveal]');
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.remove('is-pending'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => {
      if (el.getBoundingClientRect().top > innerHeight * 0.92) {
        el.classList.add('is-pending');
        io.observe(el);
      }
    });
  }

  /* ---------- Scroll-lit words ---------- */
  const scrubs = $$('[data-scrub]').map(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((w, idx) => {
      const s = document.createElement('span');
      s.className = 'sw';
      s.textContent = w;
      el.appendChild(s);
      if (idx < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    return { el, spans };
  });
  const runScrub = () => {
    scrubs.forEach(({ el, spans }) => {
      if (reduce) { spans.forEach(s => s.classList.add('is-lit')); return; }
      const r = el.getBoundingClientRect();
      const start = innerHeight * 0.85, end = innerHeight * 0.35;
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end + r.height * 0.6)));
      const n = Math.round(p * spans.length);
      spans.forEach((s, i) => s.classList.toggle('is-lit', i < n));
    });
  };

  /* ---------- Odometer ---------- */
  const DIGITS = 20; // two passes of 0–9 so a first roll spins
  function buildOdo(el) {
    const value = el.textContent.trim();
    el.setAttribute('aria-label', value);
    el.textContent = '';
    el.classList.add('odo');
    const holder = document.createElement('span');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.display = 'inline-flex';
    el.appendChild(holder);
    el._odo = { holder, strips: [] };
    setOdo(el, value, { initial: true });
    return el;
  }
  function makeStrip() {
    const d = document.createElement('span');
    d.className = 'odo-d';
    const s = document.createElement('span');
    s.className = 'odo-s';
    for (let k = 0; k < DIGITS; k++) { const n = document.createElement('span'); n.textContent = k % 10; s.appendChild(n); }
    d.appendChild(s);
    return d;
  }
  function setOdo(el, value, { initial = false, spin = false } = {}) {
    const { holder } = el._odo;
    const chars = [...value];
    // rebuild structure if the shape changed
    const shape = chars.map(c => /\d/.test(c) ? 'd' : c).join('');
    if (holder.dataset.shape !== shape) {
      holder.textContent = '';
      chars.forEach(c => {
        if (/\d/.test(c)) holder.appendChild(makeStrip());
        else { const s = document.createElement('span'); s.className = 'odo-c'; s.textContent = c; holder.appendChild(s); }
      });
      holder.dataset.shape = shape;
    }
    const strips = $$('.odo-s', holder);
    const digits = chars.filter(c => /\d/.test(c)).map(Number);
    strips.forEach((s, i) => {
      const d = digits[i];
      const idx = spin ? 10 + d : d;
      s.style.setProperty('--od', `${(strips.length - 1 - i) * 0.08}s`);
      if (initial) { s.style.transition = 'none'; s.style.transform = 'translateY(0)'; s.offsetHeight; s.style.transition = ''; }
      else s.style.transform = `translateY(${-idx * 1.1}em)`;
    });
    el._odo.value = value;
    el.setAttribute('aria-label', value);
  }
  const odos = $$('[data-odo]').map(buildOdo);
  if ('IntersectionObserver' in window && !reduce) {
    const oio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { setOdo(e.target, e.target._odo.value, { spin: true }); oio.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    odos.forEach(o => oio.observe(o));
  } else {
    odos.forEach(o => setOdo(o, o._odo.value));
  }

  /* ---------- Durations (inclusive months, LinkedIn style) ---------- */
  const fmtDur = (start, end) => {
    const [sy, sm] = start.split('-').map(Number);
    const now = new Date();
    const [ey, em] = end ? end.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
    const months = (ey - sy) * 12 + (em - sm) + 1;
    const y = Math.floor(months / 12), m = months % 12;
    const parts = [];
    if (y) parts.push(`${y} yr${y > 1 ? 's' : ''}`);
    if (m) parts.push(`${m} mo${m > 1 ? 's' : ''}`);
    return parts.join(' ');
  };
  $$('[data-duration]').forEach(el => { el.textContent = fmtDur(el.dataset.start, el.dataset.end); });
  $$('[data-year-now]').forEach(el => { el.textContent = new Date().getFullYear(); });

  /* ---------- Timeline: progress rail + year odometer ---------- */
  const tl = $('[data-timeline]');
  let runTimeline = () => {};
  if (tl) {
    const list = $('.tl-list', tl);
    const fill = $('[data-tl-fill]', tl);
    const items = $$('.tl-item', tl);
    const yearEl = $('[data-year-odo]', tl);
    const label = $('[data-tl-label]', tl);
    if (yearEl) buildOdo(yearEl), setOdo(yearEl, items[0].dataset.year);
    let active = -1;
    runTimeline = () => {
      const r = list.getBoundingClientRect();
      const mark = innerHeight * 0.45;
      const p = Math.min(1, Math.max(0, (mark - r.top) / r.height));
      fill.style.setProperty('--p', p.toFixed(4));
      let current = 0;
      items.forEach((it, i) => {
        const top = it.getBoundingClientRect().top;
        const passed = top < mark;
        it.classList.toggle('is-passed', passed);
        if (passed) current = i;
      });
      if (current !== active && yearEl) {
        active = current;
        setOdo(yearEl, items[current].dataset.year);
        if (label) {
          label.classList.add('is-swapping');
          setTimeout(() => { label.textContent = items[current].dataset.name; label.classList.remove('is-swapping'); }, 180);
        }
      }
    };
  }

  /* ---------- Parallax on media ---------- */
  const para = reduce ? [] : $$('[data-parallax]');
  const runParallax = () => {
    para.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1
      el.style.setProperty('--py', `${(-c * 4).toFixed(2)}%`);
    });
  };

  /* ---------- One rAF-throttled scroll loop ---------- */
  let ticking = false;
  const frame = () => { runScrub(); runTimeline(); runParallax(); ticking = false; };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  frame();

  /* ---------- Copy email ---------- */
  $$('[data-copy]').forEach(btn => {
    const original = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copied';
      } catch {
        const sel = getSelection(), range = document.createRange();
        const target = document.getElementById(btn.dataset.copyTarget);
        if (target) { range.selectNodeContents(target); sel.removeAllRanges(); sel.addRange(range); }
        btn.textContent = 'Selected — press ⌘C';
      }
      setTimeout(() => { btn.textContent = original; }, 2200);
    });
  });

  /* ---------- Film: YouTube facade + click-to-play videos ---------- */
  $$('[data-yt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const frame = btn.closest('.film-frame');
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0&modestbranding=1`;
      iframe.title = btn.dataset.title || 'YouTube video';
      iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      frame.innerHTML = '';
      frame.appendChild(iframe);
    });
  });
  $$('[data-play]').forEach(btn => {
    const video = btn.closest('.film-frame').querySelector('video');
    btn.addEventListener('click', () => {
      video.controls = true;
      video.muted = false;
      video.play().catch(() => {});
      btn.remove();
    });
  });
  // Muted ambient loops play only while visible
  const loops = $$('video[data-autoplay]');
  if (loops.length && 'IntersectionObserver' in window) {
    const vio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting && !reduce) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: 0.25 });
    loops.forEach(v => { v.muted = true; vio.observe(v); });
  }

  /* ---------- Horizontal scroller ---------- */
  $$('[data-scroller]').forEach(root => {
    const track = $('.scroller-track', root);
    const bar = $('.scroller-bar span', root);
    const prev = $('[data-prev]', root), next = $('[data-next]', root);
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const vis = track.clientWidth / track.scrollWidth;
      const p = max > 0 ? track.scrollLeft / max : 1;
      bar.style.setProperty('--sp', Math.max(vis, vis + (1 - vis) * p).toFixed(3));
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft > max - 4;
    };
    const step = dir => {
      const card = track.querySelector('.screen');
      const dist = card ? (card.getBoundingClientRect().width + 24) * 2 : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * dist, behavior: reduce ? 'auto' : 'smooth' });
    };
    prev && prev.addEventListener('click', () => step(-1));
    next && next.addEventListener('click', () => step(1));
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
    // mouse drag
    let down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-dragging'); }
      track.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
    });
    track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  /* ---------- Gallery: expanding strip + lightbox ---------- */
  const gal = $('[data-gallery]');
  if (gal && window.GALLERY) {
    const items = window.GALLERY;
    const filters = $('.filters', gal);
    const reel = $('[data-reel]', gal);
    const track = $('.reel-track', reel);
    const cap = $('[data-reel-open]', gal);
    const count = $('.reel-count', gal);
    const DWELL = 3400;
    let filter = 'all', view = [], panels = [], n = 0, copies = 1, pos = 0;
    let dims = { c: 0, w: 0, a: 0, g: 0 };
    let timer = null, hovering = false, inView = false, settle = null;

    const groups = [...new Set(items.map(i => i.group))];
    const mkChip = (key, label, total) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.filter = key;
      b.setAttribute('aria-pressed', key === filter ? 'true' : 'false');
      b.innerHTML = `${label} <sup>${String(total).padStart(2, '0')}</sup>`;
      b.addEventListener('click', () => { filter = key; build(); });
      return b;
    };
    filters.appendChild(mkChip('all', 'All', items.length));
    groups.forEach(g => filters.appendChild(mkChip(g, g, items.filter(i => i.group === g).length)));

    function measure() {
      const c = reel.clientWidth, h = reel.clientHeight;
      const small = c < 640;
      const w = Math.round(Math.max(small ? 34 : 56, Math.min(c * 0.075, 120)));
      const a = Math.round(small ? c * 0.72 : Math.min(c * 0.6, h * 1.5));
      const g = parseFloat(getComputedStyle(track).columnGap) || 10;
      reel.style.setProperty('--w', w + 'px');
      reel.style.setProperty('--a', a + 'px');
      dims = { c, w, a, g };
    }

    // Enough copies of the set that the strip never runs out either side
    function build() {
      $$('.chip', filters).forEach(c => c.setAttribute('aria-pressed', c.dataset.filter === filter ? 'true' : 'false'));
      view = items.filter(i => filter === 'all' || i.group === filter);
      n = view.length;
      measure();
      const perCopy = n * (dims.w + dims.g);
      copies = Math.max(3, Math.ceil((dims.c * 2 + dims.a) / perCopy) | 1);
      if (copies % 2 === 0) copies += 1;
      track.innerHTML = '';
      panels = [];
      for (let k = 0; k < copies; k++) {
        view.forEach((it, i) => {
          const p = document.createElement('div');
          p.className = 'reel-panel';
          p.dataset.index = panels.length;
          p.innerHTML = `<img src="${it.full}" alt="" loading="lazy" decoding="async">`;
          track.appendChild(p);
          panels.push(p);
        });
      }
      pos = Math.floor(copies / 2) * n;
      place(false);
      restart();
    }

    const itemAt = p => view[((p % n) + n) % n];

    function place(animate) {
      reel.classList.toggle('is-still', !animate);
      panels.forEach((p, j) => p.classList.toggle('is-active', j === pos));
      const x = dims.c / 2 - (pos * (dims.w + dims.g) + dims.a / 2);
      track.style.transform = `translate3d(${x}px, 0, 0)`;
      // Load what's about to be seen, since the strip clips lazy images
      for (let j = pos - 8; j <= pos + 10; j++) { const im = panels[j] && panels[j].firstChild; if (im && im.loading === 'lazy') im.loading = 'eager'; }
      const it = itemAt(pos), i = ((pos % n) + n) % n;
      cap.innerHTML = `<small>${it.group}</small><span>${it.title}</span>`;
      cap.setAttribute('aria-label', `${it.title}, ${it.group}. Open full size`);
      count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
      if (!animate) { track.offsetHeight; reel.classList.remove('is-still'); }
    }

    // After a move, hop back to the same piece in the middle copy without animating
    function go(target) {
      pos = target;
      place(true);
      clearTimeout(settle);
      settle = setTimeout(() => {
        const base = Math.floor(copies / 2) * n;
        const norm = base + (((pos - base) % n) + n) % n;
        if (norm !== pos) { pos = norm; place(false); }
      }, reduce ? 0 : 1150);
    }

    function tick() { go(pos + 1); }
    function restart() {
      clearInterval(timer); timer = null;
      if (!reduce && inView && !hovering && n > 1 && !document.hidden) timer = setInterval(tick, DWELL);
    }

    reel.addEventListener('click', e => {
      const p = e.target.closest('.reel-panel');
      if (!p || moved) return;
      const j = +p.dataset.index;
      if (j === pos) openLb(((pos % n) + n) % n);
      else { go(j); restart(); }
    });
    cap.addEventListener('click', () => openLb(((pos % n) + n) % n));
    $('[data-reel-prev]', gal).addEventListener('click', () => { go(pos - 1); restart(); });
    $('[data-reel-next]', gal).addEventListener('click', () => { go(pos + 1); restart(); });
    reel.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovering = true; restart(); } });
    reel.addEventListener('pointerleave', () => { hovering = false; restart(); });
    // Swipe on touch
    let sx = null, moved = false;
    reel.addEventListener('pointerdown', e => { sx = e.clientX; moved = false; });
    reel.addEventListener('pointerup', e => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) { moved = true; go(pos + (dx < 0 ? 1 : -1)); restart(); setTimeout(() => { moved = false; }, 0); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { inView = es[0].isIntersecting; restart(); }, { threshold: 0.3 }).observe(reel);
    }
    document.addEventListener('visibilitychange', restart);
    let rz;
    const showIndex = i => { pos = Math.floor(copies / 2) * n + i; place(false); };
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const i = ((pos % n) + n) % n; build(); showIndex(i); }, 150); });
    build();

    const lb = $('#lightbox');
    const lbImg = $('.lb-stage img', lb);
    const lbCap = $('.lb-cap', lb);
    const lbCount = $('.lb-count', lb);
    let cur = 0;
    function show(i) {
      cur = (i + view.length) % view.length;
      const it = view[cur];
      lbImg.src = it.full;
      lbImg.alt = `${it.title} — ${it.group}`;
      lbImg.style.animation = 'none'; lbImg.offsetHeight; lbImg.style.animation = '';
      lbCap.innerHTML = `<small>${it.group}</small>${it.title}`;
      lbCount.textContent = `${String(cur + 1).padStart(2, '0')} / ${String(view.length).padStart(2, '0')}`;
      // warm the neighbours
      [cur + 1, cur - 1].forEach(n => { const im = new Image(); im.src = view[(n + view.length) % view.length].full; });
    }
    function openLb(i) {
      show(i);
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      doc.style.overflow = 'hidden';
    }
    lb.addEventListener('close', () => { doc.style.overflow = ''; showIndex(cur); restart(); cap.focus({ preventScroll: true }); });
    $('[data-lb-close]', lb).addEventListener('click', () => lb.close());
    $('[data-lb-prev]', lb).addEventListener('click', () => show(cur - 1));
    $('[data-lb-next]', lb).addEventListener('click', () => show(cur + 1));
    lb.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'ArrowLeft') show(cur - 1);
    });
    lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-stage')) lb.close(); });
    let tx = null;
    lb.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (tx == null) return;
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
      tx = null;
    });
  }
})();
