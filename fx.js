// Site-wide motion layer: word-by-word headline reveals, scroll progress, scroll + pointer
// parallax, 3D tilt cards with a cursor spotlight, magnetic buttons and a soft cursor glow.
// Uses only the site's existing colours. Skipped entirely for prefers-reduced-motion;
// pointer-only effects (tilt, magnet, glow) run only on devices with a real mouse.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const root = document.documentElement;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  root.classList.add("fx");

  // Sections already on screen reveal underneath the intro, where nobody sees them: skip their
  // blur so it doesn't compete with the intro's blast for the GPU.
  if (root.classList.contains("intro-pending")) {
    const vh = window.innerHeight;
    document.querySelectorAll(".reveal").forEach((el) => { if (el.getBoundingClientRect().top < vh) el.classList.add("fx-noblur"); });
  }

  // ---- Split headings into words (gradient text stays whole so its gradient keeps working) ----
  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const w = document.createElement("span");
            w.className = "fx-w";
            const inner = document.createElement("span");
            inner.className = "fx-wi";
            inner.style.setProperty("--i", i++);
            inner.textContent = p;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR" && !child.classList.contains("sr-only")) {
          if (child.classList.contains("gradient-text")) {
            const w = document.createElement("span");
            w.className = "fx-w";
            const inner = document.createElement("span");
            inner.className = "fx-wi";
            inner.style.setProperty("--i", i++);
            child.replaceWith(w);
            inner.appendChild(child);
            w.appendChild(inner);
          } else {
            walk(child);
          }
        }
      });
    };
    walk(el);
    el.classList.add("fx-split");
  };

  const hero = document.querySelector(".hero h1");
  const heads = [...document.querySelectorAll("main h2")];
  if (hero) { splitWords(hero); hero.classList.add("fx-hero"); }
  heads.forEach(splitWords);

  // Hero headline plays as soon as the intro hands over the page (or right away without an intro).
  if (hero) {
    const play = () => requestAnimationFrame(() => hero.classList.add("fx-in"));
    if (root.classList.contains("intro-pending") && !root.classList.contains("intro-reveal")) {
      const mo = new MutationObserver(() => {
        // Wait out the first frames of the blast (the busiest moment of the intro) before the
        // headline starts, so the two never compete for the same frames.
        if (root.classList.contains("intro-reveal") || !root.classList.contains("intro-pending")) { mo.disconnect(); setTimeout(play, 260); }
      });
      mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    } else {
      play();
    }
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("fx-in"); io.unobserve(e.target); } });
    }, { threshold: 0.35 });
    heads.forEach((h) => io.observe(h));
  } else {
    heads.forEach((h) => h.classList.add("fx-in"));
  }

  // ---- Scroll progress bar + parallax ----
  const bar = document.createElement("div");
  bar.className = "fx-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  const stage = document.querySelector(".hero-stage");
  let mx = 0, my = 0, cmx = 0, cmy = 0; // pointer offset from centre (-1..1), eased
  let sy = window.scrollY;
  let ticking = false, looping = false;

  // Where supported, the progress bar (everywhere) and the hero scroll parallax (touch devices)
  // run as CSS scroll-driven animations on the compositor: they track the finger exactly and
  // cost no JavaScript while scrolling. Elsewhere the same motion is driven from JS below.
  const scrollDriven = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"));
  if (scrollDriven) root.classList.add(finePointer ? "fx-sd-bar" : "fx-sd");
  const jsBar = !scrollDriven;
  const jsStage = !!stage && (finePointer || !scrollDriven);

  let maxScroll = 1;
  const measure = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
  const apply = () => {
    if (jsBar) bar.style.transform = `scaleX(${Math.min(sy / maxScroll, 1)})`;
    // Hero depth parallax; skipped once the hero is off screen.
    if (jsStage && sy < 1100) {
      stage.style.translate = `${(cmx * 14).toFixed(1)}px ${(Math.min(sy, 900) * 0.12 + cmy * 10).toFixed(1)}px`;
    }
  };
  if (jsBar || jsStage) {
    const onScroll = () => {
      sy = window.scrollY;
      if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; apply(); }); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { measure(); onScroll(); }, { passive: true });
    window.addEventListener("load", () => { measure(); onScroll(); });
    measure();
    apply();
  }

  // ---- Pause looping animations in sections that are off screen ----
  // Orbits, floating panels and glows keep ticking (and compositing) even when scrolled away;
  // pausing them frees the GPU for scrolling, which matters most on phones.
  if ("IntersectionObserver" in window) {
    const offIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle("fx-off", !e.isIntersecting));
    }, { rootMargin: "200px 0px" });
    document.querySelectorAll("main > section, .site-footer").forEach((el) => offIo.observe(el));
  }

  if (!finePointer) return;

  // ---- Cursor glow (eased follow) ----
  const glow = document.createElement("div");
  glow.className = "fx-glow";
  glow.setAttribute("aria-hidden", "true");
  document.body.appendChild(glow);
  let gx = window.innerWidth / 2, gy = window.innerHeight / 2, tgx = gx, tgy = gy;

  const loop = () => {
    gx += (tgx - gx) * 0.12; gy += (tgy - gy) * 0.12;
    cmx += (mx - cmx) * 0.08; cmy += (my - cmy) * 0.08;
    glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    apply();
    if (Math.abs(tgx - gx) + Math.abs(tgy - gy) + Math.abs(mx - cmx) * 50 + Math.abs(my - cmy) * 50 > 0.3) {
      requestAnimationFrame(loop);
    } else {
      looping = false;
    }
  };
  window.addEventListener("pointermove", (e) => {
    tgx = e.clientX; tgy = e.clientY;
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
    glow.classList.add("is-on");
    if (!looping) { looping = true; requestAnimationFrame(loop); }
  }, { passive: true });
  document.addEventListener("pointerleave", () => glow.classList.remove("is-on"));

  // ---- 3D tilt + spotlight cards ----
  document.querySelectorAll(".service-card, .metric, .process-step").forEach((card) => {
    card.classList.add("fx-tilt");
    const spot = document.createElement("span");
    spot.className = "fx-spot";
    spot.setAttribute("aria-hidden", "true");
    card.appendChild(spot);
    const lift = card.classList.contains("service-card") ? -6 : -3;
    const maxDeg = card.classList.contains("service-card") ? 7 : 5;
    // The rect is measured once on enter (before the card tilts) and writes are batched to one per
    // frame: reading the rect of a card we're rotating forced a layout on every mouse move.
    let r = null, ev = null, queued = false;
    const paint = () => {
      queued = false;
      if (!r || !ev) return;
      const x = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1);
      const y = Math.min(Math.max((ev.clientY - r.top) / r.height, 0), 1);
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.transform = `perspective(900px) translateY(${lift}px) rotateX(${(0.5 - y) * maxDeg}deg) rotateY(${(x - 0.5) * maxDeg}deg)`;
    };
    card.addEventListener("pointermove", (e) => {
      if (!r) r = card.getBoundingClientRect();
      ev = e;
      if (!queued) { queued = true; requestAnimationFrame(paint); }
    }, { passive: true });
    card.addEventListener("pointerenter", () => { r = card.getBoundingClientRect(); card.classList.add("is-tilting"); });
    card.addEventListener("pointerleave", () => {
      r = null; ev = null;
      card.classList.remove("is-tilting");
      card.style.transform = "";
    });
  });

  // ---- Magnetic buttons ----
  // Centres are measured once per hover, and re-measured after the page scrolls.
  let scrollEpoch = 0;
  window.addEventListener("scroll", () => { scrollEpoch++; }, { passive: true });
  document.querySelectorAll(".button, .nav-cta, .text-link").forEach((btn) => {
    btn.classList.add("fx-magnet");
    let c = null;
    const measureBtn = () => {
      const prev = btn.style.translate;
      btn.style.translate = "";
      const r = btn.getBoundingClientRect();
      btn.style.translate = prev;
      c = { x: r.left + r.width / 2, y: r.top + r.height / 2, epoch: scrollEpoch };
    };
    btn.addEventListener("pointerenter", measureBtn);
    btn.addEventListener("pointermove", (e) => {
      if (!c || c.epoch !== scrollEpoch) measureBtn();
      btn.style.translate = `${(e.clientX - c.x) * 0.22}px ${(e.clientY - c.y) * 0.32}px`;
    }, { passive: true });
    btn.addEventListener("pointerleave", () => { c = null; btn.style.translate = ""; });
  });
})();
