/* save-image.js — hand a rendered PNG to the user, on whatever they're holding.
   Shared by /column and /linernotes. Native, no deps.

   DESKTOP → a plain download, as before.

   MOBILE → the native share sheet when the browser offers it. This is the
   whole point: on iOS there is NO web API that writes to the camera roll, and
   a `download` link lands the file in Files → Downloads, where people
   reasonably fail to find it. The share sheet's "Save Image" writes to Photos,
   and "Save to Files" is right there too — one sheet covers both.

   No photo-library permission is asked for or needed: the user picks the
   destination themselves inside the sheet, so the page is never granted access
   to anything. (Permission is for READING the library; this only hands over a
   single file the user already asked for.)

   Falls back to the download path whenever sharing is unavailable or fails —
   including when the browser rejects the call because the user gesture has
   lapsed. A dismissed sheet is NOT a failure and must not trigger a download. */
(function (root) {
  'use strict';

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);   // Firefox ignores a click on a detached anchor
    a.click();
    // revoke late: Safari can still be reading the blob as the click resolves
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  function saveImage(blob, filename) {
    if (!blob) return;
    var touch = root.matchMedia &&
                root.matchMedia('(hover: none), (pointer: coarse)').matches;
    var file = null;
    try { file = new File([blob], filename, { type: blob.type || 'image/png' }); }
    catch (e) { file = null; }      // no File constructor → download path

    if (touch && file && navigator.share && navigator.canShare &&
        navigator.canShare({ files: [file] })) {
      try {
        navigator.share({ files: [file] })['catch'](function (err) {
          if (!err || err.name !== 'AbortError') download(blob, filename);
        });
        return;
      } catch (e) { /* fall through */ }
    }
    download(blob, filename);
  }

  /* Save a canvas, preferring toBlob. A data: URL would also have to be held
     entirely as a base64 string, and mobile Safari's download path treats
     data: URLs unreliably — it will happily open one in a tab instead of
     saving it. A blob: URL behaves like a real file. */
  function saveCanvas(canvas, filename) {
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) { saveImage(blob, filename); }, 'image/png');
      return;
    }
    var a = document.createElement('a');          // ancient fallback
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 4000);
  }

  root.saveImage = saveImage;
  root.saveCanvas = saveCanvas;
})(typeof window !== 'undefined' ? window : this);
