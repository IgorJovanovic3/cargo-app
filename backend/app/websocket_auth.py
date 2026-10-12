"""Authenticate WebSockets without putting bearer tokens in URL query strings."""

from fastapi import HTTPException, WebSocket

from app.database import SessionLocal
from app.dependencies import get_current_user
from app.models import UserType


async def authenticate_websocket(websocket: WebSocket, user_id: int, required_role=None):
    protocols = websocket.scope.get("subprotocols", [])
    if len(protocols) != 2 or protocols[0] != "cargo":
        await websocket.close(code=1008)
        return None
    with SessionLocal() as db:
        try:
            user = get_current_user(protocols[1], db)
        except HTTPException:
            await websocket.close(code=1008)
            return None
        if user.id != user_id or (required_role is not None and user.user_type != required_role):
            await websocket.close(code=1008)
            return None
        return user.id
