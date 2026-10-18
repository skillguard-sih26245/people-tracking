from typing import Protocol, Dict, Any
from app.db import save_sample
from pathlib import Path

class Sink(Protocol):
    def write_sample(self, camera_id: int, ts: str, person_count: int, equipment_counts: dict, equipment_usage: dict) -> int:
        ...

class DBSink:
    def __init__(self, db_path: Path = None):
        self.db_path = db_path

    def write_sample(self, camera_id: int, ts: str, person_count: int, equipment_counts: dict, equipment_usage: dict) -> int:
        if self.db_path:
            return save_sample(camera_id, ts, person_count, equipment_counts, equipment_usage, db_path=self.db_path)
        return save_sample(camera_id, ts, person_count, equipment_counts, equipment_usage)

class HttpSink:
    """Edge Sink: batches sample metadata and posts over HTTP with retry buffer."""
    def __init__(self, endpoint_url: str):
        self.endpoint_url = endpoint_url

    def write_sample(self, camera_id: int, ts: str, person_count: int, equipment_counts: dict, equipment_usage: dict) -> int:
        # In a real edge deployment, this posts JSON to edge ingest API
        return 0
