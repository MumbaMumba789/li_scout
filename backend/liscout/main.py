"""LiScout API: lithium-pegmatite ground in Zambia that is open, lapsing or contested."""
import csv
import io
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import analysis
from .data import load, today

WEB = Path(__file__).resolve().parents[2] / "web"

app = FastAPI(title="LiScout", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")


def all_features():
    return load()["features"]


@app.get("/api/meta")
def meta():
    d = load()
    return {
        "name": "LiScout",
        "source": d.get("source"),
        "counts": d.get("counts"),
        "as_of": today().isoformat(),
        "lithium_note": "Lithium is listed as a commodity on the licence. It does not confirm a deposit.",
    }


@app.get("/api/summary")
def summary():
    t = today()
    feats = [analysis.annotate(f, t)["properties"] for f in all_features()]
    lith = [p for p in feats if p["lithium_listed"]]
    return {
        "licences_and_applications": len(feats),
        "lithium_listed": len(lith),
        "lithium_opening_soon": sum(1 for p in lith if p["opening_soon"]),
        "lithium_by_kind": {k: sum(1 for p in lith if p["kind"] == k) for k in sorted({p["kind"] for p in lith})},
        "as_of": t.isoformat(),
    }


@app.get("/api/licences")
def licences(
    kind: str | None = Query(None, description="large_exploration, small_exploration, mining or application"),
    lithium: bool = Query(False, description="only ground that lists lithium"),
    opening: bool = Query(False, description="only ground that is opening soon"),
):
    t = today()
    out = []
    for f in all_features():
        a = analysis.annotate(f, t)
        p = a["properties"]
        if kind and p["kind"] != kind:
            continue
        if lithium and not p["lithium_listed"]:
            continue
        if opening and not p["opening_soon"]:
            continue
        out.append(a)
    return {"type": "FeatureCollection", "features": out}


@app.get("/api/shortlist")
def shortlist():
    rows = analysis.shortlist(all_features(), today())
    return {"count": len(rows), "items": [r["properties"] | {"geometry_present": r["geometry"] is not None} for r in rows]}


@app.get("/api/shortlist.csv")
def shortlist_csv():
    rows = analysis.shortlist(all_features(), today())
    buf = io.StringIO()
    cols = ["code", "kind", "licence_type", "status", "holder", "granted", "expires", "pegmatite_minerals", "opening_reasons"]
    w = csv.writer(buf)
    w.writerow(cols)
    for r in rows:
        p = r["properties"]
        w.writerow([
            p.get("code"), p.get("kind"), p.get("licence_type"), p.get("status"), p.get("holder"),
            p.get("granted"), p.get("expires"), "; ".join(p.get("pegmatite_minerals") or []),
            "; ".join(p.get("opening_reasons") or []),
        ])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=liscout-shortlist.csv"})


@app.get("/api/border")
def border():
    return {"type": "FeatureCollection", "features": load().get("border", [])}


if WEB.exists():
    app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
