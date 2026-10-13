// holodeck-theme-boot.js — resolve the theme before first paint.
//
// The theme used to be applied in componentDidMount, so the first frame always
// painted the default (dark) root and then flipped to the stored/system choice —
// which is why the welcome hero looked wrong before content loaded. This is a
// plain, render-blocking script in <head> (the canonical fold's fold-theme-boot
// pattern), so the very first paint is already in the right theme. applyTheme()
// keeps it in step afterwards.
(function () {
  try {
    var t = localStorage.getItem('fold-explorer-theme');
    if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* no localStorage: the default root stands */ }
})();
