// Hands the browser the two public Supabase settings, read from the Vercel project's
// environment variables: SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY).
// Both are safe to expose: the public key only allows what the database's security rules allow.
// As a safety net, a secret/service-role key is never handed out, even if it was pasted by mistake.

function isSecretKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return payload.role === 'service_role';
  } catch (e) {
    return false;
  }
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if (key && isSecretKey(key)) {
    return res.status(500).json({ supabaseUrl: '', supabaseAnonKey: '', error: 'The key set in Vercel is a secret key. Use the anon/publishable key instead.' });
  }
  res.status(200).json({ supabaseUrl: url, supabaseAnonKey: key });
};
