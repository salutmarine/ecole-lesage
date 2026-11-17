const slider = document.querySelector('[data-maison-slider]');
if (slider) {
  const slides = [...slider.querySelector('[data-maison-slides]').children];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let timer;
  function advance() {
    slides[current].classList.remove('is-active');
    slides[current].setAttribute('aria-hidden', 'true');
    current = (current + 1) % slides.length;
    slides[current].classList.add('is-active');
    slides[current].setAttribute('aria-hidden', 'false');
  }
  function schedule() {
    clearInterval(timer);
    if (!document.hidden && !reducedMotion.matches && slides.length > 1)
      timer = setInterval(advance, 5000);
  }
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', schedule);
  window.addEventListener('pagehide', () => clearInterval(timer));
  window.addEventListener('pageshow', schedule);
  schedule();
}
