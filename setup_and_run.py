import os
import platform
import subprocess
import sys
import shutil
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = ROOT / ".venv"
DB_PATH = ROOT / "db" / "uber_hackathon_v2.db"
MARKER = ROOT / ".setup_complete"


def run(cmd, cwd=None, shell=True):
    print(f"\n>>> Running: {cmd}")
    try:
        subprocess.run(cmd, cwd=cwd, shell=shell, check=True)
    except subprocess.CalledProcessError as e:
        if MARKER.exists():
            MARKER.unlink()
        print(f"❌ Setup failed during: {e.cmd}")
        sys.exit(1)

def ensure_venv():
    """Create venv if missing or corrupted"""
    if VENV.exists():
        if platform.system() == "Windows" and not (VENV / "Scripts" / "python.exe").exists():
            print("⚠️  Invalid or non-Windows virtual environment detected — rebuilding...")
            shutil.rmtree(VENV)
        elif platform.system() != "Windows" and not (VENV / "bin" / "python").exists():
            print("⚠️  Invalid virtual environment detected — rebuilding...")
            shutil.rmtree(VENV)

    if not VENV.exists():
        print(">>> Creating new virtual environment...")
        run(f"{sys.executable} -m venv .venv")

def pip_install():
    """Install Python dependencies safely"""
    print(">>> Installing backend dependencies...")
    if platform.system() == "Windows":
        py = f"{VENV}\\Scripts\\python.exe"
        run(f'"{py}" -m pip install --upgrade pip', cwd=ROOT)
        run(f'"{py}" -m pip install -r requirements.txt', cwd=ROOT)
    else:
        py = f"{VENV}/bin/python"
        run(f"{py} -m pip install --upgrade pip", cwd=ROOT)
        run(f"{py} -m pip install -r requirements.txt", cwd=ROOT)

def init_db():
    """Initialize DB if missing"""
    if DB_PATH.exists():
        print("✔️  Database already exists — skipping creation.")
        return
    print(">>> Creating and initializing database...")
    py = f"{VENV}\\Scripts\\python.exe" if platform.system() == "Windows" else f"{VENV}/bin/python"
    scripts = [
        "scripts/load_from_excel.py",
        "scripts/synthesize_rides.py --target 30000 --write-db",
        "scripts/aggregate_trips.py",
        "scripts/init_db.py",
        "scripts/create_new_tables.py",
    ]
    for script in scripts:
        run(f'"{py}" {script}', cwd=ROOT)

def npm_install():
    """Install frontend dependencies"""
    if (FRONTEND / "node_modules").exists():
        print("✔️  Frontend dependencies already installed.")
        return
    print(">>> Installing frontend dependencies...")
    run("npm install", cwd=FRONTEND)


def run_both():
    """Launch backend and frontend servers, then open browser"""
    print(">>> Launching backend and frontend servers...")
    py = f"{VENV}\\Scripts\\python.exe" if platform.system() == "Windows" else f"{VENV}/bin/python"
    backend_cmd = f'"{py}" -m uvicorn backend.api:app --reload --port 8000'
    frontend_cmd = "npm run dev"

    if platform.system() == "Windows":
        run(f'start cmd /k {backend_cmd}')
        run(f'start cmd /k {frontend_cmd}', cwd=FRONTEND)
    else:
        run(f"{backend_cmd} &", cwd=ROOT)
        run(f"{frontend_cmd} &", cwd=FRONTEND)

    print(">>> Waiting for frontend to start...")
    time.sleep(3)
    webbrowser.open("http://localhost:5173")



def full_setup():
    """Perform full setup only once"""
    ensure_venv()
    pip_install()
    init_db()
    npm_install()
    MARKER.write_text("setup complete\n")
    print("✅ Setup complete — next runs will skip setup automatically.")

if __name__ == "__main__":
    rebuild = "--rebuild" in sys.argv

    # Detect missing setup elements
    missing_venv = not (VENV.exists() and (
        (VENV / "Scripts" / "python.exe").exists() or (VENV / "bin" / "python").exists()
    ))
    missing_node_modules = not (FRONTEND / "node_modules").exists()
    missing_db = not DB_PATH.exists()
    missing_marker = not MARKER.exists()

    setup_needed = rebuild or missing_venv or missing_node_modules or missing_db or missing_marker

    if setup_needed:
        if rebuild:
            print("♻️  Rebuilding environment...")
            if VENV.exists():
                shutil.rmtree(VENV)
            if DB_PATH.exists():
                DB_PATH.unlink()
            if MARKER.exists():
                MARKER.unlink()
        else:
            print("🚀 Detected incomplete setup — starting initial configuration...")

        full_setup()
    else:
        print("✅ Environment already configured — skipping setup.")

    run_both()
