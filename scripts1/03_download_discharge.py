"""
scripts/03_download_discharge_gee.py

Downloads GloFAS / ERA5 river discharge for Bagmati Basin stations
using Google Earth Engine. Exports one CSV to Google Drive.

Same setup as 02_download_rainfall_gee.py — if you already ran
earthengine authenticate, just run this directly.

Run:
    python scripts/03_download_discharge_gee.py

Output:
    data/raw/discharge/glofas_bagmati_daily.csv
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import STATIONS, GLOFAS_START_YEAR, GLOFAS_END_YEAR, GPM_MONTHS


def run_gee_export() -> None:
    try:
        import ee
    except ImportError:
        print("[discharge] Run: pip install earthengine-api && earthengine authenticate")
        sys.exit(1)

    print("[discharge] initialising Earth Engine ...")
    gee_project = os.getenv("GEE_PROJECT", "").strip() or None
    try:
        if gee_project:
            ee.Initialize(project=gee_project)
        else:
            ee.Initialize()
    except Exception:
        ee.Authenticate()
        if gee_project:
            ee.Initialize(project=gee_project)
        else:
            ee.Initialize()

    print("[discharge] connected OK")

    # ── Station points ──────────────────────────────────────────────────────
    station_features = ee.FeatureCollection([
        ee.Feature(
            ee.Geometry.Point([s["lon"], s["lat"]]),
            {"station_id": s["id"], "station_name": s["name"]}
        )
        for s in STATIONS
    ])

    # ── ERA5-Land daily hydro-meteo proxy ───────────────────────────────────
    # Use valid bands available in ECMWF/ERA5_LAND/DAILY_AGGR.
    # 'runoff' is not present in this collection, so we use components:
    #   - surface_runoff_sum
    #   - sub_surface_runoff_sum
    # plus precipitation and soil moisture layers for feature engineering.
    era5 = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR") \
             .select([
                 "surface_runoff_sum",
                 "sub_surface_runoff_sum",
                 "total_precipitation_sum",
                 "volumetric_soil_water_layer_1",
                 "volumetric_soil_water_layer_2",
                 "volumetric_soil_water_layer_3",
                 "volumetric_soil_water_layer_4",
             ]) \
             .filter(ee.Filter.calendarRange(GLOFAS_START_YEAR, GLOFAS_END_YEAR, "year")) \
             .filter(ee.Filter.calendarRange(GPM_MONTHS[0], GPM_MONTHS[-1], "month"))

    def extract_station_values(image):
        date_str = image.date().format("YYYY-MM-dd")

        # Sample image at each station point
        sampled = image.sampleRegions(
            collection = station_features,
            scale      = 11132,
            geometries = False,
        )

        def add_date(f):
            return f.set("date", date_str)

        return sampled.map(add_date)

    # Flatten all images × all stations into one feature collection
    all_samples = era5.map(extract_station_values).flatten()

    task = ee.batch.Export.table.toDrive(
        collection     = all_samples,
        description    = "glofas_bagmati_daily",
        fileNamePrefix = "glofas_bagmati_daily",
        fileFormat     = "CSV",
        folder         = "bahuraksha",
    )

    task.start()

    print(
        "\n[discharge] export task submitted.\n"
        "\n"
        "  Output: glofas_bagmati_daily.csv in your Google Drive / bahuraksha/\n"
        "  Save to: data/raw/discharge/glofas_bagmati_daily.csv\n"
        "\n"
        "  Monitor: https://code.earthengine.google.com/tasks\n"
        f"  Task ID: {task.id}"
    )


if __name__ == "__main__":
    run_gee_export()
