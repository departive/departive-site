/* tilt.js — pointer-reactive 3D tilt for [data-tilt] > .media. Native, no deps.
   ---------------------------------------------------------------------------
   One include per standalone page:  <script src="/assets/tilt.js" defer></script>

   Contract: an element with [data-tilt] wrapping (at any depth) a `.media`
   child → the .media tilts in perspective toward the pointer, easing back to
   rest on pointerleave (0.6s, the site's cubic-bezier).
   - data-tilt-max="4.5"  degrees of tilt at the edges (default 4.5).
   - For FULL-BLEED media (a cover hero), overscan the .media in CSS (e.g.
     120vw × 120vh, object-fit:cover) so the rotation never reveals its edges.
   - Put [data-tilt] on the largest surface you want to react to the pointer —
     the listener lives there and the .media can be nested deeper.

   Quiet by design. rAF-throttled; transform-only, so zero layout cost / CLS.
   Inert on touch (pointer:coarse / hover:none) and prefers-reduced-motion.
*/
(function () {
  'use strict';
  var mm = window.matchMedia;
  if (mm && (mm('(prefers-reduced-motion: reduce)').matches ||
             mm('(hover: none), (pointer: coarse)').matches)) return;

  var style = document.createElement('style');
  style.setAttribute('data-tilt-style', '');
  style.textContent =
    '[data-tilt] .media{transition:transform .6s cubic-bezier(.22,1,.36,1);transform-style:preserve-3d;will-change:transform;backface-visibility:hidden}' +
    '[data-tilt].tilt-active .media{transition:transform .16s ease-out}';
  (document.head || document.documentElement).appendChild(style);

  function bind(el) {
    var media = el.querySelector('.media');
    if (!media) return;
    var MAX = parseFloat(el.getAttribute('data-tilt-max')) || 4.5;
    /* data-tilt-scale > 1 overscans the media (a resting zoom) so rotation never
       exposes an edge — use it when the media exactly covers its box (e.g. a slot
       whose grid centering fights size-overscan); full-bleed heroes can overscan
       by size instead and leave this at 1. */
    var SCALE = parseFloat(el.getAttribute('data-tilt-scale')) || 1;
    var base = 'perspective(1200px) scale(' + SCALE + ') ';
    var raf = 0, rx = 0, ry = 0;
    function frame() {
      raf = 0;
      media.style.transform = base + 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    }
    if (SCALE !== 1) media.style.transform = base + 'rotateX(0deg) rotateY(0deg)'; /* resting overscan */
    el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') el.classList.add('tilt-active'); });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;   /* 0..1 across */
      var py = (e.clientY - r.top) / r.height;   /* 0..1 down */
      ry = (px - 0.5) * 2 * MAX;                 /* left/right → rotateY */
      rx = -(py - 0.5) * 2 * MAX;                /* up/down → rotateX */
      if (!raf) raf = requestAnimationFrame(frame);
    });
    el.addEventListener('pointerleave', function () {
      el.classList.remove('tilt-active');        /* → 0.6s eased return via CSS */
      rx = ry = 0;
      media.style.transform = base + 'rotateX(0deg) rotateY(0deg)';
    });
  }

  function init() {
    var els = document.querySelectorAll('[data-tilt]');
    for (var i = 0; i < els.length; i++) bind(els[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
