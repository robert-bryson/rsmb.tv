import { Entity } from 'resium';
import { Cartesian3, Color } from 'cesium';
import { useAirports } from '../hooks/useFlightData';
import type { AirportFeature } from '../types';

export function AirportEntities() {
  const { data: airports, error } = useAirports();

  if (error || !airports) return null;

  return (
    <>
      {airports.features.map((airport: AirportFeature, index: number) => {
        const props = airport.properties;
        const [lon, lat] = airport.geometry.coordinates;

        const description = `
          <strong>${props.name || props.code}</strong><br/>
          ${props.municipality || ''}, ${props.region || ''}<br/>
          ${props.country || ''}<br/>
          Visits: ${props.visitCount || 0} (Arrivals: ${props.arrivalCount || 0}, Departures: ${props.departureCount || 0})<br/>
          Dates: ${props.visitDates?.join(', ') || ''}
        `;

        return (
          <Entity
            key={`airport-${props.code}-${index}`}
            name={props.name}
            description={description}
            position={Cartesian3.fromDegrees(lon, lat)}
            point={{ pixelSize: 6, color: Color.YELLOW }}
            label={{
              text: props.code,
              scale: 0.5,
              fillColor: Color.WHITE,
              showBackground: true,
              horizontalOrigin: 0,
              verticalOrigin: -1,
            }}
          />
        );
      })}
    </>
  );
}
