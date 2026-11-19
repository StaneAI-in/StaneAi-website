(() => {
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelector(".nav-links");
  const navItems = document.querySelectorAll(".nav-links a");
  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();

  const closeMenu = () => {
    if (!menuToggle || !navLinks) return;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    navLinks.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!open));
      menuToggle.setAttribute("aria-label", open ? "Open navigation menu" : "Close navigation menu");
      navLinks.classList.toggle("is-open", !open);
      document.body.classList.toggle("menu-open", !open);
    });
    navItems.forEach((item) => item.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
    window.addEventListener("resize", () => { if (window.innerWidth > 700) closeMenu(); });
  }

  // Staggered reveal animations, with a fallback for older browsers.
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -25px 0px" });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  // Count-up stats animate only when their section becomes visible.
  const counters = document.querySelectorAll("[data-count]");
  const animateCounter = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = "true";
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    if (!Number.isFinite(target) || target === 2026) { el.textContent = String(target) + suffix; return; }
    const duration = 1100;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { animateCounter(entry.target); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach((counter) => counterObserver.observe(counter));
  } else {
    counters.forEach(animateCounter);
  }

  // Keep placeholder social URLs from jumping the page until real URLs are added.
  document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (link.getAttribute("href") === "#") event.preventDefault();
    });
  });
})();
