# Trip Story Template

Use this document as a reference or copy it into a new Google Doc. Replace text inside square brackets, then remove all instructions and unused sections before publishing.

Do not add the final story title as a Heading 1 in the body. The title comes from the Google Sheet and is rendered above the hero photograph automatically.

---

[Open with a specific scene, image, decision, or problem from the trip. Give the reader a reason to continue before explaining the itinerary. Aim for two to four short paragraphs.]

[Briefly establish when the trip happened, who was there, what motorcycle you rode, and why you set out. Do not repeat facts already shown beneath the hero unless they matter to the story.]

{{trip-map}}

## Before Leaving

[Explain the origin of the trip. What were you hoping to find, test, escape, revisit, or accomplish? Include only preparation details that affect what happens later.]

[Optional paragraph about the motorcycle, luggage, weather forecast, route constraints, or historical context.]

{{trip-photo:departure-photo-id}}

## Day 1: [Origin] to [Destination]

[Begin with movement or a concrete moment. Describe the road, weather, traffic, landscape, or your physical state without turning the section into a list of highways.]

[Introduce the day's meaningful decision, surprise, setback, encounter, or discovery. Explain why it mattered.]

{{trip-photo:day-one-photo-id}}

[Continue the story after the image. A photograph should not replace the part of the experience that only you can explain. End with a transition or changed expectation.]

## Day 2: [Origin] to [Destination]

[Open with what changed overnight or what the next leg demanded.]

{{trip-map:day-two-stop-id}}

[Describe why this location or route segment matters. The focused map is useful only when geography helps the reader understand the choice or event.]

[Tell the central scene from this day. Include specific sensory details, dialogue, or observations where they are genuinely remembered.]

{{trip-gallery:day-two-gallery-id}}

[Add a short reflection or transition after the gallery. Avoid describing every image when the captions already provide the necessary context.]

## Day 3: [Origin] to [Destination]

[Repeat the daily structure only if it serves the story. Trips do not need one chapter per calendar day; combine uneventful legs and split complicated days into meaningful scenes.]

### [Optional Scene or Place]

[Use Heading 3 for a substantial scene within a chapter.]

{{trip-photo:scene-photo-id}}

## The Turning Point

[Optional thematic chapter for the trip's most important decision, failure, repair, weather event, road, destination, or encounter. Place it where it occurred chronologically.]

{{trip-map:turning-point-stop-id}}

[Explain the consequence. What changed afterward?]

## The Ride Home

[Do not rush the return unless that is emotionally accurate. Describe what felt different after the trip's central events.]

{{trip-photo:return-photo-id}}

## Looking Back

[Write from the present. What has remained vivid? What did you misunderstand at the time? What would you repeat or change? For an old trip, distinguish clearly between what you recorded then and what you remember now.]

[End on a concrete image, observation, or consequence rather than a generic summary.]

{{trip-gallery:final-highlights}}

---

## Author's Pre-Publish Notes

Delete this section before publishing.

### Google Sheet

- `slug`: `[trip-slug]`
- `title`: `[Final public title]`
- `date`: `[Publication date]`
- `description`: `[One compelling sentence for previews and search]`
- `tags`: `Motorcycles, Travel, [places or themes]`
- `google_doc_id`: `[This document's URL or ID]`
- `published`: `false`
- `format`: `trip`
- `trip_id`: `[trip-id matching the manifest]`

### Required Assets

- [ ] Drive folder exists at `rsmb.tv/trips/[trip-id]/`.
- [ ] Originals, selects, and processed photographs are in their respective directories.
- [ ] Original and processed GPS files are in their respective directories.
- [ ] `npm run prepare-trip-assets` has completed and `asset-metadata.json` has been reviewed.
- [ ] Every processed photograph has been visually reviewed.
- [ ] The processed route has been inspected for private locations.
- [ ] Untouched originals have been archived in the private S3 source bucket.
- [ ] Trip manifest exists at `src/content/trips/[trip-id].json`.
- [ ] Hero photograph exists and is referenced by the manifest.
- [ ] Every `trip-photo` ID exists in the manifest.
- [ ] Every `trip-gallery` ID exists in the manifest.
- [ ] Every focused `trip-map` stop ID exists in the manifest.
- [ ] GeoJSON route exists at the manifest path.
- [ ] Processed photographs and route files have been uploaded to `data.rsmb.tv`.
- [ ] Images have intrinsic width and height values.
- [ ] Alt text describes meaningful visual content.
- [ ] Captions add context instead of repeating alt text.
- [ ] Private GPS locations and image metadata have been reviewed.
- [ ] The story has been previewed on desktop and mobile.
