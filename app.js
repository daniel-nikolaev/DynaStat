'use strict';

/* =====================================================================
 * Pokemon Binder Sorter
 * Data + images: TCGdex public API (https://tcgdex.dev)
 * ===================================================================== */

const API = 'https://api.tcgdex.net/v2/en';
const CACHE_PREFIX = 'ps:v1:';
const SET_LIST_TTL = 24 * 60 * 60 * 1000; // refresh the set list daily
const FETCH_CONCURRENCY = 12;

// Pile order follows the order cards appear in a set.
const CATEGORIES = [
  { key: 'Grass',     color: '#4f9d45' },
  { key: 'Fire',      color: '#e0533b' },
  { key: 'Water',     color: '#3a8fdc' },
  { key: 'Lightning', color: '#e9b824' },
  { key: 'Psychic',   color: '#9b55c4' },
  { key: 'Fighting',  color: '#b8682f' },
  { key: 'Darkness',  color: '#3d4654' },
  { key: 'Metal',     color: '#8a95a3' },
  { key: 'Fairy',     color: '#df7fb9' },
  { key: 'Dragon',    color: '#a88a2c' },
  { key: 'Colorless', color: '#a9a291' },
  { key: 'Trainer',   color: '#5d6b7a' },
  { key: 'Energy',    color: '#258f82' },
  { key: 'Unknown',   color: '#999999' },
];
const CAT = Object.fromEntries(CATEGORIES.map((c, i) => [c.key, { ...c, order: i }]));

// Special card kinds users can hide.
// Name-based kinds (`re`) apply to Pokémon only; first match wins, so order matters.
// Rarity-based kinds (`rarity`) apply to any card and stack with a name-based kind,
// e.g. a full-art "ex" can be both ex and Ultra Rare.
const SPECIALS = [
  { key: 'ex',      label: 'Pokémon ex',            re: /\bex\b/ },
  { key: 'EX',      label: 'Pokémon-EX',            re: /\bEX\b/ },
  { key: 'GX',      label: 'Pokémon-GX / TAG TEAM', re: /\bGX\b/ },
  { key: 'VMAX',    label: 'VMAX',                  re: /\bVMAX\b/ },
  { key: 'VSTAR',   label: 'VSTAR',                 re: /\bVSTAR\b/ },
  { key: 'V-UNION', label: 'V-UNION',               re: /\bV-UNION\b/ },
  { key: 'V',       label: 'Pokémon V',             re: /\sV$/ },
  { key: 'BREAK',   label: 'BREAK',                 re: /\bBREAK\b/ },
  { key: 'LV.X',    label: 'LV.X',                  re: /\bLV\.X\b/ },
  { key: 'LEGEND',  label: 'LEGEND',                re: /\bLEGEND\b/ },
  { key: 'Radiant', label: 'Radiant',               re: /^Radiant\s/ },
  { key: 'Prism',   label: 'Prism Star ◇',          re: /◇|Prism Star/ },
  { key: 'Mega',    label: 'Mega Evolution',        re: /^(Mega|M)\s/ },
  { key: 'UR',      label: 'Ultra Rare',            rarity: /^ultra rare$/i },
  { key: 'SIR',     label: 'Special Illustration Rare (SIR)', rarity: /^special illustration rare$/i },
  { key: 'ACE',     label: 'ACE SPEC Rare',         rarity: /ace spec/i },
];
const SPECIAL = Object.fromEntries(SPECIALS.map(s => [s.key, s]));

/* ---------------------------- State ---------------------------- */

const defaults = {
  seriesId: null,
  setId: null,
  mode: 'breakdown',
  type: null,
  rows: 3,
  cols: 3,
  corner: 'tl',
  showPositions: true,
  menuCollapsed: false,
  theme: 'auto',              // 'auto' | 'light' | 'dark'
  includeSecret: true,
  hiddenSpecials: [],
};
const state = {
  ...defaults,
  ...readStore('settings'),
  page: 0,
  set: null,     // set metadata
  cards: [],     // normalized cards of current set
  loadToken: 0,
};
state.hiddenSpecials = new Set(state.hiddenSpecials);

const $ = id => document.getElementById(id);
const el = {
  seriesSelect: $('series-select'),
  setSearch: $('set-search'),
  setSelect: $('set-select'),
  setTrigger: $('set-trigger'),
  setTriggerName: $('set-trigger-name'),
  setTriggerCode: $('set-trigger-code'),
  setMenu: $('set-menu'),
  specialSection: $('special-section'),
  typeFilter: $('type-filter'),
  secretFilter: $('secret-filter'),
  filtersSection: $('filters-section'),
  setMeta: $('set-meta'),
  typePicker: $('type-picker'),
  gridPreset: $('grid-preset'),
  gridRows: $('grid-rows'),
  gridCols: $('grid-cols'),
  startCorner: $('start-corner'),
  showPositions: $('show-positions'),
  menuBtn: $('menu-btn'),
  settingsBtn: $('settings-btn'),
  settingsPanel: $('settings-panel'),
  settingsClose: $('settings-close'),
  resetDefaults: $('reset-defaults'),
  fullscreenBtn: $('fullscreen-btn'),
  settingsSummary: $('settings-summary'),
  includeSecret: $('include-secret'),
  secretLabel: $('secret-label'),
  specialFilters: $('special-filters'),
  status: $('status'),
  summary: $('summary'),
  backToTypes: $('back-to-types'),
  board: $('board'),
  prev: $('prev-page'),
  next: $('next-page'),
  pageLabel: $('page-label'),
  modal: $('modal'),
  modalTitle: $('modal-title'),
  modalBody: $('modal-body'),
  modalClose: $('modal-close'),
};

