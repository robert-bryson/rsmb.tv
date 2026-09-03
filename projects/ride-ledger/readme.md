# Ride Ledger: Product and Technical Design

- Status: discovery and design
- Research date: 2026-08-16
- Working title: Ride Ledger

Do not start implementation until the source-data decisions in this document are complete. Do not put source spreadsheet exports, receipt images, or generated archives in this repository. See the private project data rules in the repository README.

## Executive recommendation

Build a private, mobile-first progressive web app for recording fuel, maintenance, expenses, and meaningful rides. The primary interaction is a quick entry made at a gas pump or in a garage, not a dashboard or map.

The current Google Sheet should be treated as an import and export format rather than the application's database. It mixes raw observations with derived values, duplicates metric and imperial measurements, and cannot reliably represent partial fills, missed fills, tire changes, or maintenance due by both date and odometer.

The product should have these defining qualities:

- A fill-up can be recorded one-handed in less than 30 seconds.
- Raw values are saved in the units and currency printed on the pump or receipt.
- Conversions and lifetime statistics are calculated, never copied into editable fields.
- Fuel-economy results disclose whether they are exact, provisional, or invalid.
- Maintenance is tied to the motorcycle's actual odometer and calendar age.
- Tire history treats front and rear tires as independent components.
- The app works without a signal and synchronizes later.
- All data can be exported in an open, documented format.

This should be a separate private application, eventually linked from rsmb.tv through a public project page. The current rsmb.tv deployment is a static Vite site with no authenticated write path, so putting personal records directly into it would create the wrong security and deployment boundary.

## Product framing

### Core jobs

1. At a fuel stop, capture enough information to calculate trustworthy economy and cost without doing conversions by hand.
2. Before a ride, see whether tires, chain, fluids, or scheduled service need attention.
3. In the garage, record work performed, parts used, cost, notes, and the next due point.
4. Over time, understand distance ridden, operating cost, fuel economy, tire life, and maintenance history.
5. Preserve a complete, portable ownership record for troubleshooting or resale.

### Primary user contexts

- **At the pump:** bright light, gloves nearby, weak connectivity, receipt in hand, very little patience.
- **In the garage:** dirty hands, more time, detailed service and parts information available.
- **Before a ride:** quick safety and due-status check.
- **At home:** review trends, correct records, import data, and export backups.

### Non-goals for the first release

- Continuous GPS ride recording
- Social feeds, leaderboards, or public profiles
- Community fuel-price crowdsourcing
- Shop inventory or fleet management
- Automatic receipt OCR
- Predictive maintenance claims
- Turn-by-turn navigation; Through Routes already owns route planning

## Research synthesis

The established products converge on a common baseline:

| Product | Useful pattern | Design implication |
| --- | --- | --- |
| Fuelly | Very simple fill-up entry, longitudinal fuel economy, real-world comparison | Keep capture minimal and make trends legible |
| Fuelio | Full-tank calculation, fill-ups and expenses in one timeline, GPS station, reminders, CSV backup | Model fill completeness explicitly and keep data portable |
| Drivvo | Fuel, service, expenses, routes, reports, date/odometer reminders, offline use | Use one vehicle history and dual-trigger maintenance rules |
| Simply Auto | Dashboard, service reminders, receipts, scheduled reports, per-entry units, multi-device sync | Preserve source units and support attachments later |
| Road Trip | Vehicle-specific trip cost estimates and local currencies | A future ride-planning estimate can consume observed economy |

The differentiator should not be a larger feature list. It should be a motorcycle-specific model with honest calculations, excellent pump-side entry, first-class tire and chain history, and easy movement between Canadian and US fuel records.

## What the spreadsheet contains

Current headers:

```text
Date, KM, Miles, Total $CAD, Total $USD, L., Gal., Location,
$USD/gal., LT mi., LT MPG, LT. km, LT l., LT l./100km,
City, State, Country, Tires
```

### Column disposition

