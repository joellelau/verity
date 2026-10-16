# Verity

Save links, reply to them with quotes, notes and #tags, and write reflections that connect what you read. Your log is saved to your own account, so it's the same on every device.

Built with plain HTML, CSS and JavaScript (no build step), [Supabase](https://supabase.com) for sign-in and storage, and [Vercel](https://vercel.com) for hosting.


## Files

- `index.html`, `styles.css`, `app.js`: the app
- `store.js`: sign-in and saving, via Supabase
- `guest.js`: guest mode, which saves in the browser instead
- `api/config.js`: gives the browser the public Supabase settings from Vercel's environment variables
- `api/title.js`: fetches a saved link's real title and site name
- `supabase/schema.sql`: database tables and security rules
