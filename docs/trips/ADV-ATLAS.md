# ADV Atlas

ADV Atlas connects motorcycle trip reports through a shared route map.
Open `/projects/adv-atlas/map` to browse the collection.
The project entry opens this explorer directly.

## Selection and navigation

| URL | Result |
| --- | --- |
| `/projects/adv-atlas/map` | Show the collection overview |
| `/projects/adv-atlas/map?trip=boise-2024` | Select and frame one trip |
| `/projects/adv-atlas/map?trip=boise-2024&view=selected` | Show only the selected trip |

The former `/projects/motorcycle-trips` routes redirect to the explorer.
Redirects retain query parameters, fragments, and return state.

Select **Show route** or a route line to select a trip.
Shared roads show named route choices.
Pointer and keyboard previews highlight routes without changing the selection or camera.
Keyboard selection closes the choices and focuses the selected card's **Show route** button.
Pointer selection reveals the card without moving keyboard focus.
Reopening the trip panel does not repeat the focus move.
Select **Zoom to all trips** to clear the selection and filter, then frame the collection.
The overview control appears when the selection, filter, or camera differs from the overview.

Select a report link to read the full story.
Its **Back to map** links retain the atlas selection and filter.
Returning restores the camera, panel state, and card position within the same browser tab.
Reloading the report or atlas retains this state.
Report, series, and neighboring-article links retain the originating atlas history key.
Opening another map at the same URL does not replace that report's return destination.
If the originating snapshot has expired, the return frames the selected trip instead of restoring another visit's view.
A fresh visit through a copied URL frames the selected trip.
Each browser history entry receives a unique key before the router starts.
Reloads retain that key. Separate direct visits receive different keys, even when their URLs match.
Camera movement updates the saved view in memory before navigation can persist it.

The browser stores up to 40 destination records in `sessionStorage`.
Each saved view normally uses two records: a history key and a return URL.
The URL record supports older report links that do not carry a history key.
The state contains only camera values, panel visibility, and card scroll position.
Stored values are validated before use. Invalid records are ignored.
If storage is unavailable, navigation uses an in-memory fallback. Reload restoration then cannot work.

## Content and recovery

Production includes published report-backed trips.
Development also includes drafts and incomplete reports, with amber labels.
Cards without valid manifests retain report links. Their route controls remain disabled.
Hosted development builds retain CDN asset URLs.
Local Vite uses prepared assets under `public/data/trips/`.

Each route has an independent loading state and retry action.
Map failures leave report cards available.
Renderer retries retain the selected trip and saved camera.
Retries also retain pending camera fits. Delayed route data completes the original fit request.
Manual movement still cancels that request. A later explicit selection can request another fit.
Fullscreen includes the cards, route choices, and recovery controls.
Renderer retries retain the fullscreen button's action, label, and icon.
If fullscreen ends during a failed retry, the next renderer creates a fresh fullscreen control.

## Code ownership

| Module | Responsibility |
| --- | --- |
| `scripts/trip-content-plugin.ts` | Validate publication data and emit small trip summaries |
| `src/features/trips/atlas/tripAtlasEntries.ts` | Group reports and order trip cards |
| `src/features/trips/atlas/tripAtlasView.ts` | Build atlas URLs and combine route features |
| `src/features/trips/atlas/tripAtlasSession.ts` | Validate, copy, bound, and persist tab state |
| `src/blog/postReturnDestination.ts` | Validate article return destinations and retain source visit identity |
| `src/utils/browserHistory.ts` | Give direct browser visits unique keys that survive reloads |
| `src/pages/AdvAtlas.tsx` | Coordinate cards, route readers, URL state, and page lifecycle |
| `src/features/trips/atlas/TripAtlasMap.tsx` | Manage MapLibre rendering, camera fitting, and map input |
| `src/features/trips/atlas/AtlasFullscreenControl.ts` | Keep the fullscreen icon correct after renderer replacement |

Use the [trip testing guide](TESTING.md#adv-atlas) for regression commands and required behavior.
Use [TODO.md](../../TODO.md#adv-atlas) for incomplete work.
The dated [research report](../reviews/2026-10-30-adv-atlas-research.md) records the original design decisions.
