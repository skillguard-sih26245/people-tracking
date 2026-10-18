import logging
import cv2
import numpy as np
from pathlib import Path
from typing import List
from app.models import Detection

logger = logging.getLogger("tc_analytics.detector")

class YOLODetector:
    """Open-vocabulary detector for people and machinery, without custom training."""
    MACHINE_PROMPTS = (
        "machine", "machinery", "industrial machinery", "heavy machinery",
        "industrial equipment", "factory equipment", "machine tool",
        "industrial lathe", "metal lathe", "lathe machine", "CNC machine",
        "machining equipment", "manufacturing equipment", "metalworking machinery",
        "factory machine", "factory machinery", "large industrial machine",
        "large machine with wheels", "machine with a large wheel",
    )
    SPECIFIC_MACHINE_PROMPTS = {"large machine with wheels", "machine with a large wheel"}

    def __init__(self, model_name: str | None = None, conf_thresh: float = 0.02):
        self.conf_thresh = conf_thresh
        self.person_conf_thresh = 0.20
        try:
            from ultralytics import YOLOWorld
            weights = model_name or str(
                Path(__file__).parent.parent / "models" / "yolov8s-worldv2.pt"
            )
            self.model = YOLOWorld(weights)
            self.class_names = ["person", *self.MACHINE_PROMPTS]
            self.model.set_classes(self.class_names)
            logger.info(f"Loaded open-vocabulary model: {weights}")
        except Exception as e:
            raise RuntimeError(f"Could not load open-vocabulary machine detector: {e}") from e

    def detect(self, raw_frame: np.ndarray) -> List[Detection]:
        if raw_frame is None:
            return []

        detections = []

        try:
            # A light denoise pass suppresses grain; CLAHE recovers local
            # contrast in dim areas without changing the source/evidence frame.
            denoised = cv2.bilateralFilter(raw_frame, d=5, sigmaColor=35, sigmaSpace=35)
            lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
            luminance, a_channel, b_channel = cv2.split(lab)
            luminance = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(luminance)
            inference_frame = cv2.cvtColor(
                cv2.merge((luminance, a_channel, b_channel)), cv2.COLOR_LAB2BGR
            )
            results = self.model(inference_frame, verbose=False, conf=self.conf_thresh, iou=0.5)
            for res in results:
                for box in res.boxes:
                    cls_id = int(box.cls[0].item())
                    cls_name = res.names[cls_id].lower()
                    conf = float(box.conf[0].item())
                    xyxy = box.xyxy[0].cpu().numpy().astype(int)
                    if cls_name == "person":
                        if conf < self.person_conf_thresh:
                            continue
                        category = "person"
                    elif cls_name in self.MACHINE_PROMPTS:
                        min_conf = 0.02 if cls_name in self.SPECIFIC_MACHINE_PROMPTS else 0.04
                        if conf < min_conf:
                            continue
                        category = "inventory"
                    else:
                        continue

                    detections.append(Detection(
                        cls=category,
                        conf=round(conf, 2),
                        box=(int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3]))
                    ))
        except Exception as e:
            raise RuntimeError(f"YOLO inference failed: {e}") from e

        # Text prompts can return overlapping boxes for the same machine under
        # different prompt variants. Collapse those so one object counts once.
        return self._deduplicate_overlapping(detections, iou_threshold=0.45)

    @staticmethod
    def _deduplicate_overlapping(detections: List[Detection], iou_threshold: float) -> List[Detection]:
        kept: List[Detection] = []
        for detection in sorted(detections, key=lambda item: item.conf, reverse=True):
            x1, y1, x2, y2 = detection.box
            area = max(0, x2 - x1) * max(0, y2 - y1)
            duplicate = False
            for previous in kept:
                if previous.cls != detection.cls:
                    continue
                px1, py1, px2, py2 = previous.box
                ix1, iy1 = max(x1, px1), max(y1, py1)
                ix2, iy2 = min(x2, px2), min(y2, py2)
                intersection = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                previous_area = max(0, px2 - px1) * max(0, py2 - py1)
                union = area + previous_area - intersection
                if union and intersection / union >= iou_threshold:
                    duplicate = True
                    break
            if not duplicate:
                kept.append(detection)
        return kept
