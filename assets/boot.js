// Runs render-blocking in <head>: mark JS as available before first paint,
// so the no-JS fallback title never flashes before the preloader/particles take over.
document.documentElement.classList.replace('no-js', 'js');
