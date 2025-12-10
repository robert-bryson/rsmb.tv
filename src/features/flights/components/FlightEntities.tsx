import { Entity } from 'resium';
import { Cartesian3, Color, PolylineGlowMaterialProperty, ArcType } from 'cesium';
import { useFlights } from '../hooks/useFlightData';
import type { FlightFeature } from '../types';

export function FlightEntities() {
  const { data: flights, error } = useFlights();

  if (error || !flights) return null;

  return (
    <>
      {flights.features.map((flight: FlightFeature, index: number) => {
        const props = flight.properties;
        const name = `${props.origin_code} → ${props.destination_code}`;

        const description = `
          <strong>${name}</strong><br/>
          ${props.origin_name} → ${props.destination_name}<br/>
          Date: ${props.date || 'Unknown'}<br/>
          Airline: ${props.airline || 'Unknown'}
        `;

        return (
          <Entity
            key={`flight-${props.id}-${index}`}
            name={name}
            description={description}
            polyline={{
              positions: [
                Cartesian3.fromDegrees(props.origin_lon, props.origin_lat, 10000),
                Cartesian3.fromDegrees(props.destination_lon, props.destination_lat, 10000),
              ],
              width: 4,
              material: new PolylineGlowMaterialProperty({
                glowPower: 0.5,
                color: Color.WHITE.withAlpha(0.8),
              }),
              arcType: ArcType.GEODESIC,
            }}
          />
        );
      })}
    </>
  );
}
