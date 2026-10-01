// Verity's connection to Supabase: sign-in and reading/writing your log.
// The rest of the app works with plain objects in this shape:
//   article: { id, url, title, site, read, readAt, createdAt }
//   item:    { id, type: 'article' | 'reply' | 'reflection', aid, quote, note, tags, text, links, createdAt }
// Times are milliseconds since 1970, ids are UUIDs made in the browser.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

let sb = null;

/* ---------- Setup ---------- */

async function readConfig() {
  // On Vercel, /api/config hands over the public Supabase settings from the project's environment variables.
  // For running on your own computer, put the same two values in config.json (see config.example.json).
  for (const url of ['/api/config', './config.json']) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const cfg = await res.json();
      if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) return cfg;
    } catch (e) { /* try the next one */ }
  }
  return null;
}

export async function connect() {
  const cfg = await readConfig();
  if (!cfg) return false;
  sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return true;
}

/* ---------- Sign-in ---------- */

export async function getSession() {
  const { data, error } = await sb.auth.getSession();
  // Clean the one-time sign-in code out of the address bar once it has been used.
  const url = new URL(location.href);
  if (url.searchParams.has('code') || url.searchParams.has('error_description')) {
    const authError = url.searchParams.get('error_description');
    url.searchParams.delete('code');
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (authError && !data.session) throw new Error(authError);
  }
  if (error) throw error;
  return data.session;
}

export function onAuthChange(cb) {
  sb.auth.onAuthStateChange((event, session) => cb(event, session));
}

export async function sendSignInLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname }
  });
  if (error) throw error;
}

export async function signOut() {
  await sb.auth.signOut();
}

/* ---------- Mapping between the database and the app ---------- */

const ms = (t) => (t ? new Date(t).getTime() : null);
const iso = (n) => (n ? new Date(n).toISOString() : null);

const toArticle = (r) => ({ id: r.id, url: r.url, title: r.title, site: r.site || '', read: !!r.read, readAt: ms(r.read_at), createdAt: ms(r.created_at) });
const fromArticle = (a) => ({ id: a.id, url: a.url, title: a.title, site: a.site || null, read: !!a.read, read_at: iso(a.readAt), created_at: iso(a.createdAt) });

const toItem = (r) => ({ id: r.id, type: r.type, aid: r.article_id, quote: r.quote || '', note: r.note || '', tags: r.tags || [], text: r.text || '', links: r.links || [], createdAt: ms(r.created_at) });
const fromItem = (m) => ({ id: m.id, type: m.type, article_id: m.aid || null, quote: m.quote || '', note: m.note || '', tags: m.tags || [], text: m.text || '', links: m.links || [], created_at: iso(m.createdAt) });

async function selectAll(table) {
  const out = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: true }).range(from, from + page - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

/* ---------- Reading and writing ---------- */

export async function loadAll() {
  const [articles, items] = await Promise.all([selectAll('articles'), selectAll('items')]);
  return { articles: articles.map(toArticle), feed: items.map(toItem) };
}

export async function addArticle(article, item) {
  const a = await sb.from('articles').insert(fromArticle(article));
  if (a.error) throw a.error;
  const i = await sb.from('items').insert(fromItem(item));
  if (i.error) throw i.error;
}

export async function addItem(item) {
  const { error } = await sb.from('items').insert(fromItem(item));
  if (error) throw error;
}

export async function updateArticle(id, patch) {
  const row = {};
  if ('title' in patch) row.title = patch.title;
  if ('site' in patch) row.site = patch.site;
  if ('read' in patch) row.read = !!patch.read;
  if ('readAt' in patch) row.read_at = iso(patch.readAt);
  const { error } = await sb.from('articles').update(row).eq('id', id);
  if (error) throw error;
}

export async function updateItemLinks(id, links) {
  const { error } = await sb.from('items').update({ links }).eq('id', id);
  if (error) throw error;
}

export async function deleteArticle(id) {
  // Its own article card and replies go with it (the database cascades the delete).
  const { error } = await sb.from('articles').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id) {
  const { error } = await sb.from('items').delete().eq('id', id);
  if (error) throw error;
}

export async function accessToken() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.access_token : null;
}
