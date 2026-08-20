import type { GlobeAllAirportPoint, GlobePoint, GlobeStatePolygon, GlobeStaticArc } from '../types';
import { escapeHtml, formatElevation, parseYear, sortDatesDescending } from './index';

type TooltipPoint = (GlobePoint | GlobeAllAirportPoint) & { isAllAirports?: boolean };

export function buildArcLabelHtml(
    arcData: GlobeStaticArc & { isStatic?: boolean },
    selectedRoute: string | null,
) {
    if (!arcData.isStatic || !arcData.flights) return '';

    const firstFlight = arcData.flights[0];
    const isSelected = selectedRoute === arcData.routeKey;

    if (!isSelected) {
        const recentFlights = arcData.flights.slice(0, 5);
        return `
              <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-700 text-sm">
                <div class="font-bold text-purple-300">${escapeHtml(firstFlight.origin_code)} ↔ ${escapeHtml(firstFlight.destination_code)}</div>
                <div class="text-gray-300 text-xs">${escapeHtml(firstFlight.origin_name)}</div>
                <div class="text-gray-400 text-xs">↕</div>
                <div class="text-gray-300 text-xs">${escapeHtml(firstFlight.destination_name)}</div>
                <div class="mt-2 pt-2 border-t border-gray-700">
                  <span class="text-purple-400">${arcData.routeCount} flight${arcData.routeCount > 1 ? 's' : ''}</span>
                </div>
                <div class="text-gray-500 text-xs mt-1">
                  ${escapeHtml(recentFlights.map((flight) => flight.date).join(', '))}${arcData.flights.length > 5 ? '...' : ''}
                </div>
                <div class="text-gray-600 text-xs mt-2 italic">Click for details</div>
              </div>
            `;
    }

    const airlines = [...new Set(arcData.flights.map((flight) => flight.airline))];
    const years = [...new Set(arcData.flights.map((flight) => parseYear(flight.date)))].sort((a, b) => a - b);
    const allDates = sortDatesDescending(arcData.flights.map((flight) => flight.date));

    return `
            <div class="bg-gray-900/95 px-4 py-3 rounded-lg shadow-xl border border-yellow-500/50 text-sm min-w-64">
              <div class="font-bold text-yellow-400 text-base">${escapeHtml(firstFlight.origin_code)} ↔ ${escapeHtml(firstFlight.destination_code)}</div>
              <div class="text-gray-300 text-xs mt-1">${escapeHtml(firstFlight.origin_name)}</div>
              <div class="text-gray-400 text-xs">↕</div>
              <div class="text-gray-300 text-xs">${escapeHtml(firstFlight.destination_name)}</div>

              <div class="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div class="text-gray-500 text-xs">Total Flights</div>
                  <div class="text-yellow-400 font-semibold">${arcData.routeCount}</div>
                </div>
                <div>
                  <div class="text-gray-500 text-xs">Years Active</div>
                  <div class="text-gray-300">${escapeHtml(years.length > 3 ? years[0] + '–' + years[years.length - 1] : years.join(', '))}</div>
                </div>
                <div>
                  <div class="text-gray-500 text-xs">Airlines</div>
                  <div class="text-orange-400">${escapeHtml(airlines.slice(0, 3).join(', '))}${airlines.length > 3 ? '...' : ''}</div>
                </div>
                <div>
                  <div class="text-gray-500 text-xs">Last Flight</div>
                  <div class="text-gray-300">${escapeHtml(allDates[0])}</div>
                </div>
              </div>

              <div class="mt-3 pt-3 border-t border-gray-700">
                <div class="mb-2 flex items-center justify-between text-xs">
                  <span class="font-medium text-gray-400">All Flights</span>
                  <span class="rounded-full bg-purple-500/15 px-2 py-0.5 text-purple-300">${allDates.length}</span>
                </div>
                <div class="grid max-h-28 grid-cols-2 gap-1 overflow-y-auto pr-1 text-xs">
                  ${allDates.map((date, index) => `
                    <div class="flex items-center gap-1.5 rounded border border-gray-700/70 bg-gray-800/70 px-2 py-1 text-gray-300">
                      <span class="text-[10px] text-gray-600">${String(index + 1).padStart(2, '0')}</span>
                      <span>${escapeHtml(date)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="text-gray-600 text-xs mt-3 italic">Click to deselect • Esc to clear</div>
            </div>
          `;
}

export function buildPointLabelHtml(point: TooltipPoint, isMetric: boolean) {
    const airport = point.airport;

    if (point.isAllAirports) {
        return `
            <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-600 text-sm">
              <div class="font-bold text-gray-300">${escapeHtml(airport.code)}</div>
              <div class="text-gray-400">${escapeHtml(airport.name)}</div>
              <div class="text-gray-500 text-xs mt-1">${airport.municipality ? escapeHtml(airport.municipality) + ', ' : ''}${escapeHtml(airport.countryName)}</div>
              <div class="text-gray-500 text-xs">${escapeHtml(airport.continentName)}</div>
              <div class="text-gray-600 text-xs mt-2 pt-2 border-t border-gray-700">
                ${escapeHtml(formatElevation(airport.elevationFt, airport.elevationM, isMetric))}
              </div>
              <div class="text-gray-600 text-xs mt-1 italic">Not yet visited</div>
            </div>
          `;
    }

    const visitedAirport = airport as GlobePoint['airport'];
    return `
            <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-gray-700 text-sm">
              <div class="font-bold text-yellow-300">${escapeHtml(visitedAirport.code)}</div>
              <div class="text-gray-300">${escapeHtml(visitedAirport.name)}</div>
              <div class="text-gray-400 text-xs">${escapeHtml(visitedAirport.municipality)}, ${escapeHtml(visitedAirport.countryName)}</div>
              <div class="text-gray-500 text-xs">${escapeHtml(formatElevation(visitedAirport.elevationFt, visitedAirport.elevationM, isMetric))}</div>
              <div class="text-gray-500 mt-2 pt-2 border-t border-gray-700">
                <span class="text-yellow-400">${visitedAirport.visitCount}</span> visits
                <span class="text-gray-600 mx-1">•</span>
                <span class="text-green-400">${visitedAirport.arrivalCount}</span>↓
                <span class="text-blue-400">${visitedAirport.departureCount}</span>↑
              </div>
            </div>
          `;
}

export function buildStatePolygonLabelHtml(poly: GlobeStatePolygon) {
    const { stats } = poly;
    return `
                <div class="bg-gray-900/95 px-3 py-2 rounded-lg shadow-xl border border-blue-700 text-sm">
                  <div class="font-bold text-blue-300">${escapeHtml(stats.name)}</div>
                  <div class="text-gray-400 text-xs">${escapeHtml(stats.abbr)}</div>
                  ${stats.visited ? `
                    <div class="mt-2 pt-2 border-t border-gray-700">
                      <div class="text-xs text-gray-500">Airports Visited</div>
                      <div class="text-green-400">${stats.airportCount} of ${stats.totalAirports}</div>
                    </div>
                    <div class="mt-1">
                      <div class="text-xs text-gray-500">Flights</div>
                      <div class="text-orange-400">${stats.flightCount}</div>
                    </div>
                    ${stats.firstVisitDate ? `
                      <div class="mt-1 text-xs text-gray-500">
                        First: ${escapeHtml(stats.firstVisitDate)}
                      </div>
                    ` : ''}
                  ` : `
                    <div class="mt-2 text-gray-500 text-xs">Not yet visited</div>
                  `}
                </div>
              `;
}
