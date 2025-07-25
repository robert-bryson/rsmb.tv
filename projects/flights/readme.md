# ✈️ Flights — 3D Webmap of My Flight History

This project visualizes flights I've taken using a 3D globe powered by CesiumJS. It converts structured flight data into GeoJSON for display in the portfolio site.

## 📂 Folder Structure

```

projects/flights/
├── data/
│   ├── airports.csv        # List of airport codes with location and metadata
│   └── flights.csv         # Flight records referencing origin/destination by airport code
├── scripts/
│   └── convertFlights.js   # Build script that generates GeoJSON from the CSV files
└── README.md               # This file

````

## 🔄 Build Process

Running the following command will regenerate the GeoJSON used by the site:

```bash
npm run build-flights
````

This script reads the raw CSV files and outputs:

```
public/data/flights/flights.geojson
```

This GeoJSON file is then loaded by the CesiumJS component in `src/pages/Flights.tsx`.

## ✨ Features

* 3D globe visualization with CesiumJS
* Customizable flight data via simple CSV files
* Automatically integrated into the React site build

## 📍 Future Ideas

* Animate flights over time
* Group by airline or year
* Add altitude arcs or great circle curves
