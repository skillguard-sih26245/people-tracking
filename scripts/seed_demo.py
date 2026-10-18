import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db import init_db, get_connection
import csv

def seed_database():
    print("[+] Initializing SQLite database...")
    init_db()
    
    conn = get_connection()
    cur = conn.cursor()
    
    # Reset existing tables for clean seed
    cur.execute("DELETE FROM alerts")
    cur.execute("DELETE FROM samples")
    cur.execute("DELETE FROM reported_attendance")
    cur.execute("DELETE FROM inventory")
    cur.execute("DELETE FROM cameras")
    cur.execute("DELETE FROM centres")
    
    # 1. Insert Centres
    centres = [(1, "MP4 Video Session", "Uploaded footage")]
    cur.executemany("INSERT INTO centres (id, name, region) VALUES (?, ?, ?)", centres)
    print("  -> Inserted 1 video session centre")
    
    # 2. Insert Cameras
    cameras = [(1, 1, "video", "data/evidence/3968782-hd_1920_1080_24fps.mp4")]
    cur.executemany("INSERT INTO cameras (id, centre_id, source_type, source_uri) VALUES (?, ?, ?, ?)", cameras)
    print("  -> Inserted the MP4 video source")
    
    # 3. Insert Inventory (Unified Inventory Class Only)
    inventories = [(1, "inventory", 20)]
    cur.executemany("INSERT INTO inventory (centre_id, class, required_count) VALUES (?, ?, ?)", inventories)
    print("  -> Inserted the inventory specification")

    # 4. Insert Reported Attendance
    rep_path = Path(__file__).parent.parent / "data" / "reported_attendance.csv"
    if rep_path.exists():
        with open(rep_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                cur.execute(
                    "INSERT INTO reported_attendance (centre_id, session_start, session_end, reported_count) VALUES (?, ?, ?, ?)",
                    (int(r["centre_id"]), r["session_start"], r["session_end"], int(r["reported_count"]))
                )
        print("  -> Inserted reported attendance records")

    conn.commit()
    conn.close()

    print("[SUCCESS] Seed complete. Upload the MP4 and enter the session counts to analyze it.")

if __name__ == "__main__":
    seed_database()
