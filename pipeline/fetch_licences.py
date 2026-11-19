"""Download Zambian mining-cadastre layers from the Geological Survey of Zambia
GeoServer (public WFS) and write one slim GeoJSON file for the app.

Source: https://geoserverprd.gsb.gov.zm/geoserver/ows (Ministry of Mines cadastre).
Run:    python3 pipeline/fetch_licences.py
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

WFS = "https://geoserverprd.gsb.gov.zm/geoserver/ows"
PAGE = 1000
OUT = Path(__file__).resolve().parent.parent / "data" / "licences.geojson"

# layer name -> what it means in the app
LAYERS = {
    "mmmd:02:largescale-exploration": "large_exploration",
    "mmmd:04:smallscale-exploration": "small_exploration",
    "mmmd:00:activelicenses-mines": "mining",
    "mmmd:lfapplications": "application",
}

# Minerals that occur with lithium pegmatites (exact, case-insensitive match on each listed commodity).
PEGMATITE_MINERALS = {"lithium", "tantalum", "tin", "beryllium", "beryl", "emerald", "caesium", "cesium", "niobium", "tourmaline"}

KEEP = ["code", "type", "status", "parties", "dtegranted", "dteexpires", "commoditie", "areavalue", "areaunit", "name"]


def get(url, retries=3):
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - report and retry
            last = e
    raise RuntimeError(f"request failed after {retries} tries: {last}")


def wfs_url(type_name, start=0, count=PAGE):
    q = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": type_name, "outputFormat": "application/json",
        "srsName": "EPSG:4326", "count": count, "startIndex": start,
    }
    return WFS + "?" + urllib.parse.urlencode(q)


def fetch_layer(type_name):
    feats, start = [], 0
    while True:
        page = get(wfs_url(type_name, start))
        batch = page.get("features", [])
        feats.extend(batch)
        if len(batch) < PAGE:
            break
        start += PAGE
    return feats


def commodity_list(text):
    if not text or text.strip().lower() in ("none", "null"):
        return []
    return [c.strip() for c in re.split(r",", text) if c.strip()]


def clean_date(value):
    if not value:
        return None
    return str(value)[:10].replace("/", "-")


def main():
    out, summary = [], {}
    for type_name, kind in LAYERS.items():
        feats = fetch_layer(type_name)
        summary[kind] = len(feats)
        for f in feats:
            p = f.get("properties") or {}
            if not f.get("geometry"):
                continue
            commodities = commodity_list(p.get("commoditie"))
            pegmatite = sorted({c.title() for c in commodities if c.lower() in PEGMATITE_MINERALS})
            out.append({
                "type": "Feature",
                "geometry": f["geometry"],
                "properties": {
                    "kind": kind,
                    "code": p.get("code"),
                    "licence_type": p.get("type"),
                    "status": (p.get("status") or "").strip(),
                    "holder": p.get("parties"),
                    "granted": clean_date(p.get("dtegranted")),
                    "expires": clean_date(p.get("dteexpires")),
                    "commodities": commodities,
                    "pegmatite_minerals": pegmatite,
                    "area_value": p.get("areavalue"),
                    "area_unit": p.get("areaunit"),
                },
            })
        print(f"{type_name}: {len(feats)} features", file=sys.stderr)

    border = get(wfs_url("mlnr:zambia-border", 0, 10))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "type": "FeatureCollection",
        "source": "Geological Survey of Zambia / Ministry of Mines cadastre (public WFS)",
        "counts": summary,
        "features": out,
        "border": border.get("features", []),
    }))
    print(f"wrote {len(out)} features to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
