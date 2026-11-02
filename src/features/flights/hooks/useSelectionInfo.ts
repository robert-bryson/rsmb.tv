import { useMemo } from 'react';
import { summarizeFlightDurations } from '../utils/flightDuration';
import { flightMatchesFilters } from '../utils/flightFilters';
import type { FlightProperties, GlobeStaticArc, GlobePoint, SelectedRouteInfo, SelectedCountryInfo, SelectedRegionInfo, FlightTypeFilter } from '../types';
import { calculateDistance, parseYear, getRouteKey, sortDatesDescending, parseDateString } from '../utils';

/** Each matching endpoint is a visit; both endpoints can belong to the selected geography. */
function getGeographyAirports(flights: readonly FlightProperties[], geography: 'country' | 'region', selectedCode: string): SelectedCountryInfo['airports'] {
    const airports = new Map<string, SelectedCountryInfo['airports'][number]>();
    for (const flight of flights) {
        for (const endpoint of ['origin', 'destination'] as const) {
            if (flight[`${endpoint}_${geography}`] !== selectedCode) continue;
            const code = flight[`${endpoint}_code`];
            const existing = airports.get(code);
            if (existing) existing.visitCount++;
            else airports.set(code, { code, name: flight[`${endpoint}_name`], visitCount: 1 });
        }
    }
    return [...airports.values()].sort((a, b) => b.visitCount - a.visitCount);
}

