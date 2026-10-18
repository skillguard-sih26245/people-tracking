import os
import csv
import io
import json
import tempfile
import uuid
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.db import (
    init_db, get_connection, get_centres, get_inventory, 
    get_samples_for_camera, get_reported_attendance, get_alerts_for_centre, DEFAULT_DB_PATH
)
from app.sources import VideoSource
from app.detector import YOLODetector
from app.sampler import PipelineSampler
from app.aggregate import aggregate_session_samples
from app.operability import compute_apparent_operability
from app.compliance import evaluate_attendance_compliance, evaluate_infra_compliance, evaluate_operability_compliance
from app.evaluation import generate_demo_accuracy_assessment

app = FastAPI(title="People & Inventory Tracking API", version="2.0.0")
analysis_jobs: Dict[str, Dict[str, Any]] = {}

# Enable CORS for React Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EVIDENCE_DIR = Path(__file__).parent.parent / "data" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static/evidence", StaticFiles(directory=str(EVIDENCE_DIR)), name="evidence")

# Global target config store (People Count & Inventory Count)
TARGET_CONFIG = {
    "expected_people": 15,
    "expected_inventory": 20
}

class TargetUpdateRequest(BaseModel):
    expected_people: Optional[int] = 15
    expected_inventory: Optional[int] = 20
    expected_chairs: Optional[int] = 0
    expected_computers: Optional[int] = 0
    expected_monitors: Optional[int] = 0

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "people-inventory-tracking-api"}

@app.get("/targets")
def get_targets():
    return TARGET_CONFIG

@app.post("/targets")
def update_targets(req: TargetUpdateRequest):
    if req.expected_people is not None:
        TARGET_CONFIG["expected_people"] = req.expected_people
        
    if req.expected_inventory is not None:
        TARGET_CONFIG["expected_inventory"] = req.expected_inventory
    elif req.expected_chairs is not None or req.expected_computers is not None:
        TARGET_CONFIG["expected_inventory"] = (req.expected_chairs or 0) + (req.expected_computers or 0) + (req.expected_monitors or 0)
        
    # Update inventory table in database for Centre 1
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE reported_attendance SET reported_count = ? WHERE centre_id = 1", (TARGET_CONFIG["expected_people"],))
    cur.execute("INSERT OR REPLACE INTO inventory (centre_id, class, required_count) VALUES (1, 'inventory', ?)", (TARGET_CONFIG["expected_inventory"],))
    conn.commit()
    conn.close()
    
    # Re-run analysis for Centre 1
    run_analysis_task(1)
    return {"message": "Targets updated successfully", "targets": TARGET_CONFIG}

@app.get("/live_tracking")
def get_live_tracking():
    """Returns target vs detected counts strictly for People and Inventory."""
    samples = get_samples_for_camera(1) # Default camera
    latest_sample = samples[-1] if samples else {
        "person_count": 0,
        "equipment_counts": {"inventory": 0},
        "ts": "N/A"
    }
    
    det_people = latest_sample.get("person_count", 0)
    det_equip = latest_sample.get("equipment_counts", {})
    det_inventory = det_equip.get("inventory", sum(det_equip.values()) if isinstance(det_equip, dict) else 0)
    
    exp_people = TARGET_CONFIG["expected_people"]
    exp_inventory = TARGET_CONFIG["expected_inventory"]
    
    people_status = "Compliant" if det_people >= exp_people else f"Under Target ({exp_people - det_people} missing)"
    inventory_status = "Compliant" if det_inventory >= exp_inventory else f"Shortfall ({exp_inventory - det_inventory} missing)"
    
    alerts = get_alerts_for_centre(1)
    evidence_url = None
    if alerts and alerts[0].get("evidence_path"):
        filename = os.path.basename(alerts[0]["evidence_path"])
        evidence_url = f"/static/evidence/{filename}"
        
    return {
        "timestamp": latest_sample.get("ts"),
        "people_tracking": {
            "expected": exp_people,
            "detected": det_people,
            "status": people_status
        },
        "inventory_tracking": {
            "expected": exp_inventory,
            "detected": det_inventory,
            "status": inventory_status
        },
        "latest_evidence_url": evidence_url,
        "total_samples_analyzed": len(samples)
    }

@app.get("/accuracy_report")
def get_accuracy_report():
    return generate_demo_accuracy_assessment()

