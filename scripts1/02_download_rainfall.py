"""
scripts/02_download_rainfall_gee.py

Downloads GPM IMERG daily rainfall for Bagmati Basin using
Google Earth Engine — runs on Google's servers, exports one
clean CSV to your Google Drive. No 1840 file downloads.

Setup (one time):
    pip install earthengine-api
    earthengine authenticate        ← opens browser, sign in with Google

Run:
    python scripts/02_download_rainfall_gee.py

Output:
    A file called  gpm_bagmati_daily.csv  will appear in your
    Google Drive root folder within 5–15 minutes.
    Download it and save to:  data/raw/rainfall/gpm_bagmati_daily.csv
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import BBOX, GPM_START_YEAR, GPM_END_YEAR, GPM_MONTHS


def run_gee_export() -> None:
    try:
        import ee
    except ImportError:
        print(
            "[rainfall] earthengine-api not installed.\n"
            "           Run:  pip install earthengine-api\n"
            "           Then: earthengine authenticate"
        )
        sys.exit(1)

    # Authenticate and initialise
    print("[rainfall] initialising Earth Engine ...")
    gee_project = os.getenv("GEE_PROJECT", "").strip() or None
    try:
        if gee_project:
            ee.Initialize(project=gee_project)
        else:
            ee.Initialize()
    except Exception:
        try:
            ee.Authenticate()
            if gee_project:
                ee.Initialize(project=gee_project)
            else:
                ee.Initialize()
        except Exception as e:
            print(
                f"[rainfall] GEE init failed: {e}\n"
                "           Earth Engine now requires a Cloud project.\n"
                "           Fix:\n"
                "           1) Create/select a Google Cloud project with Earth Engine enabled\n"
                "           2) Run: earthengine authenticate\n"
                "           3) Run with project: GEE_PROJECT=<your-project-id> python scripts/02_download_rainfall.py\n"
                "              Example: GEE_PROJECT=my-ee-project python scripts/02_download_rainfall.py"
            )
            sys.exit(1)

    print("[rainfall] connected to Earth Engine OK")

    # ── Bagmati Basin bounding box ──────────────────────────────────────────
    bagmati = ee.Geometry.Rectangle([
        BBOX["min_lon"], BBOX["min_lat"],
        BBOX["max_lon"], BBOX["max_lat"],
    ])

    # ── GPM IMERG Final Daily V07 ───────────────────────────────────────────
    # precipitationCal band = gauge-corrected daily precipitation (mm/day)
    gpm = ee.ImageCollection("NASA/GPM_L3/IMERG_V07") \
            .select("precipitation") \
            .filterBounds(bagmati)

    # ── Build monsoon-months date filter ───────────────────────────────────
    # Use [start, next_month_start) ranges because ee.Filter.date end is exclusive.
    filters = []
    for year in range(GPM_START_YEAR, GPM_END_YEAR + 1):
        for month in GPM_MONTHS:
            if month == 12:
                next_year, next_month = year + 1, 1
            else:
                next_year, next_month = year, month + 1
            filters.append(
                ee.Filter.date(
                    f"{year}-{month:02d}-01",
                    f"{next_year}-{next_month:02d}-01",
                )
            )

    combined_filter = ee.Filter.Or(*filters)
    gpm_filtered = gpm.filter(combined_filter)

    print(f"[rainfall] building daily mean precipitation series ...")
    print(f"[rainfall] years: {GPM_START_YEAR}–{GPM_END_YEAR}, months: May–Oct")

    # ── Reduce each daily image to mean over Bagmati bbox ──────────────────
    # This gives one row per day: date + mean_rainfall_mm
    def extract_daily_mean(image):
        date_str = image.date().format("YYYY-MM-dd")
        mean_val = image.reduceRegion(
            reducer   = ee.Reducer.mean(),
            geometry  = bagmati,
            scale     = 11132,    # GPM native resolution ~11km
            maxPixels = 1e6,
        ).get("precipitation")

        return ee.Feature(None, {
            "date":          date_str,
            "rainfall_mm":   mean_val,
        })

    feature_collection = ee.FeatureCollection(
        gpm_filtered.map(extract_daily_mean)
    )

    # ── Export to Google Drive ──────────────────────────────────────────────
    task = ee.batch.Export.table.toDrive(
        collection   = feature_collection,
        description  = "gpm_bagmati_daily",
        fileNamePrefix = "gpm_bagmati_daily",
        fileFormat   = "CSV",
        folder       = "bahuraksha",          # will be created in your Drive
    )

    task.start()

    print(
        "\n[rainfall] export task submitted to Google Earth Engine.\n"
        "\n"
        "  What happens next:\n"
        "  1. GEE processes everything on Google's servers (5–15 min)\n"
        "  2. A file called  gpm_bagmati_daily.csv  will appear in\n"
        "     your Google Drive under a folder called  bahuraksha/\n"
        "  3. Download it and save to:\n"
        "     data/raw/rainfall/gpm_bagmati_daily.csv\n"
        "\n"
        "  Monitor progress at:\n"
        "  https://code.earthengine.google.com/tasks\n"
        "\n"
        f"  Task ID: {task.id}"
    )


if __name__ == "__main__":
    run_gee_export()
