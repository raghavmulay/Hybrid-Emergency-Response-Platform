# Emergency Response & Information System (ERIS)

A full-stack emergency management platform with a **FastAPI** backend and a **React + TypeScript** frontend. It supports citizen incident reporting, admin dispatch, responder field operations, real-time WebSocket updates, and a full audit trail.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Running the App](#running-the-app)
- [Exposing via ngrok](#exposing-via-ngrok)
- [User Roles & Features](#user-roles--features)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Severity Scoring & Priority Triage](#severity-scoring--priority-triage)
- [Resource Recommendations](#resource-recommendations)
- [Responder Suggestion Algorithm](#responder-suggestion-algorithm)
- [Incident Lifecycle](#incident-lifecycle)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)

---

## Project Overview

ERIS coordinates emergency response between three types of users:

- **Citizens** — report incidents, track their status, and chat in real time.
- **Admins** — review, verify, and dispatch responders to incidents.
- **Responders** — receive assignments, update availability/location, and progress incidents through operational stages.

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
│   ├── .env.example
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

| Tool | Version | Download |
|---|---|---|
| Python | 3.11 or higher | https://www.python.org/downloads/ |
| Node.js | 18 or higher | https://nodejs.org/ |
| pnpm | latest | `npm install -g pnpm` |
| Git | any | https://git-scm.com/ |

---

## Backend Setup

```bash
cd Project/backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env         # Windows
cp .env.example .env           # macOS / Linux
```

Open `.env` and set at minimum:

```env
SECRET_KEY=any-long-random-string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=yourpassword
DATABASE_URL=sqlite:///./emergency.db
```

Start the server:

```bash
uvicorn app.main:app --reload
```

API available at `http://127.0.0.1:8000` — interactive docs at `http://127.0.0.1:8000/docs`.

> The database file (`emergency.db`) and the admin user are created automatically on first startup.

---

## Frontend Setup

```bash
cd Project/frontend
pnpm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

Start the dev server:

```bash
pnpm dev
```

Frontend available at `http://localhost:5173`.

---

## Running the App

Run both servers simultaneously in two separate terminals:

```bash
# Terminal 1 — Backend
cd Project/backend
venv\Scripts\activate
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd Project/frontend
pnpm dev
```

Open `http://localhost:5173` in your browser.

---

## Exposing via ngrok

To share the app with external devices or over the internet:

### 1. Install & authenticate ngrok

Download from https://ngrok.com/download, then:

```bash
ngrok config add-authtoken <your_token>
```

### 2. Tunnel the backend

```bash
ngrok http 8000
```

Copy the forwarding URL, e.g. `https://abc123.ngrok-free.app`.

### 3. Tunnel the frontend

```bash
ngrok http 5173
```

### 4. Update environment files

In `backend/.env`:
```env
BASE_URL=https://<backend-ngrok-url>
```

In `frontend/.env`:
```env
VITE_API_URL=https://<backend-ngrok-url>/api/v1
```

### 5. Restart both servers

```bash
# Backend
uvicorn app.main:app --reload

# Frontend
pnpm dev
```

Share the **frontend** ngrok URL with others.

> Note: Free ngrok URLs change every time you restart ngrok. Use a paid plan with a reserved domain for a stable URL.

> Tip: If API calls are blocked by ngrok's browser warning, add the header `ngrok-skip-browser-warning: true` to your axios client.

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

All endpoints are prefixed with `/api/v1`. Full interactive documentation at `/docs`.

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

## Database Schema

The system uses **SQLite** via SQLAlchemy ORM. There are **9 tables** total.

---

### 1. `users`

Stores all system users regardless of role.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| email | String | unique, not null | Login identifier |
| hashed_password | String | not null | bcrypt hash |
| is_active | Boolean | default false | False until email verified |
| role | String | default `user` | `user` / `admin` / `responder` |
| availability | String | default `OFFLINE` | `AVAILABLE` / `BUSY` / `OFFLINE` |
| latitude | Float | nullable | Responder GPS |
| longitude | Float | nullable | Responder GPS |
| created_at | DateTime | | |

---

### 2. `incidents`

Core table. Every reported emergency lives here.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| incident_number | String | unique, not null | Human-readable ID e.g. `INC-0001` |
| title | String | not null | Short summary |
| description | Text | nullable | Full description |
| type | Enum | not null | See incident types below |
| status | Enum | not null | See incident lifecycle below |
| priority | Enum | not null | `low` / `medium` / `high` / `critical` |
| calculated_priority | Enum | nullable | System-computed priority |
| user_selected_priority | Enum | nullable | Citizen's self-reported priority |
| severity_score | Integer | default 0 | 0–100 computed score |
| priority_reason | Text | nullable | Human-readable scoring explanation |
| latitude / longitude | Float | nullable | Incident location |
| address | Text | nullable | |
| details | JSON | nullable | Dynamic questionnaire answers |
| resource_recommendations | JSON | nullable | List of resource category keys |
| reporter_id | FK → users | not null | |
| created_at / updated_at | DateTime | | |
| possible_duplicate | Boolean | default false | |
| duplicate_of_incident_id | FK → incidents | nullable | Self-referential |
| reported_at | DateTime | nullable | Timestamp when first reported |
| acknowledged_at | DateTime | nullable | |
| verified_at | DateTime | nullable | |
| assigned_at | DateTime | nullable | |
| accepted_at | DateTime | nullable | |
| en_route_at | DateTime | nullable | |
| on_scene_at | DateTime | nullable | |
| resolving_at | DateTime | nullable | |
| resolved_at | DateTime | nullable | |

**Incident Types:** `fire`, `flood`, `medical`, `road_accident`, `building_collapse`, `electrical_hazard`, `missing_person`, `trapped_person`, `security_emergency`, `road_blockage`, `other`

---

### 3. `incident_status_history`

Immutable audit trail of every status change on an incident.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| incident_id | FK → incidents | not null | |
| status | Enum | not null | Status snapshot at this point |
| changed_at | DateTime | | |
| changed_by_id | FK → users | nullable | Null for system-triggered changes |
| reason | Text | nullable | |

---

### 4. `incident_assignments`

Tracks which responder is assigned to which incident and the lifecycle of that assignment.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| incident_id | FK → incidents | not null | |
| responder_id | FK → users | not null | |
| assigned_by | FK → users | not null | Admin who created the assignment |
| assigned_at | DateTime | | |
| status | Enum | default `pending` | `pending` / `accepted` / `rejected` / `cancelled` / `completed` |
| accepted_at | DateTime | nullable | |
| rejected_at | DateTime | nullable | |
| completed_at | DateTime | nullable | |
| rejection_reason | Text | nullable | |
| notes | Text | nullable | Admin notes |

---

### 5. `conversations`

Chat rooms — each linked to an owner (usually the citizen who reported).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| title | String | not null | |
| owner_id | FK → users | not null | |
| created_at | DateTime | | |

---

### 6. `conversation_members`

Many-to-many join between users and conversations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| conversation_id | FK → conversations | not null | |
| user_id | FK → users | not null | |
| joined_at | DateTime | | |

---

### 7. `messages`

Individual chat messages within a conversation. Supports emergency-specific metadata.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| conversation_id | FK → conversations | not null | |
| sender_id | FK → users | not null | |
| content | Text | not null | |
| timestamp | DateTime | | |
| is_emergency | Boolean | default false | |
| priority | String | nullable | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| score | Integer | nullable | 1–10 severity score |
| latitude / longitude | Float | nullable | |
| address | Text | nullable | |
| safe_routes | JSON | nullable | List of route strings |

---

### 8. `predefined_messages`

Admin-managed library of template messages for quick dispatch communication.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| title | String | not null | |
| content | Text | not null | |
| category | String | nullable | e.g. `fire`, `flood`, `medical` |

---

### 9. `audit_logs`

System-wide immutable log of every significant action.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | |
| actor_id | FK → users | nullable | Null for SYSTEM-triggered actions |
| actor_role | String | not null | `CITIZEN` / `RESPONDER` / `ADMIN` / `SYSTEM` |
| action | String | not null, indexed | e.g. `INCIDENT_CREATED`, `RESPONDER_ASSIGNED` |
| entity_type | String | not null, indexed | `INCIDENT` / `ASSIGNMENT` / `RESPONDER` / `USER` |
| entity_id | Integer | nullable | |
| description | Text | not null | Human-readable summary |
| created_at | DateTime | indexed | |

---

## Severity Scoring & Priority Triage

No ML is used. The system uses a **weighted additive scoring model** capped at 100.

### Scoring Table

| Condition | Points |
|---|---|
| Incident type: `fire` or `building_collapse` | +40 |
| Incident type: `medical`, `road_accident`, or `security_emergency` | +30 |
| All other types (`flood`, `missing_person`, etc.) | +10 |
| Injuries reported (`injured` field > 0 or truthy) | +20 |
| People trapped (`trapped` field truthy) | +30 |
| Children involved (`children` field truthy) | +20 |
| Immediate danger or spreading hazard | +25 |
| SOS alert triggered | +50 |

Score is capped at **100**.

### Priority Thresholds

| Score Range | Priority |
|---|---|
| 80 – 100 | `CRITICAL` |
| 50 – 79 | `HIGH` |
| 25 – 49 | `MEDIUM` |
| 0 – 24 | `LOW` |

### Example

A fire (`+40`) with trapped people (`+30`) and children involved (`+20`) = **score 90 → CRITICAL**.

---

## Resource Recommendations

Rule-based mapping in `backend/app/utils/resource.py`. Advisory only — not automatic dispatch.

| Resource Key | Label |
|---|---|
| `AMBULANCE` | Ambulance |
| `FIRE_UNIT` | Fire Unit |
| `RESCUE` | Rescue Team |
| `POLICE` | Police |
| `TRAFFIC` | Traffic Control |
| `HAZMAT` | Hazmat Unit |
| `SEARCH` | Search & Rescue |
| `UTILITY` | Utility / Infrastructure |

### Mapping Logic (by incident type)

| Incident Type | Default Resources | Conditional Additions |
|---|---|---|
| `fire` | FIRE_UNIT | + AMBULANCE if injured, + RESCUE if trapped |
| `road_accident` | POLICE | + AMBULANCE if injured, + RESCUE if trapped, + TRAFFIC if road blocked, + FIRE_UNIT if fire present |
| `medical` | AMBULANCE | — |
| `building_collapse` | RESCUE | + AMBULANCE if injured/trapped, + FIRE_UNIT + HAZMAT if fire or gas hazard |
| `flood` | RESCUE | + SEARCH if trapped, + AMBULANCE if injured |
| `electrical_hazard` | UTILITY, HAZMAT | + AMBULANCE if injured |
| `missing_person` | SEARCH, POLICE | — |
| `trapped_person` | RESCUE, AMBULANCE | — |
| `security_emergency` | POLICE | — |
| `road_blockage` | TRAFFIC, POLICE | — |
| `other` | POLICE | + AMBULANCE if injured |

---

## Responder Suggestion Algorithm

Implemented in `GET /api/v1/responders/suggest/{incident_id}`. No ML — fully deterministic.

### Steps

1. **Filter** — only responders with `availability = AVAILABLE`
2. **Score each candidate:**
   - Count their active (accepted) assignments → `active_assignments`
   - Compute distance to incident using the **Haversine formula** → `distance_km`
3. **Sort** by `(active_assignments ASC, distance_km ASC)`
   - Fewer active jobs = ranked higher
   - Distance is the tiebreaker
   - Responders without GPS coordinates get `distance_km = 9999` (pushed to bottom)

### Haversine Formula

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
distance_km = 6371 × 2 × atan2(√a, √(1−a))
```

The admin sees the ranked list and makes the final dispatch decision.

---

## Incident Lifecycle

```
reported
  └─► acknowledged
        └─► verified
              └─► assigned
                    └─► accepted (responder accepts)
                          └─► en_route
                                └─► on_scene
                                      └─► resolving
                                            └─► resolved

At any point an admin can move to:
  rejected | cancelled | duplicate | false_alarm | needs_information
```

Every transition is recorded in `incident_status_history` with a timestamp, actor, and reason.

---

## Environment Variables

All variables live in `backend/.env`. See `.env.example` for the full list.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | Yes | — | JWT signing secret |
| `ALGORITHM` | No | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `10080` (7 days) | Token lifetime |
| `DATABASE_URL` | No | `sqlite:///./emergency.db` | SQLAlchemy DB URL |
| `ADMIN_EMAIL` | Yes | — | Auto-seeded admin email |
| `ADMIN_PASSWORD` | Yes | — | Auto-seeded admin password |
| `SMTP_HOST` | No | — | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP login email |
| `SMTP_PASSWORD` | No | — | SMTP app password |
| `SMTP_FROM` | No | — | From address for verification emails |
| `BASE_URL` | No | `http://localhost:8000` | Base URL used in email verification links |

> Leave SMTP fields blank to use console-based email logging in development — verification tokens will be printed to the terminal.

---

## Running Tests

### Backend tests

```bash
cd Project
venv\Scripts\activate
pytest tests/
```

### Frontend tests

```bash
cd Project/frontend
pnpm test
```
