#!/usr/bin/env python3
"""
Generate high-resolution equirectangular basemap images by stitching map tiles.

Uses CartoDB/CARTO free tile servers:
- Positron (light gray canvas - similar to ArcGIS Gray Canvas)
- Dark Matter (dark themed)
- Voyager (clean labeled map - similar to ArcGIS World Topo)

Tiles are in Web Mercator (EPSG:3857). We fetch a grid of tiles at the chosen
zoom level, stitch them, then reproject from Mercator to equirectangular (plate
carrée / EPSG:4326) so the image can be texture-mapped onto a sphere.

Usage:
    python3 scripts/generate-basemaps.py [--zoom LEVEL] [--output-dir DIR]

Zoom level determines resolution:
    3 -> 2048x1024  (fast, low quality)
    4 -> 4096x2048  (good balance)
    5 -> 8192x4096  (high quality, ~20MB per image)
"""

import argparse
import io
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image

# Tile servers (no API key required for limited use)
TILE_SERVERS = {
    "positron": {
        "url": "https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
        "label": "Light (Gray Canvas)",
        "filename": "basemap-positron.jpg",
    },
    "dark-matter": {
        "url": "https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "label": "Dark Matter",
        "filename": "basemap-dark-matter.jpg",
    },
    "voyager": {
        "url": "https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
        "label": "Voyager (Clean Topo)",
        "filename": "basemap-voyager.jpg",
    },
}

# User-Agent to be a good citizen
HEADERS = {
    "User-Agent": "BasemapGenerator/1.0 (personal globe visualization project)"
}


def lat_from_mercator_y(y: int, zoom: int) -> float:
    """Convert tile Y coordinate to latitude."""
    n = 2.0 ** zoom
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    return math.degrees(lat_rad)


def fetch_tile(url: str, retries: int = 3) -> Image.Image | None:
    """Fetch a single tile image with retries."""
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                return Image.open(io.BytesIO(resp.content)).convert("RGB")
            if resp.status_code == 429:
                time.sleep(2 ** attempt)
                continue
        except (requests.RequestException, IOError):
            if attempt < retries - 1:
                time.sleep(1)
    return None


def stitch_mercator(tile_server_url: str, zoom: int, tile_size: int = 512) -> Image.Image:
    """Fetch all tiles at a zoom level and stitch into one Mercator image."""
    n_tiles = 2 ** zoom
    width = n_tiles * tile_size
    height = n_tiles * tile_size

    print(f"  Fetching {n_tiles}x{n_tiles} = {n_tiles*n_tiles} tiles at zoom {zoom} (@2x = {tile_size}px tiles)...")

    mercator_img = Image.new("RGB", (width, height), (200, 200, 200))

    # Build list of (x, y, url) tasks
    tasks = []
    for y in range(n_tiles):
        for x in range(n_tiles):
            url = tile_server_url.format(z=zoom, x=x, y=y)
            tasks.append((x, y, url))

    fetched = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_tile, url): (x, y) for x, y, url in tasks}
        for future in as_completed(futures):
            x, y = futures[future]
            tile_img = future.result()
            if tile_img:
                # Resize tile to expected size if needed (retina tiles may vary)
                if tile_img.size != (tile_size, tile_size):
                    tile_img = tile_img.resize((tile_size, tile_size), Image.LANCZOS)
                mercator_img.paste(tile_img, (x * tile_size, y * tile_size))
                fetched += 1
            else:
                failed += 1

            total = fetched + failed
            if total % 50 == 0 or total == len(tasks):
                print(f"    Progress: {total}/{len(tasks)} tiles ({failed} failed)")

    if failed > 0:
        print(f"  Warning: {failed} tiles failed to load")

    return mercator_img


