import { useRef } from 'react';
import { Viewer, CameraFlyTo, GeoJsonDataSource} from 'resium';
import { Cartesian3, Color} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css'

const Flights = () => {
    const viewerRef = useRef(null)

    return (
        <section className="h-[calc(100vh-4rem)] w-full">
            <Viewer
                full 
                ref={viewerRef}
                baseLayerPicker={false}
                timeline={false}
                animation={false}
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
            </Viewer>
        </section>
    )
};

export default Flights;