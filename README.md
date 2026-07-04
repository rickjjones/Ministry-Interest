# Ministry Interest Tracker PWA

A simple Progressive Web App built with HTML, CSS, and JavaScript for tracking people you meet in ministry. The app works offline, stores data in the browser, and can be installed to a device.

## Files

- `index.html` — app UI and form
- `styles.css` — layout and styling
- `app.js` — localStorage data logic, form behavior, install prompt, and service worker registration
- `manifest.json` — PWA metadata for install support
- `service-worker.js` — offline caching for GitHub Pages
- `icon.svg` — app icon used by the web manifest

## Publish to GitHub Pages

1. Create a GitHub repository and push the contents of this folder.
2. In repository Settings, enable **Pages** and set the branch to `main` or `gh-pages`.
3. Set the folder to `/ (root)` if your files are in the repository root.
4. Wait for the deployment link and open the published site.

## Notes

- Data is stored locally in the browser with `localStorage`.
- The app is designed for offline use and can be installed as a PWA.
- To reset the app, use the **Clear All** button.
