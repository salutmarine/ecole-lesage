/* Classic head script: the first brand frame is ready before body content paints. */
(() => {
  if (window.LesageLoading) return;
  const html = document.documentElement;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const sessionKey = 'lesage:brand-intro:v1';
  let firstArrival = true;
  try {
    firstArrival = sessionStorage.getItem(sessionKey) !== 'seen';
    sessionStorage.setItem(sessionKey, 'seen');
  } catch { /* Storage restrictions must never prevent access to the site. */ }
  const labels = {fr:'Chargement de l’École Lesage…', en:'Loading École Lesage…', ja:'エコール・ルサージュを読み込み中…'};
  const pending = new Map();
  let nextId = 0, showTimer, leaveTimer, finishTimer, introTimer;
  let visibleSince = 0, introUntil = 0, initialRelease;
  let introActive = firstArrival;

  function updateAccessibility(visible) {
    const overlay = document.getElementById('lesage-brand-loading');
    overlay?.setAttribute('aria-hidden', String(!visible));
    const label = overlay?.querySelector('.brand-loading-status');
    if (label) label.textContent = labels[html.lang] || labels.fr;
    document.getElementById('platform-main')?.setAttribute('aria-busy', String(pending.size > 0));
  }
  function paint(mode) {
    clearTimeout(finishTimer);
    if (!visibleSince) visibleSince = Date.now();
    html.dataset.brandState = mode;
    updateAccessibility(true);
  }
  function hideImmediately() {
    clearTimeout(showTimer); clearTimeout(leaveTimer); clearTimeout(finishTimer); clearTimeout(introTimer);
    for (const task of pending.values()) clearTimeout(task.expiry);
    pending.clear(); introActive = false; visibleSince = 0;
    delete html.dataset.brandState;
    updateAccessibility(false);
  }
  function settle() {
    clearTimeout(showTimer); clearTimeout(leaveTimer);
    updateAccessibility(Boolean(html.dataset.brandState));
    if (pending.size) {
      if (html.dataset.brandState && html.dataset.brandState !== 'leaving') return;
      const due = Math.min(...[...pending.values()].map(task => task.showAt));
      showTimer = setTimeout(() => paint(introActive ? 'intro' : 'busy'), Math.max(0, due - Date.now()));
      return;
    }
    if (!html.dataset.brandState) return;
    const earliest = Math.max(introActive ? introUntil : 0, visibleSince + (reducedMotion ? 0 : 220));
    leaveTimer = setTimeout(() => {
      introActive = false;
      html.dataset.brandState = 'leaving';
      updateAccessibility(false);
      finishTimer = setTimeout(() => {
        delete html.dataset.brandState; visibleSince = 0;
      }, reducedMotion ? 0 : 300);
    }, Math.max(0, earliest - Date.now()));
  }
  function begin({delay = 280} = {}) {
    clearTimeout(finishTimer);
    if (html.dataset.brandState === 'leaving') {
      delete html.dataset.brandState; visibleSince = 0;
    }
    const id = ++nextId;
    const release = () => {
      const task = pending.get(id);
      if (!task) return;
      clearTimeout(task.expiry); pending.delete(id); settle();
    };
    pending.set(id, {showAt:Date.now() + delay, expiry:setTimeout(release, 12000)});
    settle();
    return release;
  }
  function ready() { initialRelease?.(); initialRelease = null; }

  window.LesageLoading = Object.freeze({begin, ready, dismiss:hideImmediately});
  if (firstArrival) {
    introUntil = Date.now() + (reducedMotion ? 180 : 1450);
    paint('intro');
    introTimer = setTimeout(() => {
      if (pending.size && html.dataset.brandState === 'intro') {
        introActive = false; paint('busy');
      }
    }, reducedMotion ? 180 : 1450);
  }
  initialRelease = begin();
  function contentReady() {
    updateAccessibility(Boolean(html.dataset.brandState));
    // Editorial content is already present; the platform releases after its data and view are ready.
    if (!html.hasAttribute('data-lesage-platform')) ready();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', contentReady, {once:true});
  else contentReady();
  window.addEventListener('pageshow', event => { if (event.persisted) hideImmediately(); });
  window.addEventListener('pagehide', hideImmediately);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && html.dataset.brandState) hideImmediately();
  });
  // Observe real document navigation after the app's router has had the chance to handle the click.
  window.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    let destination;
    try { destination = new URL(link.href, location.href); } catch { return; }
    if (destination.origin !== location.origin || !/^https?:$/.test(destination.protocol)) return;
    if (destination.pathname === location.pathname && destination.search === location.search) return;
    begin();
  });
})();
