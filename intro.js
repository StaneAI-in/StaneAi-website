// Cinematic logo intro: logo fades in with a glow, dissolves into particles,
// and the already-loaded homepage emerges underneath. Plays once per session.
// No dependencies — plain Canvas 2D.
(() => {
  const root = document.documentElement;
  const intro = document.getElementById("intro");
  if (!intro) return;
  if (!root.classList.contains("intro-pending")) { intro.remove(); return; }

  try { sessionStorage.setItem("intro-seen", "1"); } catch (e) { /* storage blocked: intro still plays once */ }

  const canvas = intro.querySelector(".intro-canvas");
  const ctx = canvas && canvas.getContext("2d");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let done = false;
  let rafId = 0;
  const finish = (fast) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(rafId);
    removeListeners();
    root.classList.add("intro-prepaint", "intro-reveal");
    if (fast) intro.classList.add("is-skipping");
    setTimeout(() => {
      intro.remove();
      root.classList.remove("intro-pending", "intro-prepaint", "intro-reveal");
    }, fast ? 1300 : 900);
  };

  // Any interaction skips the intro; it never blocks the page.
  const skip = () => finish(true);
  const startWidth = window.innerWidth;
  const onResize = () => { if (window.innerWidth !== startWidth) skip(); };
  const skipEvents = ["pointerdown", "keydown", "wheel", "touchstart"];
  skipEvents.forEach((ev) => window.addEventListener(ev, skip, { passive: true }));
  window.addEventListener("resize", onResize);
  function removeListeners() {
    skipEvents.forEach((ev) => window.removeEventListener(ev, skip));
    window.removeEventListener("resize", onResize);
  }

  if (!ctx) { finish(true); return; }

  // ---- Logo ---------------------------------------------------------------
  // If an exact logo file is supplied via data-logo on #intro, it is drawn as-is.
  // Otherwise the site's existing brand mark + wordmark is drawn with the same
  // geometry and colours as the header logo in style.css (.brand / .brand-mark).
  const logoSrc = intro.dataset.logo;
  const FONT = '"Space Grotesk", sans-serif';

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const measureBrand = (c) => {
    c.font = `700 22px ${FONT}`;
    if ("letterSpacing" in c) c.letterSpacing = "-0.8px";
    const stane = c.measureText("Stane").width;
    const ai = c.measureText("AI").width;
    return { stane, ai, w: 21 + 11 + stane + ai, h: 25 };
  };

  const drawBrand = (c, m) => {
    // Brand mark: three rounded bars, 5px wide, 3px apart, centred vertically.
    const bars = [[13, 0.72], [23, 1], [17, 0.85]];
    bars.forEach(([bh, op], i) => {
      const x = i * 8;
      const y = (m.h - bh) / 2;
      const g = c.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, "#c3a9ff");
      g.addColorStop(1, "#5d8bff");
      c.globalAlpha = op;
      c.fillStyle = g;
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, 5, bh, 2.5); else c.rect(x, y, 5, bh);
      c.fill();
    });
    c.globalAlpha = 1;
    c.font = `700 22px ${FONT}`;
    if ("letterSpacing" in c) c.letterSpacing = "-0.8px";
    c.textBaseline = "middle";
    c.fillStyle = "#f5f6fc";
    c.fillText("Stane", 32, m.h / 2 + 0.5);
    c.fillStyle = "#9aa6ff";
    c.fillText("AI", 32 + m.stane, m.h / 2 + 0.5);
  };

  // Returns a crisp logo canvas sized in device pixels for the given CSS width.
  const buildLogo = async (targetW, dpr) => {
    const out = document.createElement("canvas");
    const c = out.getContext("2d");
    if (logoSrc) {
      const img = await loadImage(logoSrc);
      const ratio = img.naturalHeight / img.naturalWidth;
      const w = targetW, h = targetW * ratio;
      out.width = Math.ceil(w * dpr); out.height = Math.ceil(h * dpr);
      c.drawImage(img, 0, 0, out.width, out.height);
      // The logo file sits on solid black. Convert black to transparency
      // ("unscreen") so only the logo and its own glow remain; colours of
      // the logo itself are preserved exactly when composited on black.
      const id = c.getImageData(0, 0, out.width, out.height);
      const p = id.data;
      for (let i = 0; i < p.length; i += 4) {
        const m = Math.max(p[i], p[i + 1], p[i + 2]);
        const a = (m * p[i + 3]) / 255;
        if (a < 1) { p[i + 3] = 0; continue; }
        const k = 255 / m;
        p[i] = Math.min(255, p[i] * k);
        p[i + 1] = Math.min(255, p[i + 1] * k);
        p[i + 2] = Math.min(255, p[i + 2] * k);
        p[i + 3] = a;
      }
      c.putImageData(id, 0, 0);
      return { canvas: out, w, h };
    }
    const m = measureBrand(c);
    const s = targetW / m.w;
    const w = m.w * s, h = m.h * s;
    out.width = Math.ceil(w * dpr); out.height = Math.ceil(h * dpr);
    const c2 = out.getContext("2d");
    c2.scale(s * dpr, s * dpr);
    drawBrand(c2, measureBrand(c2));
    return { canvas: out, w, h };
  };

  const buildGlow = (logo, pad, dpr) => {
    const g = document.createElement("canvas");
    g.width = Math.ceil((logo.w + pad * 2) * dpr);
    g.height = Math.ceil((logo.h + pad * 2) * dpr);
    const c = g.getContext("2d");
    // A logo file already carries its own glow, so only a faint extra bloom is added.
    c.shadowColor = logoSrc ? "rgba(40, 100, 255, 0.45)" : "rgba(64, 120, 255, 0.9)";
    c.shadowBlur = (logoSrc ? 22 : 26) * dpr;
    c.drawImage(logo.canvas, pad * dpr, pad * dpr);
    if (!logoSrc) {
      c.shadowBlur = 60 * dpr;
      c.shadowColor = "rgba(40, 90, 255, 0.55)";
      c.drawImage(logo.canvas, pad * dpr, pad * dpr);
    }
    return g;
  };

  // ---- Main ---------------------------------------------------------------
  const run = async () => {
    // Wait (briefly) for the display font so the wordmark matches the header.
    if (!logoSrc && document.fonts && document.fonts.load) {
      await Promise.race([
        document.fonts.load(`700 22px ${FONT}`),
        new Promise((r) => setTimeout(r, 1500)),
      ]).catch(() => {});
    }
    if (done) return;

    const W = window.innerWidth, H = window.innerHeight;
    // Phones: cap pixel density lower — far fewer pixels to fill each frame.
    const dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targetW = Math.min(W * (W < 700 ? 0.86 : 0.5), logoSrc ? 620 : 560);
    let logo;
    try { logo = await buildLogo(targetW, dpr); } catch (e) { finish(true); return; }
    if (done) return;

    const PAD = 70;
    const glow = buildGlow(logo, PAD, dpr);
    const left = (W - logo.w) / 2, top = (H - logo.h) / 2;
    const cx = W / 2, cy = H / 2;

    // Timeline (ms)
    const T_IN = reduceMotion ? 450 : 750;   // logo fade-in
    const T_HOLD = reduceMotion ? 1100 : 1050; // start of disintegration
    const T_WAVE = 650;                       // left→right dissolve sweep
    const T_REVEAL = reduceMotion ? 1100 : 1500; // homepage starts emerging
    const T_END = reduceMotion ? 1200 : 3100;

    // ---- Particles (sampled from the logo's own pixels) ----
    let N = 0, px, py, vx, vy, rel, life, col, tier;
    if (!reduceMotion) {
      const small = W < 700, mid = W < 1100;
      let target = small ? 900 : mid ? 2200 : 4000;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) target = Math.round(target * 0.6);

      const img = logo.canvas.getContext("2d").getImageData(0, 0, logo.canvas.width, logo.canvas.height);
      const d = img.data, iw = img.width, ih = img.height;
      let opaque = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 110) opaque++;
      const step = Math.max(1, Math.sqrt((opaque * 4) / target));

      const pts = [];
      for (let y = 0; y < ih; y += step) {
        for (let x = 0; x < iw; x += step) {
          const i = (Math.floor(y) * iw + Math.floor(x)) * 4;
          if (d[i + 3] > 110) pts.push(x / dpr, y / dpr, d[i], d[i + 2]);
        }
      }
      N = pts.length / 4;
      px = new Float32Array(N); py = new Float32Array(N);
      vx = new Float32Array(N); vy = new Float32Array(N);
      rel = new Float32Array(N); life = new Float32Array(N);
      col = new Uint8Array(N); tier = new Uint8Array(N);
      const sizeK = logo.w / 560;
      for (let k = 0; k < N; k++) {
        const x = left + pts[k * 4], y = top + pts[k * 4 + 1];
        const r = pts[k * 4 + 2], b = pts[k * 4 + 3];
        px[k] = x; py[k] = y;
        const ang = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 1.1;
        const sp = (0.06 + Math.pow(Math.random(), 1.6) * 0.5) * (0.6 + sizeK * 0.6);
        vx[k] = Math.cos(ang) * sp + 0.05;
        vy[k] = Math.sin(ang) * sp;
        rel[k] = T_HOLD + ((x - left) / logo.w) * T_WAVE - Math.random() * 110;
        life[k] = 900 + Math.random() * 900;
        // 0 = white, 1 = electric blue, 2 = soft blue (from bluish logo pixels)
        const bluish = b > r + 20;
        const rnd = Math.random();
        col[k] = bluish ? (rnd < 0.55 ? 1 : rnd < 0.85 ? 2 : 0) : (rnd < 0.72 ? 0 : 1);
      }
    }
    const COLORS = ["#ffffff", "#3d7bff", "#9aa6ff"];
    const TIERS = 4;

    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    let start = 0, last = 0, revealed = false, prepainted = false;

    const frame = (now) => {
      if (done) return;
      if (!start) { start = now; last = now; }
      const t = now - start;
      const dt = Math.min(now - last, 34);
      last = now;

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);

      const inA = easeOut(Math.min(t / T_IN, 1));
      const waveP = reduceMotion ? 0 : Math.min(Math.max((t - T_HOLD) / T_WAVE, 0), 1);
      const waveX = left - 6 + (logo.w + 12) * waveP;

      // Soft blue halo behind the logo
      const haloA = inA * (reduceMotion ? 1 : 1 - Math.min(Math.max((t - T_HOLD) / 1400, 0), 1));
      if (haloA > 0.01) {
        const rad = Math.max(logo.w * 0.75, 160);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(45, 95, 255, ${(logoSrc ? 0.06 : 0.16) * haloA})`);
        g.addColorStop(1, "rgba(45, 95, 255, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }

      // Intact part of the logo (to the right of the dissolve front)
      let logoA = inA;
      if (reduceMotion && t > T_HOLD) logoA = Math.max(0, 1 - (t - T_HOLD) / 400);
      if (waveP < 1 && logoA > 0) {
        const scale = 0.965 + 0.035 * inA;
        const lw = logo.w * scale, lh = logo.h * scale;
        const lx = cx - lw / 2, ly = cy - lh / 2;
        const pk = PAD * scale;
        ctx.save();
        if (waveP > 0) { ctx.beginPath(); ctx.rect(waveX, 0, W - waveX, H); ctx.clip(); }
        const pulse = 0.85 + 0.15 * Math.sin(t / 260);
        ctx.globalAlpha = logoA * pulse * (logoSrc ? 0.55 : 1);
        ctx.drawImage(glow, lx - pk, ly - pk, lw + pk * 2, lh + pk * 2);
        ctx.globalAlpha = logoA;
        ctx.drawImage(logo.canvas, lx, ly, lw, lh);
        ctx.restore();
      }

      // Soft glowing dissolve front (radial, so it has no hard edges)
      if (waveP > 0 && waveP < 1) {
        const r = Math.max(logo.h * 0.9, 24);
        const g = ctx.createRadialGradient(waveX, cy, 0, waveX, cy, r);
        const k = Math.sin(waveP * Math.PI);
        g.addColorStop(0, `rgba(190, 215, 255, ${0.45 * k})`);
        g.addColorStop(0.35, `rgba(70, 130, 255, ${0.22 * k})`);
        g.addColorStop(1, "rgba(40, 90, 255, 0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.fillRect(waveX - r, cy - r, r * 2, r * 2);
      }

      // Particles with motion-streak trails
      if (N && t >= T_HOLD - 120) {
        let alive = 0;
        for (let k = 0; k < N; k++) {
          const age = t - rel[k];
          if (age < 0) { tier[k] = 255; alive++; continue; }
          if (age > life[k]) { tier[k] = 255; continue; }
          alive++;
          const ph = py[k] * 0.018 + t * 0.0028;
          vx[k] += Math.sin(ph) * 0.00055 * dt;
          vy[k] += Math.cos(px[k] * 0.018 + t * 0.0024) * 0.00055 * dt - 0.00002 * dt;
          const drag = Math.pow(0.9982, dt);
          vx[k] *= drag; vy[k] *= drag;
          px[k] += vx[k] * dt; py[k] += vy[k] * dt;
          const a = Math.pow(1 - age / life[k], 1.3);
          tier[k] = Math.min(TIERS - 1, Math.floor(a * TIERS));
        }
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.lineWidth = W < 700 ? 1.1 : 1.35;
        for (let c = 0; c < COLORS.length; c++) {
          ctx.strokeStyle = COLORS[c];
          for (let ti = 0; ti < TIERS; ti++) {
            ctx.globalAlpha = (ti + 1) / TIERS * 0.95;
            ctx.beginPath();
            let any = false;
            for (let k = 0; k < N; k++) {
              if (col[k] !== c || tier[k] !== ti) continue;
              const trail = 26;
              let tx = vx[k] * trail, ty = vy[k] * trail;
              if (Math.abs(tx) + Math.abs(ty) < 0.8) { tx = 0.8; ty = 0; }
              ctx.moveTo(px[k] - tx, py[k] - ty);
              ctx.lineTo(px[k], py[k]);
              any = true;
            }
            if (any) ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        if (!alive && t > T_REVEAL) { finish(false); return; }
      }

      // Let the hidden page do its first paint while the logo is holding still,
      // so that cost never lands on a frame where particles are moving.
      if (!prepainted && t >= Math.min(T_IN + 80, T_HOLD - 150)) { prepainted = true; root.classList.add("intro-prepaint"); }
      if (!revealed && t >= T_REVEAL) { revealed = true; root.classList.add("intro-reveal"); }
      if (t >= T_END) { finish(false); return; }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  };

  run().catch(() => finish(true));
})();
