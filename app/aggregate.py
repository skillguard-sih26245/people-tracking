import numpy as np
from typing import List, Dict, Any, Tuple

def compute_p90(values: List[float | int], percentile: float = 90.0) -> float:
    """Computes the specified percentile (default p90) of a list of numeric values."""
    if not values:
        return 0.0
    return float(np.percentile(values, percentile))

def aggregate_session_samples(samples: List[Dict[str, Any]], inventory: Dict[str, int], percentile: float = 90.0) -> Dict[str, Any]:
    """Aggregates raw camera samples across a session window using percentile (p90)."""
    if not samples:
        return {
            "observed_attendance": 0,
            "observed_inventory": {c: 0 for c in inventory.keys()},
            "missing_inventory": {c: req for c, req in inventory.items()},
            "infra_compliance_score": 0.0
        }
        
    person_counts = [s["person_count"] for s in samples]
    observed_attendance = int(round(compute_p90(person_counts, percentile)))
    
    observed_inventory = {}
    missing_inventory = {}
    class_ratios = []
    
    for eq_class, req_count in inventory.items():
        class_counts = [s.get("equipment_counts", {}).get(eq_class, 0) for s in samples]
        obs_c = int(round(compute_p90(class_counts, percentile)))
        observed_inventory[eq_class] = obs_c
        missing_inventory[eq_class] = max(0, req_count - obs_c)
        ratio = min(1.0, obs_c / max(req_count, 1))
        class_ratios.append(ratio)
        
    infra_score = round(float(np.mean(class_ratios)) if class_ratios else 1.0, 2)
    
    return {
        "observed_attendance": observed_attendance,
        "observed_inventory": observed_inventory,
        "missing_inventory": missing_inventory,
        "infra_compliance_score": infra_score
    }
