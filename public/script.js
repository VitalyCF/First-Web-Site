const root = document.documentElement;
const themeButton = document.querySelector('#theme');
const menuButton = document.querySelector('#menu');
const navigation = document.querySelector('#nav');

function applyTheme(theme) {
  root.dataset.theme = theme;
  themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#191b20' : '#f7f6f2';
}

try {
  applyTheme(localStorage.getItem('vitaly-site-theme') === 'dark' ? 'dark' : 'light');
} catch {
  applyTheme('light');
}

themeButton.addEventListener('click', () => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('vitaly-site-theme', theme); } catch { /* Storage is optional. */ }
});

function toggleMenu(open) {
  navigation.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.textContent = open ? 'Close' : 'Menu';
}

menuButton.addEventListener('click', () => toggleMenu(!navigation.classList.contains('open')));
navigation.addEventListener('click', () => toggleMenu(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    toggleMenu(false);
    menuButton.focus();
  }
});
window.matchMedia('(max-width: 760px)').addEventListener('change', () => toggleMenu(false));
