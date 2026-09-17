from typing import Tuple, Dict, Any
from app.db.models import IncidentType, IncidentPriority

def calculate_severity(inc_type: IncidentType, details: Dict[str, Any]) -> Tuple[int, IncidentPriority, str]:
    score = 0
    reasons = []

    # Base score by type
    if inc_type in (IncidentType.fire, IncidentType.building_collapse):
        score += 40
        reasons.append(f"High-risk incident type ({inc_type.value})")
    elif inc_type in (IncidentType.medical, IncidentType.road_accident, IncidentType.security_emergency):
        score += 30
        reasons.append(f"Moderate-to-high risk type ({inc_type.value})")
    else:
        score += 10
        reasons.append(f"Standard risk type ({inc_type.value})")

    # Analyze details
    if details.get("injured") or (isinstance(details.get("injured"), int) and details.get("injured") > 0):
        score += 20
        reasons.append("Injuries reported")
    
    if details.get("trapped"):
        score += 30
        reasons.append("People trapped")

    if details.get("children"):
        score += 20
        reasons.append("Children involved")

    if details.get("immediate_danger") or details.get("spreading"):
        score += 25
        reasons.append("Immediate danger or spreading hazard")

    if details.get("sos") is True:
        score += 50
        reasons.append("SOS alert triggered")

    # Cap at 100
    score = min(100, score)

    # Determine priority
    if score >= 80:
        priority = IncidentPriority.critical
    elif score >= 50:
        priority = IncidentPriority.high
    elif score >= 25:
        priority = IncidentPriority.medium
    else:
        priority = IncidentPriority.low

    reason_str = "; ".join(reasons)
    return score, priority, reason_str
