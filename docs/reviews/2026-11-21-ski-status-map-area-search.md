# Ski status map area search

Pan and zoom to examine a region. Apply a map area to set the geographic scope for comparison and sharing. The area control shows the preview count. The results identify the applied area. The control sits at the upper left. Resort names and terrain stay visible in the center.

## Research and product patterns

| Pattern | Where it works | What it means for ski-status |
| --- | --- | --- |
| Explicit search after moving the map | Waze documents panning or zooming to the desired region, then tapping **Search this area**. This suits a person who knows when they have framed the right place. | Keep the familiar action and show its effect before the click. [Waze search help](https://support.google.com/waze/answer/6262563) |
| Results follow the view | Redfin documents seeing listings automatically while zooming into a neighborhood. It outlines a selected place and gives the user a way to clear it. | Automatic updates help people browse inventory continuously. A fixed region preserves the comparison across zoom levels, list views, and shared links. [Redfin map search](https://support.redfin.com/hc/en-us/articles/360001432632-Searching-for-Homes) |
| Extent filtering as an opt-in mode | ArcGIS Experience Builder allows a table to follow the current map extent. Its documentation describes safeguards when changes in filtered data can also move the map. | Fit results and area search have different jobs. Keeping the area explicit avoids a feedback loop when a search, a resort selection, or Fit results moves the camera. [Esri table widget](https://developers.arcgis.com/experience-builder/guide/table-widget/#settings) |

Nivala, Brewster, and Sarjakoski’s web map usability study found that people were unsure whether searches covered the area on screen. Participants also encountered controls that obscured the map and had difficulty understanding which criteria shaped their results. The products in the study date to 2007. The questions about scope, feedback, and obstruction remain directly relevant to the ski-status map. [Usability Evaluation of Web Mapping Sites](https://www.dcs.gla.ac.uk/~stephen/papers/Nivala_et_al_TCJ.pdf)

Baymard’s retail research recommends a preview and a visible control to clear an applied filter. The research covers product lists. For ski-status, show the count next to the area action. Keep **Map area** visible in the applied filters across views. [Baymard filter controls](https://baymard.com/blog/ecommerce-filter-ui), [Baymard applied filters](https://baymard.com/research-articles/how-to-design-applied-filters)

## Interaction

| Situation | What the user sees and can do |
| --- | --- |
| Exploring without an applied area | **Search this area** shows the number of matching ski areas in view. The count uses current names, passes, locations, and operating status. |
| Panning or zooming | The action waits for the camera to settle. Results keep their current area. The preview then counts the new view. |
| Applying the visible area | **Area applied** confirms the choice and shows the committed count. The map stays where the user framed it. The confirmation survives a layout change when an applied filter appears in the header. |
| Moving away from an applied area | **Update area** previews the new view. The **Map area** filter still identifies the geography used by Results and Compare. |
| Few or zero matches | The preview says when the visible area has no matches. Applying a zero-match area is useful when the user intends to adjust a pass or status filter within it. The empty results panel offers **Clear map area**. |
| Waiting for live reports | A status-based preview says **Checking reports** while the conditions request is pending. The area action can still set the desired geography. |

The preview and committed results use the same area membership rule. The app checks both a resort’s mapped point and its visitor base when it has one. It samples the visible perimeter on the globe, so the area can cross the date line. The chosen perimeter is stored with the search. A phone can open a link created on a wider screen and keep the same geography. Changing the camera updates the view, and applying or clearing the area makes a separate history entry.

The preview count is the button’s accessible description. The applied count uses the existing live results summary so an update can be announced without moving focus. Applying the area keeps focus on its confirmation. Clearing it from the map returns focus to the area action. The controls use at least 44 CSS pixels for touch targets, and the preview remains available without hovering. [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [W3C enhanced target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

## Verification

Chromium checks at phone, landscape, and desktop sizes covered these flows with a local basemap fixture. The area control also passed the automated accessibility check.

- Moving from the Wasatch to Colorado updates the preview. Applying the new area updates the shortlist. Back and Forward restore each area and its map position.
- A pass-filtered search keeps its applied geography in Compare and when opened at another screen width. The preview agrees with the result count at the time of application.
- An empty area can be cleared from phone Results while keeping the name query, pass filter, and map position.
- The 320-pixel and landscape layouts keep the area action and Clear beside the other controls. In the short landscape layout, the confirmation stays visible when adding the filter chip resizes the map. The layer panel leaves both area controls accessible.
