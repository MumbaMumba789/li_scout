"""Pure logic: decide which licences are worth a prospector's attention.

Question this answers for the user:
  "Where is lithium-pegmatite ground that is open, lapsing or contested,
   so I know where to put a licence application or a field visit first?"
"""
from __future__ import annotations

from datetime import date, timedelta

LITHIUM = "Lithium"

# Status text the cadastre uses when a licence is not in good standing.
NOT_IN_GOOD_STANDING = {"Non-Compliant", "Pending Renewal", "Renewal Deferred", "Pending Transfer", "Pending Extension", "Pending Reduction"}
LAPSING_WINDOW = timedelta(days=365)


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def reasons(props: dict, today: date) -> list[str]:
    """Why this licence may become available. Empty list = nothing to flag."""
    out: list[str] = []
    status = (props.get("status") or "").strip()
    expires = parse_date(props.get("expires"))

    if is_contested(props):
        out.append("Application pending: someone is already applying for this ground")
    if status in NOT_IN_GOOD_STANDING:
        out.append(f"Status is '{status}'")
    if expires and expires < today:
        if status in ("Active", "Renewal Approved"):
            out.append(f"Expiry date {expires.isoformat()} has passed but status is '{status}': check the register")
        else:
            out.append("Expired")
    elif expires and expires - today <= LAPSING_WINDOW:
        out.append(f"Expires {expires.isoformat()}, within 12 months")
    return out


def has_lithium(props: dict) -> bool:
    return LITHIUM in (props.get("pegmatite_minerals") or [])


CONTESTED_PREFIX = "Application pending"


def is_contested(props: dict) -> bool:
    """Someone is already applying for this ground."""
    return props.get("kind") == "application"


def annotate(feature: dict, today: date) -> dict:
    """Return a copy of a licence feature with the derived fields the app uses.

    opening_soon: a granted licence that is lapsing, expired or not in good standing.
    contested: a pending application (someone already wants this ground).
    """
    props = dict(feature["properties"])
    props["lithium_listed"] = has_lithium(props)
    if props.get("kind") == "processing":
        # Processing sites are context, not licences: no licence rules apply.
        props.update(opening_reasons=[], opening_soon=False, contested=False)
        return {"type": "Feature", "geometry": feature["geometry"], "properties": props}
    all_reasons = reasons(props, today)
    props["contested"] = is_contested(props)
    props["opening_reasons"] = [r for r in all_reasons if not r.startswith(CONTESTED_PREFIX)]
    props["opening_soon"] = bool(props["opening_reasons"]) and not props["contested"]
    return {"type": "Feature", "geometry": feature["geometry"], "properties": props}


def shortlist(features: list[dict], today: date) -> list[dict]:
    """Lithium-listed ground that is opening soon, soonest first."""
    rows = [annotate(f, today) for f in features]
    rows = [r for r in rows if r["properties"]["lithium_listed"] and r["properties"]["opening_soon"]]

    def sort_key(r):
        expires = parse_date(r["properties"].get("expires")) or date.max
        return (expires, r["properties"].get("code") or "")

    return sorted(rows, key=sort_key)
