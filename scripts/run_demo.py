import subprocess
import sys
import time
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent

def main():
    print("==========================================================")
    print(" Training Centre Video Analytics — End-to-End System")
    print("==========================================================")

    # 1. Seed database & run initial analytics pipeline
    print("\n[Step 1/3] Running database seed and analytics pipeline...")
    seed_script = ROOT_DIR / "scripts" / "seed_demo.py"
    res = subprocess.run([sys.executable, str(seed_script)], cwd=ROOT_DIR)
    if res.returncode != 0:
        print("[ERROR] Seed process failed.")
        sys.exit(1)

    # 2. Start FastAPI Backend API
    print("\n[Step 2/3] Starting FastAPI Backend on http://localhost:8000 ...")
    api_cmd = [sys.executable, "-m", "uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
    api_process = subprocess.Popen(api_cmd, cwd=ROOT_DIR)
    time.sleep(2)

    # 3. Start React Dashboard Frontend
    print("\n[Step 3/3] Starting React Dashboard on http://localhost:5173 ...")
    frontend_dir = ROOT_DIR / "frontend"
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_process = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)

    print("\n==========================================================")
    print(" [SUCCESS] System up and running!")
    print("  -> FastAPI Backend API:  http://localhost:8000")
    print("  -> React Dashboard UI:   http://localhost:5173")
    print(" Press Ctrl+C to terminate services.")
    print("==========================================================")

    try:
        api_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down services...")
        api_process.terminate()
        frontend_process.terminate()

if __name__ == "__main__":
    main()