/* ---------------------------- Storage ---------------------------- */

function readStore(key) {
  try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + key)) ?? undefined; }
  catch { return undefined; }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota full: drop cached sets and try once more.
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX + 'set:'))
      .forEach(k => localStorage.removeItem(k));
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch { /* give up */ }
  }
}

function saveSettings() {
  writeStore('settings', {
    seriesId: state.seriesId,
    setId: state.setId,
    mode: state.mode,
    type: state.type,
    rows: state.rows,
    cols: state.cols,
    corner: state.corner,
    showPositions: state.showPositions,
    menuCollapsed: state.menuCollapsed,
    theme: state.theme,
    includeSecret: state.includeSecret,
    hiddenSpecials: [...state.hiddenSpecials],
  });
}

/* ---------------------------- Networking ---------------------------- */

async function fetchJSON(url, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/* ---------------------------- Card helpers ---------------------------- */

function parseNumber(localId) {
  const m = /^([A-Za-z-]*)(\d+)([A-Za-z]*)$/.exec(String(localId));
  if (!m) return { prefix: String(localId).toUpperCase(), n: Number.POSITIVE_INFINITY, tail: '' };
  return { prefix: m[1].toUpperCase(), n: parseInt(m[2], 10), tail: m[3] };
}

function compareNumbers(a, b) {
  const pa = a.num, pb = b.num;
  if (pa.prefix !== pb.prefix) {
    if (pa.prefix === '') return -1;      // main set numbers before subsets (TG, GG, …)
    if (pb.prefix === '') return 1;
    return pa.prefix < pb.prefix ? -1 : 1;
  }
  if (pa.n !== pb.n) return pa.n - pb.n;
  return pa.tail.localeCompare(pb.tail) || String(a.localId).localeCompare(String(b.localId));
}

// All special kinds a card belongs to (possibly none).
function detectSpecials(card) {
  const tags = [];
  if (card.category === 'Pokemon') {
    const hit = SPECIALS.find(s => s.re && s.re.test(card.name));
    if (hit) tags.push(hit.key);
    else if (card.suffix && SPECIAL[card.suffix]?.re) tags.push(card.suffix);
  }
  for (const s of SPECIALS) {
    if (s.rarity && s.rarity.test(card.rarity || '')) tags.push(s.key);
  }
  return tags;
}

// "Special illustration rare" -> "Special Illustration Rare (SIR)".
// Only first letters are raised, so "ACE SPEC Rare" keeps its capitals.
const RARITY_ABBR = { 'special illustration rare': 'SIR' };
function rarityName(rarity) {
  return rarity.replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase());
}

function formatRarity(rarity) {
  if (!rarity) return '—';
  const abbr = RARITY_ABBR[rarity.toLowerCase()];
  return abbr ? `${rarityName(rarity)} (${abbr})` : rarityName(rarity);
}

// Rarity mark printed on the card (Scarlet & Violet era), with the colour it's printed in.
const RARITY_SYMBOLS = {
  'common':                    { mark: '●',   tone: 'black' },
  'uncommon':                  { mark: '◆',   tone: 'black' },
  'rare':                      { mark: '★',   tone: 'black' },
  'double rare':               { mark: '★★',  tone: 'black' },
  'ultra rare':                { mark: '★★',  tone: 'silver' },
  'illustration rare':         { mark: '★',   tone: 'gold' },
  'special illustration rare': { mark: '★★',  tone: 'gold' },
  'hyper rare':                { mark: '★★★', tone: 'gold' },
};

// Rarity row for card details: "Uncommon - ◆", or just the name if the symbol isn't known.
function rarityLine(rarity) {
  const sym = rarity && RARITY_SYMBOLS[rarity.toLowerCase()];
  if (!sym) return formatRarity(rarity);
  const frag = document.createDocumentFragment();
  const mark = document.createElement('span');
  mark.className = `rarity-mark rarity-${sym.tone}`;
  mark.textContent = sym.mark;
  mark.title = `${sym.tone} ${sym.mark.length > 1 ? 'stars' : sym.mark === '★' ? 'star' : 'symbol'}`;
  frag.append(`${formatRarity(rarity)} - `, mark);
  return frag;
}

function categoryOf(card) {
  if (card.category === 'Trainer') return 'Trainer';
  if (card.category === 'Energy') return 'Energy';
  if (card.category === 'Pokemon') {
    const t = card.types && card.types[0];
    return CAT[t] ? t : 'Colorless';
  }
  return 'Unknown';
}

