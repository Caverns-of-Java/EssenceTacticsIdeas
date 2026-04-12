Essence Tactics Ideas - Minimal implementation

Files added:
- index.html: UI shell
- script.js: minimal API client + state + UI wiring
- styles.css: basic styles
- config.js: set `API_URL` to your Apps Script deployment URL
- apps_script/Code.gs: Google Apps Script implementation for doGet/doPost

Notes:
- All POST requests must use `Content-Type: text/plain;charset=utf-8`.
- Deploy the Apps Script as a Web App (execute as: you; access: Anyone).
- Update `config.js` with your deployment ID before using the frontend.

PWA (Progressive Web App)
-------------------------
- This project includes a `manifest.json` and a service worker (`service-worker.js`).
- To test PWA features locally, serve the folder over HTTPS or use a simple local server and open the site in Chrome/Edge.
- The app shell files are cached; the site is installable on supporting browsers.
- Icons are in the `icons/` folder. Update them as needed for store publishing.

Next steps:
- Harden validation (frontend + backend)
- Add sanitization against formula/XSS inputs
- Add retry/backoff and better error UI
- Consider soft-delete vs hard-delete semantics
