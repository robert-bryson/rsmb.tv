# Driving access rollout

November 22, 2026

The app shows reviewed approaches, mountain passes, parking entrances, and agency reports. The project guide describes the controls and current coverage. The task list tracks hosted checks and the next corridors. [Project guide](readme.md#driving-data-and-coverage), [Driving tasks](TODO.md#driving-map)

## Official sources and pilot corridors

| Corridor | Work to complete | Sources |
| --- | --- | --- |
| Snoqualmie and Stevens Pass | Check the structured WSDOT alert fields. Verify direction and mileposts at each resort exit. Check current parking rules for each Summit base and the Stevens Pass lots. | [WSDOT alerts](https://wsdot.wa.gov/traffic/api/Documentation/class_alert.html), [Road locations](https://wsdot.wa.gov/traffic/api/Documentation/class_roadway_location.html), [Summit parking](https://www.summitatsnoqualmie.com/parking-guide), [Stevens Pass parking](https://www.stevenspass.com/explore-the-resort/about-the-resort/getting-here-and-parking.aspx) |
| Whistler Blackcomb | Verify route coverage from both directions on Highway 99. Check access rules for Village, Blackcomb, and Creekside. Check each additional image source before display. | [DriveBC Open511](https://api.open511.gov.bc.ca/help), [Camera inventory](https://catalogue.data.gov.bc.ca/dataset/bc-highway-cams), [Municipal lots](https://www.whistler.ca/transportation/parking/where-to-park-in-whistler/), [Resort parking](https://www.whistlerblackcomb.com/explore-the-resort/about-the-resort/getting-here) |
| Alta and Snowbird | Compare a credentialed UDOT response with the official map. Verify uphill restrictions between Snowbird and Alta. Review SR 190 for the next Utah corridor. | [UDOT event API](https://www.udottraffic.utah.gov/help/endpoint/event), [Canyon closures](https://cottonwoodcanyons.udot.utah.gov/road-closures-uphill-restrictions/), [Traction rules](https://cottonwoodcanyons.udot.utah.gov/traction-law/) |
| Mt. Hood Meadows | Check a TripCheck sample and its terms. Verify north and south approaches on OR 35. Verify other public lot entrances. | [TripCheck API](https://tripcheck.com/Pages/API), [Source credit](https://tripcheck.com/Pages/Frequently-Asked-Questions) |
| Palisades Tahoe | Check I-80 and CA 89 sections against Caltrans road references. Keep Olympic Valley and Alpine arrivals separate. Verify California chain-control points and the time of each status. | [Caltrans lane closures](https://cwwp2.dot.ca.gov/lane-closure.html), [Chain-control fields](https://cwwp2.dot.ca.gov/chain-controls.html), [QuickMap](https://quickmap.dot.ca.gov/) |
| Colorado and other regions | Start with agency links and operator arrivals. Verify coverage and terms before you add a feed. Keep US 40 at Berthoud Pass and US 6 at Loveland Pass separate. | [CDOT winter travel](https://www.codot.gov/travel/winter-driving), [CDOT cameras](https://www.codot.gov/projects/statewidecameras), [NZTA Journey Planner](https://www.journeys.nzta.govt.nz/regions), [NZTA terms](https://www.journeys.nzta.govt.nz/about-this-site) |

## Route and report records

- Give each approach, public entrance, and pass a stable ID. Keep the roads and named passes in travel order.
- Record an empty pass list when the source confirms that the approach crosses no named pass. Omit the list when crossings need review. [Road records](research/road-approaches.json)
- Add the public vehicle entrance with its operator source and check date. Add a connector from the signed junction to the entrance. Record the source of the geometry. [Entrance catalog](data/driving-corridors.json), [WSDOT road data](https://data.wsdot.wa.gov/geospatial/default.htm)
- Use the road authority's route IDs and mileposts where available. Match the road, travel direction, and affected section. Check that the section is on the approach before the exit.
- Keep seasonal rules and agency reports in separate records. Keep the agency's described vehicle exceptions, direction, and time window. Record the report time and the last successful check.
- Use a current explicit agency statement to report an open road. Use **Nearby reports** when the app cannot match a bulletin to the approach. Label expired data **Last reported**.
- Give each camera its agency ID, coordinates, direction, and source link. Show an image only with a valid capture time and reuse terms. Credit the source. [Site content security policy](../../customHttp.yml)
- Record parking terms by lot and season. Include local dates, hours, fees, reservations, accessible spaces, and shuttle connections where published. Use dated operator counts for parking occupancy. [Visitor records](../../shared/skiResortAccess.ts)

## Implementation order and acceptance checks

| Work | Acceptance check |
| --- | --- |
| Verify hosted publication | Load the manifest and check each referenced snapshot. Verify provider states in **Driving coverage**. Check an outage and the next successful refresh. [Publication procedure](readme.md#publish-driving-feeds) |
| Extend verified road sections | Compare the route, direction, and mileposts with the agency. Test a closure beyond the exit and a restriction in the opposite direction. Test two arrivals on the same highway. |
| Extend coverage by corridor | Record the roads and limits that each agency covers. Check the approach to each winter entrance. Check different parking rules at two lots. |
| Evaluate driving time and distance | Use the selected origin and entrance. Show the source and time of the estimate. Test with a closure on the route. Check for an unknown estimate when source data expires. |

Repeat the browser checks on a narrow screen and with a keyboard. Check that **Layers**, **Fit results**, and **Search this area** stay available. Check the map after a report refresh. Test a shared approach and a return from Compare. [Browser tests](../../tests/e2e/ski-status.spec.ts)