function isSecret(card, set) {
  const official = set.cardCount?.official ?? 0;
  const total = set.cardCount?.total ?? 0;
  if (!official || official >= total) return false; // promo sets etc. have no "secret" range
  if (card.num.prefix !== '') return true;          // subset cards like TG01 / GG01
  return card.num.n > official;
}

function imageUrl(card, quality = 'low') {
  return card.image ? `${card.image}/${quality}.webp` : null;
}

function normalizeCard(raw, set) {
  const card = {
    id: raw.id,
    localId: raw.localId,
    name: raw.name,
    category: raw.category || null,
    types: raw.types || null,
    suffix: raw.suffix || null,
    rarity: raw.rarity || null,
    image: raw.image || null,
  };
  return enrichCard(card, set);
}

function enrichCard(card, set) {
  card.num = parseNumber(card.localId);
  card.cat = categoryOf(card);
  card.specials = detectSpecials(card);
  card.secret = isSecret(card, set);
  return card;
}

/* ---------------------------- Data loading ---------------------------- */

async function loadSetList() {
  const cached = readStore('setlist-v3');
  if (cached && Date.now() - cached.time < SET_LIST_TTL) return cached.groups;

  const series = await fetchJSON(`${API}/series`);
  const details = await mapLimit(series, 6, s =>
    fetchJSON(`${API}/series/${encodeURIComponent(s.id)}`).catch(() => null));

  // Oldest series first, newest last; odds-and-ends series go at the very end.
  // Sets within a series keep the API's order, which is release order.
  const tail = new Set(['misc', 'tk', 'mc', 'tcgp']);
  const groups = details
    .filter(d => d && Array.isArray(d.sets) && d.sets.length)
    .map(d => ({
      id: d.id,
      name: d.name,
      release: d.releaseDate || '',
      sets: d.sets.map(s => ({
        id: s.id,
        name: s.name,
        total: s.cardCount?.total ?? null,
      })),
    }))
    .sort((a, b) => {
      const ta = tail.has(a.id), tb = tail.has(b.id);
      if (ta !== tb) return ta ? 1 : -1;
      return a.release.localeCompare(b.release);
    });

  // Set codes (e.g. PRE) are only on each set's own record, so fetch those too.
  const allSets = groups.flatMap(g => g.sets);
  await mapLimit(allSets, FETCH_CONCURRENCY, async s => {
    const d = await fetchJSON(`${API}/sets/${encodeURIComponent(s.id)}`, 1).catch(() => null);
    s.code = d?.abbreviation?.official || null;
  });

  // Drop older cached copies of the set list.
  ['setlist', 'setlist-oldest-first'].forEach(k => localStorage.removeItem(CACHE_PREFIX + k));
  writeStore('setlist-v3', { time: Date.now(), groups });
  return groups;
}

async function loadSet(setId) {
  const token = ++state.loadToken;
  state.set = null;
  state.cards = [];
  render();

  const cached = readStore(`set:${setId}`);
  if (cached) {
    applySet(cached.set, cached.cards.map(c => enrichCard(c, cached.set)));
    return;
  }

  try {
    showStatus('Loading set…');
    const set = await fetchJSON(`${API}/sets/${encodeURIComponent(setId)}`);
    if (token !== state.loadToken) return;
    const setMeta = {
      id: set.id,
      name: set.name,
      serie: set.serie?.name || '',
      releaseDate: set.releaseDate || '',
      cardCount: set.cardCount || {},
    };
    const briefs = set.cards || [];
    let done = 0;
    let failures = 0;

    const cards = await mapLimit(briefs, FETCH_CONCURRENCY, async brief => {
      if (token !== state.loadToken) return null;
      let raw;
      try {
        raw = await fetchJSON(`${API}/cards/${encodeURIComponent(brief.id)}`);
      } catch {
        failures++;
        raw = brief; // fall back to name/number/image only
      }
      done++;
      if (token === state.loadToken) {
        showStatus(`Loading card details… ${done} / ${briefs.length}`, done / briefs.length);
      }
      return normalizeCard(raw, setMeta);
    });
    if (token !== state.loadToken) return;

    if (failures === 0) {
      writeStore(`set:${setId}`, {
        set: setMeta,
        cards: cards.map(({ id, localId, name, category, types, suffix, rarity, image }) =>
          ({ id, localId, name, category, types, suffix, rarity, image })),
      });
    }
    applySet(setMeta, cards);
    if (failures) {
      showStatus(`${failures} card(s) could not be loaded fully and are grouped under "Unknown". Reload the set to retry.`, null, true);
    }
  } catch (err) {
    if (token !== state.loadToken) return;
    showStatus(`Could not load this set (${err.message}).`, null, true, () => loadSet(setId));
  }
}

function applySet(set, cards) {
  state.set = set;
  state.cards = cards.sort(compareNumbers);
  hideStatus();
  renderFilters();
  render();
}

/* ---------------------------- Derived data ---------------------------- */

function visibleCards() {
  return state.cards.filter(c =>
    (state.includeSecret || !c.secret) &&
    !c.specials.some(k => state.hiddenSpecials.has(k)));
}

function piles(cards) {
  const map = new Map();
  for (const c of cards) {
    if (!map.has(c.cat)) map.set(c.cat, []);
    map.get(c.cat).push(c);
  }
  return [...map.entries()]
    .map(([key, list]) => ({ key, color: CAT[key].color, cards: list }))
    .sort((a, b) => CAT[a.key].order - CAT[b.key].order);
}

