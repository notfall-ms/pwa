# NotfallMS PWA

The single maintained source for the NotfallMS citizen website and Wi-Fi kiosk.
Device firmware lives in [notfall-ms/firmware](https://github.com/notfall-ms/firmware)
(currently private); project coordination is in [notfall-ms/general](https://github.com/notfall-ms/general).

```sh
npm ci
npm test -- --coverage=false
npm run build        # normal HTTPS website
npm run build:kiosk  # self-contained local HTTP box, automatic /ws connection
```

Both builds produce `_site/` from the same source. Build output is generated and
must not be maintained as another copy of the PWA. See [Kiosk integration](docs/kiosk.md).

The local HTTP/WebSocket integration was developed by Georg Wilhelm (`Lafarik`)
as part of the NotfallMS hackathon project, initially in `Lafarik/SafeMS` while
organization access was being established, and integrated here on 2026-09-27.
The PWA originated in this repository; existing authors and licensing are retained.

## Original project references


[![Wallaby.js](https://img.shields.io/badge/wallaby.js-powered-blue.svg?style=flat&logo=github)](https://wallabyjs.com/oss/)

## inspired
* https://github.com/fpapado/eleventy-with-vite
* https://github.com/stefanjudis/tiny-helpers
* https://www.trysmudford.com/blog/encapsulated-11ty-components/

# prequisite
* Node 22.14.0 (used)


* Logos: https://github.com/PKief/vscode-material-icon-theme/tree/main/icons


# Documentation
* [docs](docs/index.md) - project documentation
* [PWA and offline documents](docs/pwa.md) - setup, caching and installation

* [Preparedness tools and tracking mock](docs/preparedness.md) - tabs, checklist, location and backend contract

* [JSON pager and cache controls](docs/pager.md) - messages, offline updates and completion theme
