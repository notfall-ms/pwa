# JSON pager

Edit `src/frontend/assets/pager.json`. Eleventy copies it to `/assets/pager.json`.
In development, file changes are copied automatically. For a deployed app, publish
the JSON file at that URL; changing messages does not require a new app release.
The app requests it once on startup, every 60 seconds while the page is visible,
on reconnection, and when the refresh button is clicked.

```json
{
  "messages": [
    {
      "id": "soup-digitalhub-2026-09-26",
      "title": "Warme Suppe am Digitalhub",
      "text": "Um 19 Uhr gibt es warme Suppe am Digitalhub.",
      "demo": true,
      "expiresAt": "2026-09-26T21:00:00+02:00"
    }
  ]
}
```

`id`, `title`, and `text` are required strings; IDs must be unique. `demo` is an
optional boolean and labels sample content. `expiresAt` is optional; use an ISO
8601 timestamp with timezone to hide outdated notices automatically. An empty
`messages` array clears the displayed notices. Content is rendered as plain text,
never executable HTML.

The sample soup message is a demo, not an actual municipal announcement.
There is no backend, authentication, system notification or push delivery.

The pager validates responses before replacing its last valid cache. Invalid
JSON and network failures fall back to stored messages. The initial feed is
precached with the app, and later valid feeds use a separate app-owned cache.
The “Gespeichert” indicator means cached fallback; it may also appear when the
server sends an invalid response. External messages are not tracked.
Configure the URL and cache name in `pwa.config.ts`.

## Cache reset and completion theme

The top-bar cache button first verifies the app server is reachable. It then
unregisters this app's service worker, deletes caches with the configured app
prefix, and reloads the page to refill them. Other apps' caches, checklist state,
installation state, location preferences and tracking consent are preserved.
The button is disabled offline. This resets Cache Storage, not the browser's
entire HTTP cache.

When all checklist tasks are complete, the page uses green accents. Unchecking
a task restores red accents; this also works after reload and cross-tab checklist
changes. Colors are centralized in `preparedness/theme/theme.css`. The logo asset
and its white background remain unchanged.
