import { useEffect, useState, useRef } from 'react';
import { Viewer, CameraFlyTo,ImageryLayer, Entity} from 'resium';
import { Cartesian3, Color, Ion, UrlTemplateImageryProvider, PolylineGlowMaterialProperty, ArcType} from 'cesium';
import type { FeatureCollection, Feature, Point, LineString } from 'geojson'
import 'cesium/Build/Cesium/Widgets/widgets.css'
// import 'styles/cesium-dark.css'

type AirportProps = {
    airports: FeatureCollection<Point>;
    hoveredFlight?: Feature<LineString>;
}

const AirportEntities = ({ airports, hoveredFlight}: AirportProps) => (
    <>
        {airports.features.map((a: Feature<Point>, i: number) => {
            const props = a.properties ?? {};

            const isOriginOrDest = hoveredFlight &&
                (hoveredFlight.properties?.origin_code === props.code ||
                 hoveredFlight.properties?.destination_code === props.code
                )
            
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
                    point={{ 
                        pixelSize: isOriginOrDest ? 20: 6,
                        color: isOriginOrDest ? Color.PURPLE: Color.WHITE }}
                    label={ isOriginOrDest ? {
                        text: props?.code ?? '',
                        scale: 0.5,
                        fillColor: Color.WHITE,
                        showBackground: true,
                        horizontalOrigin: 0,
                        verticalOrigin: -1,
                    }: ''}
                />
            );
        })}
    </>
)

type FlightProps = {
    flights: FeatureCollection<LineString>;
    hoveredFlightId: number | null;
    setHoveredFlightID: (id: number | null) => void;
}

const FlightEntities = ({ flights, hoveredFlightId, setHoveredFlightID}: FlightProps) => (
    <>
        {flights.features.map((f: Feature<LineString>, i: number) => {
            const props = f.properties ?? {};
            
            const isHovered = hoveredFlightId === props.id

            const name = `${props.origin_code || ''}->${props.destination_code || ''}`
            const description = `<strong>${name}</strong>`;

            return (
                <Entity
                    key={i}
                    name={name}
                    description={description}
                    onMouseEnter={() => setHoveredFlightID(props.id)}
                    onMouseLeave={() => setHoveredFlightID(null)}
                    polyline={{
                        positions: [
                            Cartesian3.fromDegrees(props.origin_lon, props.origin_lat, 10000),
                            Cartesian3.fromDegrees(props.destination_lon, props.destination_lat, 10000),
                        ],
                        width: isHovered ? 10: 2,
                        material: new PolylineGlowMaterialProperty({
                            glowPower: isHovered ? 1 : 0.1,
                            color: isHovered ? Color.PURPLE: Color.WHITE.withAlpha(0.6),
                        }),
                        arcType: ArcType.GEODESIC,
                    }}
                />
            );
        })}
    </>
)

const Flights = () => {
    // Optional: disable Cesium Ion access token if unused
    Ion.defaultAccessToken = ''

    const viewerRef = useRef(null)

    const [airports, setAirports] = useState<FeatureCollection<Point> | null>(null)
    const [flights, setFlights] = useState<FeatureCollection<LineString> | null>(null)
    const [hoveredFlightId, setHoveredFlightID] = useState<number | null>(null)
    
    const hoveredFlight = flights?.features.find(
        (f: Feature<LineString>) => f.properties?.id === hoveredFlightId)

    useEffect(() => {
        fetch('/data/flights/flights.geojson')
            .then(res => res.json())
            .then(data => setFlights(data))
            .catch(err => console.error('Error loading flights.geojson', err))
    }, [])
    useEffect(() => {
        fetch('/data/flights/visitedAirports.geojson')
            .then(res => res.json())
            .then(data => setAirports(data))
            .catch(err => console.error('Error loading visitedAirports.geojson', err))
    }, [])

    if (!flights || !airports) return null


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

                <FlightEntities
                    flights={flights}
                    hoveredFlightId={hoveredFlightId}
                    setHoveredFlightID={setHoveredFlightID}
                />
                <AirportEntities 
                    airports={airports}
                    hoveredFlight={hoveredFlight}
                />

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
