// Runs in <head> before first paint: hides the page behind the logo intro once per browser session.
// Search-engine crawlers and link-preview bots skip the intro and see the page immediately.
// Failsafe: if intro.js never starts, the page is revealed after 8 seconds. intro.js clears this
// timer as soon as it starts, so a slow mobile connection can't cut the animation off midway.
try{if(!/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|whatsapp|telegram/i.test(navigator.userAgent)&&!sessionStorage.getItem("intro-seen")){var d=document.documentElement;d.classList.add("intro-pending");window.__introFailsafe=setTimeout(function(){d.classList.remove("intro-pending","intro-prepaint","intro-reveal");var e=document.getElementById("intro");if(e)e.remove()},8000)}}catch(e){}