| Sheet column | Import meaning | Application treatment |
| --- | --- | --- |
| Date | Fill-up date | Store as local date and optional local time |
| KM | Odometer or distance, to confirm during import | Store one canonical odometer reading with its entered unit |
| Miles | Conversion of KM or alternate reading | Derive; never ask for both |
| Total $CAD | Converted or paid total | Store only if it was the transaction currency; otherwise derive using a saved rate |
| Total $USD | Converted or paid total | Same rule as CAD |
| L. | Fuel volume | Store the entered quantity and unit |
| Gal. | Converted US gallons | Derive from liters unless gallons were entered at the pump |
| Location | Station name or free-form place | Store as station name; keep address fields separate |
| $USD/gal. | Unit price | Derive from paid total and volume, or use it to validate an imported row |
| LT mi. | Lifetime distance | Derive from odometer baseline |
| LT MPG | Lifetime economy | Derive from valid full-tank intervals |
| LT. km | Lifetime distance | Derive from odometer baseline |
| LT l. | Lifetime fuel | Derive from fuel records |
| LT l./100km | Lifetime consumption | Derive from valid full-tank intervals |
| City | Location | Store as structured station address |
| State | Region | Store as region/province code plus display name |
| Country | Country | Store ISO 3166-1 alpha-2 code; use for unit/currency defaults only |
| Tires | Tire note or set, to confirm during import | Migrate to front/rear tire installation records |

The importer must show a column-mapping preview because `KM` could mean odometer or distance since the previous fill. It must not guess silently.

## Data and calculation rules

### Preserve observations, derive interpretations

Each fill-up stores:

- Odometer value and entered unit
- Fuel quantity and entered unit
- Transaction total and transaction currency
- Whether the tank was filled completely
- Whether the previous fill-up was missed or uncertain
- Station name and optional structured location
- Transaction date and optional time
- Optional fuel grade, notes, and receipt
- Optional exchange rate, rate date, and rate source

It does not store editable copies of miles, gallons, MPG, liters per 100 km, or normalized totals.

### Unit conversions

Use constants in one tested domain module:

$$
\text{miles} = \text{kilometres} \times 0.621371192237
$$

$$
\text{US gallons} = \frac{\text{litres}}{3.785411784}
$$

$$
\text{Imperial gallons} = \frac{\text{litres}}{4.54609}
$$

The UI must always label `US mpg` or `Imp mpg`; an unlabeled `MPG` is ambiguous. Since the sheet uses `$USD/gal.`, imported gallons should default to US gallons but require confirmation during import.

### Full-tank fuel economy

Fuel consumed cannot be inferred from a single fill-up. The first full fill establishes a baseline. At the next full fill:

$$
\text{distance} = \text{current odometer} - \text{previous full-fill odometer}
$$

$$
\text{fuel consumed} = \sum \text{fuel added after the previous full fill through the current full fill}
$$

$$
\text{L/100 km} = 100 \times \frac{\text{litres consumed}}{\text{distance in km}}
$$

$$
\text{US mpg} = \frac{\text{distance in miles}}{\text{US gallons consumed}}
$$

Partial fills accumulate and remain provisional until the next full fill. A missed fill breaks the interval; the app should show no economy value rather than a precise-looking false value. Editing or deleting a historical fill recalculates all affected later intervals.

Lifetime economy is weighted from valid intervals:

$$
\text{lifetime L/100 km} = 100 \times \frac{\sum \text{valid interval litres}}{\sum \text{valid interval kilometres}}
$$

Do not average individual MPG or L/100 km values.

### Currency

- Preserve the paid amount and currency as the source of truth.
- Set the vehicle's reporting currency independently, initially CAD.
- Store each rate as reporting-currency units per one transaction-currency unit.
- Calculate the reporting amount as `paid amount × stored rate`. Use a rate of `1` when both currencies are the same.
- Save the full-precision rate, currency pair, effective date, and source. A provider update must not change a historical total.
- Default currency from location but let the rider override it before saving.
- Let imported rows provide both CAD and USD totals; select one as source and use the other as a validation check.
- Report nominal historical cost by default. Inflation-adjusted analysis is a later, explicitly labeled feature.

