from typing import Tuple, Dict, Any
from app.db.models import IncidentType, IncidentPriority


def calculate_severity(inc_type: IncidentType, details: Dict[str, Any]) -> Tuple[int, IncidentPriority, str]:
    score = 0
    reasons = []

    d = details or {}

    # ── Base score by disaster type ──────────────────────────────────────────
    HIGH_RISK = (IncidentType.earthquake, IncidentType.building_collapse, IncidentType.mass_casualty)
    MED_RISK  = (IncidentType.wildfire, IncidentType.cyclone, IncidentType.industrial_hazard,
                 IncidentType.infrastructure_failure)

    if inc_type in HIGH_RISK:
        score += 40
        reasons.append(f"High-risk disaster type ({inc_type.value})")
    elif inc_type in MED_RISK:
        score += 30
        reasons.append(f"Moderate-risk disaster type ({inc_type.value})")
    else:
        score += 10
        reasons.append(f"Standard disaster type ({inc_type.value})")

    # ── Detail-driven modifiers ───────────────────────────────────────────────
    injured = _int(d.get("injured"))
    if injured > 0:
        score += 20
        reasons.append(f"{injured} injured reported")

    if _truthy(d.get("trapped")):
        score += 30
        reasons.append("People trapped")

    if _truthy(d.get("children")):
        score += 20
        reasons.append("Children involved")

    if _truthy(d.get("immediate_rescue")) or _truthy(d.get("immediate_danger")):
        score += 25
        reasons.append("Immediate rescue required")

    if _truthy(d.get("spreading")) or _truthy(d.get("evacuation_required")):
        score += 20
        reasons.append("Spreading / evacuation required")

    if _truthy(d.get("mass_casualty")) or _int(d.get("affected")) >= 50:
        score += 25
        reasons.append("Mass casualty / large-scale impact")

    if _truthy(d.get("chemical_leak")) or _truthy(d.get("hazmat")):
        score += 20
        reasons.append("Hazardous material involved")

    if _truthy(d.get("critical_infrastructure_down")):
        score += 20
        reasons.append("Critical infrastructure failure")

    if _truthy(d.get("sos")):
        score += 50
        reasons.append("SOS alert triggered")

    score = min(100, score)

    if score >= 80:
        priority = IncidentPriority.critical
    elif score >= 50:
        priority = IncidentPriority.high
    elif score >= 25:
        priority = IncidentPriority.medium
    else:
        priority = IncidentPriority.low

    return score, priority, "; ".join(reasons)


def _truthy(val) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "yes", "1")
    return bool(val)


def _int(val) -> int:
    try:
        return int(val or 0)
    except (TypeError, ValueError):
        return 0
