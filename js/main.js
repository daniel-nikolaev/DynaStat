// Mobile menu
const toggle = document.getElementById('menuToggle');
const drawer = document.getElementById('drawer');
toggle.addEventListener('click', () => {
  const open = drawer.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  drawer.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}));

// Site search: the index comes from _data/catalog.yml (see _includes/search-index.html)
const search = document.getElementById('search');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const searchIndex = window.SEARCH_INDEX || [];

let matches = [];
let activeIdx = 0;

const openSearch = () => {
  search.classList.add('open');
  searchInput.tabIndex = 0;
  searchBtn.setAttribute('aria-expanded', 'true');
  searchBtn.setAttribute('aria-label', 'Search');
  searchInput.focus();
};
const closeSearch = () => {
  search.classList.remove('open');
  searchResults.classList.remove('show');
  searchInput.value = '';
  searchInput.tabIndex = -1;
  searchBtn.setAttribute('aria-expanded', 'false');
  searchBtn.setAttribute('aria-label', 'Open search');
};

const renderResults = () => {
  const terms = searchInput.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) { searchResults.classList.remove('show'); matches = []; return; }

  matches = searchIndex
    .filter(item => terms.every(t => item.text.includes(t)))
    .sort((a, b) => terms.some(t => b.title.toLowerCase().includes(t)) - terms.some(t => a.title.toLowerCase().includes(t)));
  activeIdx = 0;

  searchResults.innerHTML = matches.length
    ? matches.map((m, i) => `<li><a href="${m.url}" data-i="${i}" class="${i === 0 ? 'active' : ''}"><span class="r-type">${m.type}</span><span class="r-title">${m.title}</span></a></li>`).join('')
    : '<li class="r-empty">No results found</li>';
  searchResults.classList.add('show');
};

const goTo = item => {
  closeSearch();
  drawer.classList.remove('open');
  window.location.href = item.url;
};

const setActive = i => {
  const links = searchResults.querySelectorAll('a');
  if (!links.length) return;
  activeIdx = (i + links.length) % links.length;
  links.forEach((a, j) => a.classList.toggle('active', j === activeIdx));
  links[activeIdx].scrollIntoView({ block: 'nearest' });
};

search.addEventListener('submit', e => {
  e.preventDefault();
  if (!search.classList.contains('open')) return openSearch();
  if (matches.length) return goTo(matches[activeIdx]);
  if (!searchInput.value.trim()) closeSearch();
});
searchInput.addEventListener('input', renderResults);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
  else if (e.key === 'Escape') { closeSearch(); searchBtn.focus(); }
});
searchResults.addEventListener('mousedown', e => e.preventDefault()); // keep input focus
searchResults.addEventListener('click', e => {
  const link = e.target.closest('a[data-i]');
  if (!link) return;
  e.preventDefault();
  goTo(matches[+link.dataset.i]);
});
document.addEventListener('click', e => {
  if (!search.contains(e.target) && search.classList.contains('open')) closeSearch();
});

// Cell line storage box illustration on the homepage (6x6 grid, a few occupied slots, one highlighted)
const cryo = document.getElementById('cryo');
const occupied = ['A1','A2','A3','B1','B4','C2','C4','C5','D1','D6','E3','E4','F2'];
if (cryo) 'ABCDEF'.split('').forEach((row, r) => {
  for (let c = 1; c <= 6; c++) {
    const id = row + c;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', 164 + (c - 1) * 38);
    dot.setAttribute('cy', 99 + r * 38);
    dot.setAttribute('r', 14);
    if (id === 'C4') { dot.setAttribute('fill', '#0b3d91'); }
    else if (occupied.includes(id)) { dot.setAttribute('fill', '#00b3a4'); }
    cryo.appendChild(dot);
  }
});

// Scroll reveal + stat counters
const countUp = el => {
  const target = +el.dataset.count, suffix = el.dataset.suffix || '';
  const start = performance.now(), dur = 1400;
  const step = now => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    const num = e.target.querySelector('[data-count]');
    if (num) countUp(num);
    io.unobserve(e.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

document.getElementById('year').textContent = new Date().getFullYear();
