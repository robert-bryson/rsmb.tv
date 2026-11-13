# Umami analytics

The browser loads Umami Cloud on `www.rsmb.tv` only. Local and preview hosts do not send data.
The site shares one Umami website property with Through Routes, Bookend, and route2gpx.
Use the Hostname filter or the `rsmb-tv` tag to isolate this site.

## Event contract

| Event | Trigger | Data |
| --- | --- | --- |
| `project-link-click` | A visitor opens project details, a demo, source code, or source data | Project, destination, placement |
| `map-interacted` | The first deliberate action on a map visit | Feature, action |
| `filters-applied` | The visitor changes post filters or applies Atlas filters | Feature, result-count bucket |
| `article-engaged` | The story end is visible and the page has been visible for 30 seconds | Content type |
| `gallery-opened` | A trip lightbox opens | Gallery type |
| `share-action` | A map link is copied, handed off, cancelled, or shown for manual copy | Feature, method, outcome |
| `contact-link-click` | The visitor opens the email link | Placement |
| `feed-link-click` | The visitor opens an RSS or JSON feed link | Format, placement |
| `map-ready` | A map first reaches a usable state | Feature, state, duration, navigation, revision, prefetch mode, viewport class |
| `map-startup-error` | A map reports its first error before it is usable | Same fields as `map-ready` |
| `map-runtime-error` | A usable map reports its first error | Feature, revision |
| `map-recovered` | A map first recovers from an error in each phase | Feature, state, phase |
| `page-error` | A React error boundary catches an error | None |
| `page-retry` | A visitor selects the page retry button | None |

Map actions include filters, selections, view changes, playback, and statistics.
A renderer startup, hover, or URL restoration does not count as an interaction.
The reading event is an engagement proxy. It does not prove that the visitor read the text.
A generated share or link click does not prove that a recipient opened it.

`map-ready` can follow `map-startup-error` after recovery. Do not treat their counts as exclusive outcomes.
Separate document and client navigation when you compare readiness times.
`ready`, `degraded`, and `fallback` are usable states. Review them separately.
The Pins map uses `pins-of-inaccessibility` as its feature value.
Its readiness, error, and recovery events use the same map monitor.
Pin IDs, search terms, and selected coordinates are excluded.
Result-count buckets are `0`, `1`, `2-10`, `11-50`, and `51+`.
The `device` property on existing map events describes the viewport width, not a device model.

## Privacy and delivery

The send hook accepts only the listed event names and bounded property values.
It drops query strings, URL hashes, identity fields, unknown page paths, and external referrer paths.
Known published posts retain their public path and title. Unknown paths become `/404`.
It does not send free-form search terms, route coordinates, file names, email addresses, or custom identities.
The tracker respects Do Not Track, Global Privacy Control, and the `umami.disabled` local-storage setting.
It checks these preferences before loading and again before sending.

Browser errors retain a standard error class and locations in public site bundles.
They omit error messages, function names, arbitrary paths, tags, and fingerprints.
The build revision labels each error. Earlier failures, resource failures, worker failures, and server failures can be absent.
The external tracker script runs with access to the page while it is loaded.

Pending custom events are limited to eight. Pending caught errors are limited to four.
An error that waits for the tracker is discarded if the visitor has moved to another path.
A blocked or unavailable tracker must not prevent navigation or map use.
Query exclusion also prevents native UTM attribution. Do not remove it without a reviewed allowlist.

Each event-data property counts toward Cloud usage. The existing `map-ready` event has seven properties.
Its event and properties use eight units, before its pageview.

## Dashboard setup

After deployment, open the website in Umami and filter by Hostname `www.rsmb.tv`.
Check Realtime, then inspect Events, Performance, and Errors.
Create a goal for `map-interacted` and another for `project-link-click`.
Create a funnel from a project page to its map page and then `map-interacted`.
Set a step window that fits the task, such as 60 minutes.
Review direct map entrants separately. They do not start at a project page.
Add notes for releases, data outages, and major content publication.

To exclude your browser, run `localStorage.setItem('umami.disabled', '1')` in the console on this origin.
Run `localStorage.removeItem('umami.disabled')` to restore collection.
Local browser tests substitute the tracker and collection endpoint.
The optional `UMAMI_TRACKER_FIXTURE` browser test also runs a reviewed Cloud script against an intercepted endpoint.
Neither test verifies delivery or plan features in the Umami account.
