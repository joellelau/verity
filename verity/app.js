import * as store from './store.js';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let data = { articles: [], feed: [] };
let session = null;
let loaded = false;
let lastLoad = 0;

const ui = {
  replyTo: null,        // article id the chat box is replying to
  reflectIds: [],       // article ids a chat reflection is about
  quoteText: null,      // part of the draft marked as a quote
  connecting: [],       // article ids ticked in "Connect Articles"
  connectQuery: '',     // search text in "Connect Articles"
  drawerOpen: false,
  filterOpen: false,
  navCollapsed: pref('navCollapsed') === '1',
  writeText: pref('writeText') || '',
  writeLinks: safeJSON(pref('writeLinks'), []),
  sel: null,            // last textarea selection {s, e}
  pendingPaste: null
};

function safeJSON(s, fallback) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : fallback; } catch (e) { return fallback; }
}

function pref(key, value) {
  try {
    if (value === undefined) return localStorage.getItem('verity:' + key);
    if (value === null) localStorage.removeItem('verity:' + key);
    else localStorage.setItem('verity:' + key, value);
  } catch (e) { return null; }
  return null;
}

function commit() { render(); }

// Save in the background; if it fails, say so and reload what's really stored.
function persist(promise) {
  promise.catch((err) => {
    console.error(err);
    toast('Couldn’t save that. Check your connection and try again.');
    reload();
  });
}