/* ---------------------------- Rendering ---------------------------- */

function render() {
  const rows = state.rows, cols = state.cols;
  const perPage = rows * cols;
  const cornerNames = { tl: 'top-left', tr: 'top-right', bl: 'bottom-left', br: 'bottom-right' };
  el.backToTypes.hidden = !(state.mode === 'bytype' && state.set);
  el.settingsSummary.textContent = `${rows} × ${cols} · from ${cornerNames[state.corner]}`;
  el.board.classList.toggle('hide-positions', !state.showPositions);
  el.board.style.setProperty('--rows', rows);
  el.board.style.setProperty('--cols', cols);
  el.board.replaceChildren();

  if (!state.set) {
    el.summary.textContent = state.setId ? '' : 'Choose a set to get started.';
    placeSlots(Array.from({ length: perPage }, (_, i) => emptySlot(i)));
    updatePager(1);
    renderTypePicker([]);
    fitBoard();
    return;
  }

  const cards = visibleCards();
  const pileList = piles(cards);
  renderTypePicker(pileList);

  let items;
  if (state.mode === 'breakdown') {
    items = pileList;
  } else {
    const pile = pileList.find(p => p.key === state.type);
    items = pile ? pile.cards : [];
  }

  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  state.page = Math.min(Math.max(0, state.page), pageCount - 1);
  const start = state.page * perPage;
  const pageItems = items.slice(start, start + perPage);

  placeSlots(Array.from({ length: perPage }, (_, i) => {
    const item = pageItems[i];
    if (!item) return emptySlot(start + i);
    if (state.mode === 'breakdown') return pileSlot(item, start + i);
    return cardSlot(item, start + i);
  }));

  renderSummary(cards, pileList, items, start, pageItems.length, pageCount);
  updatePager(pageCount);
  fitBoard();
}

function renderSummary(cards, pileList, items, start, onPage, pageCount) {
  const s = state.set;
  if (state.mode === 'breakdown') {
    const overflow = pageCount > 1
      ? ` Your sorter has ${state.rows * state.cols} slots, so the piles continue on the next page.`
      : '';
    el.summary.innerHTML =
      `<strong>${esc(s.name)}</strong>: ${cards.length} cards across ${pileList.length} piles.` +
      ` Put each card on the pile for its type. Click a pile to see its cards.${overflow}`;
  } else if (!items.length) {
    el.summary.innerHTML = `<strong>${esc(s.name)}</strong>: pick a type to lay out.`;
  } else {
    el.summary.innerHTML =
      `<strong>${esc(state.type)}</strong> in <strong>${esc(s.name)}</strong>: ${items.length} cards.` +
      ` This page holds cards ${start + 1}–${start + onPage} ` +
      `(#${esc(items[start].localId)} to #${esc(items[start + onPage - 1].localId)}).`;
  }
}

function updatePager(pageCount) {
  el.pageLabel.textContent = `Page ${state.page + 1} of ${pageCount}`;
  el.prev.disabled = state.page <= 0;
  el.next.disabled = state.page >= pageCount - 1;
}

function emptySlot(index) {
  const d = document.createElement('div');
  d.className = 'slot empty';
  d.append(slotIndex(index));
  return d;
}

// Grid position (row, col) of the k-th slot to fill on a page, filling row
// by row starting from the chosen corner.
function slotPosition(k) {
  let row = Math.floor(k / state.cols);
  let col = k % state.cols;
  if (state.corner === 'bl' || state.corner === 'br') row = state.rows - 1 - row;
  if (state.corner === 'tr' || state.corner === 'br') col = state.cols - 1 - col;
  return { row, col };
}

// Takes slots in fill order and puts each one in its grid position.
function placeSlots(nodesInOrder) {
  const grid = new Array(nodesInOrder.length);
  nodesInOrder.forEach((node, k) => {
    const { row, col } = slotPosition(k);
    grid[row * state.cols + col] = node;
  });
  el.board.replaceChildren(...grid);
}

// Label for a slot: its physical row/column in the sorter.
function slotIndex(index) {
  const { row, col } = slotPosition(index % (state.rows * state.cols));
  const pos = document.createElement('span');
  pos.className = 'slot-index';
  pos.textContent = `R${row + 1} C${col + 1}`;
  return pos;
}

function cardImage(card, quality = 'low') {
  const url = imageUrl(card, quality);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `${card.name} #${card.localId}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => img.replaceWith(placeholder(card));
    return img;
  }
  return placeholder(card);
}

function placeholder(card) {
  const d = document.createElement('div');
  d.className = 'placeholder';
  d.style.setProperty('--c', CAT[card.cat]?.color || '#bbb');
  d.innerHTML = `<div>${esc(card.name)}</div><div>#${esc(card.localId)}</div>`;
  return d;
}

function makeClickable(node, label, onClick) {
  node.classList.add('clickable');
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  node.setAttribute('aria-label', label);
  node.addEventListener('click', onClick);
  node.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  });
}

