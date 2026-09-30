# Trip story template

Copy this template into a Google Doc. Replace each prompt in square brackets.
Delete instructions and unused sections before publication.

The site gets the story title from the Google Sheet. Do not repeat that title in the document body.
Use Heading 2 for chapters and Heading 3 for sections within a chapter.
Use Subtitle for a distance line below a heading. A subtitle does not appear in the table of contents.

---

[Describe an event, location, or problem from the trip. Use two to four short paragraphs.]

[Explain when the trip occurred and why you took it. Do not repeat the trip facts unless the story needs them.]

{{trip-map}}

## Before leaving

[Explain the reason for the trip. Include preparation details that affected the trip.]

[Describe the motorcycle, luggage, weather, or route restrictions if these details help explain the story.]

{{trip-photo:departure-photo-id}}

## Day 1: [Origin] to [Destination]

[Optional distance line. Apply the Google Docs Subtitle style to this paragraph.]

[Describe the road, weather, landscape, or an event.]

[Explain an important decision or change and its result.]

{{trip-photo:day-one-photo-id}}

[Continue the story after the photo. Explain what happened next.]

## Day 2: [Origin] to [Destination]

[Optional distance line. Apply the Google Docs Subtitle style to this paragraph.]

[Describe what changed overnight or what the next route segment required.]

{{trip-map:day-two-stop-id}}

[For a track map, replace the preceding shortcode with the following shortcode. Delete this instruction.]

{{trip-map:track:YYYY-MM-DD-day-two}}

[Explain why the location or route segment matters.]

[Describe the main event from this day. Use only details that you recorded or remember.]

{{trip-gallery:day-two-gallery-id}}

[Explain what happened after these events. Do not repeat each photo caption.]

## Day 3: [Origin] to [Destination]

[Add this chapter if the day needs a separate section. Combine route segments when that structure is clearer.]

### [Optional event or place]

[Use Heading 3 for this section.]

{{trip-photo:scene-photo-id}}

## The main event

[Describe the most important decision, failure, repair, weather event, road, or destination. Put the event in time order.]

{{trip-map:turning-point-stop-id}}

[Explain the result and what changed afterward.]

## The ride home

[Describe the return trip. Explain what was different.]

{{trip-photo:return-photo-id}}

## After the trip

[Explain what you remember and what you would change. Identify details from records separately from details from memory.]

[End with a specific event, observation, or result.]

{{trip-gallery:final-highlights}}

---

## Author checklist

Delete this section before publication. Use the [authoring guide](TRIP-AUTHORING-README.md) for commands and file rules.

### Google Sheet

- `slug`: `[trip-slug]`
- `title`: `[Public title]`
- `date`: `[Publication date]`
- `description`: `[One sentence for the preview]`
- `tags`: `Motorcycles, Travel, [places]`
- `google_doc_id`: `[Document URL or ID]`
- `published`: `false` until all publication checks pass
- `format`: `trip`
- `trip_id`: `[Manifest ID]`

### Source and asset checks

- [ ] Confirm the Drive folder at `rsmb.tv/trips/[trip-id]/`.
- [ ] Keep original, selected, and processed photos in their specified directories.
- [ ] Keep original and processed GPS files in their specified directories.
- [ ] Run `npm run prepare-trip-assets`.
- [ ] Review `asset-metadata.json` and each processed photo.
- [ ] Remove private locations from the route source.
- [ ] Back up original files to the private S3 bucket.
- [ ] Check the manifest at `src/content/trips/[trip-id].json`.
- [ ] Check each hero, photo, gallery, stop, and track reference.
- [ ] Compare manifest track IDs with the route GeoJSON.
- [ ] Verify photo dimensions and alt text.
- [ ] Verify captions and dates.
- [ ] Upload the processed assets.
- [ ] Confirm that each public asset URL is available.

### Document checks

- [ ] Replace unknown distances and placeholder text.
- [ ] Verify day numbers and trip facts.
- [ ] Confirm that subtitles use the Subtitle style.
- [ ] Confirm that the table of contents contains only section headings.
- [ ] Open each heading link.
- [ ] Test the story at desktop and phone widths.
- [ ] Test gallery controls with a keyboard.
- [ ] Delete the author checklist and all remaining instructions.
