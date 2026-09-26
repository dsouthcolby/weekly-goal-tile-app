# Tile Week

Tile Week is a weekly reward board. You make goal tiles, each worth a number of points (for example "Pilates, 15 pts"), and drag them onto the days of the week when you do them. As your weekly total grows you climb a ladder of rewards you set yourself, such as "Fancy coffee at 20 pts" or "New leggings at 70 pts". The board resets at the start of each week, and past weeks stay in History.

The whole app is a single file, `index.html`, with no build step.

## Host it with GitHub Pages

1. In this repository on GitHub, open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose the `main` branch and the `/ (root)` folder, then **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/weekly-goal-tile-app/`.

## Add it to an iPhone home screen

1. Open the GitHub Pages URL in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, keep the name "Tile Week", and tap **Add**.

It then opens full screen from its home screen icon, like an app.

## Where your data is saved

Inside claude.ai the artifact version can sync its data through claude.ai. Outside claude.ai (for example on GitHub Pages), all tiles, rewards, settings and weeks are saved only in that browser's local storage. That means:

- Nothing is sent to a server, and nothing syncs between devices or browsers.
- The home screen app and Safari may keep separate storage on iPhone.
- Clearing website data for the site, or Safari removing data for a site you have not used in a while, deletes your board.