function pileSlot(pile, index) {
  const d = document.createElement('div');
  d.className = 'slot pile';
  d.style.setProperty('--c', pile.color);

  const head = document.createElement('div');
  head.className = 'pile-head';
  head.innerHTML =
    `<span class="pile-name">${esc(pile.key)}</span>` +
    `<span class="pile-count">${pile.cards.length} card${pile.cards.length === 1 ? '' : 's'}</span>`;

  const fan = document.createElement('div');
  fan.className = 'fan';
  for (const card of pile.cards.slice(0, 3)) {
    const fc = document.createElement('div');
    fc.className = 'fan-card';
    fc.append(cardImage(card));
    fan.append(fc);
  }

  const range = document.createElement('div');
  range.className = 'pile-range';
  const first = pile.cards[0], last = pile.cards[pile.cards.length - 1];
  range.textContent = first === last ? `#${first.localId}` : `#${first.localId} – #${last.localId}`;

  d.append(head, fan, range, slotIndex(index));
  makeClickable(d, `${pile.key} pile, ${pile.cards.length} cards`, () => openPile(pile));
  return d;
}

function cardSlot(card, index) {
  const d = document.createElement('div');
  d.className = 'slot card';
  const badge = document.createElement('span');
  badge.className = 'num-badge';
  badge.textContent = `#${card.localId}`;
  d.append(cardImage(card), badge, slotIndex(index));
  makeClickable(d, `${card.name}, number ${card.localId}`, () => openCard(card));
  return d;
}

// Section 3 is shown when it has something in it: the energy-type picker
// (type-by-type mode), the secret-rare toggle and/or the special-card checkboxes.
function updateFiltersSection() {
  el.filtersSection.hidden = el.typeFilter.hidden && el.secretFilter.hidden && el.specialSection.hidden;
}

function renderTypePicker(pileList) {
  el.typeFilter.hidden = state.mode !== 'bytype' || !pileList.length;
  updateFiltersSection();
  if (el.typeFilter.hidden) {
    el.typePicker.replaceChildren();
    return;
  }
  // Default to the first available type.
  if (!pileList.some(p => p.key === state.type)) {
    state.type = pileList[0].key;
    saveSettings();
  }
  el.typePicker.replaceChildren(...pileList.map(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'type-chip';
    b.setAttribute('aria-pressed', String(p.key === state.type));
    b.innerHTML = `<span class="dot" style="--c:${p.color}"></span>${esc(p.key)} <small>${p.cards.length}</small>`;
    b.addEventListener('click', () => {
      state.type = p.key;
      state.page = 0;
      saveSettings();
      render();
    });
    return b;
  }));
}

function renderFilters() {
  const set = state.set;
  const cards = state.cards;

  // Secret rares
  const official = set.cardCount?.official;
  const secretCount = cards.filter(c => c.secret).length;
  el.secretLabel.textContent = secretCount
    ? `Include secret rares (${secretCount} cards numbered past ${official})`
    : 'Include secret rares (none in this set)';
  el.includeSecret.disabled = !secretCount;
  el.secretFilter.hidden = !secretCount;

  // Special card toggles, only for kinds present in this set
  const counts = new Map();
  for (const c of cards) for (const k of c.specials) counts.set(k, (counts.get(k) || 0) + 1);
  el.specialFilters.replaceChildren(...SPECIALS.filter(s => counts.has(s.key)).map(s => {
    const label = document.createElement('label');
    label.className = 'check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !state.hiddenSpecials.has(s.key);
    input.addEventListener('change', () => {
      if (input.checked) state.hiddenSpecials.delete(s.key);
      else state.hiddenSpecials.add(s.key);
      state.page = 0;
      saveSettings();
      render();
    });
    const span = document.createElement('span');
    span.textContent = `Include ${s.label} (${counts.get(s.key)})`;
    label.append(input, span);
    return label;
  }));
  el.specialSection.hidden = counts.size === 0;
  updateFiltersSection();

  const date = set.releaseDate ? ` · released ${set.releaseDate}` : '';
  el.setMeta.textContent = `${set.serie ? set.serie + ' · ' : ''}${cards.length} cards (${official ?? '?'} in the main set)${date}`;
}

/* ---------------------------- Modal ---------------------------- */

function openPile(pile) {
  el.modalTitle.textContent = `${pile.key} pile: ${pile.cards.length} cards`;
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = `Lay out ${pile.key} cards in number order →`;
  btn.addEventListener('click', () => {
    el.modal.close();
    setMode('bytype', pile.key);
  });
  actions.append(btn);

  const grid = document.createElement('div');
  grid.className = 'mini-grid';
  for (const card of pile.cards) grid.append(miniCard(card));
  el.modalBody.replaceChildren(actions, grid);
  el.modal.showModal();
}

function miniCard(card) {
  const fig = document.createElement('figure');
  fig.className = 'mini-card';
  const slot = document.createElement('div');
  slot.className = 'slot card';
  slot.append(cardImage(card));
  const cap = document.createElement('figcaption');
  cap.innerHTML = `<b>#${esc(card.localId)}</b> ${esc(card.name)}`;
  fig.append(slot, cap);
  return fig;
}

