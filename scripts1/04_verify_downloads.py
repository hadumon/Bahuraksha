"""
scripts/04_verify_downloads.py

Checks that all expected raw data files are present and readable.
Run this after all three download scripts to confirm everything is in order
before moving on to preprocessing.

Run:
    python scripts/04_verify_downloads.py
"""

import sys
import calendar
from pathlib import Path
from datetime import date
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    RAW_BIPAD, RAW_DEM, RAW_RAINFALL, RAW_DISCHARGE, RAW_LANDUSE, RAW_SENTINEL,
    GPM_START_YEAR, GPM_END_YEAR, GPM_MONTHS,
    GLOFAS_START_YEAR, GLOFAS_END_YEAR,
)

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
RESET  = "\033[0m"

ok      = lambda msg: print(f"  {GREEN}✓{RESET}  {msg}")
warn    = lambda msg: print(f"  {YELLOW}⚠{RESET}  {msg}")
missing = lambda msg: print(f"  {RED}✗{RESET}  {msg}")


def check_bipad() -> bool:
    print("\n── BIPAD incidents ──────────────────────────────────")
    csvs = list(RAW_BIPAD.glob("*.csv"))
    if csvs:
        for f in csvs:
            ok(f"{f.name}  ({f.stat().st_size / 1e3:.0f} KB)")
        return True
    else:
        missing("No CSV files found in data/raw/bipad/")
        return False


def check_dem() -> bool:
    print("\n── SRTM DEM ─────────────────────────────────────────")
    tifs = list(RAW_DEM.glob("*.tif")) + list(RAW_DEM.glob("*.hgt"))
    if tifs:
        for f in tifs:
            ok(f"{f.name}  ({f.stat().st_size / 1e6:.1f} MB)")
        return True
    else:
        missing("No .tif or .hgt files found in data/raw/dem/")
        missing("Download SRTM from: https://opentopography.org → SRTM GL1")
        return False


def check_worldcover() -> bool:
    print("\n── ESA WorldCover ───────────────────────────────────")
    tifs = list(RAW_LANDUSE.glob("*.tif"))
    if tifs:
        for f in tifs:
            ok(f"{f.name}  ({f.stat().st_size / 1e6:.1f} MB)")
        return True
    else:
        missing("No .tif files found in data/raw/landuse/")
        missing("Run: python scripts/01_download_worldcover.py")
        return False


def check_rainfall() -> bool:
    print("\n── GPM IMERG rainfall ───────────────────────────────")
    gee_csv = RAW_RAINFALL / "gpm_bagmati_daily.csv"
    if gee_csv.exists():
        is_ok = True
        ok(f"{gee_csv.name}  ({gee_csv.stat().st_size / 1e6:.1f} MB) [GEE export]")
        try:
            df = pd.read_csv(gee_csv, usecols=["date"])
            d = pd.to_datetime(df["date"], errors="coerce").dropna()
            if len(d) > 0:
                min_d = d.min().date()
                max_d = d.max().date()
                ok(f"date coverage: {min_d} -> {max_d}")
                if max_d.year < GPM_END_YEAR:
                    warn(
                        f"rainfall ends at {max_d.year}, but config GPM_END_YEAR={GPM_END_YEAR}. "
                        "Re-run 02_download_rainfall.py"
                    )
                    is_ok = False
        except Exception:
            warn("could not parse rainfall CSV date coverage")
        return is_ok

    total_expected = 0
    total_found    = 0

    for year in range(GPM_START_YEAR, GPM_END_YEAR + 1):
        for month in GPM_MONTHS:
            last_day = calendar.monthrange(year, month)[1]
            for day in range(1, last_day + 1):
                d = date(year, month, day)
                total_expected += 1
                if (RAW_RAINFALL / f"gpm_{d.strftime('%Y%m%d')}.nc4").exists():
                    total_found += 1

    pct = (total_found / total_expected * 100) if total_expected else 0
    msg = f"{total_found}/{total_expected} daily files ({pct:.0f}%)"

    if total_found == total_expected:
        ok(msg)
    elif total_found > 0:
        warn(f"{msg} — legacy nc4 mode is partial")
        warn("If you are using GEE mode, place gpm_bagmati_daily.csv in data/raw/rainfall/")
    else:
        missing("No rainfall dataset found.")
        missing("Either run 02_download_rainfall.py (GEE) and copy gpm_bagmati_daily.csv,")
        missing("or use legacy nc4 downloader.")

    return total_found > 0


