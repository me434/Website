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

  /* ---------- Nav: mark the section in view ---------- */
  const navLinks = $$('.head-nav a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const map = new Map(navLinks.map(a => [a.getAttribute('href').slice(1), a]));
    const nio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const a = map.get(e.target.id);
        if (a) a.setAttribute('aria-current', e.isIntersecting ? 'true' : 'false');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) nio.observe(s); });
  }

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
      const w = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * w * 2, behavior: reduce ? 'auto' : 'smooth' });
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

  /* ---------- Gallery + lightbox ---------- */
  const gal = $('[data-gallery]');
  if (gal && window.GALLERY) {
    const items = window.GALLERY;
    const grid = $('.grid', gal);
    const filters = $('.filters', gal);
    const moreBtn = $('[data-more]', gal);
    const PAGE = 12;
    let filter = 'all', expanded = false, view = [];

    const groups = [...new Set(items.map(i => i.group))];
    const mkChip = (key, label, count) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.filter = key;
      b.setAttribute('aria-pressed', key === filter ? 'true' : 'false');
      b.innerHTML = `${label} <sup>${String(count).padStart(2, '0')}</sup>`;
      b.addEventListener('click', () => { filter = key; expanded = false; render(true); });
      return b;
    };
    filters.appendChild(mkChip('all', 'All', items.length));
    groups.forEach(g => filters.appendChild(mkChip(g, g, items.filter(i => i.group === g).length)));

    function render(animate) {
      $$('.chip', filters).forEach(c => c.setAttribute('aria-pressed', c.dataset.filter === filter ? 'true' : 'false'));
      view = items.filter(i => filter === 'all' || i.group === filter);
      const shown = expanded ? view : view.slice(0, PAGE);
      grid.innerHTML = '';
      shown.forEach((it, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tile' + (animate ? ' is-entering' : '');
        b.style.setProperty('--td', `${Math.min(idx, 12) * 35}ms`);
        b.setAttribute('aria-label', `${it.title}, ${it.group}. Open larger`);
        b.innerHTML = `<img src="${it.thumb}" alt="" loading="lazy" decoding="async" width="400" height="284"><span class="tile-cap"><small>${it.group}</small>${it.title}</span>`;
        b.addEventListener('click', () => openLb(idx));
        grid.appendChild(b);
      });
      const rest = view.length - shown.length;
      moreBtn.hidden = rest <= 0;
      moreBtn.innerHTML = `Show all ${view.length} <span class="arrow">↓</span>`;
    }
    moreBtn.addEventListener('click', () => {
      expanded = true;
      const from = grid.children.length;
      render(false);
      [...grid.children].slice(from).forEach((t, k) => { t.classList.add('is-entering'); t.style.setProperty('--td', `${Math.min(k, 12) * 35}ms`); });
      grid.children[from] && grid.children[from].focus({ preventScroll: true });
    });
    render(false);

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
    lb.addEventListener('close', () => { doc.style.overflow = ''; const t = grid.children[cur]; t && t.focus({ preventScroll: true }); });
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