For CAD/USD automation, use an official daily rate source such as the Bank of Canada Valet API. When a transaction occurs on a weekend or holiday, use the latest prior published rate and display its date. Manual rates must remain possible for credit-card settlement or cash exchange differences.

Round only displayed and exported currency amounts to the currency's minor unit. Keep the stored amount and rate at full supported decimal precision. Do not convert a value that the system converted previously.

### Validation and confidence

Block impossible records:

- Odometer lower than the previous record, unless an odometer replacement/reset is documented
- Zero or negative volume or cost
- Unknown currency or incompatible quantity unit
- Full fill with no odometer

Warn but allow:

- Large odometer jump
- Economy far outside the vehicle's recent range
- Unit price inconsistent with total divided by volume
- Date earlier than a later existing record
- Duplicate date, odometer, and amount
- Location-country mismatch with currency or volume unit

Each calculated interval has one status:

- **Verified:** bounded by full fills with complete records
- **Pending:** waiting for the next full fill
- **Excluded:** missed fill, odometer reset, or explicit exclusion
- **Estimated:** imported history lacks enough source detail; never merge silently into verified totals

## Information architecture

Use a bottom navigation on narrow screens and a quiet left rail on desktop:

1. **Today** - due status, current odometer, recent economy, and quick actions
2. **History** - one chronological stream of fills, service, expenses, rides, and tire events
3. **Maintenance** - due items, schedules, completed work, and components
4. **Insights** - distance, economy, costs, fuel prices, and component life
5. **Garage** - motorcycle profile, odometer events, units, import/export, and settings

The first screen is the working dashboard, not a landing page.

### Today

Top to bottom:

- Vehicle switcher and current odometer
- Due-status band: overdue, due soon, or clear
- Large `Add` action opening a short command sheet: Fill-up, Service, Expense, Ride, Inspection
- Latest verified economy and rolling trend, with confidence label
- Upcoming maintenance ordered by urgency
- Recent history, limited to the last few events

Do not fill the screen with summary cards. Use a compact status band, aligned metrics, and a chronological list optimized for scanning.

### Add fill-up

The pump workflow should use a single page or bottom sheet:

1. Odometer, with the previous reading and delta shown beneath
2. Fuel quantity, defaulting from country/station history
3. Total paid and currency
4. `Filled tank` toggle, on by default
5. Station, suggested from recent locations with explicit permission before GPS use
6. Date/time, defaulting to now
7. Expandable details: fuel grade, missed previous fill, notes, receipt
8. Review line showing calculated unit price and any warnings
9. Save

The numeric keypad should remain open while advancing between numeric fields. Units and currency use compact selectors beside their values. Saving queues locally when offline and visibly confirms that state.

### History

Use a dense timeline rather than separate disconnected tables. Each row shows icon, event title, odometer, date, cost, and one relevant secondary value. Filters include event type, date range, odometer range, country, and tags.

Fuel rows show verified economy only when they close a valid interval. Service rows expand into tasks, parts, shop, labor, notes, and attachments. Corrections are edits with audit metadata, not duplicate compensating rows.

### Maintenance

Maintenance schedules support whichever threshold arrives first:

- Every distance interval, such as 6,000 km
- Every time interval, such as 12 months
- One-time due odometer or date
- Recurring seasonal checklist
- Manual condition-based item with no interval

Seed templates are editable and must be confirmed against the motorcycle's owner manual. Suggested motorcycle categories include:

- Engine oil and filter
- Chain clean, lubrication, slack, and adjustment
- Front and rear tire pressure, tread, age, installation, and removal
- Brake pads, discs, and fluid
- Coolant
- Air filter and spark plugs
- Battery
- Controls, lights, horn, fasteners, and stands
- Forks, shocks, steering head, and wheel bearings
- Registration, insurance, and inspection dates
- Seasonal storage and return-to-service checklist

Never present a generic interval as manufacturer guidance. The vehicle profile should record manual source, model year, and any rider-specific overrides.

