"""
scripts/07_download_sar.py

Downloads Sentinel-1 SAR (VV/VH backscatter in dB) for Bagmati Basin via
Google Earth Engine and exports CSV to Google Drive.

Run:
    GEE_PROJECT=<your-project-id> python scripts/07_download_sar.py

Output:
    data/raw/sentinel/sentinel1_bagmati_daily.csv
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import BBOX, GPM_MONTHS, SAR_START_YEAR, SAR_END_YEAR


def run_gee_export() -> None:
    try:
        import ee
    except ImportError:
        print("[sar] Run: pip install earthengine-api && earthengine authenticate")
        sys.exit(1)

    print("[sar] initialising Earth Engine ...")
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

    print("[sar] connected OK")

    basin = ee.Geometry.Rectangle([
        BBOX["min_lon"], BBOX["min_lat"],
        BBOX["max_lon"], BBOX["max_lat"],
    ])

    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(basin)
        .filter(ee.Filter.calendarRange(SAR_START_YEAR, SAR_END_YEAR, "year"))
        .filter(ee.Filter.calendarRange(GPM_MONTHS[0], GPM_MONTHS[-1], "month"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .select(["VV", "VH"])
    )

    def extract_scene_mean(image):
        date_str = image.date().format("YYYY-MM-dd")
        stats = image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=basin,
            scale=30,
            maxPixels=1e9,
        )
        vv = stats.get("VV")
        vh = stats.get("VH")
        ratio = ee.Algorithms.If(
            ee.Algorithms.IsEqual(vh, None),
            None,
            ee.Number(vv).subtract(ee.Number(vh)),
        )

        return ee.Feature(None, {
            "date": date_str,
            "sar_vv_db": vv,
            "sar_vh_db": vh,
            "sar_vv_vh_ratio_db": ratio,
        })

    features = ee.FeatureCollection(s1.map(extract_scene_mean))

    task = ee.batch.Export.table.toDrive(
        collection=features,
        description="sentinel1_bagmati_daily",
        fileNamePrefix="sentinel1_bagmati_daily",
        fileFormat="CSV",
        folder="bahuraksha",
    )
    task.start()

    print(
        "\n[sar] export task submitted.\n"
        "\n"
        "  Output: sentinel1_bagmati_daily.csv in Google Drive / bahuraksha/\n"
        "  Save to: data/raw/sentinel/sentinel1_bagmati_daily.csv\n"
        "\n"
        "  Monitor: https://code.earthengine.google.com/tasks\n"
        f"  Task ID: {task.id}"
    )


if __name__ == "__main__":
    run_gee_export()

