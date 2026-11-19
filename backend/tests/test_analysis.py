from datetime import date

from liscout.analysis import annotate, reasons, shortlist

TODAY = date(2026, 11, 19)


def licence(**props):
    base = {"kind": "large_exploration", "code": "X", "status": "Active", "expires": "2030-01-01",
            "pegmatite_minerals": ["Lithium"]}
    base.update(props)
    return {"type": "Feature", "geometry": None, "properties": base}


def test_active_licence_far_from_expiry_is_not_flagged():
    assert reasons(licence()["properties"], TODAY) == []


def test_non_compliant_is_flagged():
    assert "Status is 'Non-Compliant'" in reasons(licence(status="Non-Compliant")["properties"], TODAY)


def test_expiry_within_a_year_is_flagged():
    r = reasons(licence(expires="2027-06-01")["properties"], TODAY)
    assert any("within 12 months" in x for x in r)


def test_expired_licence_is_flagged():
    assert "Expired" in reasons(licence(expires="2026-01-01", status="Expired")["properties"], TODAY)


def test_application_is_flagged_as_pending():
    r = reasons(licence(kind="application", status="Application")["properties"], TODAY)
    assert any("Application pending" in x for x in r)


def test_shortlist_keeps_only_lithium_and_sorts_soonest_first():
    feats = [
        licence(code="late", expires="2027-03-01", status="Pending Renewal"),
        licence(code="none", expires="2027-03-01", pegmatite_minerals=[]),
        licence(code="soon", expires="2027-01-01"),
        licence(code="fine"),
    ]
    rows = shortlist(feats, TODAY)
    assert [r["properties"]["code"] for r in rows] == ["soon", "late"]


def test_annotate_sets_lithium_flag():
    a = annotate(licence(), TODAY)
    assert a["properties"]["lithium_listed"] is True
    assert a["properties"]["opening_soon"] is False


def test_application_is_contested_not_opening():
    a = annotate(licence(kind="application", status="Application"), TODAY)
    assert a["properties"]["contested"] is True
    assert a["properties"]["opening_soon"] is False


def test_shortlist_excludes_applications():
    rows = shortlist([licence(kind="application", status="Application", code="app")], TODAY)
    assert rows == []


def test_past_expiry_with_active_status_asks_to_check_register():
    r = reasons(licence(expires="2021-01-01", status="Active")["properties"], TODAY)
    assert any("check the register" in x for x in r)