### Tires and components

`Tires` deserves a component model, not a text field. Track front and rear independently:

- Brand, model, size, and optional serial or DOT date code
- Installed and removed date/odometer
- Purchase price and installation cost
- Starting and current tread depth
- Cold pressure target and optional pressure checks
- Removal reason: worn, puncture, age, damage, seasonal swap, or other
- Distance and days in service, derived automatically

The same component pattern can later support chain/sprocket sets, batteries, brake pads, and accessories without redesigning service history.

### Insights

Start with questions that lead to action:

- How far have I ridden this month, season, and year?
- Is verified fuel economy changing?
- What is fuel costing per 100 km and per month?
- What is total operating cost per kilometre, split by fuel, service, parts, insurance, and fees?
- How long did each front/rear tire last?
- Which maintenance is approaching by date or odometer?
- Where do I usually refuel, and what did I actually pay?

Charts should disclose sample size and exclude pending/invalid intervals. Maps are secondary: a simple station and visited-place map may be useful later, but GPS ride traces would introduce substantial battery, privacy, and storage scope.

## Domain model

Use IDs, decimal values serialized as strings at API boundaries, ISO dates, ISO currency codes, and canonical metric values for comparisons. Preserve the entered values alongside canonical values for editing and auditability.

Use a decimal arithmetic library for quantities, money, exchange rates, and aggregate calculations. Do not use binary floating-point arithmetic for stored values or financial totals. Define one rounding rule for each displayed and exported value, and test boundary cases.

```text
User
  id, reportingCurrency, locale, timezone

Vehicle
  id, ownerId, nickname, make, model, modelYear, vin?,
  distanceUnit, economyDisplay, currentOdometer, manualReference?

Event
  id, vehicleId, type, occurredAt, odometer, odometerUnit,
  notes?, attachments[], createdAt, updatedAt, syncVersion

FuelEvent extends Event
  quantity, quantityUnit, totalPaid, currency,
  fullTank, missedPreviousFill, fuelGrade?, stationId?,
  exchangeRate?, exchangeRateDate?, exchangeRateSource?, excludedReason?

ServiceEvent extends Event
  provider?, laborCost?, currency, tasks[], parts[], scheduleCompletions[]

ExpenseEvent extends Event
  category, amount, currency, recurringRule?

RideEvent extends Event
  endedAt?, endOdometer?, purpose?, routeReference?, tags[]

MaintenanceSchedule
  id, vehicleId, name, distanceInterval?, timeInterval?,
  nextDueOdometer?, nextDueDate?, source, enabled

Component
  id, vehicleId, type, position?, make, model, specification?, metadata

ComponentInstallation
  id, componentId, installedEventId, removedEventId?,
  installedOdometer, removedOdometer?, removalReason?

Station
  id, name, address?, city?, region?, countryCode, latitude?, longitude?
```

`Event` is the chronological source of truth. Aggregates and current due state are projections that can be rebuilt.

## Import design

Import is a guided, reversible operation:

1. Upload CSV exported from Google Sheets.
2. Detect headers and show encoding/date/decimal assumptions.
3. Map each source column to a known field or `Ignore`.
4. Confirm whether `KM` is odometer or trip distance.
5. Confirm whether `Gal.` means US or Imperial gallons.
6. Choose source currency when both CAD and USD values exist.
7. Preview normalized rows, warnings, duplicates, and computed checks.
8. Import into a temporary batch.
9. Review totals against the sheet.
10. Commit or roll back the entire batch.

Keep `sourceRowNumber`, `importBatchId`, and the original row payload until the import is accepted. Derived lifetime columns are useful for reconciliation but should not become source fields.

Export must support:

- A normalized CSV suitable for spreadsheets
- A complete JSON archive preserving entities, units, rates, and relationships
- A human-readable maintenance history PDF later
- Receipt and attachment download as a separate archive later

## Technical architecture

### Recommended boundary

Create a separate application and deployment, such as `rides.rsmb.tv`, with a public portfolio description in this repository only after the private app is usable.

