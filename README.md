# StaneAI Website

A responsive, premium dark-theme landing page for StaneAI, built with plain HTML, CSS, and vanilla JavaScript.

## Contents

- `index.html` — page structure, metadata, company story, services, product vision, contact and social placeholders
- `style.css` — responsive layout, advanced CSS motion, animated product illustrations and reduced-motion support
- `script.js` — mobile navigation, scroll reveals, animated metric counters and dynamic copyright year
- `assets/` — reserved for local images, icons and other static assets

## Run locally

No build step, backend, database, authentication, package manager, or paid library is required.

### Option 1: Open directly
Double-click `index.html` to open it in your browser.

### Option 2: Run a local server (recommended)
Open a terminal in this directory and run:

```bash
python -m http.server 5500
```

Then visit <http://localhost:5500>.

## Before publishing

1. Replace `hello@staneai.com` and its `mailto:` link in `index.html` with your actual contact email.
2. Replace the `#` social URLs with real StaneAI profile URLs.
3. Company figures and positioning are based on the details supplied for this website. Verify that the "10+ mobile apps in progress" and "5+ US clients in pitching" statements remain accurate before publishing.
4. Google Fonts load remotely. For a fully offline page, remove the Google Fonts `<link>` elements and use the fallback sans-serif fonts in `style.css`.
5. Add local images or brand assets to `assets/` and reference them using relative paths.

## Motion and accessibility

- Animated hero orbits, floating interface panels, subtle background glow, service illustrations, product mockups, reveal-on-scroll and count-up metrics.
- Mobile navigation supports click, Escape, and closes after selecting a link.
- `prefers-reduced-motion` is respected to reduce motion for visitors who request it.
- Layout adapts for mobile, tablet and desktop screens.

## Notes

- Product mockups are CSS illustrations, not screenshots of launched apps.
- No client names, customer logos, testimonials, revenue figures or unprovided achievements are claimed.
- The social links intentionally do not navigate until real profile URLs are added.
- This project has not been deployed.
