# Ministry Interest Tracker PWA

A simple Progressive Web App built with HTML, CSS, and JavaScript for tracking people you meet in ministry. The app works offline, stores data in the browser, and can be installed to a device.

## Features

### People
- Add a person with name, contact details, notes, a follow-up date and an initial location.
- Edit anyone in the list; removing a person asks for confirmation first and says how many visits will be lost.
- **Navigate** opens directions to a person's saved location in Apple Maps (iPhone, iPad, Mac) or Google Maps (everything else).

### Visits
- **Log Visit** records the date, what you talked about and where you were.
- Each person's visit history (newest first) has **Edit** and **Delete** buttons for every visit. The history stays open while you make changes.

### Location
- **Get Location** uses the device's GPS and looks up the street address via OpenStreetMap. If no address can be found (or you're offline), it saves the coordinates instead.
- Clear messages when location permission is denied, unavailable or times out.

### Backup and restore
- **Export CSV** saves everything, including visit history, to a dated file (`ministry-interest-backup-YYYY-MM-DD.csv`) that opens in Excel or Numbers.
- **Import CSV** restores a backup. Records already in your list are skipped, so importing the same file twice won't create duplicates. Backups made by older versions of the app still import.
- A status line under the backup buttons shows when you last exported, and turns red if you've never backed up or it's been 14 days or more.

### Reliability
- Works offline once opened; every deploy reaches installed copies the next time they're opened online.
- Asks the browser to keep the app's storage permanently, so Safari doesn't clear it after a week of not using the app.
- If saved data ever becomes unreadable, the app keeps a copy of it instead of discarding it, and tells you how to restore from a backup.
- Dates are always shown on the correct calendar day, whatever your time zone.

### Installing
- On Android and desktop Chrome/Edge, an **Install App** button appears when the browser supports installing and the app isn't already installed.
- On iPhone and iPad, **How to Install** explains how to use Share → **Add to Home Screen**. Safari can't tell whether the app is already installed, so tapping **I've installed it** (or the **×** next to the button) hides it for good.
- The button never appears inside the installed app.
- Includes proper home-screen icons for iOS and Android.

## Privacy

All data stays in your browser on your device; there is no server or account. The only outside request is the address lookup: when you tap **Get Location**, your coordinates are sent to OpenStreetMap's Nominatim service to find the street address.

## Files

- `index.html` — app UI and form
- `styles.css` — layout and styling
- `app.js` — UI, localStorage data logic, location capture, install prompt, and service worker registration
- `utils.js` — pure helpers (dates, CSV parsing, IDs) shared by the app and the unit tests
- `manifest.json` — PWA metadata for install support
- `service-worker.js` — network-first caching so the app works offline and updates on every deploy
- `version.json` — the app version shown in the header (the only place the version is set)
- `icon.svg`, `icons/` — app icons (SVG plus PNGs for Android and the iOS home screen)
- `tests/` — unit tests for `utils.js`

## Development

Requires Node.js 18.18 or newer.

```sh
npm install        # install ESLint (dev only; the app itself has no dependencies)
npm run check      # lint + unit tests
python -m http.server 8080   # serve the app at http://localhost:8080
```

## Releasing

1. Bump the version in `version.json`.
2. Push to `main`. The GitHub Actions workflow runs lint and tests, then deploys only the app files to GitHub Pages.
3. Installed copies pick up the new version the next time they are opened online.

## Notes

- Data is stored locally in the browser with `localStorage`. Use **Export CSV** regularly as a backup; the app shows when the last backup was made.
- The app is designed for offline use and can be installed as a PWA.
- To reset the app, use the **Clear All** button.
