# PWA and offline documents

## Setup

Run `npm run build`, then serve `_site` over HTTPS or localhost (for example,
`python3 -m http.server 8080 --directory _site`). The repository-root `index.html`
is a separate placeholder; the application is generated in `_site`.
`npm run dev` also enables the service worker. Open the Eleventy app (normally
`http://localhost:8080`), not Vite's asset server. Eleventy generates the worker
and document list on every rebuild and watches the configured document folder.
Development uses network-first caching for app resources and Vite modules, so
online changes stay fresh. After initial activation, one automatic reload captures
the development module graph for offline use. Visit the page online once before
testing offline reloads. BrowserSync and unrelated endpoints are not cached.
Development worker updates activate automatically; production asks for confirmation.

Put public emergency documents in `src/documents`, including subdirectories.
Configure `documentsSource` and `documentsPath` in `pwa.config.ts` to change the
source folder and published URL directory. Rebuild after adding or changing files.
The sample is `src/documents/beispiel.txt`.

## Behavior

The production build runs Vite, Eleventy and PWA generation in order. It creates
an explicit document list and caches the app shell, built assets and every listed
document at service worker installation. Installation fails if a required fetch
fails; an existing working worker remains available. Only application resources
are intercepted. Unknown documents receive an offline error, never app HTML.

The compact top bar shows package version (build hash in its tooltip) and the browser's network
status (`navigator.onLine`, not a guarantee that the server is reachable).
The homepage reads previews directly from the active worker's cache. TXT files
are displayed as plain text. `.md` and `.markdown` files render as formatted
Markdown, including headings, lists, tables, quotes and code blocks. Raw HTML is
disabled. Relative links and images resolve against the source document folder.
Images inside the configured documents folder are cached with the documents;
external images require a connection. Other document types are linked. “✓ 1 offline” is
shown after the document cache has been checked, independently of document-list
rendering or network registration success. Browser storage can be evicted.

The install button requests the browser's installation dialog where supported.
The user still confirms installation in that dialog. After `appinstalled`, the
installation controls are hidden and this state is remembered in local storage.
Standalone launches also hide the controls. A new browser installation prompt
clears the remembered state (for example after uninstalling). Other browsers receive
instructions for their menu or iOS Share → Add to Home Screen.

Updates are checked on load and when connectivity returns. A waiting worker
exposes an update button; accepting activates the new cache and reloads open app
tabs. Previous app caches are removed when only one tab remains. Other apps'
caches are never deleted. Version comes from `package.json`; content changes
also change the build hash even if the package version stays the same.

## Verification

1. Build and serve `_site`; open it online and wait for “✓ 1 offline”.
2. Confirm the sample text is visible, then use browser DevTools to go offline.
3. Reload and open the document link; both must work without a network.
4. Change the sample, build again, go online and reload. Accept the update and
   check that both the build hash and document content change.
5. Check installation in a supporting browser and fallback instructions on iOS.

Automated checks:

```sh
node --test src/frontend/components/pwa/service-worker/service-worker.spec.cjs
npx jest src/frontend/components/pwa/documents/documents.spec.ts --runInBand --coverage=false
```
