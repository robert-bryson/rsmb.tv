import { useMemo } from 'react';
import type { GlobeStaticArc, GlobePoint, SelectedRouteInfo, SelectedCountryInfo, SelectedRegionInfo } from '../types';
import { calculateDistance, parseYear, getRouteKey } from '../utils';

/**
 * Computes derived selection info (route, country, region) for the stats panel.
 * Extracts ~170 lines of useMemo logic from FlightsMap.
 */
export function useSelectionInfo({
    selectedRoute,
    selectedCountry,
    selectedRegion,
    staticArcsData,
    pointsData,
}: {
    selectedRoute: string | null;
    selectedCountry: string | null;
    selectedRegion: string | null;
    staticArcsData: GlobeStaticArc[];
    pointsData: GlobePoint[];
}) {
    const selectedRouteInfo = useMemo<SelectedRouteInfo | null>(() => {
        if (!selectedRoute) return null;
        const arc = staticArcsData.find(a => a.routeKey === selectedRoute);
        if (!arc || arc.flights.length === 0) return null;
        const first = arc.flights[0];
        const airlines = [...new Set(arc.flights.map(f => f.airline).filter(Boolean))];
        const years = [...new Set(arc.flights.map(f => parseYear(f.date)))].sort((a, b) => a - b);
        const dates = arc.flights.map(f => f.date).sort((a, b) => {
            const pa = a.split('/'); const pb = b.split('/');
            const da = new Date(+pa[2], +pa[0] - 1, +pa[1]);
            const db = new Date(+pb[2], +pb[0] - 1, +pb[1]);
            return db.getTime() - da.getTime();
        });
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
            departures,
            arrivals,
            airports: countryPoints.map(p => ({ code: p.airport.code, name: p.airport.name, visitCount: p.airport.visitCount }))
                .sort((a, b) => b.visitCount - a.visitCount),
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
            departures,
            arrivals,
            airports: regionPoints.map(p => ({ code: p.airport.code, name: p.airport.name, visitCount: p.airport.visitCount }))
                .sort((a, b) => b.visitCount - a.visitCount),
            airlines,
            years,
            topRoutes,
        };
    }, [selectedRegion, pointsData, staticArcsData]);

    return { selectedRouteInfo, selectedCountryInfo, selectedRegionInfo };
}
