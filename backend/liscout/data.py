"""Load the cadastre file the pipeline wrote, once, for the API to use."""
import json
from datetime import date
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "licences.geojson"


@lru_cache(maxsize=1)
def load() -> dict:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def today() -> date:
    return date.today()
