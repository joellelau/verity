# Verity

Save links, reply to them with quotes, notes and #tags, and write reflections that connect what you read. Your log is saved to your own account, so it's the same on every device.

Built with plain HTML, CSS and JavaScript (no build step), [Supabase](https://supabase.com) for sign-in and storage, and [Vercel](https://vercel.com) for hosting.

## Set it up (about 15 minutes)

You need free accounts on GitHub, Supabase and Vercel.

### 1. Create the database (Supabase)

1. In Supabase, click **New project**. Pick a name (e.g. `verity`), set a database password (save it somewhere), choose a region near you, and create it. Wait a minute or two for it to finish.
2. Open **SQL Editor** in the left sidebar, then **New query**.
3. Open `supabase/schema.sql` from this project, copy everything, paste it into the editor, and press **Run**. You should see "Success. No rows returned".
4. Go to **Project Settings → API** (on newer projects it's **Project Settings → API Keys** and **Data API**). Copy two values and keep them handy:
   - **Project URL**, like `https://abcdefgh.supabase.co`
   - **anon public** key (newer projects call it the **publishable** key and it starts with `sb_publishable_`)

   Never use the **service_role** or **secret** key here.

### 2. Put the code on GitHub

1. On GitHub, click **+ → New repository**. Name it `verity`. It can be **Private**. Click **Create repository**.
2. Click **uploading an existing file**, drag in everything from this folder (including the `api` and `supabase` folders), and click **Commit changes**.

### 3. Put it online (Vercel)

1. In Vercel, click **Add New… → Project**, connect your GitHub account if asked, and **Import** the `verity` repository.
2. Leave **Framework Preset** as **Other**. Don't change the build settings.
3. Open **Environment Variables** and add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon (or publishable) key
4. Click **Deploy**. When it finishes, copy your site address, like `https://verity-abc123.vercel.app`.

### 4. Tell Supabase where the app lives

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel address.
3. Under **Redirect URLs**, click **Add URL** and add your Vercel address followed by `/**`, for example `https://verity-abc123.vercel.app/**`. Save.

### 5. Sign in

Open your Vercel address, enter your email and press **Email me a sign-in link**. Open the email **in the same browser** and you're in.

## Good to know

- **Sign-in links** must be opened in the browser you requested them from. On a phone, if your mail app opens links elsewhere, copy the link into the browser you used.
- **Email limits:** Supabase's built-in email sender only sends a few sign-in emails per hour. That's fine for personal use; for more, add your own email provider under **Authentication → Emails → SMTP settings**.
- **Article titles** are looked up automatically after you save a link (by `api/title.js`). Some sites block this; the title is then guessed from the link and you can fix it with **Edit title**.
- **Updating the app:** upload changed files to the GitHub repository and Vercel redeploys on its own within a minute.
- **Privacy:** every row in the database belongs to the account that created it, and the database's security rules only let you read or change your own.

## Run it on your own computer

1. Copy `config.example.json` to `config.json` and fill in your Project URL and key.
2. In Supabase **Authentication → URL Configuration → Redirect URLs**, also add `http://localhost:8000/**`.
3. Start a local server in this folder and open http://localhost:8000:
   ```
   python3 -m http.server 8000
   ```
   Title look-ups only work on Vercel, so locally titles are guessed from the link.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `store.js`: sign-in and saving, via Supabase
- `api/config.js`: gives the browser the public Supabase settings from Vercel's environment variables
- `api/title.js`: fetches a saved link's real title and site name
- `supabase/schema.sql`: database tables and security rules
