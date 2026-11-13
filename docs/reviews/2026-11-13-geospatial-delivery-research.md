# Geospatial storage and map delivery

Use the existing S3 and CloudFront data service for generated geographic artifacts. Use PMTiles for large, stable display boundaries. Keep small result indexes, changing records, selected features, and route data as JSON or GeoJSON where they remain efficient. Keep CARTO basemap requests going directly to CARTO.

The most urgent change is to remove generated Pins geometry from Git and the Amplify application artifact. The next change is to reduce the geometry each view downloads and processes. These are separate problems. Moving a whole GeoJSON file to S3 solves repository storage but preserves its browser download, parsing, validation, and client tiling costs. [MapLibre guidance for large GeoJSON](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/).

This assessment covers Pins, Flights, Temperature Records, Tornado Tracks, trips, and ADV Atlas in the November 13, 2026 working tree. Pirsig is included as a separate, README-level comparison. The [measurement record](../performance/2026-11-13-geospatial-delivery.json) retains sizes, prototype settings, source fingerprints, tile identity checks, and public CDN probes.

Selected-pin location details now use the small-JSON approach described here. Elevations and nearest listed places for all 8,091 pins are published under `https://data.rsmb.tv/maps/pins/context/`, independently of the application. The 307 files total 2,586,600 bytes; the largest is 81,417 bytes. The browser loads a manifest and one relevant scope after selection. Generated context stays outside Git and the application build. The publisher verifies current pin coordinates and checksums, uploads immutable files, checks the remote inventory, and changes the manifest last. All 307 files were read back through CloudFront and matched their SHA-256 checksums. See the [context measurements](../performance/2026-11-13-pins-context.json) and [generation and publication instructions](../../projects/pins-of-inaccessibility/readme.md#elevation-and-nearby-places). Migration of the existing boundary publication to tiles remains the next larger change.

## Recommended architecture

A vector tile contains geometry and attributes for one geographic tile at a particular zoom level. PMTiles packages a tile pyramid into one file. A compatible reader requests byte ranges from that file instead of downloading the entire archive. MapLibre supports the PMTiles protocol through its `addProtocol` interface. This fits the existing globe renderer. A surface globe does not require a Cesium or OGC 3D Tiles service. [PMTiles concepts](https://docs.protomaps.com/pmtiles/), [MapLibre integration](https://docs.protomaps.com/pmtiles/maplibre), [MapLibre globe example](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-vector-map/).

Use four separate responsibilities:

| Responsibility | Storage and format | Purpose |
| --- | --- | --- |
| Source and calculation | Pinned source URLs, checksums, an ignored build cache, and an object archive where needed | Reproduce the full boundary calculations |
| Display boundaries | Versioned PMTiles objects on S3, delivered through CloudFront | Load geometry for the visible area and zoom |
| Application results | Small versioned JSON indexes on the data CDN | Supply rankings, search, pin coordinates, distances, bounds, and provenance |
| Interactive overlays | Small GeoJSON sources built or loaded for the selected and nearby features | Draw precise selected circles, spokes, hover details, and changing records |

Keep source snapshots, schemas, calculation code, infrastructure, small identity catalogs, and curated test fixtures in Git. Publish generated bulk data separately. An ignored local cache can still contain downloaded source ZIP files and generated GeoJSON during preparation. The application release should not copy these files into `dist`.

Keep calculation geometry separate from display tiles. Vector tiles can clip polygons at tile edges and quantize their coordinates. Those artificial edges must never enter the pole solver. The numeric result indexes must also remain the authority for complete rankings and counts. Features read from visible tiles can be incomplete, clipped, or repeated. The prototype identity checks explicitly deduplicate tiled features by jurisdiction ID. [Vector tile format](https://github.com/mapbox/vector-tile-spec), [FlatGeobuf discussion of lossless features and lossy display tiles](https://flatgeobuf.org/#what-about-mapbox-vector-tiles).

## Current storage and browser behavior

The following sizes are uncompressed working-tree files. Temperature, Tornado, and trip figures describe the available local UI mirrors. They do not include all S3 observation archives, source downloads, photographs, or private originals.

| Project data | Local files | Local size | Files tracked in Git | Current delivery |
| --- | ---: | ---: | ---: | --- |
| Pins | 517 | 45.54 MiB | 517 | Same-origin files copied from `public/data` |
| Flights | 4 | 2.11 MiB | 4 | Same-origin generated GeoJSON |
| Temperature UI records | 5 | 1.80 MiB | 0 | S3 and `data.rsmb.tv` |
| Tornado UI archive | 158 | 61.57 MiB | 0 | S3 and `data.rsmb.tv/tornadoes` |
| Mirrored trip geometry | 22 | 1.12 MiB | 0 | Processed routes on S3 and CloudFront |

The committed Pins baseline contains 34.92 MiB. The outline detail changes in this working tree increased it to 45.54 MiB. That increased display fidelity, but the generated output belongs in an artifact store. These file sizes are not compressed Git object sizes. Removing tracked data also does not remove existing blobs from Git history. A history rewrite should be considered separately if clone or repository size becomes a measured problem.

Pins already loads regional files by country and defers U.S. county outlines. It does not download all 517 files on every visit. However, [`useWorldPinsData`](../../src/features/pins/data.ts) requests the complete world country outline for every foreign-country view. The browser then filters it to one country. A Tobago view therefore depends on a 6.03 MiB country outline before its small regional outline is considered.

Representative file measurements use gzip level 6:

| Artifact | Raw | Local gzip |
| --- | ---: | ---: |
| World country outlines | 6.03 MiB | 2.15 MiB |
| U.S. county outlines | 6.64 MiB | 2.20 MiB |
| Canadian province outlines | 1.69 MiB | 601 KiB |
| U.S. pin results, including all counties | 1.81 MiB | 390 KiB |
| World country pin index | 188 KiB | 43 KiB |
| All-airport point data | 1.47 MiB | 235 KiB |
| Shared simplified U.S. state context | 87 KiB | 28 KiB |

Local gzip sizes are comparisons of representations. They are not measurements of deployed browser transfer sizes.

There is also an independent CPU and memory issue. [`PinsMap`](../../src/features/pins/PinsMap.tsx) can generate circles for all U.S. counties when that layer becomes visible. A single local call generated 3,292 circles with 240,316 coordinates. Their JSON representation is 9.31 MiB. Circle generation took 87.6 ms on the laboratory Node process, before serialization. This is not a phone or browser frame measurement. It shows that migrating boundary downloads alone will leave substantial geometry work in the client.

Generate and cache rings and spokes for the selected and nearby pins. Keep the complete numeric pin index for rankings. If ordinary circles still dominate rendering, evaluate an optional tiled ring layer while keeping selected overlays dynamic.

## Local tile experiments

The experiments used the current boundary files, Tippecanoe 2.79.0, the official PMTiles Python reader 3.8.1, and vector-tile decoder 2.2.0. Compiler concurrency was limited to four threads. No generated archive was placed in the repository or uploaded to S3.

The global inputs contained 8,091 jurisdictions: 257 countries, 4,599 states or source regions, and 3,235 U.S. counties. String properties retained jurisdiction IDs and FIPS codes. Country geometry began at zoom 0, regions at zoom 3, and counties at zoom 6.

The compiler disabled feature-count dropping, tile-size dropping, and tiny-polygon reduction. It used `--no-simplification-of-shared-nodes` for shared boundaries. These settings are experimental controls, not final production presets. Production should enforce measured tile budgets and fail a build rather than silently discard required jurisdictions. Tippecanoe supports direct PMTiles output and controls for shared borders and simplification. [Creation guide](https://docs.protomaps.com/pmtiles/create), [Tippecanoe options](https://github.com/felt/tippecanoe/blob/main/README.md).

| Prototype | Archive size | Tile addresses across all zooms | Build time | Peak compiler memory |
| --- | ---: | ---: | ---: | ---: |
| Global boundaries through zoom 8 | 19.47 MiB | 23,511 | 7.33 s | 161 MiB |
| Global boundaries through zoom 10 | 57.87 MiB | 314,275 | 31.38 s | 161 MiB |
| Trinidad and Tobago through zoom 14 | 215 KiB | 1,492 | 0.31 s | 89 MiB |

The archives contain internally compressed tiles. Increasing maximum zoom increased the stored pyramid substantially. PMTiles is not a promise that the complete stored file will be smaller than compressed GeoJSON. Its main advantage here is selective delivery and moving tile preparation out of the browser.

The zoom-10 prototype addresses 314,275 tiles. Publishing those as individual objects would create a large upload and object-management workload. A PMTiles archive keeps that pyramid in one object and can reuse identical tile content within it.

The following samples enumerate specified Web Mercator tile coordinates. They are not MapLibre camera traces. Actual globe requests can include different zooms, buffers, metadata, directory reads, and cached responses.

| Sample | Selected compressed tile payload | Current comparison |
| --- | ---: | --- |
| All four zoom-1 world tiles | 148 KiB | World outline alone is 2.15 MiB as gzip |
| Four zoom-3 tiles covering the lower 48 bounds | 130 KiB | Includes eligible country and regional layers in those tiles |
| Nine zoom-7 tiles covering Colorado bounds | 22.5 KiB | Complete U.S. county outline is 2.20 MiB as gzip |
| Tobago zoom-13 bounding box in the detailed prototype | 5.5 KiB over 26 nonempty tiles | TTO regional GeoJSON alone is about 4 KiB as gzip |

These are tile body sizes, not complete cold HTTP costs. The Python reader needed about 9.5 KiB of unique header and directory bytes for the global samples. A browser reader can start with a 16 KiB header request and perform additional metadata or directory requests. Do not convert these payload ratios into page-speed or billing claims without browser measurements.

The Tobago result is useful: a small GeoJSON request can beat a cold, dedicated tile archive. Do not create a separate PMTiles file for every small country merely to eliminate the GeoJSON extension. Pack tiles by useful theme and update cadence, and retain efficient small feature responses where appropriate.

At each global prototype's maximum zoom, decoded tiles retained all 8,091 expected jurisdiction IDs. County FIPS properties retained their five-character strings. The detailed TTO prototype retained its country and all 16 regional IDs. These checks establish identity retention. They do not certify every island component, shared-edge topology, nearest-contact accuracy, or device performance.

A representative command was:

```bash
TIPPECANOE_MAX_THREADS=4 tippecanoe \
  --output=boundaries.pmtiles \
  --minimum-zoom=0 --maximum-zoom=10 \
  --no-feature-limit --no-tile-size-limit \
  --no-tiny-polygon-reduction \
  --no-simplification-of-shared-nodes \
  --named-layer=countries:countries.geojsonseq \
  --named-layer=regions:regions.geojsonseq \
  --named-layer=counties:counties.geojsonseq
```

The newline-delimited inputs preserve geometry and selected properties. Each feature also declares its layer's minimum zoom in Tippecanoe metadata. Input hashes, archive hashes, sampled bounds, and exact settings are in the measurement record.

## Comparison of delivery approaches

| Approach | Appropriate use here | Main tradeoff | Decision |
| --- | --- | --- | --- |
| Generated GeoJSON in Git and Amplify | Small fixtures and authored geographic data | Bulk changes enlarge checkouts, history, and application releases | Stop using this for Pins publication |
| GeoJSON or JSON on S3 and CloudFront | Selected routes, records, compact result indexes, small country responses | Large files are still downloaded and processed as a whole | Keep and expand this existing pattern |
| TopoJSON on the data CDN | Compact whole-country boundaries with shared topology | Requires conversion for MapLibre GeoJSON sources and still loads the chosen file | Useful alternative for small whole-feature views |
| PMTiles on S3 and CloudFront | Stable country, regional, and county display geometry | Adds a reader and tile-production checks; range requests still incur requests | Preferred direction for large Pins boundaries |
| Individual `{z}/{x}/{y}.mvt` objects on S3 | Consumers that need standard tile URLs without a PMTiles reader | More objects, uploads, publication coordination, and cleanup | Viable second choice |
| FlatGeobuf | Lossless feature downloads selected by bounding box | Needs an adapter and is not a zoom-dependent display pyramid | Consider for source access or precise selected geometry |
| GeoParquet | Offline analytics and reproducible geographic processing | Does not directly replace a MapLibre vector source | Use when the analysis pipeline needs it |
| Managed tiles or a PostGIS tile service | Frequent spatial edits, server-side queries, permissions, or SQL-driven tiles | Introduces ongoing service operations or vendor dependence | Not required for the current static Pins data |

TopoJSON stores common boundary arcs once. FlatGeobuf provides an optional spatial index for feature access. GeoParquet targets geospatial data in Parquet. They solve different parts of the pipeline. None alone makes the current MapLibre GeoJSON source request zoom-dependent. [TopoJSON specification](https://github.com/topojson/topojson-specification), [FlatGeobuf](https://flatgeobuf.org/), [GeoParquet](https://geoparquet.org/).

Martin can serve tiles from databases and archives when a service becomes necessary. Direct PMTiles reads avoid adding such a service for static objects. Git LFS would change artifact storage in the development workflow, but would not provide viewport selection or remove browser tiling costs. [Martin documentation](https://maplibre.org/martin/), [PMTiles delivery](https://docs.protomaps.com/pmtiles/cloud-storage).

## Comparison with the existing projects

### Pins

Pins is the first migration target. Its source snapshots and numerical verification are useful and should remain. Its generated geometry should move out of Git. Replace heavy display inputs with vector sources, while retaining complete JSON indexes for search and ranking.

Start with an administrative archive and a separate U.S. county archive. Keeping counties separate prevents hidden county geometry from inflating every administrative tile. Split country and regional archives further only if their zoom profiles or release cadence justify it. Do not adopt the prototype's maximum zoom as a production setting without testing tiny jurisdictions and selected boundary contacts.

[`installPinLayers`](../../src/features/pins/mapLayers.ts) currently creates GeoJSON sources, and [`mapRenderer`](../../src/features/pins/mapRenderer.ts) calls `setData` on them. A tile migration therefore needs a source descriptor and vector layer configuration. Changing the data URL alone is insufficient. Preserve the existing globe, selected-circle behavior, visibility controls, recovery, and country filtering.

### Temperature Records

The generated UI records already use [`data.rsmb.tv`](../../src/features/temperatures/constants.ts). The [resource hooks](../../src/features/temperatures/hooks/useTemperatureData.ts) load independent products on demand. This is appropriate for changing point records and complete record tables.

Keep these products as JSON. Do not tile the record table solely because it contains coordinates. Extract a shared, versioned state-context dataset rather than keeping a dependency on `/data/flights/usStates.geojson`. Any shared product needs an explicit source date, IDs, and water-boundary policy.

### Tornado Tracks

The [existing pipeline](../../projects/tornado-tracks/readme.md) keeps generated data out of Git and publishes yearly tracks to S3. It separates geometry from chart aggregates. Current filtered Trends uses `trend-index.json`; it does not need to reconstruct all historical charts from track downloads.

Preserve that separation. A single selected year's GeoJSON can remain reasonable. Tile historical track geometry if broad year ranges become a measured browser problem. Keep aggregate JSON as the source of complete statistics. Preserve the SVG fallback, which currently consumes geometry rather than a viewport's partial tiles. Consider archives divided by historical update cadence instead of rebuilding every year for a current-year update.

The [sync workflow](../../.github/workflows/sync-tornadoes.yml) uploads summaries and GeoJSON in separate passes and invalidates the tornado prefix. Local staging is careful, but sequential remote uploads do not form one atomic multi-object release. A versioned release prefix and a manifest published last would improve consistency across data products.

### Trips and ADV Atlas

Trips provide the closest existing model for artifact ownership: [private originals](../../infra/trip-assets.tf), processed public derivatives, [fingerprinted immutable photographs](../../scripts/publish-trip-assets.js), and small manifests in the application.

Keep selected route GeoJSON on the CDN. The available route files are small enough that a tile service would add little value. [`useTripRoute`](../../src/features/trips/useTripRoute.ts) already shares requests, aborts unused pending work, and bounds settled cache entries.

ADV Atlas combines full route inputs through [`RouteReader`](../../src/pages/AdvAtlas.tsx). As the number of trips grows, publish a lightweight overview route per trip and load full tracks after selection. This can postpone tiling while preserving per-day route detail. Apply the existing content-hash publication pattern to route revisions as well as photographs.

### Flights

Flights uses Three.js through `react-globe.gl`, rather than MapLibre for its globe. Its [CARTO raster tiles](../../src/features/flights/components/FlightsGlobe.tsx) are already requested directly from the provider. Its [optional airport and state layers](../../src/features/flights/hooks/useFlightMapLayers.ts) load only when needed.

Keep small flight records and airport points as JSON or GeoJSON. The airport catalog has only 4,371 features and compresses to about 235 KiB. Introducing vector-tile decoding into the Three.js globe is not justified by that size.

The [sync workflow](../../.github/workflows/sync-flights.yml) force-adds four generated GeoJSON files despite their ignore rule. Keep the authored or imported flight CSV history if it is useful. Publish generated derivatives to S3 or create them as build artifacts. This removes unnecessary generated-data commits and avoids coupling every data refresh to an application release.

The [state generator](../../projects/flights/scripts/generateUSStates.js) reads an unversioned GitHub `master` URL. Publish that contextual boundary product with a pinned source and checksum. Do not silently equate its generalized state context with Pins' Census jurisdiction geometry.

### Pirsig

[Pirsig's README](../../../pirsig/README.md) describes private records in PostgreSQL and a provider-hosted OpenStreetMap raster basemap. That is a different requirement. Keep private records behind the authenticated application API. Public static boundary archives are not a replacement for that database or authorization model.

## Reusing S3 and CloudFront

[`temperature-data.tf`](../../infra/temperature-data.tf) already defines the shared public derivative bucket, CloudFront Origin Access Control, HTTPS delivery, and `data.rsmb.tv`. The CSP already permits that origin. New map artifacts can reuse this service without adding a new hosting provider.

A live request with `Range: bytes=0-126` and the website's `Origin` returned `206 Partial Content` for temperature county records, the 2025 tornado tracks, and the Boise route. Each response contained exactly 127 bytes and a valid `Content-Range`. The responses also exposed ETag and Content-Length through CORS. This confirms useful capabilities on existing objects. Validate the actual PMTiles object after publication as well. CloudFront supports caching partial responses from S3. [AWS range request behavior](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RangeGETs.html).

The configuration needs the following changes for a durable tile publication path:

1. Use a versioned object prefix such as `maps/pins/releases/<content-hash>/`. The distribution currently ignores query strings, so `?v=<hash>` is not a reliable CloudFront version key.
2. Add a cache behavior for immutable release objects. The current default edge TTL is capped at one day. Keep a mutable manifest on a separate short-cache path.
3. Serve `.pmtiles` as binary data without whole-object `Content-Encoding: gzip` or Brotli. The tile payloads inside the archive can remain compressed. Byte offsets must continue to refer to the stored archive bytes.
4. Preserve Range and If-Match support. Existing wildcard allowed headers and exposed ETag meet the documented PMTiles CORS baseline. Expose Content-Range and Accept-Ranges as well for diagnostics and broader clients.
5. Add a narrowly scoped Pins publication role using the existing [GitHub OIDC pattern](../../infra/github-actions.tf). The existing temperature and tornado roles do not authorize an arbitrary new Pins prefix.
6. Upload and verify immutable objects before publishing the small manifest that references them. Retain older release objects for rollback and supported cached clients.

Use an explicit no-compression behavior or equivalent safeguards for the binary archive. Do not apply that policy to ordinary JSON, which should still benefit from HTTP compression. Test cache and range behavior at the CDN endpoint, not only against S3. [PMTiles cloud storage configuration](https://docs.protomaps.com/pmtiles/cloud-storage), [CloudFront compression](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html).

A possible object layout is:

```text
data.rsmb.tv/maps/pins/manifest-v1.json
data.rsmb.tv/maps/pins/releases/<content-hash>/
  manifest-v1.json
  admin.pmtiles
  us-counties.pmtiles
  country-pins.json
  region-pins/CAN.json
  county-pins/08.json
  provenance.json
```

The manifest should declare its schema version, release ID, artifact URLs, checksums, layer names, coverage counts, source provenance, and tile profiles. All referenced products should belong to the same release. Keep an immutable copy of each manifest inside its release prefix. Rollback can then restore that manifest at the mutable entry point. Keep result indexes small and split U.S. county results by state if measurements justify it.

Register the PMTiles protocol once through the shared MapLibre infrastructure. Load its dependency with the relevant map route. Preserve string jurisdiction IDs with `promoteId` and explicit `source-layer` names. Share the protocol cache across simultaneous maps without allowing one component's cleanup to remove a protocol still used by another map. [PMTiles React integration](https://docs.protomaps.com/pmtiles/maplibre).

Keep CARTO separate. Its standard basemap terms prohibit server-side proxying or caching. Continue the current direct browser requests. Upload your own redistributable geographic artifacts to S3 rather than mirroring CARTO tiles. [CARTO basemap terms, acceptable use](https://www.carto.com/legal/basemap-terms/).

## Cost and operational tradeoffs

At the current US East 1 S3 Standard rate of $0.023 per GB-month, a hypothetical 0.1 GB archive costs about $0.0023 per month for storage. One million S3 Standard GET requests cost $0.40 before applicable allowances. A range request counts as a request; a single archive does not mean a single chargeable fetch. CDN requests, transfer, versions, and source storage are separate inputs. [AWS public S3 price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json), [S3 pricing](https://aws.amazon.com/s3/pricing/).

CloudFront now offers both pay-as-you-go pricing and flat-rate plans. Its published Free flat-rate plan lists 1 million requests and 100 GB of transfer per month. These are plan allowances, not an established allowance for this account or distribution. Compare actual requests, regions, cache hits, and the account's current plan before projecting a bill. [CloudFront plans](https://aws.amazon.com/cloudfront/pricing/), [pay-as-you-go pricing](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/).

Cloudflare R2 is a viable alternative if data egress becomes the deciding factor; its standard pricing has no Internet egress charge. The existing AWS bucket, domain, access control, and publication jobs make S3 and CloudFront the lower-change starting point here. Revisit providers with observed traffic rather than moving them solely to store tens of megabytes. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

For this project, repository ownership, browser work, cache consistency, and reproducibility matter more than the storage charge for one boundary archive. Keep actively served tiles in a storage class that supports immediate reads. Archival policies for private originals serve a different purpose.

## Implementation order and acceptance criteria

1. **Separate publication from the application.** Add a Pins manifest and data-base override using the existing CDN pattern. Upload versioned data and verify it before changing the frontend. Replace the full-publication frontend fixtures with small curated cases while keeping exhaustive coverage checks in the data publication job.
2. **Remove generated bulk files from future commits and application builds.** Preserve source contracts and generators. Keep an ignored cache for local regeneration. Maintain legacy GeoJSON URLs or redirects to CDN copies during the transition for supported cached clients. Retain access to the previous publication during the rollout. Do not rewrite Git history as part of this migration.
3. **Introduce the administrative tile source.** Eliminate the full world GeoJSON request in a selected-country view. Preserve source-compatible IDs, country filters, globe projection, and the rule that a country outline must not conflict with visible province outlines.
4. **Introduce county tiles and reduce dynamic geometry work.** Load county display data only while needed. Limit circle and spoke generation to relevant pins. Keep complete statistics in numeric indexes.
5. **Apply selected improvements to the other projects.** Move Flights derivatives out of Git. Version the shared state-context product and route revisions. Keep Temperature JSON and Tornado aggregates. Tile other geometry only when its measured use requires it.

Before a tiled release becomes the default, check:

- Exact jurisdiction IDs and preserved FIPS strings at each layer's intended finest zoom.
- Tiny jurisdictions, island components, enclaves, shared borders, and date-line behavior. The existing Tobago regression is a required case, alongside Vatican City, Fiji, and Alaska.
- Selected circle and contact alignment against the calculation source within an explicit display-error budget. The local maximum-zoom identity tests do not replace this check.
- World, Canada, Colorado counties, and Tobago browser transfers, parse/decode work, retained memory, and rendering on a real phone. Compare cold and warm visits with equivalent cameras and layers.
- CDN `206` responses, byte counts, CORS, ETag exposure, absent whole-object content encoding, and cache reuse for the actual versioned archive.
- Recovery from a missing manifest or archive, a failed tile, stale data, a background style reset, and graphics loss. Ranking and search should remain usable during a boundary failure.
- A rollback using the previous manifest and its still-available immutable objects.

Tiling does not update an obsolete administrative division or improve the survey quality of Natural Earth. Source review and higher-quality country adapters remain separate work. The delivery design should make those updates easier to publish without adding their generated geometry to Git.