function openCard(card) {
  el.modalTitle.textContent = `${card.name} (#${card.localId})`;
  const wrap = document.createElement('div');
  wrap.className = 'card-detail';
  const img = cardImage(card, 'high');
  img.loading = 'eager';
  const dl = document.createElement('dl');
  const rows = [
    ['Number', `${card.localId}${state.set.cardCount?.official ? ' / ' + state.set.cardCount.official : ''}`],
    ['Types', card.cat === 'Trainer' ? 'Trainer' : card.types ? card.types.join(', ') : '—'],
    ['Rarity', rarityLine(card.rarity)],
    ['Secret rare', card.secret ? 'Yes' : 'No'],
  ];
  if (card.types && card.types.length > 1) {
    rows.push(['Note', `Dual-type card, sorted under its first type (${card.types[0]}).`]);
  }
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd');
    if (v instanceof Node) dd.append(v); else dd.textContent = v;
    dl.append(dt, dd);
  }
  wrap.append(img, dl);
  el.modalBody.replaceChildren(wrap);
  el.modal.showModal();
}

/* ---------------------------- Status ---------------------------- */

function showStatus(message, progress = null, isError = false, retry = null) {
  el.status.hidden = false;
  el.status.classList.toggle('error', isError);
  el.status.replaceChildren(document.createTextNode(message));
  if (progress !== null) {
    const p = document.createElement('progress');
    p.max = 1;
    p.value = progress;
    el.status.append(p);
  }
  if (retry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Retry';
    b.addEventListener('click', retry);
    el.status.append(b);
  }
}

function hideStatus() { el.status.hidden = true; }

/* ---------------------------- Set picker ---------------------------- */

let setGroups = [];

const ALL_SERIES = 'all';

function renderSeriesOptions() {
  // First visit: "All series". Otherwise keep the saved series, or fall back
  // to the series of the saved set.
  const valid = id => id === ALL_SERIES || setGroups.some(g => g.id === id);
  if (!valid(state.seriesId)) {
    const owner = setGroups.find(g => g.sets.some(s => s.id === state.setId));
    state.seriesId = owner?.id ?? ALL_SERIES;
  }
  const all = new Option('All series', ALL_SERIES);
  el.seriesSelect.replaceChildren(all, ...setGroups.map(g =>
    new Option(`${g.name} (${g.sets.length} sets)`, g.id)));
  el.seriesSelect.value = state.seriesId;
}

function renderSetOptions() {
  const q = el.setSearch.value.trim().toLowerCase();
  const groups = state.seriesId === ALL_SERIES
    ? setGroups
    : setGroups.filter(g => g.id === state.seriesId);
  const grouped = groups.length > 1;   // only show series headings in "All series"
  const frag = document.createDocumentFragment();
  for (const g of groups) {
    const sets = q
      ? g.sets.filter(s => [s.name, s.id, s.code || ''].some(v => v.toLowerCase().includes(q)))
      : g.sets;
    if (!sets.length) continue;
    if (grouped) {
      const h = document.createElement('div');
      h.className = 'set-group';
      h.setAttribute('role', 'presentation');
      h.textContent = g.name;
      frag.append(h);
    }
    for (const s of sets) {
      const item = document.createElement('div');
      item.className = 'set-item';
      item.id = `set-opt-${s.id}`;
      item.dataset.id = s.id;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(s.id === state.setId));

      const name = document.createElement('span');
      name.className = 'set-name';
      name.textContent = s.name;
      if (s.total) {
        const total = document.createElement('span');
        total.className = 'set-total';
        total.textContent = ` (${s.total})`;
        name.append(total);
      }
      name.title = s.name;
      item.append(name);

      if (s.code) {
        const code = document.createElement('span');
        code.className = 'set-code';
        code.textContent = `[${s.code}]`;
        item.append(code);
      }
      frag.append(item);
    }
  }
  if (!frag.childNodes.length) {
    const empty = document.createElement('div');
    empty.className = 'set-empty';
    empty.textContent = 'No sets match your search.';
    frag.append(empty);
  }
  el.setSelect.replaceChildren(frag);
  setActiveItem(el.setSelect.querySelector('[aria-selected=true]'));
}

// Keyboard highlight within the set list (Enter or Space picks it).
function setActiveItem(item) {
  el.setSelect.querySelectorAll('.set-item.active').forEach(n => n.classList.remove('active'));
  if (!item) { el.setSelect.removeAttribute('aria-activedescendant'); return; }
  item.classList.add('active');
  el.setSelect.setAttribute('aria-activedescendant', item.id);
  item.scrollIntoView({ block: 'nearest' });
}

function onSetListKey(e) {
  const items = [...el.setSelect.querySelectorAll('.set-item')];
  if (!items.length) return;
  const current = el.setSelect.querySelector('.set-item.active');
  let i = items.indexOf(current);
  if (e.key === 'ArrowDown') i = Math.min(items.length - 1, i + 1);
  else if (e.key === 'ArrowUp') i = Math.max(0, i - 1);
  else if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = items.length - 1;
  else if ((e.key === 'Enter' || (e.key === ' ' && e.target !== el.setSearch)) && current) {
    e.preventDefault();
    selectSet(current.dataset.id);
    return;
  } else return;
  e.preventDefault();
  setActiveItem(items[Math.max(0, i)]);
}

