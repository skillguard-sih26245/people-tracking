import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).parent.parent / "data" / "tc_analytics.db"

def get_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: Path = DEFAULT_DB_PATH):
    conn = get_connection(db_path)
    cur = conn.cursor()
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS centres (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        region TEXT NOT NULL
    );
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS cameras (
        id INTEGER PRIMARY KEY,
        centre_id INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_uri TEXT NOT NULL,
        FOREIGN KEY (centre_id) REFERENCES centres(id)
    );
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
        centre_id INTEGER NOT NULL,
        class TEXT NOT NULL,
        required_count INTEGER NOT NULL,
        PRIMARY KEY (centre_id, class),
        FOREIGN KEY (centre_id) REFERENCES centres(id)
    );
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS reported_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        centre_id INTEGER NOT NULL,
        session_start TEXT NOT NULL,
        session_end TEXT NOT NULL,
        reported_count INTEGER NOT NULL,
        FOREIGN KEY (centre_id) REFERENCES centres(id)
    );
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_id INTEGER NOT NULL,
        ts TEXT NOT NULL,
        person_count INTEGER NOT NULL,
        equipment_counts TEXT NOT NULL, -- JSON
        equipment_usage TEXT NOT NULL,  -- JSON
        FOREIGN KEY (camera_id) REFERENCES cameras(id)
    );
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        centre_id INTEGER NOT NULL,
        ts TEXT NOT NULL,
        type TEXT NOT NULL,
        level TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        evidence_path TEXT,
        evidence_hash TEXT,
        resolved INTEGER DEFAULT 0,
        FOREIGN KEY (centre_id) REFERENCES centres(id)
    );
    """)
    
    conn.commit()
    conn.close()

def save_sample(camera_id: int, ts: str, person_count: int, equipment_counts: dict, equipment_usage: dict, db_path: Path = DEFAULT_DB_PATH) -> int:
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO samples (camera_id, ts, person_count, equipment_counts, equipment_usage) VALUES (?, ?, ?, ?, ?)",
        (camera_id, ts, person_count, json.dumps(equipment_counts), json.dumps(equipment_usage))
    )
    conn.commit()
    sample_id = cur.lastrowid
    conn.close()
    return sample_id

def save_alert(centre_id: int, ts: str, alert_type: str, level: str, value: float, threshold: float, evidence_path: str = None, evidence_hash: str = None, db_path: Path = DEFAULT_DB_PATH) -> int:
    conn = get_connection(db_path)
    cur = conn.cursor()
    # Deduplicate open alerts for the same centre and type in current session
    cur.execute(
        "SELECT id FROM alerts WHERE centre_id = ? AND type = ? AND level = ? AND resolved = 0",
        (centre_id, alert_type, level)
    )
    existing = cur.fetchone()
    if existing:
        conn.close()
        return existing["id"]
        
    cur.execute(
        "INSERT INTO alerts (centre_id, ts, type, level, value, threshold, evidence_path, evidence_hash, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
        (centre_id, ts, alert_type, level, value, threshold, evidence_path, evidence_hash)
    )
    conn.commit()
    alert_id = cur.lastrowid
    conn.close()
    return alert_id

def get_centres(db_path: Path = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM centres")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def get_inventory(centre_id: int, db_path: Path = DEFAULT_DB_PATH) -> Dict[str, int]:
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT class, required_count FROM inventory WHERE centre_id = ?", (centre_id,))
    rows = cur.fetchall()
    conn.close()
    return {r["class"]: r["required_count"] for r in rows}

def get_samples_for_camera(camera_id: int, db_path: Path = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM samples WHERE camera_id = ? ORDER BY ts ASC", (camera_id,))
    rows = []
    for r in cur.fetchall():
        d = dict(r)
        d["equipment_counts"] = json.loads(d["equipment_counts"])
        d["equipment_usage"] = json.loads(d["equipment_usage"])
        rows.append(d)
    conn.close()
    return rows

def get_reported_attendance(centre_id: int, db_path: Path = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM reported_attendance WHERE centre_id = ? ORDER BY id DESC LIMIT 1", (centre_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def get_alerts_for_centre(centre_id: int, db_path: Path = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM alerts WHERE centre_id = ? ORDER BY id DESC", (centre_id,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def get_all_alerts(centre_id: Optional[int] = None, db_path: Path = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cur = conn.cursor()
    if centre_id:
        cur.execute("""
            SELECT a.*, c.name as centre_name, c.region as centre_region 
            FROM alerts a 
            LEFT JOIN centres c ON a.centre_id = c.id 
            WHERE a.centre_id = ? 
            ORDER BY a.id DESC
        """, (centre_id,))
    else:
        cur.execute("""
            SELECT a.*, c.name as centre_name, c.region as centre_region 
            FROM alerts a 
            LEFT JOIN centres c ON a.centre_id = c.id 
            ORDER BY a.id DESC
        """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def resolve_alert(alert_id: int, resolved: bool = True, db_path: Path = DEFAULT_DB_PATH) -> bool:
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE alerts SET resolved = ? WHERE id = ?", (1 if resolved else 0, alert_id))
    conn.commit()
    conn.close()
    return True

