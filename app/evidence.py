import os
import cv2
import hashlib
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional
from app.models import Detection

EVIDENCE_DIR = Path(__file__).parent.parent / "data" / "evidence"

def apply_privacy_blur(frame: np.ndarray, detections: List[Detection]) -> np.ndarray:
    """Blurs all person bounding boxes to ensure privacy compliance."""
    output = frame.copy()
    h, w = output.shape[:2]
    
    for det in detections:
        if det.cls == "person":
            x1, y1, x2, y2 = det.box
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            if x2 > x1 and y2 > y1:
                roi = output[y1:y2, x1:x2]
                blurred = cv2.GaussianBlur(roi, (51, 51), 0)
                output[y1:y2, x1:x2] = blurred
                
    return output

def save_evidence_jpeg(
    frame: np.ndarray, 
    detections: List[Detection], 
    centre_id: int, 
    sample_id: int, 
    is_synthetic: bool = False
) -> Tuple[str, str]:
    """Generates privacy-safe annotated JPEG evidence image showing both People Bounding Boxes & Inventory Bounding Boxes."""
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Apply privacy protection (blur all person regions)
    safe_frame = apply_privacy_blur(frame, detections)
    
    # 2. Draw annotations for BOTH People and Inventory items
    for det in detections:
        x1, y1, x2, y2 = det.box
        if det.cls == "person":
            color = (255, 140, 0) # Dark Orange for People
            label = "Person [blurred]"
        else:
            color = (0, 215, 255) # Bright Cyan/Yellow for Inventory Items
            label = f"{det.cls.title()} ({det.conf:.2f})"
            
        cv2.rectangle(safe_frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(safe_frame, label, (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    # Count statistics overlay banner
    person_cnt = sum(1 for d in detections if d.cls == "person")
    inventory_cnt = sum(1 for d in detections if d.cls != "person")
    
    cv2.rectangle(safe_frame, (0, 0), (safe_frame.shape[1], 40), (15, 20, 30), -1)
    stats_text = f"DETECTED PEOPLE COUNT: {person_cnt} | DETECTED INVENTORY COUNT: {inventory_cnt}"
    cv2.putText(safe_frame, stats_text, (20, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 242, 254), 2)

    # Privacy Compliance Watermark Banner at bottom
    cv2.rectangle(safe_frame, (0, safe_frame.shape[0] - 35), (safe_frame.shape[1], safe_frame.shape[0]), (20, 20, 20), -1)
    watermark = "PRIVACY COMPLIANT AUDIT | FACES BLURRED | INVENTORY & PEOPLE TRACKING"
    if is_synthetic:
        watermark += " [SIMULATED DATA]"
    cv2.putText(safe_frame, watermark, (15, safe_frame.shape[0] - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 150), 1)

    filename = f"evidence_c{centre_id}_s{sample_id}.jpg"
    filepath = EVIDENCE_DIR / filename
    
    cv2.imwrite(str(filepath), safe_frame)
    
    # Calculate SHA-256 for audit integrity
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        hasher.update(f.read())
    sha256_hash = hasher.hexdigest()

    return str(filepath), sha256_hash
