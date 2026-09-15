# Emergency Internet-Free Communication System (EIFS)

This repository contains the **online baseline** of the EIFS project – a FastAPI backend that provides authentication, user management, conversations, and emergency-aware messaging. The frontend will be added later (React, Flutter, …).

## Quick start (development)
`ash
# Clone the repo (already initialised in this workspace)
# Create a virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn backend/app/main:app --reload
`

The API docs are available at http://127.0.0.1:8000/docs.