/** Computes route, country, and region details from the matching flight legs. */
export function useSelectionInfo({
    selectedRoute,
    selectedCountry,
    selectedRegion,
    staticArcsData: allStaticArcsData,
    pointsData,
    selectedAirport = null,
    selectedFlightType = null,
}: {
    selectedRoute: string | null;
    selectedCountry: string | null;
    selectedRegion: string | null;
    selectedAirport?: string | null;
    selectedFlightType?: FlightTypeFilter | null;
    staticArcsData: GlobeStaticArc[];
    pointsData: GlobePoint[];
}) {
    const staticArcsData = useMemo(() => allStaticArcsData.map(arc => {
        const flights = arc.flights.filter(flight => flightMatchesFilters(flight, {
            selectedRoute, selectedCountry, selectedRegion, selectedAirport, selectedFlightType,
        }));
        return { ...arc, flights, routeCount: flights.length };
    }).filter(arc => arc.flights.length), [allStaticArcsData, selectedRoute, selectedCountry, selectedRegion, selectedAirport, selectedFlightType]);
    const selectedRouteInfo = useMemo<SelectedRouteInfo | null>(() => {
        if (!selectedRoute) return null;
        const arc = staticArcsData.find(a => a.routeKey === selectedRoute);
        if (!arc || arc.flights.length === 0) return null;
        const first = arc.flights[0];
        const airlines = [...new Set(arc.flights.map(f => f.airline).filter(Boolean))];
        const years = [...new Set(arc.flights.map(f => parseYear(f.date)))].sort((a, b) => a - b);
        const dates = sortDatesDescending(arc.flights.map(f => f.date));
        const distanceKm = Math.round(calculateDistance(first.origin_lat, first.origin_lon, first.destination_lat, first.destination_lon));
        return {
            routeKey: selectedRoute,
            originCode: first.origin_code,
            originName: first.origin_name,
            originMunicipality: first.origin_municipality,
            originCountry: first.origin_country,
            originCountryName: first.origin_countryName,
            originRegion: first.origin_region,
            originRegionName: first.origin_regionName,
            originContinentName: first.origin_continentName,
            destinationCode: first.destination_code,
            destinationName: first.destination_name,
            destinationMunicipality: first.destination_municipality,
            destinationCountry: first.destination_country,
            destinationCountryName: first.destination_countryName,
            destinationRegion: first.destination_region,
            destinationRegionName: first.destination_regionName,
            destinationContinentName: first.destination_continentName,
            totalFlights: arc.routeCount,
            duration: summarizeFlightDurations(arc.flights),
            flights: [...arc.flights].sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime()),
            airlines,
            years,
            dates,
            distanceKm,
            isInternational: first.origin_country !== first.destination_country,
            isIntercontinental: first.origin_continent !== first.destination_continent,
        };
    }, [selectedRoute, staticArcsData]);

    const selectedCountryInfo = useMemo<SelectedCountryInfo | null>(() => {
        if (!selectedCountry) return null;
        const countryPoints = pointsData.filter(p => p.airport.country === selectedCountry);
        if (countryPoints.length === 0) return null;
        const first = countryPoints[0].airport;
        const countryFlights = staticArcsData.flatMap(arc =>
            arc.flights.filter(f => f.origin_country === selectedCountry || f.destination_country === selectedCountry)
        );
        const airlines = [...new Set(countryFlights.map(f => f.airline).filter(Boolean))];
        const years = [...new Set(countryFlights.map(f => parseYear(f.date)))].sort((a, b) => a - b);
        const routeCounts = new Map<string, { origin: string; destination: string; count: number }>();
        countryFlights.forEach(f => {
            const key = getRouteKey(f.origin_code, f.destination_code);
            const existing = routeCounts.get(key);
            if (existing) { existing.count++; } else {
                routeCounts.set(key, { origin: f.origin_code, destination: f.destination_code, count: 1 });
            }
        });
        const topRoutes = [...routeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
        const connCountries = new Map<string, { code: string; name: string; count: number }>();
        countryFlights.forEach(f => {
            const otherCode = f.origin_country === selectedCountry ? f.destination_country : f.origin_country;
            const otherName = f.origin_country === selectedCountry ? f.destination_countryName : f.origin_countryName;
            if (otherCode === selectedCountry) return;
            const existing = connCountries.get(otherCode);
            if (existing) { existing.count++; } else {
                connCountries.set(otherCode, { code: otherCode, name: otherName, count: 1 });
            }
        });
        const departures = countryFlights.filter(f => f.origin_country === selectedCountry).length;
        const arrivals = countryFlights.filter(f => f.destination_country === selectedCountry).length;
        return {
            code: selectedCountry,
            name: first.countryName,
            continent: first.continent,
            continentName: first.continentName,
            totalFlights: countryFlights.length,
            duration: summarizeFlightDurations(countryFlights),
            departures,
            arrivals,
            airports: getGeographyAirports(countryFlights, 'country', selectedCountry),
            airlines,
            years,
            topRoutes,
            connectedCountries: [...connCountries.values()].sort((a, b) => b.count - a.count).slice(0, 10),
        };
    }, [selectedCountry, pointsData, staticArcsData]);

    const selectedRegionInfo = useMemo<SelectedRegionInfo | null>(() => {
        if (!selectedRegion) return null;
        const regionPoints = pointsData.filter(p => p.airport.region === selectedRegion);
        if (regionPoints.length === 0) return null;
        const first = regionPoints[0].airport;
        const regionFlights = staticArcsData.flatMap(arc =>
            arc.flights.filter(f => f.origin_region === selectedRegion || f.destination_region === selectedRegion)
        );
        const airlines = [...new Set(regionFlights.map(f => f.airline).filter(Boolean))];
        const years = [...new Set(regionFlights.map(f => parseYear(f.date)))].sort((a, b) => a - b);
        const routeCounts = new Map<string, { origin: string; destination: string; count: number }>();
        regionFlights.forEach(f => {
            const key = getRouteKey(f.origin_code, f.destination_code);
            const existing = routeCounts.get(key);
            if (existing) { existing.count++; } else {
                routeCounts.set(key, { origin: f.origin_code, destination: f.destination_code, count: 1 });
            }
        });
        const topRoutes = [...routeCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
        const departures = regionFlights.filter(f => f.origin_region === selectedRegion).length;
        const arrivals = regionFlights.filter(f => f.destination_region === selectedRegion).length;
        return {
            code: selectedRegion,
            name: first.regionName,
            country: first.country,
            countryName: first.countryName,
            totalFlights: regionFlights.length,
            duration: summarizeFlightDurations(regionFlights),
            departures,
            arrivals,
            airports: getGeographyAirports(regionFlights, 'region', selectedRegion),
            airlines,
            years,
            topRoutes,
        };
    }, [selectedRegion, pointsData, staticArcsData]);

    return { selectedRouteInfo, selectedCountryInfo, selectedRegionInfo };
}