def check_discharge() -> bool:
    print("\n── GloFAS discharge ─────────────────────────────────")
    gee_csv = RAW_DISCHARGE / "glofas_bagmati_daily.csv"
    if gee_csv.exists():
        is_ok = True
        ok(f"{gee_csv.name}  ({gee_csv.stat().st_size / 1e6:.1f} MB) [GEE export]")
        try:
            df = pd.read_csv(gee_csv, usecols=["date"])
            d = pd.to_datetime(df["date"], errors="coerce").dropna()
            if len(d) > 0:
                min_d = d.min().date()
                max_d = d.max().date()
                ok(f"date coverage: {min_d} -> {max_d}")
                if max_d.year < GLOFAS_END_YEAR:
                    warn(
                        f"discharge ends at {max_d.year}, but config GLOFAS_END_YEAR={GLOFAS_END_YEAR}. "
                        "Re-run 03_download_discharge.py"
                    )
                    is_ok = False
        except Exception:
            warn("could not parse discharge CSV date coverage")
        return is_ok

    total_expected = GLOFAS_END_YEAR - GLOFAS_START_YEAR + 1
    found = []
    for year in range(GLOFAS_START_YEAR, GLOFAS_END_YEAR + 1):
        f = RAW_DISCHARGE / f"glofas_{year}.nc"
        if f.exists():
            found.append((year, f.stat().st_size / 1e6))

    msg = f"{len(found)}/{total_expected} annual files"
    if len(found) == total_expected:
        for year, mb in found:
            ok(f"glofas_{year}.nc  ({mb:.1f} MB)")
    elif found:
        for year, mb in found:
            ok(f"glofas_{year}.nc  ({mb:.1f} MB)")
        warn(f"{msg} — re-run 03_download_discharge.py for missing years")
    else:
        missing("No discharge dataset found.")
        missing("Run 03_download_discharge.py (GEE) and copy glofas_bagmati_daily.csv")
        missing("into data/raw/discharge/")

    return len(found) > 0


def check_sar() -> bool:
    print("\n── Sentinel-1 SAR ───────────────────────────────────")
    sar_csv = RAW_SENTINEL / "sentinel1_bagmati_daily.csv"
    if not sar_csv.exists():
        missing("No SAR CSV found.")
        missing("Run 07_download_sar.py and copy sentinel1_bagmati_daily.csv")
        missing("into data/raw/sentinel/")
        return False

    ok(f"{sar_csv.name}  ({sar_csv.stat().st_size / 1e6:.1f} MB) [GEE export]")
    try:
        df = pd.read_csv(sar_csv, usecols=["date"])
        d = pd.to_datetime(df["date"], errors="coerce").dropna()
        if len(d) > 0:
            ok(f"date coverage: {d.min().date()} -> {d.max().date()}")
    except Exception:
        warn("could not parse SAR CSV date coverage")
    return True


def main() -> None:
    print("=" * 54)
    print("  BAHURAKSHA — data download verification")
    print("=" * 54)

    results = {
        "BIPAD":       check_bipad(),
        "DEM":         check_dem(),
        "WorldCover":  check_worldcover(),
        "Rainfall":    check_rainfall(),
        "Discharge":   check_discharge(),
        "SAR":         check_sar(),
    }

    print("\n" + "=" * 54)
    all_ok = all(results.values())
    if all_ok:
        print(f"  {GREEN}All datasets present. Ready for preprocessing.{RESET}")
        print("  Next step:  python scripts/05_preprocess.py")
    else:
        failed = [k for k, v in results.items() if not v]
        print(f"  {RED}Missing: {', '.join(failed)}{RESET}")
        print("  Fix the issues above, then re-run this script.")
    print("=" * 54 + "\n")


if __name__ == "__main__":
    main()
