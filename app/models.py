from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import numpy as np

@dataclass
class Detection:
    cls: str
    conf: float
    box: Tuple[int, int, int, int]  # x1, y1, x2, y2

@dataclass
class Observation:
    camera_id: int
    ts: datetime
    frame: Optional[np.ndarray] = None
    detections: Optional[List[Detection]] = None

@dataclass
class SampleRecord:
    id: Optional[int]
    camera_id: int
    ts: str
    person_count: int
    equipment_counts: Dict[str, int]
    equipment_usage: Dict[str, float]

@dataclass
class AlertRecord:
    id: Optional[int]
    centre_id: int
    ts: str
    type: str  # 'attendance' | 'infrastructure' | 'operability'
    level: str # 'normal' | 'warning' | 'critical'
    value: float
    threshold: float
    evidence_path: Optional[str] = None
    evidence_hash: Optional[str] = None
    resolved: bool = False