function selectSeries(id) {
  state.seriesId = id;
  el.setSearch.value = '';
  saveSettings();
  renderSetOptions();
}

function findSet(id) {
  for (const g of setGroups) {
    const s = g.sets.find(x => x.id === id);
    if (s) return s;
  }
  return null;
}

function updateSetTrigger() {
  const s = findSet(state.setId);
  el.setTriggerName.textContent = s ? s.name : 'Choose a set…';
  el.setTriggerCode.textContent = s?.code ? `[${s.code}]` : '';
}

function openSetMenu() {
  el.setMenu.hidden = false;
  el.setTrigger.setAttribute('aria-expanded', 'true');
  renderSetOptions();
  el.setSearch.focus();
}

function closeSetMenu(focusTrigger = false) {
  if (el.setMenu.hidden) return;
  el.setMenu.hidden = true;
  el.setTrigger.setAttribute('aria-expanded', 'false');
  el.setSearch.value = '';
  if (focusTrigger) el.setTrigger.focus();
}

function selectSet(id) {
  closeSetMenu(true);
  if (!id || id === state.setId && state.set) return;
  state.setId = id;
  updateSetTrigger();
  el.setSelect.querySelectorAll('.set-item').forEach(n =>
    n.setAttribute('aria-selected', String(n.dataset.id === id)));
  setActiveItem(el.setSelect.querySelector(`[data-id="${CSS.escape(id)}"]`));
  state.page = 0;
  saveSettings();
  loadSet(id);
}

/* ---------------------------- Controls ---------------------------- */

function setMode(mode, type) {
  state.mode = mode;
  if (type) state.type = type;
  state.page = 0;
  document.querySelectorAll('input[name=mode]').forEach(r => { r.checked = r.value === mode; });
  saveSettings();
  render();
}

function syncGridControls() {
  const key = `${state.rows}x${state.cols}`;
  const preset = [...el.gridPreset.options].some(o => o.value === key) ? key : 'custom';
  el.gridPreset.value = preset;
  el.gridRows.value = state.rows;
  el.gridCols.value = state.cols;
}

function setGrid(rows, cols) {
  const clamp = v => Math.min(12, Math.max(1, parseInt(v, 10) || 1));
  // Keep the first visible item in view when the sorter size changes.
  const firstIndex = state.page * state.rows * state.cols;
  state.rows = clamp(rows);
  state.cols = clamp(cols);
  state.page = Math.floor(firstIndex / (state.rows * state.cols));
  syncGridControls();
  saveSettings();
  render();
}

function bindControls() {
  el.seriesSelect.addEventListener('change', () => selectSeries(el.seriesSelect.value));
  el.setSearch.addEventListener('input', renderSetOptions);
  el.setSelect.addEventListener('click', e => {
    const item = e.target.closest('.set-item');
    if (item) selectSet(item.dataset.id);
  });
  el.setSelect.addEventListener('keydown', onSetListKey);
  el.setSearch.addEventListener('keydown', onSetListKey); // arrows/Enter work from the search box
  el.setTrigger.addEventListener('click', () =>
    el.setMenu.hidden ? openSetMenu() : closeSetMenu(true));
  el.setMenu.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeSetMenu(true); }
  });
  // pointerdown, not click: on iPad, taps on plain (non-button) areas don't
  // produce click events on the page, so "tap outside to close" never fired.
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.set-dropdown')) closeSetMenu();
  });

  document.querySelectorAll('input[name=mode]').forEach(r =>
    r.addEventListener('change', () => r.checked && setMode(r.value)));

  el.gridPreset.addEventListener('change', () => {
    if (el.gridPreset.value === 'custom') {
      el.gridRows.focus();
      return;
    }
    const [r, c] = el.gridPreset.value.split('x');
    setGrid(r, c);
  });
  el.showPositions.addEventListener('change', () => {
    state.showPositions = el.showPositions.checked;
    saveSettings();
    render();
  });
  el.startCorner.addEventListener('change', () => {
    state.corner = el.startCorner.value;
    saveSettings();
    render();
  });
  el.gridRows.addEventListener('change', () => setGrid(el.gridRows.value, el.gridCols.value));
  el.gridCols.addEventListener('change', () => setGrid(el.gridRows.value, el.gridCols.value));

  el.includeSecret.addEventListener('change', () => {
    state.includeSecret = el.includeSecret.checked;
    state.page = 0;
    saveSettings();
    render();
  });

  el.backToTypes.addEventListener('click', () => setMode('breakdown'));
  el.prev.addEventListener('click', () => { state.page--; render(); });
  el.next.addEventListener('click', () => { state.page++; render(); });

  document.addEventListener('keydown', e => {
    if (el.modal.open) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' && !el.prev.disabled) { state.page--; render(); }
    if (e.key === 'ArrowRight' && !el.next.disabled) { state.page++; render(); }
  });

  el.modalClose.addEventListener('click', () => el.modal.close());
  el.modal.addEventListener('click', e => { if (e.target === el.modal) el.modal.close(); });
}

/* ---------------------------- View (menu / full screen) ---------------------------- */

