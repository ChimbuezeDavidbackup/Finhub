import asyncio
import json
import logging
from typing import Set, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger("finhub.websocket")

class WebSocketHub:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message_type: str, data: Any):
        if not self.active_connections:
            return
        payload = json.dumps({"type": message_type, "data": data})
        dead_connections = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                dead_connections.add(connection)
        
        for dead in dead_connections:
            self.active_connections.discard(dead)

ws_hub = WebSocketHub()
