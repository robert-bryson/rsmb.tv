import { useMemo } from 'react';
import { Viewer, CameraFlyTo, ImageryLayer } from 'resium';
import { Cartesian3, Ion, UrlTemplateImageryProvider } from 'cesium';
import { AirportEntities } from './AirportEntities';
import { FlightEntities } from './FlightEntities';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Disable Cesium Ion (not using Ion services, using CARTO basemap instead)
Ion.defaultAccessToken = '';

export function FlightsMap() {
  // Memoize the imagery provider to avoid creating new instances on re-render
  const imageryProvider = useMemo(
    () =>
      new UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: ['a', 'b', 'c', 'd'],
        credit: '© CARTO',
      }),
    []
  );

  const initialDestination = useMemo(
    () => Cartesian3.fromDegrees(-90.0, 38.6, 10000000),
    []
  );

  return (
    <Viewer
      full
      baseLayerPicker={false}
      animation={false}
      timeline={false}
      skyAtmosphere={false}
    >
      <CameraFlyTo duration={3} destination={initialDestination} />
      <FlightEntities />
      <AirportEntities />
      <ImageryLayer imageryProvider={imageryProvider} />
    </Viewer>
  );
}
