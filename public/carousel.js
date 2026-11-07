const carousel = document.querySelector('.carousel');
const toolbar = carousel.querySelector('.carousel-toolbar');
const track = carousel.querySelector('.slides');
const slides = Array.from(track.children);
const select = toolbar.querySelector('select');
const thumbnails = Array.from(toolbar.querySelectorAll('[data-slide-to]'));
const count = toolbar.querySelector('.slide-count');
const status = toolbar.querySelector('[role="status"]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeIndex = -1;
let settleTimer;
let lastWidth = 0;

function indexForId(id) {
  return slides.findIndex(slide => slide.id === id);
}

function fitHeight() {
  track.style.height = slides[activeIndex].offsetHeight + 'px';
}

function showSlide(index, updateUrl) {
  if (index === activeIndex) return;
  const previous = slides[activeIndex];
  if (previous && previous.contains(document.activeElement)) {
    track.focus({ preventScroll: true });
  }
  activeIndex = index;
  const active = slides[index];
  slides.forEach((slide, position) => {
    slide.inert = position !== index;
    slide.setAttribute('aria-hidden', String(position !== index));
  });
  thumbnails.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.slideTo === active.id));
  });
  const selectedThumb = thumbnails[index];
  if (selectedThumb) {
    const strip = selectedThumb.parentElement;
    const left = selectedThumb.offsetLeft;
    const right = left + selectedThumb.offsetWidth;
    if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left - (strip.clientWidth - selectedThumb.offsetWidth) / 2;
    }
  }
  if (select) select.value = active.id;
  count.textContent = (index + 1) + ' / ' + slides.length;
  status.textContent = count.textContent + '. ' + active.querySelector('h2').textContent;
  fitHeight();
  if (updateUrl && location.hash !== '#' + active.id) {
    try { history.replaceState(history.state, '', '#' + active.id); } catch { /* Standalone files may restrict history access. */ }
  }
}

function moveTo(index, animate = true, updateUrl = true) {
  if (index < 0 || index >= slides.length) return;
  const smooth = animate && !reducedMotion.matches && Math.abs(index - activeIndex) === 1;
  showSlide(index, updateUrl);
  track.scrollTo({ left: slides[index].offsetLeft, behavior: smooth ? 'smooth' : 'instant' });
}

function step(direction) {
  moveTo((activeIndex + direction + slides.length) % slides.length);
}

function syncAfterScroll() {
  clearTimeout(settleTimer);
  showSlide(Math.min(slides.length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth))), true);
}

function followHash() {
  const index = indexForId(location.hash.slice(1));
  if (index < 0) return;
  moveTo(index, false, false);
  carousel.scrollIntoView({ block: 'start', behavior: 'instant' });
}

carousel.classList.add('ready');
carousel.setAttribute('aria-roledescription', 'carousel');
track.tabIndex = 0;
track.setAttribute('role', 'group');
track.setAttribute('aria-label', carousel.getAttribute('aria-label'));
slides.forEach(slide => slide.setAttribute('aria-roledescription', 'slide'));
toolbar.hidden = false;
const initial = indexForId(location.hash.slice(1));
moveTo(initial < 0 ? 0 : initial, false, false);
if (initial >= 0) requestAnimationFrame(followHash);

toolbar.querySelectorAll('[data-step]').forEach(button => {
  button.addEventListener('click', () => step(Number(button.dataset.step)));
});
thumbnails.forEach(button => {
  button.addEventListener('click', () => moveTo(indexForId(button.dataset.slideTo)));
});
if (select) select.addEventListener('change', () => moveTo(indexForId(select.value)));

carousel.addEventListener('keydown', event => {
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey ||
      event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
  switch (event.key) {
    case 'ArrowLeft': step(-1); break;
    case 'ArrowRight': step(1); break;
    case 'Home': moveTo(0); break;
    case 'End': moveTo(slides.length - 1); break;
    default: return;
  }
  event.preventDefault();
});

// Touch swipes and horizontal trackpad scrolling use the browser's scroll snap.
track.addEventListener('scroll', () => {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(syncAfterScroll, 150);
}, { passive: true });
track.addEventListener('scrollend', syncAfterScroll);
window.addEventListener('hashchange', followHash);
new ResizeObserver(() => {
  if (track.clientWidth !== lastWidth) {
    lastWidth = track.clientWidth;
    track.scrollTo({ left: slides[activeIndex].offsetLeft, behavior: 'instant' });
  }
  fitHeight();
}).observe(carousel);
const contentResize = new ResizeObserver(fitHeight);
slides.forEach(slide => contentResize.observe(slide));
