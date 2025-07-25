import { useRef } from 'react';
import { Viewer, CameraFlyTo,ImageryLayer, GeoJsonDataSource} from 'resium';
import { Cartesian3, Color, Ion, UrlTemplateImageryProvider} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css'

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
                <GeoJsonDataSource
                    data="/data/flights/flights.geojson"
                    markerSize={0}
                    stroke={Color.PURPLE}
                    strokeWidth={2}
                    fill={Color.PURPLE.withAlpha(0.3)}
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