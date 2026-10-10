"""
Resource recommendation utility for HERP disaster incidents.
Rule-based mapping — advisory only, not automatic dispatch.
"""
from typing import Any, Dict, List, Optional
from app.db.models import IncidentType


RESOURCES = {
    "AMBULANCE":  "Ambulance",
    "FIRE_UNIT":  "Fire Unit",
    "RESCUE":     "Rescue Team",
    "POLICE":     "Police",
    "TRAFFIC":    "Traffic Control",
    "HAZMAT":     "Hazmat Unit",
    "SEARCH":     "Search & Rescue",
    "UTILITY":    "Utility / Infrastructure",
    "MILITARY":   "Military / Civil Defence",
    "MEDICAL":    "Medical Response Team",
    "EVACUATION": "Evacuation Unit",
}


def recommend_resources(
    incident_type: IncidentType,
    details: Optional[Dict[str, Any]],
) -> List[str]:
    d = details or {}
    resources: set[str] = set()

    injured   = _int(d.get("injured"))
    trapped   = _truthy(d.get("trapped"))
    affected  = _int(d.get("affected"))
    hazmat    = _truthy(d.get("chemical_leak")) or _truthy(d.get("hazmat"))
    evac      = _truthy(d.get("evacuation_required"))
    spreading = _truthy(d.get("spreading"))

    if incident_type == IncidentType.earthquake:
        resources.update(["RESCUE", "MEDICAL"])
        if injured > 0:   resources.add("AMBULANCE")
        if trapped:       resources.add("SEARCH")
        if evac:          resources.add("EVACUATION")
        if affected >= 50: resources.add("MILITARY")

    elif incident_type == IncidentType.flood:
        resources.update(["RESCUE", "EVACUATION"])
        if trapped:       resources.add("SEARCH")
        if injured > 0:   resources.add("AMBULANCE")
        if affected >= 50: resources.add("MILITARY")

    elif incident_type == IncidentType.cyclone:
        resources.update(["RESCUE", "EVACUATION"])
        if injured > 0:   resources.add("AMBULANCE")
        if affected >= 50: resources.add("MILITARY")
        resources.add("UTILITY")

    elif incident_type == IncidentType.landslide:
        resources.update(["RESCUE", "SEARCH"])
        if injured > 0:   resources.add("AMBULANCE")
        if evac:          resources.add("EVACUATION")
        resources.add("TRAFFIC")

    elif incident_type == IncidentType.wildfire:
        resources.update(["FIRE_UNIT", "RESCUE"])
        if injured > 0:   resources.add("AMBULANCE")
        if evac or spreading: resources.add("EVACUATION")
        if affected >= 50: resources.add("MILITARY")

    elif incident_type == IncidentType.building_collapse:
        resources.update(["RESCUE", "SEARCH"])
        if injured > 0 or trapped: resources.add("AMBULANCE")
        if hazmat:        resources.update(["HAZMAT", "FIRE_UNIT"])
        if evac:          resources.add("EVACUATION")

    elif incident_type == IncidentType.industrial_hazard:
        resources.update(["HAZMAT", "FIRE_UNIT"])
        if injured > 0:   resources.add("AMBULANCE")
        if evac:          resources.add("EVACUATION")
        resources.add("POLICE")

    elif incident_type == IncidentType.infrastructure_failure:
        resources.update(["UTILITY", "POLICE"])
        if injured > 0:   resources.add("AMBULANCE")
        if _truthy(d.get("critical_infrastructure_down")): resources.add("MILITARY")

    elif incident_type == IncidentType.mass_casualty:
        resources.update(["AMBULANCE", "MEDICAL", "RESCUE", "POLICE"])
        if evac:          resources.add("EVACUATION")
        resources.add("MILITARY")

    else:  # other
        resources.add("RESCUE")
        if injured > 0:   resources.add("AMBULANCE")
        resources.add("POLICE")

    return sorted(resources)


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