The current rsmb.tv Vite/Amplify build emits static assets and has no authentication or server-side write API. Reusing its visual language and tested utility patterns is appropriate; reusing its deployment boundary is not.

### Suggested stack

- React and TypeScript, matching existing frontend experience
- A PWA shell with a service worker and installable manifest
- IndexedDB, through a small typed library, for local records and an outbox
- Schema validation shared between import, UI, and API
- An authenticated serverless API
- Managed identity with self-registration disabled for a private first release
- A durable database with conditional writes and automated backups
- Private object storage with short-lived signed URLs for receipts
- Infrastructure as code, logs, alarms, and a restore test

AWS is a natural fit with the existing operational tooling: Cognito for identity, API Gateway and Lambda for the API, DynamoDB for records, S3 for attachments/exports, and the existing dashboard patterns for health and cost visibility. A small relational database is also defensible if ad hoc reporting becomes more important than low-operations serverless storage; do not introduce both.

### Offline and synchronization contract

- Create UUIDs on the client so offline records are stable.
- Save locally first and append an idempotent mutation to an outbox.
- Show `Saved on this device` until the server acknowledges it.
- Send `recordId`, `baseVersion`, `mutationId`, and changed fields.
- Accept an update only when `baseVersion` equals the current server version. Return the current record when the versions differ.
- Scope each `mutationId` to the authenticated user. Store the result so a retry returns the first result and does not apply the mutation again.
- Show local and server values when an edit is stale. Let the rider select a value for each conflicting field before retry.
- Represent a synchronized deletion with a versioned tombstone so an offline client cannot restore the deleted record.
- Authorize every mutation against the authenticated owner on the server. Do not trust a client-supplied owner or vehicle identifier.
- Cache only the signed-in rider's data and clear local data explicitly on sign-out.

The MVP may begin local-first with manual encrypted JSON backup, but cloud synchronization is a release requirement before the app becomes the sole system of record.

### Security and privacy

- Keep the application private by default; no public vehicle or trip pages.
- Disable open sign-up. Require a passkey or multi-factor authentication. Define and test an account recovery procedure before release.
- Encrypt transport and managed storage; keep attachments private.
- Authorize each attachment request before the server creates a short-lived signed URL. An object key is not an access control.
- Request location only while adding a station and only after an explicit action.
- Store a station point, not background movement, for fuel entries.
- Decode and re-encode receipt images to remove metadata before storage. Reject an image when the service cannot verify this operation.
- Never put tokens, vehicle identifiers, or personal locations in URL query state.
- Remove sensitive values from logs, error reports, analytics, and infrastructure outputs.
- Maintain export and delete-account paths even for a single-user app.
- Back up data automatically and test restore, not only backup creation.

## Visual direction

The interface should feel like an instrument panel without imitating gauges or using novelty dashboard chrome.

- Light and dark themes with high outdoor contrast; default from the device.
- Neutral graphite, warm white, safety amber for due soon, red only for overdue/error, and a restrained teal or green for verified/current.
- Tabular numerals for odometer, volume, economy, and cost.
- A purposeful condensed display face for vehicle identity and a highly readable sans serif for controls and records.
- Stable, compact rows; 8 px or smaller corner radii; no cards nested inside cards.
- Familiar icons for fuel, wrench, receipt, tire/component, route, filter, and export, each with accessible labels/tooltips.
- Minimum 44 by 44 CSS-pixel touch targets and no action that depends on hover.
- No decorative map hero, oversized headings, or marketing copy inside the private app.

## Delivery plan

### Phase 0: validate the source data

- Obtain a CSV sample with representative Canadian and US rows.
- Resolve the meaning of `KM`, `Miles`, `Location`, and `Tires`.
- Identify partial fills, missing fills, odometer resets, and formula columns.
- Recalculate a sample of lifetime values independently and explain discrepancies.
- Write import fixtures and expected normalized output before building UI.

Exit criterion: at least 20 representative rows import with agreed units and reconciled totals.

### Phase 1: trustworthy fuel log

