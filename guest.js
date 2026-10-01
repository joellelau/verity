// Guest mode: the same reading/writing functions as store.js, but everything stays in this
// browser (localStorage). Nothing is sent to the database. Guests start with a few sample
// articles so there's something to try; "Start fresh" clears them.

const KEY = 'verity:guest:data';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.articles) && Array.isArray(d.feed)) return d;
    }
  } catch (e) { /* fall through */ }
  return null;
}

function write(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch (e) {
    throw new Error('Your browser’s storage is full or blocked.');
  }
}

function change(fn) {
  const d = read() || { articles: [], feed: [] };
  fn(d);
  write(d);
  return Promise.resolve();
}

export function sampleData() {
  const day = 24 * 3600e3;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const at = (daysAgo, h, m) => Math.min(start.getTime() - daysAgo * day + (h * 60 + m) * 60e3, Date.now() - 60e3);
  const item = (o) => Object.assign({ aid: null, quote: '', note: '', tags: [], text: '', links: [] }, o);
  return {
    articles: [
      { id: 'g-a1', url: 'https://example.com/third-places', title: 'The quiet power of third places', site: 'The Commons Review', read: true, readAt: at(3, 20, 0), createdAt: at(3, 8, 12) },
      { id: 'g-a2', url: 'https://example.com/note-taking', title: 'How note-taking changes what we remember', site: 'Mind & Method', read: true, readAt: at(2, 21, 0), createdAt: at(2, 7, 55) },
      { id: 'g-a3', url: 'https://example.com/streets', title: 'Designing streets for eight-year-olds', site: 'Urban Field Notes', read: true, readAt: at(1, 17, 0), createdAt: at(1, 12, 30) },
      { id: 'g-a4', url: 'https://example.com/slow-software', title: 'The case for slower software', site: 'Byte & Grain', read: false, readAt: null, createdAt: at(0, 9, 2) }
    ],
    feed: [
      item({ id: 'g-f1', type: 'article', aid: 'g-a1', createdAt: at(3, 8, 12) }),
      item({ id: 'g-f2', type: 'reply', aid: 'g-a1', quote: 'People return not for the coffee but for the feeling of being expected.', note: 'This is why the café near home matters more to me than the office.', tags: ['cities', 'community'], createdAt: at(3, 21, 40) }),
      item({ id: 'g-f3', type: 'article', aid: 'g-a2', createdAt: at(2, 7, 55) }),
      item({ id: 'g-f4', type: 'reply', aid: 'g-a2', quote: 'Writing in your own words forces a second, slower reading.', note: 'Try paraphrasing one quote per article.', tags: ['learning'], createdAt: at(2, 22, 3) }),
      item({ id: 'g-f5', type: 'article', aid: 'g-a3', createdAt: at(1, 12, 30) }),
      item({ id: 'g-f6', type: 'reply', aid: 'g-a3', tags: ['cities'], createdAt: at(1, 18, 10) }),
      item({ id: 'g-f7', type: 'reflection', text: 'Third places and kid-friendly streets feel like the same idea: cities built for lingering, not just passing through.', links: ['g-a1', 'g-a3'], createdAt: at(1, 22, 15) }),
      item({ id: 'g-f8', type: 'article', aid: 'g-a4', createdAt: at(0, 9, 2) })
    ]
  };
}

export async function loadAll() {
  let d = read();
  if (!d) {
    d = sampleData();
    write(d);
  }
  return JSON.parse(JSON.stringify(d));
}

export function clearAll() {
  write({ articles: [], feed: [] });
}

export function addArticle(article, item) {
  return change((d) => { d.articles.push(article); d.feed.push(item); });
}

export function addItem(item) {
  return change((d) => { d.feed.push(item); });
}

export function updateArticle(id, patch) {
  return change((d) => { const a = d.articles.find((x) => x.id === id); if (a) Object.assign(a, patch); });
}

export function updateItemLinks(id, links) {
  return change((d) => { const m = d.feed.find((x) => x.id === id); if (m) m.links = links; });
}

export function deleteArticle(id) {
  return change((d) => {
    d.articles = d.articles.filter((a) => a.id !== id);
    d.feed = d.feed.filter((m) => m.aid !== id);
  });
}

export function deleteItem(id) {
  return change((d) => { d.feed = d.feed.filter((m) => m.id !== id); });
}

export async function accessToken() {
  return null;
}
