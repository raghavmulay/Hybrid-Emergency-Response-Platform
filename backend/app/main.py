import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.init_db import create_tables, get_db
from app.db.models import Message
from app.api.v1 import auth, users, conversations, messages

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Emergency Info System API",
    version="1.0.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
)

# ─────────────────────── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────── Startup ─────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_tables()
    logger.info("Database tables created/verified.")

# ─────────────────────── Routers ─────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")

# ─────────────────────── WebSocket Manager ───────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, room: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(room, []).append(websocket)

    def disconnect(self, room: str, websocket: WebSocket):
        connections = self.active_connections.get(room, [])
        if websocket in connections:
            connections.remove(websocket)

    async def broadcast(self, room: str, payload: dict):
        for ws in list(self.active_connections.get(room, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    conversation_id: str,
    websocket: WebSocket,
    token: str = "",
):
    # Allow hard-coded admin token
    ADMIN_USER_ID = "0"
    if token == "admin-token":
        user_id = ADMIN_USER_ID
    else:
        payload = decode_access_token(token, settings.SECRET_KEY) if token else None
        if not payload:
            await websocket.close(code=1008)  # Policy violation
            return
        user_id = payload.get("sub")

    await manager.connect(conversation_id, websocket)
    logger.info(f"WS connected: user={user_id} room={conversation_id}")

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = {"content": raw}

            # Persist message to DB
            db = next(get_db())
            try:
                msg = Message(
                    conversation_id=int(conversation_id),
                    sender_id=int(user_id),
                    content=data.get("content", ""),
                    is_emergency=data.get("is_emergency", False),
                    priority=data.get("priority"),
                    score=data.get("score"),
                    latitude=data.get("latitude"),
                    longitude=data.get("longitude"),
                    address=data.get("address"),
                    safe_routes=data.get("safe_routes"),
                )
                db.add(msg)
                db.commit()
                db.refresh(msg)
                broadcast_payload = {
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "content": msg.content,
                    "is_emergency": msg.is_emergency,
                    "priority": msg.priority,
                    "score": msg.score,
                    "latitude": msg.latitude,
                    "longitude": msg.longitude,
                    "address": msg.address,
                    "safe_routes": msg.safe_routes,
                    "timestamp": msg.timestamp.isoformat(),
                }
            finally:
                db.close()

            await manager.broadcast(conversation_id, broadcast_payload)

    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
        logger.info(f"WS disconnected: user={user_id} room={conversation_id}")


@app.get("/")
def root():
    return {"msg": "Emergency Info System API is running. Visit /docs for the API reference."}
