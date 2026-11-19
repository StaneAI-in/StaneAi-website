// Runs in <head> before first paint: hides the page behind the logo intro once per browser session.
// Failsafe: if intro.js never runs, the page is revealed after 8 seconds.
try{if(!sessionStorage.getItem("intro-seen")){var d=document.documentElement;d.classList.add("intro-pending");setTimeout(function(){d.classList.remove("intro-pending","intro-prepaint","intro-reveal");var e=document.getElementById("intro");if(e)e.remove()},8000)}}catch(e){}