async function reload() {
  try {
    data = await store.loadAll();
    loaded = true;
    lastLoad = Date.now();
    preserveScroll(render);
  } catch (err) {
    console.error(err);
    toast('Couldn’t load your log. Check your connection.');
  }
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function themeSetting() {
  const t = pref('theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

function applyTheme() {
  const t = themeSetting();
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && darkQuery && darkQuery.matches);
  const meta = document.getElementById('themeColor');
  if (meta) meta.setAttribute('content', dark ? '#0c0c0e' : '#fafafa');
}

if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applyTheme);
applyTheme();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const DAY = 24 * 3600e3;
const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

const icon = {
  book: '<path d="M4 19V5a1 1 0 011-1h3v16H5a1 1 0 01-1-1z"/><path d="M8 4h4v16H8"/><path d="M14.5 5.2l3.9-1 3.4 14.6-3.9 1z"/>',
  bookmark: '<path d="M18 7v14l-6-4-6 4V7a4 4 0 014-4h4a4 4 0 014 4z"/>',
  chat: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1.1-4.6A8 8 0 1121 12z"/>',
  bars: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  filter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>'
};
const svg = (name, size = 16, sw = 2, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via', 'with']);
function titleCase(t) {
  const words = String(t || '').split(' ');
  return words.map((w, i) => {
    const lower = w.toLowerCase();
    if (i > 0 && i < words.length - 1 && MINOR.has(lower)) return lower;
    if (/[A-Z].*[A-Z]/.test(w.slice(1)) || /\d/.test(w)) return w; // leave acronyms and mixed words alone
    return w.split('-').map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join('-');
  }).join(' ');
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hm = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return 'Today ' + hm;
  if (ts >= startToday - 6 * DAY) return d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + hm;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + hm;
}

function fmtDay(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return 'today';
  if (ts >= startToday - DAY) return 'yesterday';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

function titleFromUrl(u) {
  try {
    const url = new URL(u);
    const segs = url.pathname.split('/').filter(Boolean);
    let s = '';
    while (segs.length && !s) {
      s = decodeURIComponent(segs.pop())
        .replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/[-_+]+/g, ' ')
        .replace(/\b[0-9a-f]{8,}\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (/^\d+$/.test(s)) s = '';
    }
    if (!s) return hostOf(u);
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch (e) {
    return u;
  }
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ------------------------------------------------------------------ */
/* In-page dialog (browser confirm/prompt are blocked in some hosts)   */
/* ------------------------------------------------------------------ */

function ask({ title, message = '', confirmLabel = 'OK', danger = false, input = null }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
      <h2 id="dlgTitle" class="dialog-title serif">${esc(title)}</h2>
      ${message ? `<p class="dialog-msg">${esc(message)}</p>` : ''}
      ${input !== null ? `<label for="dlgInput" class="sr-only">${esc(title)}</label><input id="dlgInput" class="dialog-input" type="text" value="${esc(input)}">` : ''}
      <div class="dialog-actions">
        <button type="button" class="btn btn-outline" data-dlg="cancel">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-dark'}" data-dlg="ok">${esc(confirmLabel)}</button>
      </div></div>`;
    const prev = document.activeElement;
    document.body.appendChild(wrap);
    const field = wrap.querySelector('#dlgInput');
    (field || wrap.querySelector('[data-dlg=ok]')).focus();
    if (field) field.select();
    const done = (ok) => {
      const val = field ? field.value : true;
      wrap.remove();
      document.removeEventListener('keydown', onKey, true);
      if (prev && prev.focus) prev.focus();
      resolve(ok ? val : null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Enter' && field && document.activeElement === field) { e.preventDefault(); done(true); }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return done(false);
      const b = e.target.closest('[data-dlg]');
      if (b) done(b.dataset.dlg === 'ok');
    });
  });
}

/* ------------------------------------------------------------------ */
/* Derived data                                                        */
/* ------------------------------------------------------------------ */

const byId = (id) => data.articles.find((a) => a.id === id);
const repliesOf = (id) => data.feed.filter((m) => m.type === 'reply' && m.aid === id);
const entriesOf = (id) => repliesOf(id).filter((m) => m.quote || m.note);

function tagsOf(id) {
  const out = [];
  repliesOf(id).forEach((m) => (m.tags || []).forEach((t) => { if (!out.includes(t)) out.push(t); }));
  return out;
}

function tagCounts(list = data.articles) {
  const counts = {};
  list.forEach((a) => tagsOf(a.id).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  return Object.keys(counts).sort((x, y) => counts[y] - counts[x] || x.localeCompare(y)).map((t) => ({ tag: t, count: counts[t] }));
}

function countLabel(id) {
  const es = entriesOf(id);
  const q = es.filter((e) => e.quote).length;
  const n = es.filter((e) => e.note).length;
  if (!q && !n) return 'No notes yet';
  const parts = [];
  if (q) parts.push(q + (q === 1 ? ' quote' : ' quotes'));
  if (n) parts.push(n + (n === 1 ? ' note' : ' notes'));
  return parts.join(', ');
}

function weekStats() {
  const since = Date.now() - 7 * DAY;
  return {
    saved: data.articles.filter((a) => a.createdAt >= since).length,
    read: data.articles.filter((a) => a.read && (a.readAt || 0) >= since).length,
    quotes: data.feed.filter((m) => m.type === 'reply' && m.quote && m.createdAt >= since).length
  };
}

const readList = () => data.articles.filter((a) => a.read).sort((x, y) => (y.readAt || 0) - (x.readAt || 0));
const unreadList = () => data.articles.filter((a) => !a.read).sort((x, y) => y.createdAt - x.createdAt);

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/');
  const params = new URLSearchParams(query || '');
  if (parts[0] === 'articles') return { name: 'articles', tab: params.get('tab') === 'unread' ? 'unread' : 'read', tag: params.get('tag') };
  if (parts[0] === 'insights') return { name: 'insights', tab: ['connect', 'reflect'].includes(params.get('tab')) ? params.get('tab') : 'notes' };
  if (parts[0] === 'write') return { name: 'write' };
  if (parts[0] === 'article' && parts[1]) return { name: 'article', id: decodeURIComponent(parts[1]) };
  return { name: 'chat' };
}

function articlesHash(tab, tag) {
  const p = new URLSearchParams();
  if (tab === 'unread') p.set('tab', 'unread');
  if (tag) p.set('tag', tag);
  const q = p.toString();
  return '#/articles' + (q ? '?' + q : '');
}

function go(hash) {
  if (location.hash === hash || (hash === '#/' && !location.hash)) render();
  else location.hash = hash;
}

window.addEventListener('hashchange', () => {
  closeDrawer(false);
  ui.filterOpen = false;
  render();
  const scroller = document.querySelector('#view .scroll');
  if (scroller) scroller.scrollTop = 0;
});

/* ------------------------------------------------------------------ */
/* Navigation (desktop side nav + phone drawer)                        */
/* ------------------------------------------------------------------ */

function navLinks(r, big, collapsed) {
  const cur = (on) => (on ? ' aria-current="page"' : '');
  const onArticles = r.name === 'articles' || r.name === 'article';
  const size = big ? 20 : 16;
  const item = (href, on, ic, label, extra = '') =>
    `<a class="nav-item" href="${href}"${cur(on)}${collapsed ? ` title="${label}" aria-label="${label}"` : ''}>${svg(ic, size)}${collapsed ? '' : `<span class="label">${label}</span>${extra}`}</a>`;
  return `<div class="nav-list">
    ${item('#/', r.name === 'chat', 'chat', 'Chat')}
    ${item('#/articles', onArticles && !(r.name === 'articles' && r.tag), 'book', 'Articles', `<span class="count">${data.articles.length}</span>`)}
    ${item('#/insights', r.name === 'insights', 'bars', 'Insights')}
  </div>
  <a class="btn btn-${big ? 'dark' : 'outline'} write-btn" href="#/write"${collapsed ? ' title="Write a reflection" aria-label="Write a reflection"' : ''}>${svg('pen')}${collapsed ? '' : 'Write a reflection'}</a>`;
}

function tagLinks(r) {
  const tags = tagCounts();
  if (!tags.length) return '';
  const readIds = new Set(readList().map((a) => a.id));
  return `<div class="nav-heading">Tags</div><div class="nav-list">${tags.map((t) => {
    const hasRead = data.articles.some((a) => readIds.has(a.id) && tagsOf(a.id).includes(t.tag));
    return `<a class="nav-item tag" href="${articlesHash(hasRead ? 'read' : 'unread', t.tag)}"${r.name === 'articles' && r.tag === t.tag ? ' aria-current="page"' : ''}><span class="label">#${esc(t.tag)}</span><span class="count">${t.count}</span></a>`;
  }).join('')}</div>`;
}

function weekCard() {
  const ws = weekStats();
  return `<div class="card week-card"><div class="week-title serif">This Week</div><div class="week-grid">
    <div><b>${ws.saved}</b><span>saved</span></div><div><b>${ws.read}</b><span>read</span></div><div><b>${ws.quotes}</b><span>quotes</span></div></div></div>`;
}

function settings() {
  const t = themeSetting();
  const opt = (val, ic, label) => `<button type="button" data-action="set-theme" data-id="${val}" aria-pressed="${t === val}">${svg(ic, 13)}${label}</button>`;
  return `<div class="settings">
    <div class="settings-label" id="themeLabel">Appearance</div>
    <div class="theme-switch" role="group" aria-labelledby="themeLabel">${opt('system', 'monitor', 'Auto')}${opt('light', 'sun', 'Light')}${opt('dark', 'moon', 'Dark')}</div>
    <div class="account">
      <div class="account-email" title="${esc(session && session.user ? session.user.email : '')}">${esc(session && session.user ? session.user.email : '')}</div>
      <button type="button" class="link-btn" data-action="sign-out">Sign out</button>
    </div>
  </div>`;
}

function renderSidenav(r) {
  const nav = $('sidenav');
  const c = ui.navCollapsed;
  nav.classList.toggle('collapsed', c);
  const brand = c
    ? `<div class="brand"><button type="button" class="logo logo-btn" data-action="toggle-nav" aria-expanded="false" aria-label="Expand sidebar" title="Expand sidebar">${svg('book', 16, 2, 'i-logo')}${svg('panel', 16, 2, 'i-expand')}</button></div>`
    : `<div class="brand"><div class="logo">${svg('book')}</div>
        <div class="brand-text"><div class="brand-name serif">Verity</div><div class="brand-sub">Your reading, in one place</div></div>
        <button type="button" class="icon-btn" data-action="toggle-nav" aria-expanded="true" aria-label="Collapse sidebar" title="Collapse sidebar">${svg('panel')}</button></div>`;
  nav.innerHTML = `${brand}
    ${navLinks(r, false, c)}
    ${c ? '' : tagLinks(r)}
    <div class="nav-spacer"></div>
    ${c ? '' : weekCard() + settings()}`;
}

function renderDrawer(r) {
  const d = $('drawer');
  d.innerHTML = `
    <div class="drawer-head">
      <div class="drawer-brand"><div class="logo">${svg('book', 18)}</div><div><div class="brand-name serif">Verity</div><div class="brand-sub">Your reading, in one place</div></div></div>
      <button type="button" class="round-btn" data-action="close-drawer" aria-label="Close menu">${svg('x', 18)}</button>
    </div>
    ${navLinks(r, true, false)}
    ${tagLinks(r)}
    <div class="nav-spacer"></div>
    ${weekCard()}
    ${settings()}`;
}

function openDrawer() {
  ui.drawerOpen = true;
  const d = $('drawer');
  d.classList.add('open');
  d.inert = false;
  $('scrim').classList.add('open');
  $('menuBtn').setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => { const b = d.querySelector('[data-action=close-drawer]'); if (b) b.focus(); });
}

function closeDrawer(focusButton = true) {
  if (!ui.drawerOpen) return;
  ui.drawerOpen = false;
  const d = $('drawer');
  d.classList.remove('open');
  d.inert = true;
  $('scrim').classList.remove('open');
  $('menuBtn').setAttribute('aria-expanded', 'false');
  if (focusButton) $('menuBtn').focus();
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

function refLine(a) {
  if (!a) return '';
  return `<a class="ref" href="#/article/${encodeURIComponent(a.id)}">${svg('reply', 13)}<span>${esc(titleCase(a.title))}</span></a>`;
}

function tagChips(tags, dark) {
  if (!tags || !tags.length) return '';
  return `<div class="chips">${tags.map((t) => `<span class="chip${dark ? ' chip-dark' : ''}">#${esc(t)}</span>`).join('')}</div>`;
}

function articleCard(m) {
  const a = byId(m.aid);
  if (!a) return '';
  return `<div class="card article-card">
    <div class="source"><div class="tile">${svg('bookmark')}</div>
      <div class="source-text"><a class="article-title" href="#/article/${encodeURIComponent(a.id)}">${esc(titleCase(a.title))}</a><div class="domain">${esc(hostOf(a.url))}</div></div></div>
    <div class="split">
      <button type="button" class="btn ${a.read ? 'btn-soft' : 'btn-outline'}" data-action="toggle-read" data-id="${a.id}" aria-pressed="${a.read}">${a.read ? svg('check') + 'Read' : 'Mark as read'}</button>
      <button type="button" class="btn btn-dark" data-action="reply" data-id="${a.id}">${svg('reply')}Reply</button>
    </div>
  </div>`;
}

function replyBubble(m) {
  const tagsFirst = !m.quote && !m.note;
  return `<div class="bubble">
    ${tagsFirst ? tagChips(m.tags, true) : ''}
    ${refLine(byId(m.aid))}
    ${m.quote ? `<div class="quote">“${esc(m.quote)}”</div>` : ''}
    ${m.note ? `<div class="note">${esc(m.note)}</div>` : ''}
    ${!tagsFirst ? tagChips(m.tags, true) : ''}
  </div>`;
}

function reflectionCard(m) {
  const links = (m.links || []).map(byId).filter(Boolean);
  return `<div class="card reflection">
    <div class="note">${esc(m.text)}</div>
    ${links.length ? `<div class="ref-list">${links.map(refLine).join('')}</div>` : ''}
  </div>`;
}

function renderChat() {
  const items = data.feed.map((m) => {
    let body = '';
    if (m.type === 'article') body = articleCard(m);
    else if (m.type === 'reply') body = replyBubble(m);
    else if (m.type === 'reflection') body = reflectionCard(m);
    if (!body) return '';
    return `<div class="msg">${body}<div class="time">${fmtTime(m.createdAt)}</div></div>`;
  }).join('');
  const empty = `<div class="empty-chat"><b class="serif">Nothing Saved Yet</b>Paste a link below to save your first article, or write a thought to save it as a reflection.</div>`;
  return `<div class="chat-scroll"><div class="feed">${items || empty}</div></div>`;
}

/* ------------------------------------------------------------------ */
/* Chat box                                                            */
/* ------------------------------------------------------------------ */

function renderComposer() {
  const replying = !!ui.replyTo && !!byId(ui.replyTo);
  const reflecting = !replying && ui.reflectIds.length > 0;
  const parts = [];
  if (replying) {
    parts.push(`<div class="context"><div class="context-text">Replying to <b>${esc(titleCase(byId(ui.replyTo).title))}</b></div>
      <button type="button" class="icon-btn" data-action="cancel-context" aria-label="Cancel reply">${svg('x')}</button></div>`);
  }
  if (reflecting) {
    const titles = ui.reflectIds.map(byId).filter(Boolean).map((a) => titleCase(a.title)).join(' · ');
    parts.push(`<div class="context"><div class="context-text">Reflection on <b>${esc(titles)}</b></div>
      <button type="button" class="icon-btn" data-action="cancel-context" aria-label="Cancel reflection">${svg('x')}</button></div>`);
  }
  if (replying && ui.quoteText) {
    const q = ui.quoteText.length > 90 ? ui.quoteText.slice(0, 88) + '…' : ui.quoteText;
    parts.push(`<div class="quote-mark"><div class="quote-mark-text"><b>Quote:</b> “${esc(q)}” <span>Everything else is your note.</span></div>
      <button type="button" class="link-btn" data-action="unmark-quote">Unmark</button></div>`);
  } else if (replying) {
    parts.push('<div class="hint">Paste a quote and it’s marked automatically, or select text and press Quote. Add #tags anywhere.</div>');
  }
  $('composerContext').innerHTML = parts.join('');
  $('quoteBtn').hidden = !replying;
  $('fullBtn').hidden = replying;
  $('draft').placeholder = replying ? 'Paste a quote, add a note, #tag it' : reflecting ? 'Write your reflection' : 'Paste a link, or write a reflection';
  $('sendBtn').classList.toggle('is-empty', !$('draft').value.trim());
  measureComposer();
}

function measureComposer() {
  const c = $('composer');
  if (!c.hidden) document.documentElement.style.setProperty('--composer-h', c.offsetHeight + 'px');
}

function resizeDraft() {
  const t = $('draft');
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 160) + 'px';
  measureComposer();
}

function resetComposer() {
  ui.replyTo = null;
  ui.reflectIds = [];
  ui.quoteText = null;
  ui.pendingPaste = null;
  ui.sel = null;
  $('draft').value = '';
  resizeDraft();
}

function focusDraft() { requestAnimationFrame(() => $('draft').focus()); }

function send() {
  const text = $('draft').value.trim();
  if (!text) return;
  const now = Date.now();
  const tagRe = /(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]*)/g;

  if (ui.replyTo && byId(ui.replyTo)) {
    const quote = ui.quoteText && text.includes(ui.quoteText) ? ui.quoteText : '';
    const rest = quote ? text.replace(quote, ' ') : text;
    const tags = [];
    let m;
    while ((m = tagRe.exec(rest)) !== null) {
      const t = m[2].toLowerCase();
      if (!tags.includes(t)) tags.push(t);
    }
    const note = rest.replace(tagRe, '$1').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
    const item = { id: uid(), type: 'reply', aid: ui.replyTo, quote, note, tags, text: '', links: [], createdAt: now };
    data.feed.push(item);
    persist(store.addItem(item));
    resetComposer();
    commit();
    return;
  }

  if (!ui.reflectIds.length) {
    let url = null;
    if (/^https?:\/\/\S+$/i.test(text)) url = text;
    else if (/^www\.\S+\.\S+$/i.test(text)) url = 'https://' + text;
    if (url) {
      const existing = data.articles.find((a) => a.url === url);
      if (existing) {
        toast('Already saved. Opening it.');
        resetComposer();
        go('#/article/' + encodeURIComponent(existing.id));
        return;
      }
      const id = uid();
      const article = { id, url, title: titleFromUrl(url), site: hostOf(url), read: false, readAt: null, createdAt: now };
      const item = { id: uid(), type: 'article', aid: id, quote: '', note: '', tags: [], text: '', links: [], createdAt: now };
      data.articles.push(article);
      data.feed.push(item);
      const saved = store.addArticle(article, item);
      persist(saved);
      saved.then(() => lookUpTitle(article)).catch(() => {});
      resetComposer();
      commit();
      return;
    }
  }

  const item = { id: uid(), type: 'reflection', aid: null, quote: '', note: '', tags: [], text, links: ui.reflectIds.filter(byId), createdAt: now };
  data.feed.push(item);
  persist(store.addItem(item));
  resetComposer();
  commit();
}

// Replace the guessed title with the page's real one.
async function lookUpTitle(article) {
  const guessed = article.title;
  try {
    const token = await store.accessToken();
    const res = await fetch('/api/title?url=' + encodeURIComponent(article.url), { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    if (!res.ok) return;
    const info = await res.json();
    const a = byId(article.id);
    if (!a || a.title !== guessed) return; // removed, or renamed by you meanwhile
    const patch = {};
    if (info.title) patch.title = info.title;
    if (info.site) patch.site = info.site;
    if (!Object.keys(patch).length) return;
    Object.assign(a, patch);
    persist(store.updateArticle(a.id, patch));
    preserveScroll(render);
  } catch (e) { /* keep the guessed title */ }
}

function startReply(id) {
  ui.replyTo = id;
  ui.reflectIds = [];
  ui.quoteText = null;
  if (route().name !== 'chat') go('#/');
  else renderComposer();
  focusDraft();
}

function openWrite(links, text) {
  ui.writeLinks = (links || []).filter(byId);
  ui.writeText = text || '';
  persistWrite();
  go('#/write');
}

function persistWrite() {
  pref('writeText', ui.writeText || null);
  pref('writeLinks', ui.writeLinks.length ? JSON.stringify(ui.writeLinks) : null);
}

const draft = $('draft');
draft.addEventListener('input', () => {
  const v = draft.value;
  let q = ui.quoteText;
  if (ui.pendingPaste && v.includes(ui.pendingPaste)) q = ui.pendingPaste;
  ui.pendingPaste = null;
  if (q && !v.includes(q)) q = null;
  const changed = q !== ui.quoteText;
  ui.quoteText = q;
  if (changed) renderComposer();
  $('sendBtn').classList.toggle('is-empty', !v.trim());
  resizeDraft();
});
const trackSel = () => { ui.sel = { s: draft.selectionStart, e: draft.selectionEnd }; };
['select', 'keyup', 'mouseup', 'touchend'].forEach((ev) => draft.addEventListener(ev, trackSel));
draft.addEventListener('paste', (e) => {
  if (!ui.replyTo) return;
  const t = e.clipboardData ? e.clipboardData.getData('text') : '';
  if (t && t.trim() && !/^https?:\/\/\S+$/i.test(t.trim())) ui.pendingPaste = t.trim();
});
draft.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(hover: hover)').matches) {
    e.preventDefault();
    send();
  }
});
$('sendBtn').addEventListener('click', () => { send(); focusDraft(); });
$('quoteBtn').addEventListener('pointerdown', (e) => e.preventDefault()); // keep the textarea selection
$('quoteBtn').addEventListener('click', () => {
  const d = draft.value;
  const sel = ui.sel;
  const q = sel && sel.e > sel.s ? d.slice(sel.s, sel.e).trim() : d.trim();
  if (!q) { toast('Type or paste the quote first.'); return; }
  ui.quoteText = q;
  renderComposer();
  focusDraft();
});
$('fullBtn').addEventListener('click', () => {
  const text = draft.value;
  const links = ui.reflectIds.slice();
  resetComposer();
  openWrite(links, text);
});
if (window.ResizeObserver) new ResizeObserver(measureComposer).observe($('composer'));

/* ------------------------------------------------------------------ */
/* Full-page reflection                                                */
/* ------------------------------------------------------------------ */

function wordCount(t) {
  const n = t.trim() ? t.trim().split(/\s+/).length : 0;
  return n + (n === 1 ? ' word' : ' words');
}

function renderWrite() {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const chips = data.articles.slice().reverse().map((a) => {
    const on = ui.writeLinks.includes(a.id);
    return `<button type="button" class="link-chip" data-action="toggle-write-link" data-id="${a.id}" aria-pressed="${on}">${on ? svg('check', 13) : ''}<span>${esc(titleCase(a.title))}</span></button>`;
  }).join('');
  return `<div class="write">
    <div class="write-bar">
      <button type="button" class="back" data-action="close-write">${svg('back')}Back to chat</button>
      <div class="right"><span class="words" id="wordCount">${wordCount(ui.writeText)}</span>
        <button type="button" class="btn btn-dark" data-action="save-write" id="saveWrite"${ui.writeText.trim() ? '' : ' disabled'}>Save reflection</button></div>
    </div>
    <div class="write-body"><div class="write-col">
      <div><div class="eyebrow">Reflection · ${esc(today)}</div><h1 class="write-title serif">What Stayed With You?</h1></div>
      ${data.articles.length ? `<div class="section" style="gap:8px"><div class="meta" style="font-weight:500">Linked articles</div><div class="link-chips">${chips}</div></div>` : ''}
      <label for="writeText" class="sr-only">Reflection</label>
      <textarea id="writeText" placeholder="Take your time. What connects these ideas, what surprised you, what would you do differently?">${esc(ui.writeText)}</textarea>
    </div></div>
  </div>`;
}

function bindWrite() {
  const t = $('writeText');
  if (!t) return;
  t.addEventListener('input', () => {
    ui.writeText = t.value;
    persistWrite();
    $('wordCount').textContent = wordCount(t.value);
    $('saveWrite').disabled = !t.value.trim();
  });
  requestAnimationFrame(() => { t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
}

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

function renderArticlesHeader(r) {
  const base = r.tab === 'unread' ? unreadList() : readList();
  const tags = tagCounts(base);
  const allTags = tagCounts();
  const tab = (val, label, n) => `<a role="tab" href="${articlesHash(val, r.tag)}" aria-selected="${r.tab === val}">${label} <span class="n">${n}</span></a>`;
  const opts = [`<a role="menuitemradio" href="${articlesHash(r.tab, null)}" aria-checked="${!r.tag}"><span class="check">${!r.tag ? svg('check', 14) : ''}</span><span class="grow">All tags</span><span class="n">${base.length}</span></a>`]
    .concat(allTags.map((t) => {
      const n = (tags.find((x) => x.tag === t.tag) || { count: 0 }).count;
      return `<a role="menuitemradio" href="${articlesHash(r.tab, t.tag)}" aria-checked="${r.tag === t.tag}"><span class="check">${r.tag === t.tag ? svg('check', 14) : ''}</span><span class="grow">#${esc(t.tag)}</span><span class="n">${n}</span></a>`;
    }));
  return `<div class="title-row"><h1 class="page-title serif">Articles</h1></div>
    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Articles">${tab('read', 'Recently read', readList().length)}${tab('unread', 'To be read', unreadList().length)}</div>
      <button type="button" class="btn btn-outline filter-btn${r.tag ? ' active' : ''}" data-action="toggle-filter" aria-haspopup="true" aria-expanded="${ui.filterOpen}">${svg('filter')}${r.tag ? '#' + esc(r.tag) : 'Filter'}</button>
      ${ui.filterOpen ? `<div class="popover" role="menu" id="filterMenu"><div class="popover-label">Filter by tag</div>${opts.join('')}</div>` : ''}
    </div>`;
}

function renderArticles(r) {
  const base = r.tab === 'unread' ? unreadList() : readList();
  const list = base.filter((a) => !r.tag || tagsOf(a.id).includes(r.tag));
  const cards = list.map((a) => `
    <a class="card list-card" href="#/article/${encodeURIComponent(a.id)}">
      <div class="tile">${svg('bookmark')}</div>
      <div class="list-body">
        <div class="article-title">${esc(titleCase(a.title))}</div>
        <div class="list-meta">${esc(a.site || hostOf(a.url))} · ${countLabel(a.id)}</div>
        ${tagsOf(a.id).length ? `<div class="chips">${tagsOf(a.id).map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <span class="chev">${svg('chevron')}</span>
    </a>`).join('');
  let empty;
  if (!data.articles.length) empty = 'No articles yet. Paste a link in Chat to save one.';
  else if (r.tag) empty = `No articles tagged #${esc(r.tag)} here.`;
  else empty = r.tab === 'unread' ? 'You’re all caught up.' : 'Nothing marked as read yet.';
  return `<div class="scroll"><div class="page" style="gap:10px">${cards || `<div class="empty">${empty}</div>`}</div></div>`;
}

/* ------------------------------------------------------------------ */
/* Article page                                                        */
/* ------------------------------------------------------------------ */

function renderArticle(r) {
  const a = byId(r.id);
  if (!a) return `<div class="scroll"><div class="page"><div class="empty">This article isn’t in your log anymore.</div></div></div>`;
  const entries = entriesOf(a.id).slice().reverse();
  const reflections = data.feed.filter((m) => m.type === 'reflection' && (m.links || []).includes(a.id)).slice().reverse();
  return `<div class="scroll"><div class="page">
    <div class="article-head">
      <div class="site-line">${esc(a.site || hostOf(a.url))} · ${esc(hostOf(a.url))}</div>
      <h2 class="serif">${esc(titleCase(a.title))}</h2>
      <div class="chips">
        <button type="button" class="chip chip-status${a.read ? ' read' : ''}" data-action="toggle-read" data-id="${a.id}" aria-pressed="${a.read}" title="Toggle read">${a.read ? 'Read' : 'To read'}</button>
        ${tagsOf(a.id).map((t) => `<a class="chip" href="${articlesHash(a.read ? 'read' : 'unread', t)}">#${esc(t)}</a>`).join('')}
        <span class="meta">${countLabel(a.id)} · saved ${fmtTime(a.createdAt)}</span>
      </div>
    </div>
    <div class="two-col">
      <a class="btn btn-outline" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Open original ${svg('external', 14)}</a>
      <button type="button" class="btn btn-dark" data-action="reply" data-id="${a.id}">Add quote or note</button>
    </div>
    <div class="divider"></div>
    ${entries.map((e) => `<div class="card entry">
      ${e.quote ? `<div class="quote">“${esc(e.quote)}”</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      <div class="meta-row"><span class="meta">${fmtTime(e.createdAt)}</span><button type="button" class="text-btn" data-action="delete-entry" data-id="${e.id}">Delete</button></div>
    </div>`).join('') || '<div class="empty">No quotes or notes yet.</div>'}
    ${reflections.length ? `<h3 class="section-title serif">Reflections</h3>${reflections.map((m) => `<div class="card reflection-item"><div class="note">${esc(m.text)}</div><div class="meta">${fmtTime(m.createdAt)}</div></div>`).join('')}` : ''}
    <div class="subtle-actions">
      <button type="button" class="text-btn" data-action="reflect" data-id="${a.id}">Write a reflection</button>
      <button type="button" class="text-btn" data-action="edit-title" data-id="${a.id}">Edit title</button>
      <button type="button" class="text-btn" data-action="delete-article" data-id="${a.id}">Remove from log</button>
    </div>
  </div></div>`;
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

function renderInsights(r) {
  const ws = weekStats();
  const top = tagCounts().slice(0, 4);
  const reflectedIds = new Set();
  data.feed.forEach((m) => { if (m.type === 'reflection') (m.links || []).forEach((id) => reflectedIds.add(id)); });
  const unreflected = data.articles.filter((a) => entriesOf(a.id).length === 0 && !reflectedIds.has(a.id));
  ui.connecting = ui.connecting.filter(byId);
  const canConnect = ui.connecting.length >= 2;
  const reflections = data.feed.filter((m) => m.type === 'reflection').slice().reverse();
  const tab = (val, label, n) => `<a role="tab" href="#/insights${val === 'notes' ? '' : '?tab=' + val}" aria-selected="${r.tab === val}">${label}${n === null ? '' : ` <span class="n">${n}</span>`}</a>`;

  let panel = '';
  if (r.tab === 'notes') {
    panel = `<div class="section-sub" style="margin-top:0">Articles you haven’t quoted, noted or reflected on yet.</div>
      ${unreflected.map((a) => `<div class="card row-card"><div class="grow article-title">${esc(titleCase(a.title))}</div><button type="button" class="btn btn-outline" data-action="reflect" data-id="${a.id}">${svg('pen', 14)}Reflect</button></div>`).join('')
        || '<div class="empty">Every article has a note or reflection.</div>'}`;
  } else if (r.tab === 'connect') {
    const q = ui.connectQuery.trim().toLowerCase();
    const list = data.articles.slice().sort((x, y) => y.createdAt - x.createdAt);
    const haystack = (a) => (a.title + ' ' + (a.site || '') + ' ' + hostOf(a.url) + ' ' + tagsOf(a.id).map((t) => '#' + t).join(' ')).toLowerCase();
    const rows = list.map((a) => {
      const on = ui.connecting.includes(a.id);
      const hide = q && !haystack(a).includes(q);
      return `<button type="button" class="check-row" data-action="toggle-connect" data-id="${a.id}" data-search="${esc(haystack(a))}" aria-pressed="${on}"${hide ? ' hidden' : ''}><span class="box">${on ? svg('check', 12, 3) : ''}</span><span class="check-text"><span class="check-title">${esc(titleCase(a.title))}</span><span class="check-meta">Added ${fmtDay(a.createdAt)} · ${esc(a.site || hostOf(a.url))}</span></span></button>`;
    });
    const anyVisible = list.some((a) => !q || haystack(a).includes(q));
    panel = `<div class="section-sub" style="margin-top:0">Pick two or more to write one reflection linking them.</div>
      ${data.articles.length ? `<div class="search">
        <label for="connectSearch" class="sr-only">Search articles</label>
        ${svg('search', 16)}
        <input id="connectSearch" type="search" placeholder="Search by title, site or #tag" value="${esc(ui.connectQuery)}" autocomplete="off">
      </div>
      <div class="checklist" id="connectList"${anyVisible ? '' : ' hidden'}>${rows.join('')}</div>
      <div class="empty" id="connectEmpty"${anyVisible ? ' hidden' : ''}>No articles match that search.</div>
      <button type="button" class="btn btn-dark btn-block" data-action="start-connect"${canConnect ? '' : ' disabled'}>${canConnect ? `Write a reflection on ${ui.connecting.length} articles` : 'Select at least 2 articles'}</button>` : '<div class="empty">Save a few articles first.</div>'}`;
  } else {
    panel = reflections.map((m) => {
      const links = (m.links || []).map(byId).filter(Boolean);
      return `<div class="card reflection-item"><div class="note">${esc(m.text)}</div>
        ${links.length ? `<div class="meta">On: ${links.map((a) => `<a href="#/article/${encodeURIComponent(a.id)}">${esc(titleCase(a.title))}</a>`).join(' · ')}</div>` : ''}
        <div class="meta-row"><span class="meta">${fmtTime(m.createdAt)}</span><button type="button" class="text-btn" data-action="delete-entry" data-id="${m.id}">Delete</button></div></div>`;
    }).join('') || '<div class="empty">No reflections yet. <a href="#/write">Write one</a>.</div>';
  }

  return `<div class="scroll"><div class="page" style="gap:24px">
    <section class="section">
      <h2 class="section-title serif">This Week</h2>
      <div class="stats">
        <div class="card stat"><div class="stat-label">Saved</div><div class="stat-value">${ws.saved}</div></div>
        <div class="card stat"><div class="stat-label">Read</div><div class="stat-value">${ws.read}</div></div>
        <div class="card stat"><div class="stat-label">Quotes</div><div class="stat-value">${ws.quotes}</div></div>
      </div>
      ${top.length ? `<div class="chips" style="align-items:center"><span class="meta" style="font-size:13px">Top tags</span>${top.map((t) => `<a class="chip" href="${articlesHash('read', t.tag)}">#${esc(t.tag)} <span style="color:var(--muted)">${t.count}</span></a>`).join('')}</div>` : ''}
    </section>
    <div class="divider"></div>
    <section class="section" style="gap:14px">
      <div class="tabs tabs-3" role="tablist" aria-label="Insights">${tab('notes', 'No Notes Yet', unreflected.length)}${tab('connect', 'Connect Articles', null)}${tab('reflect', 'Reflections', reflections.length)}</div>
      <div class="section" role="tabpanel">${panel}</div>
    </section>
  </div></div>`;
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function renderHeader(r) {
  const h = $('pageHeader');
  if (r.name === 'chat' || r.name === 'write') { h.hidden = true; h.innerHTML = ''; return; }
  h.hidden = false;
  let inner = '';
  if (r.name === 'articles') inner = renderArticlesHeader(r);
  else if (r.name === 'insights') inner = '<div class="title-row"><h1 class="page-title serif">Insights</h1><div class="page-sub">What you’ve read, quoted and reflected on</div></div>';
  else if (r.name === 'article') inner = `<div class="title-row" style="padding-left:${isDesktop() ? 0 : 60}px"><a class="back" href="#/articles">${svg('back')}Articles</a></div>`;
  h.innerHTML = `<div class="page-header-inner">${inner}</div>`;
}

function render() {
  const r = route();
  const a = r.name === 'article' ? byId(r.id) : null;
  document.title = { chat: 'Verity', articles: 'Articles · Verity', insights: 'Insights · Verity', write: 'New reflection · Verity', article: a ? titleCase(a.title) + ' · Verity' : 'Verity' }[r.name];
  renderSidenav(r);
  renderDrawer(r);
  renderHeader(r);
  const view = $('view');
  if (r.name === 'chat') view.innerHTML = renderChat();
  else if (r.name === 'articles') view.innerHTML = renderArticles(r);
  else if (r.name === 'insights') view.innerHTML = renderInsights(r);
  else if (r.name === 'write') view.innerHTML = renderWrite();
  else view.innerHTML = renderArticle(r);
  $('composer').hidden = r.name !== 'chat';
  $('menuBtn').hidden = r.name === 'write';
  if (r.name === 'write') bindWrite();
  if (r.name === 'insights') bindConnectSearch();
  renderComposer();
}

function bindConnectSearch() {
  const input = $('connectSearch');
  if (!input) return;
  input.addEventListener('input', () => {
    ui.connectQuery = input.value;
    const q = input.value.trim().toLowerCase();
    let any = false;
    document.querySelectorAll('#connectList .check-row').forEach((row) => {
      const show = !q || row.dataset.search.includes(q);
      row.hidden = !show;
      if (show) any = true;
    });
    $('connectList').hidden = !any;
    $('connectEmpty').hidden = any;
  });
}

function renderHeaderOnly() { renderHeader(route()); }

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function preserveScroll(fn) {
  const s = document.querySelector('#view .scroll, #view .chat-scroll');
  const top = s ? s.scrollTop : 0;
  fn();
  const s2 = document.querySelector('#view .scroll, #view .chat-scroll');
  if (s2) s2.scrollTop = top;
}

const actions = {
  'reply': (id) => startReply(id),
  'toggle-read': (id) => {
    const a = byId(id);
    if (!a) return;
    a.read = !a.read;
    a.readAt = a.read ? Date.now() : null;
    persist(store.updateArticle(a.id, { read: a.read, readAt: a.readAt }));
    preserveScroll(commit);
  },
  'cancel-context': () => { ui.replyTo = null; ui.reflectIds = []; ui.quoteText = null; renderComposer(); },
  'unmark-quote': () => { ui.quoteText = null; renderComposer(); },
  'reflect': (id) => openWrite([id], ''),
  'toggle-connect': (id) => {
    ui.connecting = ui.connecting.includes(id) ? ui.connecting.filter((x) => x !== id) : ui.connecting.concat([id]);
    preserveScroll(render);
  },
  'start-connect': () => {
    if (ui.connecting.length < 2) return;
    const ids = ui.connecting.slice();
    ui.connecting = [];
    openWrite(ids, '');
  },
  'toggle-write-link': (id, el) => {
    ui.writeLinks = ui.writeLinks.includes(id) ? ui.writeLinks.filter((x) => x !== id) : ui.writeLinks.concat([id]);
    persistWrite();
    const on = ui.writeLinks.includes(id);
    el.setAttribute('aria-pressed', String(on));
    el.innerHTML = (on ? svg('check', 13) : '') + `<span>${esc(titleCase(byId(id).title))}</span>`;
  },
  'close-write': () => {
    // Take the unsaved text back to the chat box.
    const text = ui.writeText;
    const links = ui.writeLinks.slice();
    ui.writeText = '';
    ui.writeLinks = [];
    persistWrite();
    ui.replyTo = null;
    ui.quoteText = null;
    ui.reflectIds = links;
    $('draft').value = text;
    go('#/');
    resizeDraft();
    focusDraft();
  },
  'save-write': () => {
    const text = ui.writeText.trim();
    if (!text) return;
    const item = { id: uid(), type: 'reflection', aid: null, quote: '', note: '', tags: [], text, links: ui.writeLinks.filter(byId), createdAt: Date.now() };
    data.feed.push(item);
    persist(store.addItem(item));
    ui.writeText = '';
    ui.writeLinks = [];
    persistWrite();
    toast('Reflection saved.');
    go('#/');
  },
  'toggle-nav': () => { ui.navCollapsed = !ui.navCollapsed; pref('navCollapsed', ui.navCollapsed ? '1' : '0'); render(); },
  'toggle-filter': () => {
    ui.filterOpen = !ui.filterOpen;
    renderHeaderOnly();
    if (ui.filterOpen) requestAnimationFrame(() => { const f = document.querySelector('#filterMenu a'); if (f) f.focus(); });
  },
  'close-drawer': () => closeDrawer(),
  'set-theme': (val) => {
    pref('theme', val === 'system' ? null : val);
    applyTheme();
    document.querySelectorAll('[data-action=set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === val)));
  },
  'edit-title': async (id) => {
    const a = byId(id);
    if (!a) return;
    const t = await ask({ title: 'Edit Title', input: a.title, confirmLabel: 'Save' });
    if (t && t.trim()) { a.title = t.trim(); persist(store.updateArticle(a.id, { title: a.title })); commit(); toast('Title saved.'); }
  },
  'delete-article': async (id) => {
    const a = byId(id);
    if (!a) return;
    if (!(await ask({ title: 'Remove This Article?', message: `“${titleCase(a.title)}” and its quotes and notes will be deleted.`, confirmLabel: 'Remove', danger: true }))) return;
    const touched = data.feed.filter((m) => m.type === 'reflection' && (m.links || []).includes(id));
    data.articles = data.articles.filter((x) => x.id !== id);
    data.feed = data.feed
      .filter((m) => m.aid !== id)
      .map((m) => (m.type === 'reflection' ? Object.assign({}, m, { links: (m.links || []).filter((x) => x !== id) }) : m));
    if (ui.replyTo === id) ui.replyTo = null;
    persist(Promise.all(touched.map((m) => store.updateItemLinks(m.id, m.links.filter((x) => x !== id)))).then(() => store.deleteArticle(id)));
    toast('Removed.');
    go('#/articles');
  },
  'delete-entry': async (id) => {
    if (!(await ask({ title: 'Delete This?', message: 'This can’t be undone.', confirmLabel: 'Delete', danger: true }))) return;
    data.feed = data.feed.filter((m) => m.id !== id);
    persist(store.deleteItem(id));
    preserveScroll(commit);
  },
  'sign-out': async () => {
    closeDrawer(false);
    if (!(await ask({ title: 'Sign Out?', message: 'You can sign back in any time with an email link.', confirmLabel: 'Sign out' }))) return;
    await store.signOut();
  }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (ui.filterOpen && !e.target.closest('#filterMenu') && !(el && el.dataset.action === 'toggle-filter')) {
    ui.filterOpen = false;
    renderHeaderOnly();
  }
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el.dataset.id, el); }
});

$('menuBtn').addEventListener('click', openDrawer);
$('scrim').addEventListener('click', () => closeDrawer());
$('drawer').addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (link && link.getAttribute('href') === location.hash) closeDrawer(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (ui.drawerOpen) closeDrawer();
  else if (ui.filterOpen) { ui.filterOpen = false; renderHeaderOnly(); const b = document.querySelector('[data-action=toggle-filter]'); if (b) b.focus(); }
});

// Pick up changes made on your other devices when you come back to the app.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && session && Date.now() - lastLoad > 30000) reload();
});

/* ------------------------------------------------------------------ */
/* Sign-in and start-up                                                */
/* ------------------------------------------------------------------ */

function showGate(html) {
  const gate = $('gate');
  gate.innerHTML = html;
  gate.hidden = false;
  document.querySelector('.app').hidden = true;
}

function hideGate() {
  $('gate').hidden = true;
  $('gate').innerHTML = '';
  document.querySelector('.app').hidden = false;
}

const brandBlock = `<div class="gate-brand"><div class="logo">${svg('book', 18)}</div><div class="brand-name serif">Verity</div></div>`;

function showSignIn(message) {
  showGate(`<div class="gate-card card">
    ${brandBlock}
    <h1 class="gate-title serif">Your Reading, in One Place</h1>
    <p class="gate-text">Save links, reply with quotes and notes, and reflect on what you read. Enter your email and we’ll send you a link to sign in. No password needed.</p>
    <form id="signInForm" class="gate-form" novalidate>
      <label for="email" class="gate-label">Email</label>
      <input id="email" class="dialog-input" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>
      <button type="submit" class="btn btn-dark btn-block" id="signInBtn">Email me a sign-in link</button>
      <p class="gate-note" id="signInNote" role="status">${message ? esc(message) : ''}</p>
    </form>
  </div>`);
  const form = $('signInForm');
  const email = $('email');
  email.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = email.value.trim();
    const note = $('signInNote');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { note.textContent = 'Enter a valid email address, like you@example.com.'; email.focus(); return; }
    const btn = $('signInBtn');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await store.sendSignInLink(value);
      showCheckEmail(value);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Email me a sign-in link';
      note.textContent = /rate|seconds/i.test(err.message || '') ? 'Too many tries. Wait a minute, then try again.' : 'Couldn’t send the link: ' + (err.message || 'unknown error') + '.';
    }
  });
}

