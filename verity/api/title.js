// Looks up a saved link's real title and site name.
// GET /api/title?url=https://...   (needs the signed-in user's token in the Authorization header)
// Returns { title, site } — either may be empty if the page doesn't say.

const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 600 * 1024;
const TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 4;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublic(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only web links can be looked up.');
  if (url.username || url.password) throw new Error('Links with passwords are not looked up.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('That address can’t be looked up.');
}

async function signedIn(req) {
  const auth = req.headers.authorization || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!auth.startsWith('Bearer ') || !process.env.SUPABASE_URL || !key) return false;
  try {
    const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { Authorization: auth, apikey: key }
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

async function readLimited(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    // Titles live in <head>; stop once it's over.
    if (Buffer.concat(chunks).toString('utf8').includes('</head>')) break;
  }
  try { reader.cancel(); } catch (e) { /* ignore */ }
  return Buffer.concat(chunks).toString('utf8');
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, names) {
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return decode(m[1]);
  }
  return '';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await signedIn(req))) return res.status(401).json({ error: 'Sign in first.' });

  let url;
  try { url = new URL(String(req.query.url || '')); } catch (e) { return res.status(400).json({ error: 'That isn’t a valid link.' }); }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response;
    for (let hop = 0; ; hop++) {
      await assertPublic(url);
      response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VerityBot/1.0; +https://vercel.app)', Accept: 'text/html,application/xhtml+xml' }
      });
      const loc = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && loc && hop < MAX_REDIRECTS) { url = new URL(loc, url); continue; }
      break;
    }
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.includes('html')) return res.status(200).json({ title: '', site: '' });
    const html = await readLimited(response);
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = meta(html, ['og:title', 'twitter:title']) || (titleTag ? decode(titleTag[1]) : '');
    const site = meta(html, ['og:site_name', 'application-name']);
    return res.status(200).json({ title: title.slice(0, 300), site: site.slice(0, 120) });
  } catch (e) {
    return res.status(200).json({ title: '', site: '', error: e.message });
  } finally {
    clearTimeout(timer);
  }
};
