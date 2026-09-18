# Emergency Response & Information System (ERIS)

A full-stack emergency management platform with a **FastAPI** backend and a **React + TypeScript** frontend. It supports citizen incident reporting, admin dispatch, responder field operations, real-time WebSocket updates, and an audit trail.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the App](#running-the-app)
- [User Roles & Features](#user-roles--features)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)

---

## Project Overview

ERIS is designed to coordinate emergency response between three types of users:

- **Citizens** — report incidents, track their status, and chat in real time.
- **Admins** — review, verify, and dispatch responders to incidents.
- **Responders** — receive assignments, update their availability/location, and progress incidents through operational stages.

Key capabilities:
- Automated **severity scoring & priority triage** based on incident type and reported details.
- **Duplicate detection** — flags incidents reported within 100 m and 15 minutes of an existing open incident.
- **Smart responder suggestions** — ranks available responders by workload and proximity.
- **Real-time updates** via WebSocket for chat messages and incident status changes.
- **Full audit log** of every action taken in the system.
- **Email verification** on registration (falls back to console logging in dev mode).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, SQLite, Pydantic v2, python-jose, passlib |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router v6, TanStack Query, Leaflet |
| Real-time | WebSockets (built into FastAPI) |
| Testing | pytest (backend), Vitest + Testing Library (frontend) |

---

## Project Structure

```
Project/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route handlers (auth, users, incidents, responders, conversations, messages, audit)
│   │   ├── core/            # Config, JWT security, email, dependencies
│   │   ├── db/              # SQLAlchemy models & DB init
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── utils/           # Triage scoring, resource recommendations
│   │   └── main.py          # FastAPI app entry point + WebSocket manager
│   ├── .env.example         # Template for environment variables
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API client modules
│   │   ├── components/      # Reusable UI components (maps, layout, modals)
│   │   ├── context/         # Auth context (JWT decode, role)
│   │   ├── hooks/           # WebSocket hooks for incidents and conversations
│   │   ├── pages/           # Route-level page components
│   │   └── routes.tsx       # Role-based route guards
│   ├── package.json
│   └── vite.config.ts
└── tests/                   # Backend integration tests
```

---

## Prerequisites

Make sure the following are installed before you begin:

| Tool | Version | Download |
|---|---|---|
| Python | 3.11 or higher | https://www.python.org/downloads/ |
| Node.js | 18 or higher | https://nodejs.org/ |
| pnpm | latest | `npm install -g pnpm` |
| Git | any | https://git-scm.com/ |

> **Windows users:** Use PowerShell or Command Prompt. All commands below are cross-platform unless noted.

---

## Backend Setup

### 1. Create and activate a virtual environment

```bash
cd Project/backend

python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
# Copy the example file
copy .env.example .env        # Windows
cp .env.example .env          # macOS / Linux
```

Open `.env` and set at minimum:

```env
SECRET_KEY=any-long-random-string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=yourpassword
DATABASE_URL=sqlite:///./emergency.db
```

Leave the SMTP fields blank to use console-based email logging in development (verification tokens will be printed to the terminal).

### 4. Start the backend server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.  
Interactive docs: `http://127.0.0.1:8000/docs`

> The database file (`emergency.db`) and the admin user are created automatically on first startup.

---

## Frontend Setup

### 1. Install dependencies

```bash
cd Project/frontend
pnpm install
```

### 2. Configure the API base URL

The frontend `.env` file should point to the backend:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

If the file doesn't exist, create it at `frontend/.env`.

### 3. Start the dev server

```bash
pnpm dev
```

The frontend will be available at `http://localhost:5173`.

---

## Running the App

Run both servers simultaneously (in two separate terminals):

**Terminal 1 — Backend**
```bash
cd Project/backend
venv\Scripts\activate       # or source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 — Frontend**
```bash
cd Project/frontend
pnpm dev
```

Open `http://localhost:5173` in your browser.

---

## User Roles & Features

### Citizen (default role after email verification)
- Register and verify email
- Report incidents with type, description, location, and dynamic detail fields
- View and track status of their own incidents
- Participate in real-time conversations

### Admin (seeded on startup via `.env`)
- View all incidents with filters (priority, status, type)
- Acknowledge, verify, reject, or cancel incidents
- Dispatch responders using the smart suggestion engine
- Manage users and change roles
- View the full audit log

### Responder (promoted by admin)
- View assigned incidents on a dashboard
- Accept or reject assignments
- Update availability (`AVAILABLE` / `BUSY` / `OFFLINE`) and GPS location
- Progress incidents through operational stages: `en_route → on_scene → resolving → resolved`

---

## API Reference

All endpoints are prefixed with `/api/v1`. Full interactive documentation is at `/docs`.

| Tag | Prefix | Description |
|---|---|---|
| Auth | `/api/v1/auth` | Register, login, email verification |
| Users | `/api/v1/users` | Profile, list users, role management (admin) |
| Incidents | `/api/v1/incidents` | CRUD, status transitions, timeline |
| Responders | `/api/v1/responders` | Availability, location, assignments |
| Conversations | `/api/v1/conversations` | Create/list conversations |
| Messages | `/api/v1/messages` | Send/retrieve messages |
| Audit | `/api/v1/audit` | Audit log (admin only) |
| WebSocket | `/ws/{conversation_id}` | Real-time chat (token query param required) |

---

## Environment Variables

All variables live in `backend/.env`. See `.env.example` for the full list.

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | JWT signing secret — use a long random string in production |
| `ALGORITHM` | No | JWT algorithm, default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token lifetime, default 7 days |
| `DATABASE_URL` | No | SQLAlchemy DB URL, default `sqlite:///./emergency.db` |
| `ADMIN_EMAIL` | Yes | Email for the auto-seeded admin account |
| `ADMIN_PASSWORD` | Yes | Password for the auto-seeded admin account |
| `SMTP_HOST` | No | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | No | SMTP port, default `587` |
| `SMTP_USER` | No | SMTP login email |
| `SMTP_PASSWORD` | No | SMTP app password |
| `SMTP_FROM` | No | From address for verification emails |
| `BASE_URL` | No | Base URL used in email links, default `http://localhost:8000` |

---

## Running Tests

### Backend tests

```bash
cd Project
# Activate the virtual environment first
venv\Scripts\activate

pytest tests/
```

### Frontend tests

```bash
cd Project/frontend
pnpm test
```
