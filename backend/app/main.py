import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.database import init_db
from app.core.websocket_hub import ws_hub
from app.modules.market_data.crypto_feed import crypto_feed
from app.modules.signals.manager import signals_manager
from app.modules.paper_trading.engine import paper_engine
from app.modules.ai_engine.rl_policy import rl_policy_engine
from app.modules.ai_engine.ml_model import finhub_ml_model
from app.api.v1.signals import router as signals_router
from app.api.v1.paper import router as paper_router
from app.api.v1.market import router as market_router
from app.api.v1.ws import router as ws_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("finhub.main")

async def market_ticker_stream_loop():
    """Background task that periodically pulls market ticks, updates open paper positions, and broadcasts ticks."""
    logger.info("Starting live market tick background loop...")
    while True:
        try:
            for sym in settings.SUPPORTED_SYMBOLS:
                ticker = await crypto_feed.fetch_ticker(sym)
                
                # Update open paper positions with live market mark price
                paper_engine.update_positions_with_market_tick(sym, ticker.price)

                # Broadcast live tick
                await ws_hub.broadcast("TICK", {
                    "symbol": ticker.symbol,
                    "price": ticker.price,
                    "change_24h_percent": ticker.change_24h_percent,
                    "change_24h": ticker.change_24h_percent,
                    "high_24h": ticker.high_24h,
                    "low_24h": ticker.low_24h,
                    "volume_24h": ticker.volume_24h,
                    "timestamp": ticker.timestamp
                })
            
            # Broadcast paper account summary if there are active positions
            acc_summary = paper_engine.get_account_summary()
            await ws_hub.broadcast("PAPER_ACCOUNT_UPDATE", acc_summary.model_dump(mode="json"))

            await asyncio.sleep(1.5)
        except Exception as e:
            logger.error(f"Error in market ticker stream loop: {e}")
            await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Finhub backend services...")
    await init_db()
    finhub_ml_model.initialize_or_load()
    await rl_policy_engine.initialize_from_db()
    await paper_engine.initialize_from_db()
    await crypto_feed.initialize()

    # Pre-generate initial active signals
    for sym in settings.SUPPORTED_SYMBOLS:
        try:
            await signals_manager.generate_fresh_signal(sym)
        except Exception as e:
            logger.warning(f"Initial signal generation for {sym} failed: {e}")

    # Launch background async loops
    timer_task = asyncio.create_task(signals_manager.start_background_timer())
    stream_task = asyncio.create_task(market_ticker_stream_loop())

    yield

    logger.info("Shutting down Finhub backend services...")
    signals_manager.stop()
    timer_task.cancel()
    stream_task.cancel()
    await crypto_feed.close()

app = FastAPI(
    title="Finhub Trading Intelligence API",
    description="Institutional-grade AI Confluence, Dynamic Risk Engine, and Built-in Paper Trading.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development & PWA
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(signals_router, prefix="/api/v1")
app.include_router(paper_router, prefix="/api/v1")
app.include_router(market_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "supported_symbols": settings.SUPPORTED_SYMBOLS
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