- Private sign-in and one motorcycle profile
- Offline-capable add/edit/delete fill-up workflow
- Full/partial/missed-fill model and confidence labels
- CAD/USD and L/US gal input with saved exchange rates
- Unified history
- Google Sheet CSV import preview, validation, and rollback
- CSV and complete JSON export
- Basic dashboard and verified economy/cost trends

Exit criterion: the sheet is no longer needed for new fill-ups, and exported data can recreate every record.

### Phase 2: maintenance and components

- Service and general expense events
- Date/odometer maintenance schedules and notifications
- Editable owner-manual schedule source
- Front/rear tire lifecycle
- Chain/sprocket and battery components
- Receipt attachments
- Operating cost and component-life insights

Exit criterion: upcoming work and complete service/tire history can be trusted without separate notes.

### Phase 3: rides and integration

- Manual ride summaries and tags
- Optional import of GPX/FIT ride files rather than background tracking
- Link saved Through Routes plans to completed ride records
- Trip cost estimates using observed verified economy
- Seasonal and annual summaries

Exit criterion: riding history adds value without making pump and maintenance workflows slower.

## MVP acceptance criteria

- A phone user can record a standard fill-up in under 30 seconds after initial setup.
- The app works offline and clearly distinguishes local from synchronized state.
- A partial fill does not produce a final economy value until a later full fill.
- A missed fill excludes the affected interval from verified aggregate economy.
- Every cost report can show source currency and reporting-currency conversion details.
- US and Imperial gallons are never displayed under the same unlabeled unit.
- Editing an older fill recalculates all dependent intervals deterministically.
- Maintenance can become due by date, odometer, or whichever threshold occurs first.
- Front and rear tires can have different installation/removal histories.
- CSV import is previewable and atomic; every import can be rolled back.
- A complete export is possible without vendor-specific software.
- No personal record or attachment is publicly accessible without authorization.

## Open decisions

1. Does `KM` contain the odometer reading or distance since the previous fill?
2. Is `Miles` always formula-derived from `KM`?
3. Is `Gal.` always a US gallon conversion?
4. Which of CAD or USD is the actual transaction amount on cross-border rows?
5. How are exchange rates currently selected?
6. What does each value in `Tires` represent: pressure, model, installation, or mileage?
7. Is there one motorcycle or should multi-bike support be present from the first schema version?
8. Are individual rides important to record, or does “riding” primarily mean odometer/fuel history?
9. Should the app remain strictly private or support sharing a redacted service record?
10. Which owner-manual maintenance schedule should seed the first vehicle?
11. Which identity service, authentication methods, and account recovery process meet the security requirements?
12. Do the confirmed query and reporting patterns require a relational database or DynamoDB?
13. Which hostname and AWS account will contain the private application?

## Research sources

- [Fuelly](https://www.fuelly.com/) - fill-up logging, longitudinal economy, reports, and real-world vehicle comparison
- [Fuelio](https://www.fuel.io/) - fill-ups, expenses, GPS station data, timeline, reminders, and device backup
- [Fuelio fuel-consumption FAQ](https://www.fuel.io/faq_fuel_consumption.html) - requirement for two full fills and the full-tank algorithm
- [Fuelio backup and import FAQ](https://www.fuel.io/faq_backup_help.html) - CSV import/export, local backup, and limited-scope cloud backup
- [Drivvo personal use](https://www.drivvo.com/en/personal-use/) - motorcycle support, unified history, offline use, reports, and date/odometer reminders
- [Simply Auto](https://www.simplyauto.app/) - service reminders, receipts, per-entry units, reports, backup, and multi-device sync
- [Road Trip](https://www.getroadtrip.app/) - vehicle-specific trip estimates, local fuel prices/currencies, and motorcycle support
- [Bank of Canada Valet API](https://www.bankofcanada.ca/valet/docs) - official exchange-rate data interface

Product pages describe vendor capabilities and may contain marketing claims. They inform interaction patterns, not implementation correctness. Fuel and maintenance calculations in this design must be covered by independent fixtures and tests.
