# LiScout Zambia

LiScout helps small-scale prospectors and junior exploration geologists in Zambia find lithium-bearing ground that is about to open. It reads the public Ministry of Mines licence register (published by the Geological Survey of Zambia) and shows:

- which licences and applications list lithium, or the pegmatite minerals that occur with it (tantalum, tin, beryllium, caesium, niobium, tourmaline);
- which of that ground is **opening soon**: granted licences that are lapsing, expired, or not in good standing;
- which ground is **contested**: pending applications for the same ground;
- a soonest-first **shortlist** you can download as a CSV for a field visit.

Status: prototype. The data comes straight from the register. Nothing has been checked on the ground yet.

## What a licence listing lithium does and does not mean

A licence lists the commodities it is held for. Many list several minerals, so a listing shows that lithium is claimed on that ground, not that a deposit has been found. Dates and status come from the register and can be out of date, so the app asks you to check the register when a past expiry date still shows an active status.

## Run it

Needs Python 3.10 or newer. The quickest way:

    ./run.sh

Then open http://localhost:8000 (landing page) or http://localhost:8000/map.html (map).

To set it up by hand:

    cd backend
    python3 -m venv .venv
    . .venv/bin/activate
    pip install -r requirements.txt
    uvicorn liscout.main:app --reload --port 8000

Then open http://localhost:8000 (landing page) or http://localhost:8000/map.html (map). API docs are at /api/docs.

The map loads Leaflet from cdnjs, so the browser needs internet access.

## Refresh the data

The licence data is already in `data/licences.geojson`. To pull the latest register:

    python3 pipeline/fetch_licences.py

The script reads the Survey's public WFS (geoserverprd.gsb.gov.zm). It takes a few minutes and writes the file again.

## Tests

    cd backend
    .venv/bin/python -m pytest -q

## Layout

- `pipeline/fetch_licences.py`: downloads the cadastre layers and writes one GeoJSON file.
- `backend/liscout/analysis.py`: the rules for "opening soon", "contested" and the shortlist. Pure Python, tested.
- `backend/liscout/main.py`: the API (summary, licences, shortlist, CSV) and the static pages.
- `web/`: the landing page (`index.html`) and the map (`map.html`, `map.js`), styled in `app.css`. Primary colour `#2b9348`.
- `data/licences.geojson`: the register extract the app reads.

## Not in this version yet

- Geology: the prospectivity signal is currently only the licence commodity list. The Survey's public GeoServer and portal have no geology layer that this environment can reach, so a geology source is still needed.
- Mineral processing sites are shown as context only (172 features from the Survey's GeoServer).
- Satellite change detection: the imagery hosts are not reachable from the current environment.
- AI: planned for a later step, after the data layers are in place.
- Field checks: nothing has been verified on the ground.

## Data source

Geological Survey of Zambia / Ministry of Mines cadastre, public WFS (`geoserverprd.gsb.gov.zm`). Boundary: Zambia border layer from the same service.