function showCheckEmail(email) {
  showGate(`<div class="gate-card card">
    ${brandBlock}
    <h1 class="gate-title serif">Check Your Email</h1>
    <p class="gate-text">We sent a sign-in link to <b>${esc(email)}</b>. Open it in this same browser to continue. It can take a minute to arrive, so check your spam folder too.</p>
    <button type="button" class="btn btn-outline btn-block" id="useOther">Use a different email</button>
  </div>`);
  $('useOther').addEventListener('click', () => showSignIn());
}

function showSetupNeeded() {
  showGate(`<div class="gate-card card">
    ${brandBlock}
    <h1 class="gate-title serif">Almost There</h1>
    <p class="gate-text">Verity can’t find its Supabase settings yet. In your Vercel project, add the environment variables <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code>, then redeploy. When running on your own computer, copy <code>config.example.json</code> to <code>config.json</code> and fill in the same two values.</p>
  </div>`);
}

async function enterApp(s) {
  session = s;
  hideGate();
  $('view').innerHTML = '<div class="loading">Loading your log…</div>';
  $('composer').hidden = true;
  await reload();
  resizeDraft();
}

async function start() {
  let ok = false;
  try { ok = await store.connect(); } catch (e) { ok = false; }
  if (!ok) { showSetupNeeded(); return; }
  let s = null;
  let problem = '';
  try { s = await store.getSession(); } catch (e) { problem = 'That sign-in link didn’t work. It may have expired or already been used. Request a new one below.'; }
  store.onAuthChange((event, next) => {
    if (event === 'SIGNED_OUT' || !next) {
      session = null;
      data = { articles: [], feed: [] };
      loaded = false;
      showSignIn();
    } else if (!session || session.user.id !== next.user.id) {
      enterApp(next);
    } else {
      session = next;
    }
  });
  if (s) enterApp(s);
  else showSignIn(problem);
}

start();
