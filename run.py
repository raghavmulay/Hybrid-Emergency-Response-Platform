import subprocess
import sys
import os
import time
import signal
import requests

BASE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.join(BASE, "frontend")
BACKEND  = os.path.join(BASE, "backend")
VENV_PYTHON = sys.executable

def build_frontend():
    print(">>> Building frontend...")
    r = subprocess.run("pnpm build", cwd=FRONTEND, shell=True)
    if r.returncode != 0:
        print("Frontend build failed. Exiting.")
        sys.exit(1)
    print(">>> Frontend built.\n")

def start_backend():
    print(">>> Starting backend on port 8000...")
    return subprocess.Popen(
        [VENV_PYTHON, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BACKEND,
    )

def start_ngrok():
    print(">>> Starting ngrok tunnel on port 8000...")
    return subprocess.Popen(
        ["ngrok", "http", "8000"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

def get_ngrok_url(retries=10):
    for _ in range(retries):
        time.sleep(2)
        try:
            tunnels = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=3).json()
            for t in tunnels.get("tunnels", []):
                if t["proto"] == "https":
                    return t["public_url"]
        except Exception:
            pass
    return None

if __name__ == "__main__":
    build_frontend()

    backend = start_backend()
    time.sleep(3)

    ngrok = start_ngrok()
    url = get_ngrok_url()

    if url:
        print(f"\n{'='*50}")
        print(f"  App is LIVE at: {url}")
        print(f"  API docs:       {url}/docs")
        print(f"{'='*50}\n")
    else:
        print("Could not get ngrok URL. Check http://127.0.0.1:4040 manually.")

    print("Press Ctrl+C to stop everything.\n")
    try:
        backend.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
        backend.terminate()
        ngrok.terminate()