// Size the sorter so the whole page of slots fits in the visible window,
// using all the width and height that's free. Re-run on resize, menu toggle and full screen.
function fitBoard() {
  const board = el.board;
  const cs = getComputedStyle(board);
  const pad = parseFloat(cs.paddingLeft) || 0;
  const gap = parseFloat(cs.columnGap) || 0;
  const rows = state.rows, cols = state.cols;

  // Height from the board's top edge to the bottom of the window, minus room for the pager.
  const top = board.getBoundingClientRect().top + window.scrollY;
  const pagerSpace = (document.querySelector('.pager')?.offsetHeight || 40) + 28;
  const availH = Math.max(260, window.innerHeight - top - pagerSpace);

  // Width that makes the board exactly availH tall (slots keep the 63:88 card shape).
  const slotH = (availH - 2 * pad - (rows - 1) * gap) / rows;
  const slotW = slotH * 63 / 88;
  const fitW = cols * slotW + (cols - 1) * gap + 2 * pad;

  const maxW = board.parentElement.clientWidth -
    (parseFloat(getComputedStyle(board.parentElement).paddingLeft) || 0) -
    (parseFloat(getComputedStyle(board.parentElement).paddingRight) || 0);
  board.style.width = `${Math.max(Math.min(fitW, maxW), Math.min(maxW, cols * 90))}px`;
}

function applyMenuState() {
  document.body.classList.toggle('menu-collapsed', state.menuCollapsed);
  fitBoard();
  const label = state.menuCollapsed ? 'Show menu' : 'Hide menu';
  el.menuBtn.setAttribute('aria-expanded', String(!state.menuCollapsed));
  el.menuBtn.setAttribute('aria-label', label);
  el.menuBtn.title = label;
}

function toggleMenu() {
  state.menuCollapsed = !state.menuCollapsed;
  applyMenuState();
  saveSettings();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

function openSettings() {
  el.settingsPanel.hidden = false;
  el.settingsBtn.setAttribute('aria-expanded', 'true');
}

function closeSettings(focusButton = false) {
  if (el.settingsPanel.hidden) return;
  el.settingsPanel.hidden = true;
  el.settingsBtn.setAttribute('aria-expanded', 'false');
  if (focusButton) el.settingsBtn.focus();
}

function resetToDefaults() {
  if (!confirm('Reset to defaults?\n\nThis clears your saved settings and downloaded card data, then reloads the page.')) return;
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX))
    .forEach(k => localStorage.removeItem(k));
  location.reload();
}

function bindSettingsPanel() {
  el.settingsBtn.addEventListener('click', () =>
    el.settingsPanel.hidden ? openSettings() : closeSettings());
  el.settingsClose.addEventListener('click', () => closeSettings(true));
  el.resetDefaults.addEventListener('click', resetToDefaults);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el.settingsPanel.hidden && !el.modal.open) closeSettings(true);
  });
  // Tap or click anywhere outside the panel (and its gear button) closes it.
  document.addEventListener('pointerdown', e => {
    if (!el.settingsPanel.hidden &&
        !el.settingsPanel.contains(e.target) &&
        !el.settingsBtn.contains(e.target)) closeSettings();
  });
}

function applyTheme() {
  if (!['auto', 'light', 'dark'].includes(state.theme)) state.theme = 'auto';
  document.documentElement.dataset.theme = state.theme;
  document.querySelectorAll('input[name=theme]').forEach(r => { r.checked = r.value === state.theme; });
}

function bindViewControls() {
  document.querySelectorAll('input[name=theme]').forEach(r =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.theme = r.value;
      applyTheme();
      saveSettings();
    }));
  el.menuBtn.addEventListener('click', toggleMenu);
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fitBoard);
  });
  // Some browsers (e.g. iPhone Safari) have no full-screen support for pages.
  if (!document.fullscreenEnabled) {
    el.fullscreenBtn.hidden = true;
    return;
  }
  el.fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    fitBoard();
    const label = document.fullscreenElement ? 'Exit full screen' : 'Enter full screen';
    el.fullscreenBtn.setAttribute('aria-label', label);
    el.fullscreenBtn.title = label;
  });
}

/* ---------------------------- Utils ---------------------------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/* ---------------------------- Boot ---------------------------- */

async function init() {
  bindControls();
  bindViewControls();
  bindSettingsPanel();
  applyTheme();
  applyMenuState();
  syncGridControls();
  if (!['tl', 'tr', 'bl', 'br'].includes(state.corner)) state.corner = 'tl';
  el.startCorner.value = state.corner;
  el.showPositions.checked = state.showPositions;
  el.includeSecret.checked = state.includeSecret;
  document.querySelectorAll('input[name=mode]').forEach(r => { r.checked = r.value === state.mode; });
  render();

  try {
    showStatus('Loading set list…');
    setGroups = await loadSetList();
    hideStatus();
    renderSeriesOptions();
    renderSetOptions();
    updateSetTrigger();
  } catch (err) {
    showStatus(`Could not reach the card database (${err.message}).`, null, true, () => location.reload());
    return;
  }

  if (state.setId) {
    loadSet(state.setId);
  }
}

init();
