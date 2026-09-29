/*
 * The portfolio is a box with three faces (plus a decorative fourth side).
 * `angle` is the box's rotation in degrees: face i is square-on at i * 90.
 *
 * Navigation:
 *   touch     – swipe left / right (the box follows your finger)
 *   trackpad  – two-finger horizontal swipe
 *   keyboard  – ← / →
 *   pointer   – header tabs, side "gates" on wide screens, "Next face" cards
 *
 * While resting, the front face is drawn flat (no 3D transform) so text is
 * crisp and scrolling behaves exactly like a normal page.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const stage = document.getElementById('stage');
  const cube = document.getElementById('cube');
  if (!stage || !cube) return;

  const faces = Array.from(cube.querySelectorAll('.face'));
  const panels = faces.filter((face) => face.id);
  const ids = panels.map((panel) => panel.id);
  const last = panels.length - 1;
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const labels = tabs.map((tab) => (tab.querySelector('.tab-l') || tab).textContent.trim());
  const gates = { prev: document.querySelector('.gate--prev'), next: document.querySelector('.gate--next') };
  const hint = document.querySelector('.swipe-hint');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const store = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (_) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch (_) { /* private mode etc. */ }
    },
  };

  let width = 0;
  let half = 0;
  let angle = 0;
  let index = 0;
  let frame = 0;
  let flat = true;

  /* ── Starfield ───────────────────────────────────────────────────────── */

  const sky = createSky(document.querySelector('.sky'));

  function createSky(canvas) {
    const noop = { setOffset() {} };
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return noop;

    const colors = ['#ffffff', '#ffddaa', '#b0ccff'];
    // Three depth layers: far stars drift least when the box turns.
    const layers = [
      { drift: 0.06, size: 0.55, alpha: 0.45 },
      { drift: 0.14, size: 0.9, alpha: 0.7 },
      { drift: 0.3, size: 1.4, alpha: 0.95 },
    ];

    let w = 0;
    let h = 0;
    let seededWidth = 0;
    let stars = [];
    let offset = 0;
    let raf = 0;
    let meteor = null;
    let nextMeteor = 0;

    function seed() {
      const count = Math.round(clamp((w * h) / 2200, 140, 800));
      stars = [];
      for (let k = 0; k < count; k++) {
        const r = Math.random();
        const layer = r < 0.62 ? 0 : r < 0.9 ? 1 : 2;
        const c = Math.random();
        stars.push({
          x: Math.random(),
          y: Math.random(),
          layer,
          color: c < 0.72 ? 0 : c < 0.86 ? 1 : 2,
          size: layers[layer].size * (0.7 + Math.random() * 0.6),
          alpha: layers[layer].alpha * (0.55 + Math.random() * 0.45),
          twinkle: 0.4 + Math.random() * 1.6,
          phase: Math.random() * Math.PI * 2,
        });
      }
      stars.sort((a, b) => a.color - b.color);
      seededWidth = w;
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Star positions are stored as fractions, so small height changes
      // (mobile toolbars) just stretch the sky instead of reshuffling it.
      if (!stars.length || Math.abs(w - seededWidth) > 80) seed();
    }

    function drawMeteor(now) {
      if (!meteor) {
        if (!nextMeteor) nextMeteor = now + 5000 + Math.random() * 7000;
        if (now < nextMeteor) return;
        meteor = {
          x: w * (0.25 + Math.random() * 0.75),
          y: h * Math.random() * 0.4,
          dx: -(w * 0.18 + Math.random() * w * 0.12),
          dy: h * (0.12 + Math.random() * 0.1),
          start: now,
          duration: 900 + Math.random() * 500,
        };
      }
      const p = (now - meteor.start) / meteor.duration;
      if (p >= 1) {
        meteor = null;
        nextMeteor = now + 7000 + Math.random() * 11000;
        return;
      }
      const hx = meteor.x + meteor.dx * p;
      const hy = meteor.y + meteor.dy * p;
      const tx = hx - meteor.dx * 0.35;
      const ty = hy - meteor.dy * 0.35;
      const gradient = ctx.createLinearGradient(hx, hy, tx, ty);
      gradient.addColorStop(0, `rgba(255, 240, 215, ${(0.85 * Math.sin(Math.PI * p)).toFixed(3)})`);
      gradient.addColorStop(1, 'rgba(255, 240, 215, 0)');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    function draw(now) {
      const still = reduceMotion.matches;
      ctx.clearRect(0, 0, w, h);
      let color = -1;
      for (const s of stars) {
        if (s.color !== color) {
          color = s.color;
          ctx.fillStyle = colors[color];
        }
        let x = (s.x * w - offset * w * layers[s.layer].drift) % w;
        if (x < 0) x += w;
        const y = s.y * h;
        ctx.globalAlpha = still ? s.alpha : s.alpha * (0.72 + 0.28 * Math.sin(now * 0.001 * s.twinkle + s.phase));
        if (s.size < 1.1) {
          ctx.fillRect(x - s.size / 2, y - s.size / 2, s.size, s.size);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, s.size / 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (!still) drawMeteor(now);
    }

    function loop(now) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      cancelAnimationFrame(raf);
      raf = 0;
      if (reduceMotion.matches) draw(0);
      else raf = requestAnimationFrame(loop);
    }

    resize();
    start();
    window.addEventListener('resize', () => {
      resize();
      if (reduceMotion.matches) draw(0);
    });
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', start);

    return {
      setOffset(turn) {
        offset = turn;
        if (reduceMotion.matches) draw(0);
      },
    };
  }

  /* ── The box ─────────────────────────────────────────────────────────── */

  function measure() {
    width = stage.clientWidth || window.innerWidth;
    half = width / 2;
    stage.style.setProperty('--half', `${half}px`);
    stage.style.setProperty('--persp', `${Math.round(Math.max(1000, width * 1.6))}px`);
  }

  function render() {
    const turn = angle / 90;
    const frac = turn - Math.floor(turn);
    const edge = Math.sin(Math.PI * frac); // 0 when square-on, 1 halfway through a turn
    const depth = reduceMotion.matches ? 0 : edge * half * 0.22; // pull back while turning

    cube.style.transform = `translateZ(${(-half - depth).toFixed(2)}px) rotateY(${(-angle).toFixed(3)}deg)`;
    stage.style.setProperty('--edge', edge.toFixed(3));

    for (const face of faces) {
      const rel = ((((angle - Number(face.dataset.face) * 90) % 360) + 540) % 360) - 180;
      const away = Math.abs(rel);
      face.style.setProperty('--dim', Math.min(1, away / 90).toFixed(3));
      face.classList.toggle('is-off', away >= 90);
    }

    root.style.setProperty('--pos', clamp(turn, 0, last).toFixed(4));
    sky.setOffset(turn);
  }

  function setFlat(on) {
    flat = on;
    stage.classList.toggle('is-flat', on);
    if (!on) return;
    cube.style.transform = '';
    stage.style.setProperty('--edge', '0');
    for (const face of faces) {
      face.classList.remove('is-off');
      face.style.setProperty('--dim', '0');
    }
  }

  function setIndex(i, writeUrl) {
    index = i;
    panels.forEach((panel, k) => {
      panel.classList.toggle('is-active', k === i);
      panel.toggleAttribute('inert', k !== i);
    });
    tabs.forEach((tab, k) => {
      if (k === i) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    updateGate(gates.prev, i - 1, 'Previous');
    updateGate(gates.next, i + 1, 'Next');
    if (writeUrl && location.hash !== `#${ids[i]}`) {
      history.replaceState(null, '', `#${ids[i]}`);
    }
  }

  function updateGate(gate, target, word) {
    if (!gate) return;
    const valid = target >= 0 && target <= last;
    gate.hidden = !valid;
    if (!valid) return;
    gate.dataset.go = String(target);
    gate.querySelector('.gate-label').textContent = labels[target];
    gate.setAttribute('aria-label', `${word}: ${labels[target]}`);
  }

  function settle(focus) {
    render();
    setFlat(true);
    if (focus) {
      const scroller = panels[index].querySelector('.face-scroll');
      if (scroller) scroller.focus({ preventScroll: true });
    }
  }

  function animateTo(target, { duration, ease = easeInOut, focus = false } = {}) {
    cancelAnimationFrame(frame);
    frame = 0;

    if (reduceMotion.matches) {
      angle = target;
      settle(focus);
      stage.classList.remove('is-fading');
      void stage.offsetWidth; // restart the fade
      stage.classList.add('is-fading');
      return;
    }

    const from = angle;
    const distance = Math.abs(target - from);
    if (distance < 0.01) {
      angle = target;
      settle(focus);
      return;
    }

    if (flat) setFlat(false);
    const time = duration || 260 + (distance / 90) * 440;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - start) / time);
      angle = from + (target - from) * ease(t);
      render();
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
        angle = target;
        settle(focus);
      }
    };
    frame = requestAnimationFrame(step);
  }

  function go(i, options = {}) {
    const target = clamp(Math.round(i), 0, last);
    if (target !== index) setIndex(target, true);
    dismissHint();
    animateTo(target * 90, options);
  }

  /* ── Touch: swipe to rotate ──────────────────────────────────────────── */

  // Past either end the box gives a little, then resists.
  const rubber = (over) => 24 * (1 - Math.exp(-over / 40));

  let drag = null;
  let suppressClickUntil = 0;

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: false, startAngle: angle, samples: [] };
  });

  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;

    if (!drag.horizontal) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        drag = null; // a vertical scroll — leave it to the browser
        return;
      }
      drag.horizontal = true;
      drag.x = e.clientX; // start tracking from here so the box doesn't jump
      cancelAnimationFrame(frame);
      frame = 0;
      drag.startAngle = angle;
      setFlat(false);
      stage.classList.add('is-dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }

    const max = last * 90;
    let a = drag.startAngle - ((e.clientX - drag.x) / width) * 90;
    if (a < 0) a = -rubber(-a);
    else if (a > max) a = max + rubber(a - max);
    angle = a;
    render();

    drag.samples.push({ x: e.clientX, t: e.timeStamp });
    if (drag.samples.length > 6) drag.samples.shift();
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.horizontal) return;

    stage.classList.remove('is-dragging');
    suppressClickUntil = performance.now() + 400;

    // Flick velocity in px/ms over the last few moves (negative = leftwards).
    let velocity = 0;
    const s = d.samples;
    if (e.type === 'pointerup' && s.length > 1) {
      const first = s[0];
      const lastSample = s[s.length - 1];
      const dt = lastSample.t - first.t;
      if (dt > 0 && e.timeStamp - lastSample.t < 100) velocity = (lastSample.x - first.x) / dt;
    }

    const from = Math.round(d.startAngle / 90);
    const moved = (angle - d.startAngle) / 90; // in faces, positive = forward
    let target = Math.round(angle / 90);
    if (e.type === 'pointerup') {
      // A flick wins over distance: flick forward → next face (or back to
      // where you started if you'd pulled the other way), and vice versa.
      if (velocity < -0.35) target = moved >= 0 ? from + 1 : from;
      else if (velocity > 0.35) target = moved <= 0 ? from - 1 : from;
      else if (moved > 0.18) target = Math.max(target, from + 1);
      else if (moved < -0.18) target = Math.min(target, from - 1);
    }
    target = clamp(target, 0, last);

    if (target !== index) setIndex(target, true);
    dismissHint();
    animateTo(target * 90, {
      ease: easeOut,
      duration: 220 + (Math.abs(target * 90 - angle) / 90) * 380,
    });
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // A swipe that starts on a link must not also open it.
  stage.addEventListener('click', (e) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* ── Trackpad: horizontal two-finger swipe ───────────────────────────── */

  let wheelSum = 0;
  let wheelLocked = false;
  let wheelTimer = 0;

  stage.addEventListener('wheel', (e) => {
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? width : 1;
    const dx = e.deltaX * scale;
    const dy = e.deltaY * scale;
    if (e.ctrlKey || Math.abs(dx) <= Math.abs(dy)) return;
    e.preventDefault(); // also stops the browser's swipe-to-go-back

    // One gesture = one face: stay locked until the wheel stream goes quiet
    // (this swallows trackpad momentum).
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheelLocked = false;
      wheelSum = 0;
    }, 220);
    if (wheelLocked) return;

    wheelSum += dx;
    if (Math.abs(wheelSum) > 40) {
      wheelLocked = true;
      go(index + Math.sign(wheelSum));
    }
  }, { passive: false });

  /* ── Keyboard ────────────────────────────────────────────────────────── */

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (document.querySelector('dialog[open]')) return; // the lightbox owns the arrows
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1, { focus: true });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1, { focus: true });
    }
  });

  /* ── Links, tabs and gates ───────────────────────────────────────────── */

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = e.target.closest('[data-go], a[href^="#"]');
    if (!el) return;
    const i = el.hasAttribute('data-go')
      ? Number(el.getAttribute('data-go'))
      : ids.indexOf(el.getAttribute('href').slice(1));
    if (!(i >= 0 && i <= last)) return;
    e.preventDefault();
    go(i, { focus: true });
  });

  window.addEventListener('hashchange', () => {
    const i = ids.indexOf(decodeURIComponent(location.hash.slice(1)));
    if (i >= 0 && i !== index) go(i);
  });

  // The stage only clips; make sure nothing (e.g. find-in-page) scrolls it.
  stage.addEventListener('scroll', () => {
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  });

  window.addEventListener('resize', () => {
    measure();
    if (!flat) render();
  });

  /* ── Swipe hint (touch devices, first visit) ─────────────────────────── */

  const HINT_KEY = 'portfolio:rotated';

  function dismissHint() {
    if (!hint) return;
    hint.classList.remove('is-on');
    store.set(HINT_KEY, '1');
  }

  if (hint && window.matchMedia('(pointer: coarse)').matches && !store.get(HINT_KEY)) {
    setTimeout(() => {
      if (!store.get(HINT_KEY)) hint.classList.add('is-on');
    }, 1400);
    setTimeout(() => hint.classList.remove('is-on'), 9000);
  }

  /* ── Copy email ──────────────────────────────────────────────────────── */

  for (const button of document.querySelectorAll('[data-copy]')) {
    const label = button.querySelector('.copy-label') || button;
    const original = label.textContent;
    let timer = 0;

    button.addEventListener('click', async () => {
      const text = button.getAttribute('data-copy');
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (_) {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
        area.remove();
      }
      label.textContent = ok ? 'Copied ✓' : 'Copy failed';
      button.classList.toggle('is-done', ok);
      clearTimeout(timer);
      timer = setTimeout(() => {
        label.textContent = original;
        button.classList.remove('is-done');
      }, 2000);
    });
  }

  /* ── Screenshot lightbox ─────────────────────────────────────────────── */

  const lightbox = document.querySelector('.lightbox');

  if (lightbox && typeof lightbox.showModal === 'function') {
    const img = lightbox.querySelector('.lightbox-img');
    const count = lightbox.querySelector('.lightbox-count');
    const text = lightbox.querySelector('.lightbox-text');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');
    let shots = [];
    let current = 0;
    let opener = null;

    const show = (i) => {
      current = (i + shots.length) % shots.length;
      const shot = shots[current];
      const thumb = shot.querySelector('img');
      img.src = shot.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      count.textContent = `${current + 1} / ${shots.length}`;
      text.textContent = shot.dataset.caption || '';
      const single = shots.length < 2;
      prevBtn.hidden = single;
      nextBtn.hidden = single;
      // Warm the cache for the neighbours so paging feels instant.
      for (const n of [current - 1, current + 1]) {
        const s = shots[(n + shots.length) % shots.length];
        if (s) new Image().src = s.getAttribute('href');
      }
    };

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const shot = e.target.closest('.shot');
      if (!shot) return;
      e.preventDefault();
      const gallery = shot.closest('.case-gallery');
      shots = gallery ? Array.from(gallery.querySelectorAll('.shot')) : [shot];
      lightbox.classList.toggle('is-phone', !!(gallery && gallery.classList.contains('case-gallery--phone')));
      opener = shot;
      show(shots.indexOf(shot));
      lightbox.showModal();
    });

    prevBtn.addEventListener('click', () => show(current - 1));
    nextBtn.addEventListener('click', () => show(current + 1));
    lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());

    // Clicking the dark area around the picture closes the viewer (but not
    // the click that ends a swipe).
    let swipedAt = 0;
    lightbox.addEventListener('click', (e) => {
      if (performance.now() - swipedAt < 400) return;
      if (e.target === lightbox || e.target.classList.contains('lightbox-figure')) lightbox.close();
    });

    lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        show(current + (e.key === 'ArrowRight' ? 1 : -1));
      }
    });

    // Swipe left / right on touch screens.
    let swipe = null;
    lightbox.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' && e.isPrimary) swipe = { x: e.clientX, y: e.clientY };
    });
    lightbox.addEventListener('pointerup', (e) => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && shots.length > 1) {
        swipedAt = performance.now();
        show(current + (dx < 0 ? 1 : -1));
      }
    });
    lightbox.addEventListener('pointercancel', () => { swipe = null; });

    lightbox.addEventListener('close', () => {
      img.removeAttribute('src');
      // Browsers that don't focus links on click (Safari) would otherwise
      // drop focus at the top of the page.
      if (opener) opener.focus({ preventScroll: true });
      opener = null;
    });
  }

  /* ── Reveal on scroll ────────────────────────────────────────────────── */

  if ('IntersectionObserver' in window) {
    root.classList.add('reveal-ready');
    for (const panel of panels) {
      const scroller = panel.querySelector('.face-scroll');
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      }, { root: scroller, rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
      for (const el of panel.querySelectorAll('.reveal')) observer.observe(el);
    }
  }

  /* ── Start ───────────────────────────────────────────────────────────── */

  measure();
  const initial = Math.max(0, ids.indexOf(decodeURIComponent(location.hash.slice(1))));
  angle = initial * 90;
  setIndex(initial, false);
  render();
  setFlat(true);
  stage.scrollTop = 0;
  stage.scrollLeft = 0;
})();
