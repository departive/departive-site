/* hover-tilt.js — pointer-reactive perspective tilt for [data-tilt] > .media
   ---------------------------------------------------------------------------
   Native, dependency-free. One include per standalone page:
       <script src="/assets/tilt.js" defer></script>
   Contract: any element with [data-tilt] that wraps a `.media` child (a device
   video loop or still) gains a subtle pointer-driven 3D tilt — max ~4.5° — that
   eases back to rest on pointerleave (0.6s, the site's cubic-bezier). A faint
   specular sheen tracks the pointer (optional; delete the ::after block below
   to drop it — David verdicts from a preview).

   Quiet by design: the visitor should notice the depth, not the effect.
   - rAF-throttled pointermove; transform-only, so zero layout cost / CLS.
   - Touch (pointer:coarse / hover:none): fully inert, media stays static.
   - prefers-reduced-motion: fully inert.
   NOT wired into the dc-runtime landing. Intended mounts: the /studies hero and
   its per-study media slots (see assets/studies/README.md) — pending that
   page's WIP settling.
*/
(function () {
  'use strict';
  var mm = window.matchMedia;
  var reduce = mm && mm('(prefers-reduced-motion: reduce)').matches;
  var coarse = mm && mm('(hover: none), (pointer: coarse)').matches;

  /* Inject the CSS here so a page needs only the one <script>. */
  var css =
    '[data-tilt]{position:relative}' +
    '[data-tilt] .media{transition:transform .6s cubic-bezier(.22,1,.36,1);transform-style:preserve-3d;will-change:transform;backface-visibility:hidden}' +
    '[data-tilt].tilt-active .media{transition:none}' +
    /* specular sheen — subtle; remove this pair of rules to drop it */
    '[data-tilt]::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .6s ease;background:radial-gradient(circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.10),rgba(255,255,255,0) 42%);mix-blend-mode:soft-light;z-index:2}' +
    '[data-tilt].tilt-active::after{opacity:1}' +
    '@media (prefers-reduced-motion: reduce){[data-tilt] .media{transition:none!important;transform:none!important}[data-tilt]::after{display:none}}';
  var style = document.createElement('style');
  style.setAttribute('data-tilt-style', '');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  if (reduce || coarse) return; /* inert: static media, no handlers bound */

  var MAX = 4.5; /* degrees of tilt at the edges */

  function bind(el) {
    var media = el.querySelector('.media');
    if (!media) return;
    var raf = 0, rx = 0, ry = 0;
    function apply() {
      raf = 0;
      media.style.transform =
        'perspective(1200px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    }
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      el.classList.add('tilt-active');
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;   /* 0..1 across */
      var py = (e.clientY - r.top) / r.height;   /* 0..1 down */
      ry = (px - 0.5) * 2 * MAX;                 /* left/right → rotateY */
      rx = -(py - 0.5) * 2 * MAX;                /* up/down → rotateX */
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('pointerleave', function () {
      el.classList.remove('tilt-active');        /* → 0.6s eased return via CSS */
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      rx = ry = 0;
      media.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    });
  }

  function init() {
    var els = document.querySelectorAll('[data-tilt]');
    for (var i = 0; i < els.length; i++) bind(els[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