def mercator_to_equirectangular(mercator_img: Image.Image, zoom: int, output_width: int) -> Image.Image:
    """
    Reproject a Mercator image to equirectangular (plate carrée) projection.

    Mercator maps latitude non-linearly (stretches poles), while equirectangular
    maps latitude linearly. We sample from the Mercator image using the inverse
    Mercator projection formula.
    """
    output_height = output_width // 2
    equirect = Image.new("RGB", (output_width, output_height), (20, 20, 30))

    merc_w, merc_h = mercator_img.size
    pixels_merc = mercator_img.load()
    pixels_eq = equirect.load()

    # The Mercator tile grid covers lat ≈ [-85.05, 85.05] (Web Mercator limits)
    max_lat = 85.0511287798

    print(f"  Reprojecting to equirectangular ({output_width}x{output_height})...")

    for eq_y in range(output_height):
        # Equirectangular: linear latitude mapping from +90 to -90
        lat = 90.0 - (eq_y / output_height) * 180.0

        if abs(lat) > max_lat:
            # Beyond Mercator coverage - fill with edge color
            continue

        # Convert latitude to Mercator Y pixel
        lat_rad = math.radians(lat)
        merc_y_norm = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0
        merc_py = int(merc_y_norm * merc_h)
        merc_py = max(0, min(merc_h - 1, merc_py))

        for eq_x in range(output_width):
            # Equirectangular: linear longitude mapping
            merc_px = int((eq_x / output_width) * merc_w) % merc_w

            try:
                pixels_eq[eq_x, eq_y] = pixels_merc[merc_px, merc_py]
            except IndexError:
                pass

    # Fill polar regions (beyond Mercator coverage) with appropriate color
    # Sample the edge rows to get a reasonable polar fill color
    for eq_y in range(output_height):
        lat = 90.0 - (eq_y / output_height) * 180.0
        if abs(lat) > max_lat:
            # Use the nearest valid Mercator row
            if lat > 0:
                source_y_norm = 0.0
            else:
                source_y_norm = 1.0
            merc_py = int(source_y_norm * (merc_h - 1))
            merc_py = max(0, min(merc_h - 1, merc_py))

            for eq_x in range(output_width):
                merc_px = int((eq_x / output_width) * merc_w) % merc_w
                try:
                    pixels_eq[eq_x, eq_y] = pixels_merc[merc_px, merc_py]
                except IndexError:
                    pass

    return equirect


def generate_basemap(name: str, config: dict, zoom: int, output_dir: str, output_width: int):
    """Generate a single basemap image."""
    print(f"\n{'='*60}")
    print(f"Generating: {config['label']} ({name})")
    print(f"{'='*60}")

    # Step 1: Stitch tiles into a Mercator image
    mercator_img = stitch_mercator(config["url"], zoom)

    # Step 2: Reproject to equirectangular
    equirect_img = mercator_to_equirectangular(mercator_img, zoom, output_width)

    # Step 3: Save
    output_path = os.path.join(output_dir, config["filename"])
    equirect_img.save(output_path, "JPEG", quality=90, optimize=True)
    file_size = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({file_size / 1024 / 1024:.1f} MB)")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate equirectangular basemap images from map tiles")
    parser.add_argument("--zoom", type=int, default=4, help="Zoom level (3=2K, 4=4K, 5=8K)")
    parser.add_argument("--output-dir", default="public/basemaps", help="Output directory")
    parser.add_argument("--basemaps", nargs="*", default=None, help="Which basemaps to generate (default: all)")
    parser.add_argument("--width", type=int, default=None, help="Output width in pixels (default: auto from zoom)")
    args = parser.parse_args()

    # Auto-calculate output width from zoom if not specified
    # @2x tiles are 512px, so at zoom 4 we get 16*512 = 8192px Mercator
    # Equirectangular output at similar quality
    if args.width is None:
        args.width = 2 ** args.zoom * 512  # Match Mercator resolution
    
    print(f"Output resolution: {args.width}x{args.width // 2}")

    os.makedirs(args.output_dir, exist_ok=True)

    basemaps_to_gen = args.basemaps or list(TILE_SERVERS.keys())
    for name in basemaps_to_gen:
        if name not in TILE_SERVERS:
            print(f"Unknown basemap: {name}. Available: {list(TILE_SERVERS.keys())}")
            sys.exit(1)

    for name in basemaps_to_gen:
        generate_basemap(name, TILE_SERVERS[name], args.zoom, args.output_dir, args.width)

    print(f"\nDone! Generated {len(basemaps_to_gen)} basemap(s) in {args.output_dir}/")


if __name__ == "__main__":
    main()
