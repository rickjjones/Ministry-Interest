# Ministry Interest Tracker PWA

A simple Progressive Web App built with HTML, CSS, and JavaScript for tracking people you meet in ministry. The app works offline, stores data in the browser, and can be installed to a device.

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
