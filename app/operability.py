from typing import List, Dict, Tuple
from app.models import Detection

def box_overlap(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int], margin: int = 40) -> bool:
    """Check if person box overlaps or is near equipment box with margin."""
    ax1, ay1, ax2, ay2 = boxA
    bx1, by1, bx2, by2 = boxB
    
    # Expand boxB by margin
    bx1 -= margin
    by1 -= margin
    bx2 += margin
    by2 += margin

    return not (ax2 < bx1 or ax1 > bx2 or ay2 < by1 or ay1 > by2)

def calculate_sample_usage(detections: List[Detection], class_map: Dict[str, List[str]], required_inventory: Dict[str, int]) -> Dict[str, float]:
    """Computes equipment usage flag (0.0 to 1.0) per class for a single frame sample."""
    if not detections:
        return {c: 0.5 for c in required_inventory.keys()}
        
    person_boxes = [d.box for d in detections if d.cls == "person"]
    usage = {}

    for req_class, mapped_coco_classes in class_map.items():
        equip_boxes = [
            d.box for d in detections
            if d.cls == "inventory" or d.cls in mapped_coco_classes
        ]
        if not equip_boxes or not person_boxes:
            usage[req_class] = 0.5 # default moderate usage factor when unattended
            continue
            
        used_count = 0
        for eq_b in equip_boxes:
            if any(box_overlap(p_b, eq_b) for p_b in person_boxes):
                used_count += 1
                
        usage[req_class] = round(used_count / max(len(equip_boxes), 1), 2)

    return usage

def compute_apparent_operability(samples: List[dict], inventory: Dict[str, int]) -> Dict[str, float]:
    """Computes apparent operability per equipment class over a window of samples.
    
    score_c = presence_ratio_c * (0.5 + 0.5 * usage_frac_c)
    """
    if not samples or not inventory:
        return {c: 0.0 for c in inventory.keys()}
        
    presence_ratios = {c: [] for c in inventory.keys()}
    usage_fracs = {c: [] for c in inventory.keys()}

    for s in samples:
        eq_counts = s.get("equipment_counts", {})
        eq_usage = s.get("equipment_usage", {})
        
        for c, req_n in inventory.items():
            obs_n = eq_counts.get(c, 0)
            p_ratio = min(1.0, obs_n / max(req_n, 1))
            presence_ratios[c].append(p_ratio)
            
            u_frac = eq_usage.get(c, 0.5)
            usage_fracs[c].append(u_frac)

    operability_scores = {}
    for c in inventory.keys():
        mean_p = sum(presence_ratios[c]) / len(presence_ratios[c]) if presence_ratios[c] else 0.0
        mean_u = sum(usage_fracs[c]) / len(usage_fracs[c]) if usage_fracs[c] else 0.5
        usage_factor = 0.5 + (0.5 * mean_u)
        operability_scores[c] = round(mean_p * usage_factor, 2)

    return operability_scores
