# NotfallMS device kiosk

`notfall-ms/pwa` is the only maintained PWA source. `npm run build:kiosk`
builds its HTTP device profile; `npm run build` builds the normal website.
The build directory is cleaned first so kiosk metadata cannot leak into a
subsequent website build. The kiosk marker participates in the asset build hash.

The device profile connects automatically to `/ws` on the page's current host,
reconnects after interruption and requests `{"type":"get_messages"}`.
The firmware answers with a complete `{"messages":[...]}` snapshot containing
`id`, `title`, `message` and an ISO UTC `timestamp` for each message. The client
keeps snapshots separate from historical Bluetooth messages. Reception ACKs use
the existing `messageId`, `deviceId`, `status: "received"`, `timestamp` contract.
ACKs do not mean that a human has read a message and do not transmit over LoRa.

The generated `kiosk-info.json` lists the version, build and document URLs.
On local HTTP the document view works without CacheStorage or a service worker
and labels documents as available on the box, not saved offline on the phone.
Downloads remain available. The standard HTTPS worker and Bluetooth client are
preserved for the normal website. MeshCore BLE and the PWA's own Bluetooth GATT
protocol remain different protocols; the device kiosk uses WebSocket.

The firmware build fetches an immutable Git revision of this repository, runs
the tests, builds this profile and packages the resulting files into flash.
Released firmware records the exact revision. Creating a new firmware version
can resolve the latest `main`; rebuilding an old version uses its recorded lock.
The installed device requires no internet and changes only when firmware is updated.

## Provenance

PWA base: `45fd6cfc2917377c21a9bc271c1d62001892e168` in this repository.
Device integration: `Lafarik/SafeMS` at
`1e78ca0f8ff9a297a75684ecba679255b552c2ed`, developed by Georg Wilhelm (`Lafarik`)
for the NotfallMS hackathon. Maintained here since 2026-09-27.

`logo-favicon.svg` replaces the old lowercase `logo.svg`; `LOGO.svg` remains.
Distinct names allow a complete checkout on both Windows and Linux.
