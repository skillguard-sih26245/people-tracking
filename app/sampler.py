import logging
from typing import Callable, Dict, Any, List, Optional
from app.sources import Source
from app.detector import YOLODetector
from app.sinks import Sink, DBSink
from app.operability import calculate_sample_usage
from app.evidence import save_evidence_jpeg
from app.db import save_alert, get_inventory, get_reported_attendance, get_samples_for_camera
from app.aggregate import aggregate_session_samples
from app.compliance import evaluate_attendance_compliance, evaluate_infra_compliance, evaluate_operability_compliance, check_persistence
from app.operability import compute_apparent_operability

logger = logging.getLogger("tc_analytics.sampler")

DEFAULT_CLASS_MAPPING = {
    "inventory": [
        "backpack", "handbag", "suitcase", "chair", "couch",
        "dining table", "tv", "laptop", "mouse", "keyboard", "bench",
    ]
}

class PipelineSampler:
    def __init__(self, camera_id: int, centre_id: int, source: Source, detector: YOLODetector, sink: Optional[Sink] = None, class_map: Optional[Dict[str, List[str]]] = None):
        self.camera_id = camera_id
        self.centre_id = centre_id
        self.source = source
        self.detector = detector
        self.sink = sink or DBSink()
        self.class_map = class_map or DEFAULT_CLASS_MAPPING

    def process_all(self, progress_callback: Optional[Callable[[int, Optional[int]], None]] = None) -> List[int]:
        inventory = get_inventory(self.centre_id)
        if not inventory:
            inventory = {"inventory": 20}
            
        sample_ids = []
        sample_records = []
        breach_flags = []
        
        last_frame = None
        last_detections = []
        best_inventory_frame = None
        best_inventory_detections = []
        best_inventory_count = -1

        for obs in self.source.observations():
            ts_str = obs.ts.strftime("%Y-%m-%d %H:%M:%S")
            
            # Detect objects if frame present and detections not pre-computed
            if obs.detections is None and obs.frame is not None:
                detections = self.detector.detect(obs.frame)
            else:
                detections = obs.detections or []

            last_frame = obs.frame
            last_detections = detections

            inventory_count = sum(1 for d in detections if d.cls == "inventory")
            if inventory_count > best_inventory_count:
                best_inventory_frame = obs.frame
                best_inventory_detections = detections
                best_inventory_count = inventory_count

            # Count persons
            person_count = sum(1 for d in detections if d.cls == "person")

            # Count unified inventory items
            equipment_counts = {}
            for req_class in inventory.keys():
                mapped_classes = self.class_map.get(req_class, [req_class])
                # The generic detector intentionally labels every recognized
                # non-person object as "inventory". Keep named-class mapping
                # support for any detections supplied by other sources.
                cnt = sum(
                    1 for d in detections
                    if d.cls == "inventory" or d.cls in mapped_classes
                )
                equipment_counts[req_class] = cnt

            # Compute equipment usage
            equipment_usage = calculate_sample_usage(detections, self.class_map, inventory)

            # Write to Sink
            sid = self.sink.write_sample(self.camera_id, ts_str, person_count, equipment_counts, equipment_usage)
            sample_ids.append(sid)
            sample_records.append({
                "ts": ts_str,
                "person_count": person_count,
                "equipment_counts": equipment_counts,
                "equipment_usage": equipment_usage
            })
            
            # Track sample breach flag for persistence check
            is_breach = False
            for req_cls, req_n in inventory.items():
                if equipment_counts.get(req_cls, 0) < req_n:
                    is_breach = True
            breach_flags.append(is_breach)
            if progress_callback:
                progress_callback(len(sample_ids), getattr(self.source, "estimated_samples", None))

        # Run Window Percentile & Compliance Aggregation
        rep_att = get_reported_attendance(self.centre_id)
        reported_count = rep_att["reported_count"] if rep_att else 20
        
        agg = aggregate_session_samples(sample_records, inventory)
        obs_att = agg["observed_attendance"]
        infra_score = agg["infra_compliance_score"]
        
        operability_scores = compute_apparent_operability(sample_records, inventory)
        
        # Check Attendance Compliance
        att_lvl, att_ratio = evaluate_attendance_compliance(reported_count, obs_att)
        if att_lvl in ["warning", "critical"]:
            ev_path, ev_hash = None, None
            if last_frame is not None:
                ev_path, ev_hash = save_evidence_jpeg(last_frame, last_detections, self.centre_id, sample_ids[-1] if sample_ids else 0, is_synthetic=False)
            save_alert(self.centre_id, sample_records[-1]["ts"], "attendance", att_lvl, att_ratio, 0.20, ev_path, ev_hash)

        # Check Infrastructure Compliance
        infra_lvl, infra_val = evaluate_infra_compliance(infra_score)
        if infra_lvl in ["warning", "critical"] and check_persistence(breach_flags, min_samples=10, breach_fraction=0.6):
            ev_path, ev_hash = None, None
            evidence_frame = best_inventory_frame if best_inventory_frame is not None else last_frame
            evidence_detections = best_inventory_detections if best_inventory_frame is not None else last_detections
            if evidence_frame is not None:
                ev_path, ev_hash = save_evidence_jpeg(evidence_frame, evidence_detections, self.centre_id, sample_ids[-1] if sample_ids else 0, is_synthetic=False)
            save_alert(self.centre_id, sample_records[-1]["ts"], "infrastructure", infra_lvl, infra_val, 0.80, ev_path, ev_hash)

        # Check Operability Compliance
        op_lvl, op_val = evaluate_operability_compliance(operability_scores)
        if op_lvl == "warning":
            ev_path, ev_hash = None, None
            evidence_frame = best_inventory_frame if best_inventory_frame is not None else last_frame
            evidence_detections = best_inventory_detections if best_inventory_frame is not None else last_detections
            if evidence_frame is not None:
                ev_path, ev_hash = save_evidence_jpeg(evidence_frame, evidence_detections, self.centre_id, sample_ids[-1] if sample_ids else 0, is_synthetic=False)
            save_alert(self.centre_id, sample_records[-1]["ts"], "operability", op_lvl, op_val, 0.50, ev_path, ev_hash)

        return sample_ids
