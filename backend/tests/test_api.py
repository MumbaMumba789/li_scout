from fastapi.testclient import TestClient

from liscout.main import app

client = TestClient(app)


def test_meta_and_summary():
    assert client.get("/api/meta").status_code == 200
    s = client.get("/api/summary").json()
    assert s["licences_and_applications"] > 10000
    assert s["lithium_listed"] > 0


def test_lithium_filter_only_returns_lithium_ground():
    fc = client.get("/api/licences", params={"lithium": True}).json()
    assert fc["features"]
    assert all(f["properties"]["lithium_listed"] for f in fc["features"])


def test_shortlist_csv_has_header():
    r = client.get("/api/shortlist.csv")
    assert r.status_code == 200
    assert r.text.splitlines()[0].startswith("code,kind,licence_type")
