// Native scrolling keeps the page, links and video controls in their usual flow.
const mounted = new WeakMap();
const offsetProperty = '--home-parallax-y';

export function parallaxOffset(rect, viewportHeight, depth, maximum = 72) {
  const distance = viewportHeight / 2 - (rect.top + rect.height / 2);
  const amount = Number.isFinite(depth) ? depth : 0;
  return Math.max(-maximum, Math.min(maximum, distance * amount));
}

export function setupHomeParallax(root = typeof document === 'undefined' ? null : document.querySelector('.home-page')) {
  if (!root) return () => {};
  if (mounted.has(root)) return mounted.get(root);
  const doc = root.ownerDocument;
  const view = doc?.defaultView;
  if (!view?.requestAnimationFrame) return () => {};
  const groups = [...root.querySelectorAll('[data-home-parallax]')].map(element => ({
    element,
    visible: null,
    previousVisible: element.getAttribute('data-home-parallax-visible'),
    layers: [...element.querySelectorAll('[data-parallax-layer][data-parallax-depth]')]
      .filter(layer => layer.closest('[data-home-parallax]') === element)
      .map(element => ({
        element,
        depth: Math.max(-1, Math.min(1, Number(element.dataset.parallaxDepth) || 0)),
        value: element.style.getPropertyValue(offsetProperty),
        priority: element.style.getPropertyPriority(offsetProperty)
      }))
  })).filter(group => group.layers.length);
  if (!groups.length) return () => {};

  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const hadActiveClass = root.classList.contains('home-parallax-active');
  const byElement = new Map(groups.map(group => [group.element, group]));
  let frame = 0, active = false, destroyed = false, suspended = false, observer;

  function restore() {
    root.classList.toggle('home-parallax-active', hadActiveClass);
    for (const group of groups) {
      if (group.previousVisible === null) group.element.removeAttribute('data-home-parallax-visible');
      else group.element.setAttribute('data-home-parallax-visible', group.previousVisible);
      for (const layer of group.layers) {
        if (layer.value) layer.element.style.setProperty(offsetProperty, layer.value, layer.priority);
        else layer.element.style.removeProperty(offsetProperty);
      }
    }
  }
  function cancel() {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
  }
  function draw() {
    frame = 0;
    if (!active || destroyed || suspended || doc.hidden || motion?.matches) return;
    const height = view.innerHeight || doc.documentElement.clientHeight;
    const maximum = (view.innerWidth || doc.documentElement.clientWidth) <= 650 ? 24 : 72;
    // Read all geometry first; update custom properties only after the reads finish.
    const updates = groups.filter(group => !observer || group.visible !== false).map(group => {
      const rect = group.element.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < height && rect.height > 0;
      return {group, visible, offsets: visible ? group.layers.map(layer => parallaxOffset(rect, height, layer.depth, maximum)) : []};
    });
    for (const {group, visible, offsets} of updates) {
      group.visible = visible;
      if (visible) group.element.setAttribute('data-home-parallax-visible', '');
      else group.element.removeAttribute('data-home-parallax-visible');
      if (visible) group.layers.forEach((layer, index) => layer.element.style.setProperty(offsetProperty, `${offsets[index].toFixed(2)}px`));
    }
  }
  function schedule() {
    if (!active || destroyed || suspended || doc.hidden || motion?.matches || frame) return;
    if (observer && groups.every(group => group.visible === false)) return;
    frame = view.requestAnimationFrame(draw);
  }
  function resized() {
    // Viewport changes can bring a formerly offscreen group back into view.
    for (const group of groups) group.visible = null;
    schedule();
  }
  function stop() {
    cancel();
    if (!active) return;
    active = false;
    view.removeEventListener('scroll', schedule);
    view.removeEventListener('resize', resized);
    observer?.disconnect();
  }
  function start() {
    if (active || destroyed || suspended || doc.hidden || motion?.matches) return;
    active = true;
    for (const group of groups) group.visible = null;
    root.classList.add('home-parallax-active');
    view.addEventListener('scroll', schedule, {passive: true});
    view.addEventListener('resize', resized, {passive: true});
    for (const group of groups) observer?.observe(group.element);
    schedule();
  }
  function preferenceChanged() {
    if (motion?.matches) { stop(); restore(); }
    else start();
  }
  function visibilityChanged() {
    if (doc.hidden) stop();
    else start();
  }
  function pageHidden(event) {
    if (event.persisted) { suspended = true; stop(); }
    else cleanup();
  }
  function pageShown(event) {
    if (!event.persisted) return;
    suspended = false; start();
  }
  function cleanup() {
    if (destroyed) return;
    stop(); destroyed = true; restore();
    doc.removeEventListener('visibilitychange', visibilityChanged);
    view.removeEventListener('pagehide', pageHidden);
    view.removeEventListener('pageshow', pageShown);
    if (motion?.removeEventListener) motion.removeEventListener('change', preferenceChanged);
    else motion?.removeListener?.(preferenceChanged);
    mounted.delete(root);
  }

  if (view.IntersectionObserver) {
    observer = new view.IntersectionObserver(entries => {
      if (!active || destroyed) return;
      for (const entry of entries) {
        const group = byElement.get(entry.target);
        if (!group) continue;
        group.visible = entry.isIntersecting;
        if (!entry.isIntersecting) group.element.removeAttribute('data-home-parallax-visible');
      }
      if (groups.every(group => group.visible === false)) cancel();
      else schedule();
    });
  }
  mounted.set(root, cleanup);
  doc.addEventListener('visibilitychange', visibilityChanged);
  view.addEventListener('pagehide', pageHidden);
  view.addEventListener('pageshow', pageShown);
  if (motion?.addEventListener) motion.addEventListener('change', preferenceChanged);
  else motion?.addListener?.(preferenceChanged);
  start();
  return cleanup;
}
