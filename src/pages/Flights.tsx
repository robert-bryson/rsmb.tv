import { useEffect, useState, useRef } from 'react';
import { Viewer, CameraFlyTo,ImageryLayer, Entity} from 'resium';
import { Cartesian3, Color, Ion, UrlTemplateImageryProvider, PolylineGlowMaterialProperty, ArcType} from 'cesium';
import type { FeatureCollection, Feature, Point, LineString } from 'geojson'
import 'cesium/Build/Cesium/Widgets/widgets.css'
// import 'styles/cesium-dark.css'

const AirportEntities = () => {
   const [airports, setAirports] = useState<FeatureCollection<Point> | null>(null)

   useEffect(() => {
    fetch('/data/flights/visitedAirports.geojson')
        .then(res => res.json())
        .then(data => setAirports(data))
        .catch(err => console.error('Error loading visitedAirports.geojson', err))
   }, [])

   if (!airports) return null

   return (
    <>
        {airports.features.map((a: Feature<Point>, i: number) => {
            const props = a.properties ?? {};
            
            const description = `
                <strong>${props.name || props.code}</strong><br/>
                ${props.municipality || ''}, ${props.region || ''}<br/>
                ${props.country || ''}<br/>
                Visits: ${props.visitCount || ''} (Arrivals: ${props.arrivalCount || ''}, Departures: ${props.departureCount || ''})<br/>
                Dates: ${props.dates  || ''}
            `
        
            return (
                <Entity
                    key={i}
                    name={a.properties?.name ?? ''}
                    description={description}
                    position={Cartesian3.fromDegrees(...a.geometry.coordinates as [number, number])}
                    point={{ pixelSize: 6, color: Color.YELLOW }}
                    label={{
                        text: props?.code ?? '',
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
   )
}

const FlightEntities = () => {
    const [flights, setFlights] = useState<FeatureCollection<LineString> | null>(null)

    useEffect(() => {
        fetch('/data/flights/flights.geojson')
            .then(res => res.json())
            .then(data => setFlights(data))
            .catch(err => console.error('Error loading flights.geojson', err))
    }, [])

    if (!flights) return null

    return (
    <>
        {flights.features.map((f: Feature<LineString>, i: number) => {
            const props = f.properties ?? {};

            const name = `${props.origin_code || ''}->${props.destination_code || ''}`
            const description = `<strong>${name}</strong>`;

            return (
                <Entity
                    key={i}
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
   )
}

const Flights = () => {
    // Optional: disable Cesium Ion access token if unused
    Ion.defaultAccessToken = ''

    const viewerRef = useRef(null)

    return (
        <section className="h-[calc(100vh-4rem)] w-full">
            <Viewer
                full 
                ref={viewerRef}
                baseLayerPicker={false}
                animation={false}
                timeline={false}
                skyAtmosphere={false}
            >
                <CameraFlyTo
                    duration={3}
                    destination={Cartesian3.fromDegrees(-90.0, 38.6, 10000000)}
                />

                <FlightEntities />
                <AirportEntities />

                <ImageryLayer
                    imageryProvider={new UrlTemplateImageryProvider({
                        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                        subdomains: ['a', 'b', 'c', 'd'],
                        credit: '© CARTO',
                    })}
                />

            </Viewer>
        </section>
    )
};

export default Flights;
