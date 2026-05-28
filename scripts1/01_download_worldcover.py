"""
scripts/01_download_worldcover.py

Downloads the ESA WorldCover 2021 land use tile for Nepal directly
from the public AWS S3 bucket. No account or API key needed.

Run:
    python scripts/01_download_worldcover.py
"""

import sys
import math
import requests
from pathlib import Path
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import BBOX, RAW_LANDUSE


def _tile_id_from_bbox() -> str:
    """WorldCover uses 3x3 degree tiles named by lower-left corner."""
    lat_ll = math.floor(BBOX["min_lat"] / 3) * 3
    lon_ll = math.floor(BBOX["min_lon"] / 3) * 3

    lat_prefix = "N" if lat_ll >= 0 else "S"
    lon_prefix = "E" if lon_ll >= 0 else "W"
    return f"{lat_prefix}{abs(lat_ll):02d}{lon_prefix}{abs(lon_ll):03d}"


def _candidate_urls(tile_id: str) -> list[str]:
    fname = f"ESA_WorldCover_10m_2021_v200_{tile_id}_Map.tif"
    return [
        f"https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/{fname}",
        f"https://esa-worldcover.s3.amazonaws.com/v200/2021/map/{fname}",
    ]


def download_worldcover() -> Path:
    out_path = RAW_LANDUSE / "worldcover_nepal.tif"

    if out_path.exists():
        print(f"[worldcover] already exists at {out_path} — skipping download.")
        return out_path

    RAW_LANDUSE.mkdir(parents=True, exist_ok=True)
    tile_id = _tile_id_from_bbox()
    urls = _candidate_urls(tile_id)
    print(f"[worldcover] downloading from AWS S3 ...")
    print(f"             tile: {tile_id}")
    print(f"             dest: {out_path}")
    response = None
    last_exc = None
    for url in urls:
        print(f"             try : {url}")
        try:
            candidate = requests.get(url, stream=True, timeout=120)
            candidate.raise_for_status()
            response = candidate
            break
        except requests.RequestException as exc:
            last_exc = exc

    if response is None:
        raise RuntimeError(
            f"Could not download WorldCover tile {tile_id} from known URLs."
        ) from last_exc

    total_bytes = int(response.headers.get("content-length", 0))

    with open(out_path, "wb") as f, tqdm(
        total=total_bytes,
        unit="B",
        unit_scale=True,
        unit_divisor=1024,
        desc="worldcover",
    ) as bar:
        for chunk in response.iter_content(chunk_size=1024 * 256):
            f.write(chunk)
            bar.update(len(chunk))

    print(f"[worldcover] done — {out_path.stat().st_size / 1e6:.1f} MB saved.")
    return out_path


if __name__ == "__main__":
    download_worldcover()
