# Tile Week

Tile Week is a weekly reward board. You make goal tiles, each worth a number of points (for example "Pilates, 15 pts"), and drag them onto the days of the week when you do them. As your weekly total grows you climb a ladder of rewards you set yourself, such as "Fancy coffee at 20 pts" or "New leggings at 70 pts". The board resets at the start of each week, and past weeks stay in History.

Each person signs in with their email and gets their own board, synced across their devices. It keeps working with no signal and syncs when the connection comes back.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app |
| `supabase.js` | Supabase's browser library (`@supabase/supabase-js` 2.117.2, MIT licence), kept here so the app works offline |
| `sw.js`, `manifest.webmanifest`, `*.png` | Let the app open offline and install on a home screen |
| `supabase/schema.sql` | The database tables and access rules |
| `artifact/tile-week.html` | The claude.ai artifact version, built from `index.html` by `tools/build_artifact.py` |

## Set up Supabase (once, about 10 minutes, free plan)

1. Create a free account and a new project at supabase.com.
2. In the project, open **SQL Editor**, paste all of `supabase/schema.sql`, and run it.
3. Make sign-in emails contain a code instead of a link. Open **Authentication > Email Templates**, choose **Magic Link**, and replace `{{ .ConfirmationURL }}` with `{{ .Token }}`. For example:
   ```html
   <h2>Your Tile Week code</h2>
   <p>Enter this code in Tile Week: <strong>{{ .Token }}</strong></p>
   ```
   A code works better than a link on iPhone, because a link opens Safari instead of the home screen app.
4. Copy the project's **URL** and its **anon / publishable** key from the project's API settings. Never use the `service_role` or secret key.
5. Put them at the top of the script in `index.html`:
   ```js
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_KEY = 'your-anon-or-publishable-key';
   ```
   These two values are meant to be public. The access rules in `schema.sql` are what keep each person's board private.

Until those two values are filled in, the app works on one device only and saves to that browser.

## Host it with GitHub Pages

1. In this repository on GitHub, open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose the `main` branch and the `/ (root)` folder, then **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/weekly-goal-tile-app/`.

## Add it to an iPhone home screen

1. Open the site in **Safari** and sign in.
2. Tap the **Share** button, then **Add to Home Screen**, and tap **Add**.
3. Open it from the home screen. If it asks you to sign in again there, do so once; the code arrives by email as before.

## How syncing works

- Every change is saved on the device first, so the app works with no signal.
- Changes upload when the app opens, when you switch back to it, when the connection returns, after each change, and every minute while it is open. The status under the title says **Synced**, **Syncing…** or **Offline · 2 changes to sync**.
- Each tile you place is its own record, so changes made on two devices at the same time are combined. If the same record was changed on both, the later change wins. This uses each device's clock.
- The first time you sign in on a device, any board already saved on that device is added to your account.
- Signing out clears the board from that device. Anything that hasn't synced yet is lost, and the app warns you first.
- A new version of the app appears the time after it is published, because the app opens from its saved copy first.

## The claude.ai version

The artifact on claude.ai is the same app. claude.ai does not let artifacts connect to outside services such as Supabase, so it syncs through claude.ai's own storage instead, and it doesn't work offline. Each person who opens it gets their own private board. People need Contributor access or higher to save; anyone with less access can still use it, but their changes stay in their own browser. The artifact and the GitHub Pages site do not share data.

To update the artifact after changing `index.html`, run `python3 tools/build_artifact.py` and republish `artifact/tile-week.html`.

## Limits to check

These come from Supabase's plans, which can change. Check the current pricing page before relying on them.

- Supabase's built-in email sender only sends a small number of emails per hour. That is fine for one person but may not be enough for a group; Supabase lets you connect your own email sender (SMTP) to raise it.
- Free Supabase projects may be paused after a period of no use. Opening the app regularly avoids this.
