import random
import time
from datetime import datetime, timedelta
from typing import Iterator, List, Optional, Protocol
import numpy as np
import cv2
from pathlib import Path
from app.models import Detection, Observation

class Source(Protocol):
    def observations(self) -> Iterator[Observation]:
        ...

class SyntheticSource:
    """Generates synthetic classroom/workshop observations with realistic variance, dropouts, and aggregate inventory counts."""
    def __init__(self, camera_id: int, num_samples: int = 30, base_people: int = 20, missing_equip: Optional[dict] = None, dropout_prob: float = 0.05):
        self.camera_id = camera_id
        self.num_samples = num_samples
        self.base_people = base_people
        self.missing_equip = missing_equip or {}
        self.dropout_prob = dropout_prob
        self.start_time = datetime.now() - timedelta(minutes=num_samples * 3 // 60)

    def observations(self) -> Iterator[Observation]:
        for i in range(self.num_samples):
            sample_ts = self.start_time + timedelta(seconds=i * 3)
            
            # Simulate occasional occlusion dropout
            if random.random() < self.dropout_prob:
                people_count = max(0, self.base_people - random.randint(5, 12))
            else:
                people_count = max(0, self.base_people + random.randint(-2, 2))
                
            detections = []
            
            # Synthetic frame
            frame = np.zeros((600, 800, 3), dtype=np.uint8)
            frame[:] = (30, 32, 40)
            
            cv2.putText(frame, f"CAM {self.camera_id:02d} | SIMULATED SOURCE | {sample_ts.strftime('%Y-%m-%d %H:%M:%S')}", 
                        (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 200), 2)
            
            for p in range(people_count):
                x1 = random.randint(50, 700)
                y1 = random.randint(100, 450)
                w, h = random.randint(40, 60), random.randint(80, 110)
                x2, y2 = min(800, x1 + w), min(600, y1 + h)
                conf = round(random.uniform(0.75, 0.98), 2)
                detections.append(Detection(cls="person", conf=conf, box=(x1, y1, x2, y2)))
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 165, 0), 2)

            # Aggregate Inventory detections
            inv_defaults = {"inventory": 20}
            for eq_cls, req_cnt in inv_defaults.items():
                loss = self.missing_equip.get(eq_cls, 0)
                actual_cnt = max(0, req_cnt - loss)
                for _ in range(actual_cnt):
                    x1 = random.randint(40, 720)
                    y1 = random.randint(120, 500)
                    w, h = random.randint(30, 50), random.randint(30, 50)
                    x2, y2 = min(800, x1 + w), min(600, y1 + h)
                    conf = round(random.uniform(0.80, 0.95), 2)
                    detections.append(Detection(cls="inventory", conf=conf, box=(x1, y1, x2, y2)))
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 255), 1)

            yield Observation(camera_id=self.camera_id, ts=sample_ts, frame=frame, detections=detections)

class VideoSource:
    """Reads video file using OpenCV and emits frames at sampling intervals."""
    def __init__(self, camera_id: int, video_path: str, sample_interval_s: int = 2, virtual_speedup: float = 1.0):
        self.camera_id = camera_id
        self.video_path = video_path
        self.sample_interval_s = sample_interval_s
        self.virtual_speedup = virtual_speedup
        self.start_time = datetime.now() - timedelta(minutes=30)
        self.estimated_samples = None

    def observations(self) -> Iterator[Observation]:
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            cap.release()
            raise ValueError(f"Could not open video source: {self.video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = int(fps * self.sample_interval_s / self.virtual_speedup)
        if frame_interval < 1:
            frame_interval = 1

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        self.estimated_samples = (total_frames + frame_interval - 1) // frame_interval if total_frames else None
        frame_idx = 0
        sample_count = 0
        while cap.isOpened() and (not total_frames or frame_idx < total_frames):
            if frame_idx:
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break
            sample_ts = self.start_time + timedelta(seconds=sample_count * self.sample_interval_s)
            sample_count += 1
            yield Observation(camera_id=self.camera_id, ts=sample_ts, frame=frame, detections=None)
            frame_idx += frame_interval

        cap.release()
