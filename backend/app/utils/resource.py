"""
Resource recommendation utility for HERP incidents.
Simple rule-based mapping — NOT dispatch, just advisory recommendations.
"""
from typing import Any, Dict, List, Optional
from app.db.models import IncidentType


RESOURCES = {
    "AMBULANCE": "Ambulance",
    "FIRE_UNIT": "Fire Unit",
    "RESCUE": "Rescue Team",
    "POLICE": "Police",
    "TRAFFIC": "Traffic Control",
    "HAZMAT": "Hazmat Unit",
    "SEARCH": "Search & Rescue",
    "UTILITY": "Utility / Infrastructure",
}


def recommend_resources(
    incident_type: IncidentType,
    details: Optional[Dict[str, Any]],
) -> List[str]:
    """
    Returns a list of resource category keys to recommend.
    Based on incident type and structured details.
    """
    d = details or {}
    resources = set()

    injured = int(d.get("injured", 0) or 0)
    trapped = int(d.get("trapped", 0) or 0)
    has_fire = _truthy(d.get("fire_or_smoke")) or _truthy(d.get("fire_spreading"))

    if incident_type == IncidentType.fire:
        resources.add("FIRE_UNIT")
        if injured > 0 or _truthy(d.get("anyone_injured")):
            resources.add("AMBULANCE")
        if trapped > 0 or _truthy(d.get("anyone_trapped")):
            resources.add("RESCUE")

    elif incident_type == IncidentType.road_accident:
        if injured > 0 or _truthy(d.get("anyone_injured")):
            resources.add("AMBULANCE")
        if trapped > 0 or _truthy(d.get("anyone_trapped")):
            resources.add("RESCUE")
        if _truthy(d.get("road_blocked")):
            resources.add("TRAFFIC")
            resources.add("POLICE")
        if has_fire:
            resources.add("FIRE_UNIT")
        if not resources:
            resources.add("POLICE")

    elif incident_type == IncidentType.medical:
        resources.add("AMBULANCE")

    elif incident_type == IncidentType.building_collapse:
        resources.add("RESCUE")
        if injured > 0 or trapped > 0:
            resources.add("AMBULANCE")
        if has_fire or _truthy(d.get("gas_hazard")):
            resources.add("FIRE_UNIT")
            resources.add("HAZMAT")

    elif incident_type == IncidentType.flood:
        resources.add("RESCUE")
        if trapped > 0 or _truthy(d.get("anyone_trapped")):
            resources.add("SEARCH")
        if injured > 0:
            resources.add("AMBULANCE")

    elif incident_type == IncidentType.electrical_hazard:
        resources.add("UTILITY")
        resources.add("HAZMAT")
        if injured > 0:
            resources.add("AMBULANCE")

    elif incident_type == IncidentType.missing_person:
        resources.add("SEARCH")
        resources.add("POLICE")

    elif incident_type == IncidentType.trapped_person:
        resources.add("RESCUE")
        resources.add("AMBULANCE")

    elif incident_type == IncidentType.security_emergency:
        resources.add("POLICE")

    elif incident_type == IncidentType.road_blockage:
        resources.add("TRAFFIC")
        resources.add("POLICE")

    else:  # other / SOS
        resources.add("POLICE")
        if injured > 0:
            resources.add("AMBULANCE")

    return sorted(list(resources))


def _truthy(val) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "yes", "1")
    return bool(val)