@app.get("/privacy_note")
def get_privacy_note():
    note_path = Path(__file__).parent.parent / "PRIVACY_DESIGN_NOTE.md"
    if note_path.exists():
        with open(note_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    return {"content": "Privacy design note available in repository."}

@app.get("/centres")
def list_centres():
    centres = get_centres()
    results = []
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT centre_id, source_type FROM cameras")
    source_types = {row["centre_id"]: row["source_type"] for row in cur.fetchall()}
    conn.close()
    
    for c in centres:
        cid = c["id"]
        alerts = get_alerts_for_centre(cid)
        samples = get_samples_for_camera(cid)
        inventory = get_inventory(cid)
        reported = get_reported_attendance(cid)
        
        agg = aggregate_session_samples(samples, inventory)
        obs_att = agg["observed_attendance"]
        rep_att = reported["reported_count"] if reported else TARGET_CONFIG["expected_people"]
        infra_score = agg["infra_compliance_score"]
        
        open_alerts = [a for a in alerts if not a["resolved"]]
        level_weights = {"critical": 3, "warning": 1, "normal": 0}
        max_level = "normal"
        risk_score = 0
        
        for a in open_alerts:
            lvl = a["level"]
            risk_score += level_weights.get(lvl, 0)
            if lvl == "critical":
                max_level = "critical"
            elif lvl == "warning" and max_level != "critical":
                max_level = "warning"
                
        results.append({
            "id": cid,
            "name": c["name"],
            "region": c["region"],
            "source_type": source_types.get(cid, "unknown"),
            "risk_level": max_level,
            "risk_score": risk_score,
            "reported_attendance": rep_att,
            "observed_attendance": obs_att,
            "infra_compliance_score": infra_score,
            "alert_count": len(open_alerts)
        })
        
    return results

@app.get("/centres/{centre_id}/summary")
def get_centre_summary(centre_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM centres WHERE id = ?", (centre_id,))
    centre = cur.fetchone()
    conn.close()
    
    if not centre:
        raise HTTPException(status_code=404, detail="Centre not found")

    inventory = get_inventory(centre_id)
    reported = get_reported_attendance(centre_id)
    samples = get_samples_for_camera(centre_id)
    
    agg = aggregate_session_samples(samples, inventory)
    operability = compute_apparent_operability(samples, inventory)
    
    rep_cnt = reported["reported_count"] if reported else TARGET_CONFIG["expected_people"]
    obs_cnt = agg["observed_attendance"]
    att_level, att_ratio = evaluate_attendance_compliance(rep_cnt, obs_cnt)
    infra_level, infra_val = evaluate_infra_compliance(agg["infra_compliance_score"])
    
    inventory_items = []
    for eq_cls, req_n in inventory.items():
        obs_n = agg["observed_inventory"].get(eq_cls, 0)
        missing_n = agg["missing_inventory"].get(eq_cls, 0)
        op_score = operability.get(eq_cls, 0.0)
        inventory_items.append({
            "class": eq_cls,
            "required": req_n,
            "observed_p90": obs_n,
            "missing": missing_n,
            "apparent_operability": op_score,
            "status": "warning" if op_score < 0.50 or missing_n > 0 else "normal"
        })
        
    return {
        "centre": dict(centre),
        "reported_attendance": rep_cnt,
        "observed_attendance_p90": obs_cnt,
        "attendance_deviation_ratio": att_ratio,
        "attendance_status": att_level,
        "infra_compliance_score": agg["infra_compliance_score"],
        "infra_status": infra_level,
        "inventory": inventory_items,
        "session": dict(reported) if reported else None
    }

@app.get("/centres/{centre_id}/samples")
def get_centre_samples(centre_id: int):
    return get_samples_for_camera(centre_id)

@app.get("/centres/{centre_id}/alerts")
def get_centre_alerts(centre_id: int):
    alerts = get_alerts_for_centre(centre_id)
    formatted = []
    for a in alerts:
        d = dict(a)
        if d.get("evidence_path"):
            filename = os.path.basename(d["evidence_path"])
            d["evidence_url"] = f"/static/evidence/{filename}"
        else:
            d["evidence_url"] = None
        formatted.append(d)
    return formatted

def run_analysis_task(centre_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT source_type, source_uri FROM cameras WHERE centre_id = ?", (centre_id,))
    camera = cur.fetchone()
    conn.close()
    if not camera:
        raise ValueError(f"No camera source is configured for centre {centre_id}.")
    if camera["source_type"] != "video":
        raise ValueError(f"Centre {centre_id} is not configured with a video source.")

    video_path = Path(camera["source_uri"])
    if not video_path.is_absolute():
        video_path = Path(__file__).parent.parent / video_path
    if not video_path.is_file():
        raise FileNotFoundError(f"Configured MP4 video was not found: {video_path}")

    source = VideoSource(camera_id=centre_id, video_path=str(video_path), sample_interval_s=2, virtual_speedup=1.0)
    sampler = PipelineSampler(camera_id=centre_id, centre_id=centre_id, source=source, detector=YOLODetector())
    sampler.process_all()

def process_uploaded_video(job_id: str, centre_id: int, video_path: str):
    analysis_jobs[job_id].update(status="processing", processed_samples=0, total_samples=None)
    try:
        source = VideoSource(camera_id=centre_id, video_path=video_path, sample_interval_s=2, virtual_speedup=1.0)
        source.start_time = datetime.now()
        detector = YOLODetector()

        def update_progress(processed, total):
            analysis_jobs[job_id].update(processed_samples=processed, total_samples=total)

        sampler = PipelineSampler(camera_id=centre_id, centre_id=centre_id, source=source, detector=detector)
        sampler.process_all(progress_callback=update_progress)
        analysis_jobs[job_id].update(status="completed", message="Video analysis completed.")
    except Exception as err:
        analysis_jobs[job_id].update(status="failed", message=str(err) or "Video analysis failed.")
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass


@app.post("/analysis/video", status_code=202)
async def upload_video_for_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    centre_id: int = Form(...),
    reported_attendance: int = Form(..., ge=0),
    required_inventory: int = Form(..., ge=0),
):
    if not file.filename or Path(file.filename).suffix.lower() != ".mp4":
        raise HTTPException(status_code=400, detail="Upload an MP4 video file.")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM centres WHERE id = ?", (centre_id,))
    centre = cur.fetchone()
    conn.close()
    if not centre:
        raise HTTPException(status_code=404, detail="Training centre not found.")

    upload_dir = DEFAULT_DB_PATH.parent / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    fd, video_path = tempfile.mkstemp(prefix="analysis_", suffix=".mp4", dir=upload_dir)
    try:
        with os.fdopen(fd, "wb") as destination:
            while chunk := await file.read(1024 * 1024):
                destination.write(chunk)
    except Exception:
        Path(video_path).unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT evidence_path FROM alerts WHERE centre_id = ?", (centre_id,))
    previous_evidence = [row["evidence_path"] for row in cur.fetchall() if row["evidence_path"]]
    cur.execute("DELETE FROM samples WHERE camera_id = ?", (centre_id,))
    cur.execute("DELETE FROM alerts WHERE centre_id = ?", (centre_id,))
    now = datetime.now().isoformat(timespec="seconds")
    cur.execute(
        "INSERT INTO reported_attendance (centre_id, session_start, session_end, reported_count) VALUES (?, ?, ?, ?)",
        (centre_id, now, now, reported_attendance),
    )
    cur.execute(
        "INSERT INTO inventory (centre_id, class, required_count) VALUES (?, 'inventory', ?) "
        "ON CONFLICT(centre_id, class) DO UPDATE SET required_count = excluded.required_count",
        (centre_id, required_inventory),
    )
    conn.commit()
    conn.close()

    evidence_root = (Path(__file__).parent.parent / "data" / "evidence").resolve()
    for evidence_path in previous_evidence:
        candidate = Path(evidence_path)
        if not candidate.is_absolute():
            candidate = evidence_root / candidate
        try:
            resolved = candidate.resolve()
            if resolved.is_relative_to(evidence_root):
                resolved.unlink(missing_ok=True)
        except (OSError, ValueError):
            pass

    job_id = str(uuid.uuid4())
    analysis_jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "centre_id": centre_id,
        "processed_samples": 0,
        "total_samples": None,
        "message": "Video queued for analysis.",
    }
    background_tasks.add_task(process_uploaded_video, job_id, centre_id, video_path)
    return analysis_jobs[job_id]

@app.get("/analysis/jobs/{job_id}")
def get_analysis_job(job_id: str):
    job = analysis_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    return job

@app.post("/run/{centre_id}")
def trigger_analysis(centre_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_analysis_task, centre_id)
    return {"message": f"Analysis started for centre {centre_id}"}

@app.post("/run_all")
def trigger_all_analysis():
    for centre in get_centres():
        run_analysis_task(centre["id"])
    return {"message": "Analysis completed for all centres"}

@app.post("/attendance/upload")
async def upload_attendance_csv(file: UploadFile = File(...)):
    contents = await file.read()
    csv_str = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(csv_str))
    
    conn = get_connection()
    cur = conn.cursor()
    
    rows_inserted = 0
    for row in reader:
        cur.execute(
            "INSERT INTO reported_attendance (centre_id, session_start, session_end, reported_count) VALUES (?, ?, ?, ?)",
            (int(row["centre_id"]), row["session_start"], row["session_end"], int(row["reported_count"]))
        )
        rows_inserted += 1
        
    conn.commit()
    conn.close()
    return {"message": f"Successfully imported {rows_inserted} attendance records"}
