import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.websocket_hub import ws_hub
from app.modules.market_data.crypto_feed import crypto_feed
from app.modules.signals.manager import signals_manager
from app.modules.paper_trading.engine import paper_engine

logger = logging.getLogger("finhub.api.ws")
router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_hub.connect(websocket)
    try:
        # Send initial snapshot to client
        ticker = await crypto_feed.fetch_ticker("BTC/USDT")
        signal = await signals_manager.get_active_signal("BTC/USDT")
        account = paper_engine.get_account_summary()

        await websocket.send_text(json.dumps({
            "type": "SNAPSHOT",
            "data": {
                "ticker": ticker.model_dump(mode="json"),
                "signal": signal.model_dump(mode="json") if signal else None,
                "account": account.model_dump(mode="json")
            }
        }))

        while True:
            data = await websocket.receive_text()
            # Handle client incoming messages if needed (e.g. ping)
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "PONG"}))
    except WebSocketDisconnect:
        ws_hub.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        ws_hub.disconnect(websocket)
