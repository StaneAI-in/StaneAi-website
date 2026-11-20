// Cinematic logo intro: thousands of particles spiral in and assemble the logo,
// a light sweep crosses it, it pulls in and detonates in a shockwave, and the
// already-loaded homepage emerges underneath. Plays once per session.
// No dependencies — Canvas 2D, with particles on WebGL where available.
(() => {
  const root = document.documentElement;
  const intro = document.getElementById("intro");
  if (!intro) return;
  if (!root.classList.contains("intro-pending")) { intro.remove(); return; }

  // intro.js is running, so the head failsafe is no longer needed (on slow phones it could
  // otherwise fire mid-animation). A shorter watchdog below covers a stalled logo load.
  clearTimeout(window.__introFailsafe);

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
    root.classList.add("intro-prepaint", "intro-reveal", "intro-played");
    if (fast) intro.classList.add("is-skipping");
    setTimeout(() => {
      intro.remove();
      root.classList.remove("intro-pending", "intro-prepaint", "intro-reveal");
    }, fast ? 1300 : 900);
  };

  // Any interaction skips the intro; it never blocks the page.
  const skip = () => finish(true);
  // Size of the screen the intro actually covers. The fixed, full-screen #intro box is the ground
  // truth: on Android Chrome window.innerWidth can report a desktop-like width while the page is
  // still loading, which used to render the phone intro with desktop sizing.
  const viewSize = () => {
    const r = intro.getBoundingClientRect();
    const de = document.documentElement;
    return {
      w: Math.round(r.width) || de.clientWidth || window.innerWidth,
      h: Math.round(r.height) || de.clientHeight || window.innerHeight,
    };
  };
  const startWidth = viewSize().w;
  // Only a real width change (rotation) skips; Android's URL bar showing/hiding only changes height.
  const onResize = () => { if (Math.abs(viewSize().w - startWidth) > 40) skip(); };
  // "click" rather than touchstart/pointerdown: on phones an accidental touch or swipe
  // while the page loads used to kill the intro instantly; a deliberate tap still skips.
  const skipEvents = ["click", "keydown", "wheel"];
  skipEvents.forEach((ev) => window.addEventListener(ev, skip, { passive: true }));
  window.addEventListener("resize", onResize);
  function removeListeners() {
    skipEvents.forEach((ev) => window.removeEventListener(ev, skip));
    window.removeEventListener("resize", onResize);
  }

  if (!ctx) { finish(true); return; }
  // Watchdog: if the show never gets going (logo fails to load, very slow device), fade to the page.
  // Once the clock starts it is re-armed from that moment, so slow setup never cuts the show midway.
  let watchdog = setTimeout(() => finish(true), 9000);

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

    const { w: W, h: H } = viewSize();
    // Phones: cap pixel density lower — far fewer pixels to fill each frame.
    const dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const targetW = Math.min(W * (W < 700 ? 0.86 : 0.5), logoSrc ? 620 : 560);
    let logo;
    try { logo = await buildLogo(targetW, dpr); } catch (e) { finish(true); return; }
    if (done) return;

    const left = (W - logo.w) / 2, top = (H - logo.h) / 2;
    const cx = W / 2, cy = H / 2;
    const sizeK = logo.w / 560;

    // Light sweep across the formed logo, clipped to the logo's own pixels.
    const gleam = document.createElement("canvas");
    gleam.width = logo.canvas.width; gleam.height = logo.canvas.height;
    const gc = gleam.getContext("2d");

    // Timeline (ms): particles swirl in -> logo forms -> gleam -> pull-in -> BLAST -> page.
    const T_FORM = reduceMotion ? 450 : 1150;     // logo fully formed
    const T_CHARGE = reduceMotion ? 1100 : 1550;  // logo pulls in, energy builds
    const T_BLAST = reduceMotion ? 1100 : 1850;   // shockwave + particle explosion
    const T_REVEAL = reduceMotion ? 1100 : 1950;  // homepage starts emerging
    const T_END = reduceMotion ? 1200 : 3500;

    // ---- Particles (sampled from the logo's own pixels) ----
    let N = 0, tx, ty, ox, oy, spin, delay, dur, px, py, qx, qy, vx, vy, rel, life, col, tier;
    if (!reduceMotion) {
      const small = W < 700, mid = W < 1100;
      // Phones get fewer, slightly bolder particles: the logo still reads clearly, at a fraction of the cost.
      let target = small ? 750 : mid ? 2000 : 4200;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) target = Math.round(target * 0.6);
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) target = Math.round(target * 0.6);

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
      const F = () => new Float32Array(N);
      tx = F(); ty = F(); ox = F(); oy = F(); spin = F(); delay = F(); dur = F();
      px = F(); py = F(); qx = F(); qy = F(); vx = F(); vy = F(); rel = F(); life = F();
      col = new Uint8Array(N); tier = new Uint8Array(N);
      const R = Math.hypot(W, H) * 0.55;
      for (let k = 0; k < N; k++) {
        tx[k] = left + pts[k * 4]; ty[k] = top + pts[k * 4 + 1];
        const r = pts[k * 4 + 2], b = pts[k * 4 + 3];
        // Start scattered around the screen, then spiral into place.
        const a = Math.random() * Math.PI * 2;
        const rad = R * (0.3 + Math.random() * 0.8);
        ox[k] = Math.cos(a) * rad; oy[k] = Math.sin(a) * rad;
        spin[k] = (Math.random() < 0.7 ? 1 : -1) * (1.4 + Math.random() * 2.2);
        delay[k] = Math.random() * 260 + ((tx[k] - left) / logo.w) * 90;
        dur[k] = 620 + Math.random() * 180;
        life[k] = 750 + Math.random() * 850;
        // 0 = white, 1 = electric blue, 2 = soft blue (from bluish logo pixels)
        const bluish = b > r + 20;
        const rnd = Math.random();
        col[k] = bluish ? (rnd < 0.55 ? 1 : rnd < 0.85 ? 2 : 0) : (rnd < 0.72 ? 0 : 1);
      }
    }
    const COLORS = ["#ffffff", "#3d7bff", "#9aa6ff"];
    const TIERS = 4;
    const maxR = Math.hypot(W, H) * 0.62;

    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let tAcc = 0, last = 0, warm = 0, waited = 0, prewarmed = false, slowCheck = 0, slowSum = 0;
    let revealed = false, prepainted = false, blasted = false;

    // Assembly position of particle k at time t (spiral from its start offset to its logo pixel).
    let ax = 0, ay = 0;
    const asm = (k, t) => {
      const e = easeInOut(clamp01((t - delay[k]) / dur[k]));
      const s = 1 - e;
      const ang = spin[k] * s * s;
      const c = Math.cos(ang), sn = Math.sin(ang);
      ax = tx[k] + (ox[k] * c - oy[k] * sn) * s;
      ay = ty[k] + (ox[k] * sn + oy[k] * c) * s;
    };

    // ---- Particle renderer ----
    // Thousands of anti-aliased streaks per frame are far too much path work for Canvas 2D, so
    // they are drawn on the GPU (WebGL) on a canvas stacked above, blended additively
    // (plus-lighter) exactly like the 2D "lighter" mode. Canvas 2D remains the fallback.
    const RGB = [[1, 1, 1], [61 / 255, 123 / 255, 1], [154 / 255, 166 / 255, 1]];
    let gl = null, glCanvas = null, glVerts = null, uOff = null;
    if (N && window.CSS && CSS.supports && CSS.supports("mix-blend-mode", "plus-lighter")) {
      try {
        glCanvas = document.createElement("canvas");
        glCanvas.className = "intro-canvas intro-gl";
        glCanvas.width = canvas.width; glCanvas.height = canvas.height;
        gl = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
        if (gl) {
          const sh = (type, src) => {
            const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
            if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error("shader");
            return o;
          };
          const prog = gl.createProgram();
          gl.attachShader(prog, sh(gl.VERTEX_SHADER,
            "attribute vec2 p;attribute vec2 uv;attribute vec2 ext;attribute vec4 c;uniform vec2 res;uniform vec2 off;" +
            "varying vec2 vuv;varying vec2 vext;varying vec4 vc;" +
            "void main(){vuv=uv;vext=ext;vc=c;vec2 q=(p+off)/res*2.0-1.0;gl_Position=vec4(q.x,-q.y,0.0,1.0);}"));
          gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,
            "precision mediump float;varying vec2 vuv;varying vec2 vext;varying vec4 vc;" +
            "void main(){float cov=clamp(vext.x+0.5-abs(vuv.x),0.0,1.0)*clamp(vext.y+0.5-abs(vuv.y),0.0,1.0);" +
            "float a=vc.a*cov;gl_FragColor=vec4(vc.rgb*a,a);}"));
          gl.linkProgram(prog);
          if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
          gl.useProgram(prog);
          gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
          [["p", 2, 0], ["uv", 2, 8], ["ext", 2, 16], ["c", 4, 24]].forEach(([name, size, offset]) => {
            const loc = gl.getAttribLocation(prog, name);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, offset);
          });
          uOff = gl.getUniformLocation(prog, "off");
          gl.uniform2f(gl.getUniformLocation(prog, "res"), glCanvas.width, glCanvas.height);
          gl.viewport(0, 0, glCanvas.width, glCanvas.height);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE);
          gl.clearColor(0, 0, 0, 0);
          glVerts = new Float32Array(N * 60);
          canvas.after(glCanvas);
        }
      } catch (e) { gl = null; if (glCanvas) glCanvas.remove(); }
    }

    // Draw every live particle as a short streak (qx,qy -> px,py) with round-cap length.
    const drawParticles = (lineW, alphaMul, shx, shy) => {
      if (gl) {
        const v = glVerts, h = (lineW * dpr) / 2;
        let n = 0;
        const put = (x, y, u, w, exc, eyc, rgb, a) => {
          v[n++] = x; v[n++] = y; v[n++] = u; v[n++] = w; v[n++] = exc; v[n++] = eyc;
          v[n++] = rgb[0]; v[n++] = rgb[1]; v[n++] = rgb[2]; v[n++] = a;
        };
        for (let k = 0; k < N; k++) {
          const ti = tier[k];
          if (ti === 255) continue;
          let dx = px[k] - qx[k], dy = py[k] - qy[k];
          if (Math.abs(dx) + Math.abs(dy) < 0.8) { dx = 0.8; dy = 0; }
          dx *= dpr; dy *= dpr;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len, uy = dy / len;
          const cx0 = px[k] * dpr - dx / 2, cy0 = py[k] * dpr - dy / 2;
          const exc = len / 2 + h, eyc = h;   // coverage extents (round-cap length)
          const ex = exc + 1, ey = eyc + 1;   // quad extents incl. 1px anti-alias rim
          const rgb = RGB[col[k]];
          const a = ((ti + 1) / TIERS) * 0.95 * alphaMul;
          const ax = ux * ex, ay2 = uy * ex, nx = -uy * ey, ny = ux * ey;
          put(cx0 - ax - nx, cy0 - ay2 - ny, -ex, -ey, exc, eyc, rgb, a);
          put(cx0 + ax - nx, cy0 + ay2 - ny, ex, -ey, exc, eyc, rgb, a);
          put(cx0 + ax + nx, cy0 + ay2 + ny, ex, ey, exc, eyc, rgb, a);
          put(cx0 - ax - nx, cy0 - ay2 - ny, -ex, -ey, exc, eyc, rgb, a);
          put(cx0 + ax + nx, cy0 + ay2 + ny, ex, ey, exc, eyc, rgb, a);
          put(cx0 - ax + nx, cy0 - ay2 + ny, -ex, ey, exc, eyc, rgb, a);
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (n) {
          gl.uniform2f(uOff, shx * dpr, shy * dpr);
          gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, n), gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, n / 10);
        }
        return;
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineWidth = lineW;
      for (let c = 0; c < COLORS.length; c++) {
        ctx.strokeStyle = COLORS[c];
        for (let ti = 0; ti < TIERS; ti++) {
          ctx.globalAlpha = ((ti + 1) / TIERS) * 0.95 * alphaMul;
          ctx.beginPath();
          let any = false;
          for (let k = 0; k < N; k++) {
            if (col[k] !== c || tier[k] !== ti) continue;
            let dx = px[k] - qx[k], dy = py[k] - qy[k];
            if (Math.abs(dx) + Math.abs(dy) < 0.8) { dx = 0.8; dy = 0; }
            ctx.moveTo(px[k] - dx, py[k] - dy);
            ctx.lineTo(px[k], py[k]);
            any = true;
          }
          if (any) ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };
    const clearParticles = () => { if (gl) gl.clear(gl.COLOR_BUFFER_BIT); };

    const frame = (now) => {
      if (done) return;
      const raw = last ? now - last : 0;
      last = now;

      // Warm-up: the page is still loading behind the intro, so the first frames can be very
      // long. Upload the logo to the GPU now (drawn invisibly), and only start the clock
      // once the browser delivers two smooth frames in a row, so no part of the show is skipped.
      if (warm < 2) {
        if (!prewarmed) {
          prewarmed = true;
          // Let the hidden page do its first paint now, while the screen is still black: the
          // clock only starts once frames are smooth again, so that cost never hits the show.
          prepainted = true;
          root.classList.add("intro-prepaint");
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.globalAlpha = 0.004;
          ctx.drawImage(logo.canvas, 0, 0, 2, 2);
          ctx.drawImage(gleam, 0, 0, 2, 2);
          ctx.globalAlpha = 1;
          ctx.clearRect(0, 0, W, H);
          if (gl) { gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 0); }
        }
        waited += raw;
        warm = raw > 0 && (raw < 24 || waited > 600) ? warm + 1 : 0;
        if (warm >= 2) {
          clearTimeout(watchdog);
          watchdog = setTimeout(() => finish(true), T_END + 4000);
        }
        rafId = requestAnimationFrame(frame);
        return;
      }
      // A device that can't keep up (under ~14fps for the first frames) gets a clean fade to the
      // page instead of a juddering, half-played show.
      if (slowCheck < 15) {
        slowCheck++; slowSum += raw;
        if (slowCheck === 15 && slowSum / 15 > 70) { finish(true); return; }
      }
      // The clock advances at most 34ms per frame: a slow frame slows the show down a touch
      // instead of jumping ahead, so every phase is always seen in full.
      const dt = Math.min(raw, 34);
      tAcc += dt;
      const t = tAcc;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      // Screen shake: a small knock when the logo locks in, a big one on the blast.
      let shx = 0, shy = 0;
      if (!reduceMotion) {
        let amp = 0;
        const f = (t - T_FORM) / 220;
        if (f > 0 && f < 1) amp += 3.5 * (1 - f) * (1 - f);
        const b = (t - T_BLAST) / 420;
        if (b > 0 && b < 1) amp += 13 * (1 - b) * (1 - b);
        if (amp > 0.1) { shx = (Math.random() - 0.5) * amp * 2; shy = (Math.random() - 0.5) * amp * 2; ctx.translate(shx, shy); }
      }

      // ---- Logo: fades in as the particles land, pops, gleams, pulls in, then vanishes in the blast.
      let logoA, scale = 1;
      if (reduceMotion) {
        logoA = easeOut(clamp01(t / T_FORM));
        if (t > T_BLAST) logoA = Math.max(0, 1 - (t - T_BLAST) / 400);
      } else {
        logoA = t < T_BLAST ? easeOut(clamp01((t - (T_FORM - 150)) / 260)) : 0;
        const pop = (t - (T_FORM - 60)) / 420;
        if (pop > 0 && pop < 1) scale += 0.07 * Math.sin(pop * Math.PI) * (1 - pop);
        const ch = clamp01((t - T_CHARGE) / (T_BLAST - T_CHARGE));
        scale -= 0.05 * ch * ch;
      }

      if (logoA > 0.003) {
        const lw = logo.w * scale, lh = logo.h * scale;
        const lx = cx - lw / 2, ly = cy - lh / 2;
        ctx.globalAlpha = logoA;
        ctx.drawImage(logo.canvas, lx, ly, lw, lh);

        // Diagonal light sweep across the logo
        const gp = (t - (T_FORM + 60)) / 420;
        if (!reduceMotion && gp > 0 && gp < 1) {
          const gw = gleam.width, gh = gleam.height;
          const bx = -gw * 0.3 + gw * 1.6 * easeInOut(gp);
          gc.globalCompositeOperation = "source-over";
          gc.clearRect(0, 0, gw, gh);
          gc.drawImage(logo.canvas, 0, 0);
          gc.globalCompositeOperation = "source-atop";
          const lg = gc.createLinearGradient(bx - gh, 0, bx + gh * 0.4, gh);
          lg.addColorStop(0, "rgba(255,255,255,0)");
          lg.addColorStop(0.5, "rgba(255,255,255,0.95)");
          lg.addColorStop(1, "rgba(255,255,255,0)");
          gc.fillStyle = lg;
          gc.fillRect(0, 0, gw, gh);
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.sin(gp * Math.PI);
          ctx.drawImage(gleam, lx, ly, lw, lh);
          ctx.globalCompositeOperation = "source-over";
        }

        ctx.globalAlpha = 1;
      }

      // ---- Particles ----
      if (N) {
        if (t < T_BLAST) {
          // Swirl in: streak from where each particle was a moment ago to where it is now.
          const fade = 1 - clamp01((t - (T_FORM - 80)) / 220);
          if (fade > 0) {
            for (let k = 0; k < N; k++) {
              asm(k, t - 30); qx[k] = ax; qy[k] = ay;
              asm(k, t); px[k] = ax; py[k] = ay;
              const a = clamp01((t - delay[k] + 120) / 300);
              tier[k] = a <= 0 ? 255 : Math.min(TIERS - 1, Math.floor(a * TIERS));
            }
            drawParticles(W < 700 ? 1.4 : 1.5, fade, shx, shy);
          } else {
            clearParticles();
          }
        } else {
          if (!blasted) {
            blasted = true;
            // Detonate: every particle flies outward from its logo pixel.
            for (let k = 0; k < N; k++) {
              px[k] = tx[k]; py[k] = ty[k];
              const ang = Math.atan2(ty[k] - cy, tx[k] - cx) + (Math.random() - 0.5) * 0.9;
              const sp = (0.3 + Math.pow(Math.random(), 1.8) * 1.7) * (0.6 + sizeK * 0.6);
              vx[k] = Math.cos(ang) * sp;
              vy[k] = Math.sin(ang) * sp;
              rel[k] = T_BLAST + Math.random() * 50;
            }
          }
          let alive = 0;
          const drag = Math.pow(0.9955, dt);
          for (let k = 0; k < N; k++) {
            const age = t - rel[k];
            if (age < 0) { tier[k] = 255; alive++; continue; }
            if (age > life[k]) { tier[k] = 255; continue; }
            alive++;
            vx[k] += Math.sin(py[k] * 0.018 + t * 0.003) * 0.0005 * dt;
            vy[k] += Math.cos(px[k] * 0.018 + t * 0.0026) * 0.0005 * dt;
            vx[k] *= drag; vy[k] *= drag;
            px[k] += vx[k] * dt; py[k] += vy[k] * dt;
            qx[k] = px[k] - vx[k] * 24; qy[k] = py[k] - vy[k] * 24;
            const a = Math.pow(1 - age / life[k], 1.3);
            tier[k] = Math.min(TIERS - 1, Math.floor(a * TIERS));
          }
          drawParticles(W < 700 ? 1.4 : 1.45, 1, shx, shy);
          if (!alive && t > T_REVEAL + 600) { finish(false); return; }
        }
      }

      // ---- Blast: flash + double shockwave ring ----
      if (!reduceMotion && t >= T_BLAST) {
        const bt = t - T_BLAST;
        ctx.globalCompositeOperation = "lighter";
        const fl = 1 - bt / 260;
        if (fl > 0) {
          const r = logo.w * (0.6 + (1 - fl) * 0.8);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * fl})`);
          g.addColorStop(0.35, `rgba(120, 170, 255, ${0.45 * fl})`);
          g.addColorStop(1, "rgba(40, 90, 255, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
          ctx.fillStyle = `rgba(150, 190, 255, ${0.12 * fl})`;
          ctx.fillRect(-20, -20, W + 40, H + 40);
        }
        const rings = [[0, 900, 16, "130, 175, 255"], [110, 1000, 7, "255, 255, 255"]];
        for (const [del, len, w0, rgb] of rings) {
          const q = (bt - del) / len;
          if (q <= 0 || q >= 1) continue;
          const r = 12 + easeOut(q) * maxR;
          ctx.lineWidth = w0 * (1 - q) + 0.8;
          ctx.strokeStyle = `rgba(${rgb}, ${0.85 * (1 - q) * (1 - q)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      if (!revealed && t >= T_REVEAL) { revealed = true; root.classList.add("intro-reveal"); }
      if (t >= T_END) { finish(false); return; }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  };

  run().catch(() => finish(true));
})();
