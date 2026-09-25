# Preparedness tools and local tracking mock

## UI and setup

Run `npm run dev`, or `npm run build` and serve `_site` over HTTPS/localhost.
Markdown documents use level-two headings (`##`) as tabs. Introductory content
remains above them; subsections remain within their module. Documents without
level-two headings fall back to another heading level. Tabs support arrows,
Home/End, selection states and separate IDs across documents.

The six example tasks are configured in
`src/frontend/components/preparedness/checklist/tasks/tasks.ts`.
They are illustrative starting points, not a complete emergency plan.
Reference: [BBK checklists](https://www.bbk.bund.de/DE/Warnung-Vorsorge/Vorsorge/Ratgeber-Checkliste/ratgeber-checkliste_node.html).
Completion is stored locally under stable task IDs. Unknown IDs are discarded.
Points equal the number of currently completed tasks times ten. Unchecking a
task removes those points; toggling cannot accumulate extra rewards.

Open counts appear both above the list and in the top bar. One simulated reminder
appears after 12 seconds if work remains. The demo button triggers it again.
It is an in-app notification, not a browser push message; no notification
permission, background scheduling or backend is involved.

## Location

Users can select one of Münster's 45 statistical districts manually, request a
single browser geolocation lookup, or delete their selection. Point-in-polygon
lookup uses bundled city data and supports offline operation when the browser
can supply a position. No external geocoding service is used. Denied permission,
outside-city positions and insufficient accuracy keep manual selection available.
Manual changes or clearing the selection override an outstanding location request.
Only area ID, city district and selection method are persisted locally; precise
coordinates and accuracy values are discarded. Tracking includes only the city
district, never the statistical district ID or coordinates.

Source and license: [bundled area data](../src/frontend/components/preparedness/location/areas/areas.md).

## Tracking contract — mock only

Tracking is OFF until the user activates the demo. The replaceable
`TrackingClient` interface lives in `tracking/tracking.d.ts`; the current adapter
only writes up to 20 local events. It does not call `fetch`, beacon, analytics or
any backend. The UI explicitly labels this as a local demo.

The controller creates a SHA-256 hash of 32 cryptographically random bytes.
It does not hash a name, address, position or device fingerprint. Only the hash
is retained. The event contract is:

```json
{
  "schemaVersion": 1,
  "eventId": "random UUID",
  "kind": "progress",
  "residentHash": "64 lowercase hexadecimal characters",
  "district": "Münster-West",
  "installed": true,
  "completed": 2,
  "total": 6,
  "occurredAt": "2026-09-26T00:00:00.000Z"
}
```

Kinds: `snapshot`, `installation`, `progress`, `district`. A missing district is
`null`. Activation and subsequent starts report current state; `appinstalled`
reports installation; task and location changes produce fresh snapshots.
Events are serialized. Withdrawing consent invalidates queued work, clears the
local mock log and deletes the hash, while preserving personal checklist progress.
It also reacts to withdrawal in another tab. Storage or crypto failures leave
the personal checklist usable and display a demo status error.

A stable hash is a pseudonym, not anonymous data or proof of residency. One hash
represents a consenting browser profile, not necessarily one resident. Multiple
devices and storage resets can produce multiple hashes for one person. Do not
label raw hash counts as verified residents.

## Future backend integration

No backend or municipal dashboard has been implemented. Replace the mock adapter
with the backend client only after separately configuring a real deployment.
Suggested endpoints are `POST /v1/preparedness/events` and a participant deletion
endpoint. Server-side validation must whitelist districts, validate count ranges
and event schema, and deduplicate by `eventId`. Keep the latest snapshot per hash;
do not sum repeated progress events. Aggregate city-district installation counts
and progress buckets for the dashboard, with suppression of small groups. Avoid
exposing individual hashes in the municipal dashboard.

Real withdrawal needs server-side deletion and cancellation of queued uploads,
including an offline withdrawal strategy. Retention, access controls, abuse
handling and consent wording remain backend/deployment work. The local mock
must not be presented as anonymization of any existing remote records.

## Verification

`npm test -- --coverage=false` covers heading navigation, checklist persistence,
reward counts, local boundary lookup, location permission failures, and consent
withdrawal during hashing. `node --test src/frontend/components/pwa/service-worker/service-worker.spec.cjs`
covers the worker's cache behavior. Manually check responsive layout, browser
location permission, install events, offline reload and cross-tab changes.
