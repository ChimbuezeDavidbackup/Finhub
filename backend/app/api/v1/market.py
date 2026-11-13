from fastapi import APIRouter, Query, Body
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.models.market import Candle, Ticker, OrderbookSnapshot, MarketRegimeSnapshot
from app.modules.market_data.crypto_feed import crypto_feed
from app.modules.regime.detector import regime_detector
from app.modules.sentiment.news_feed import news_engine
from app.modules.signals.manager import signals_manager
from app.modules.paper_trading.engine import paper_engine
from app.core.websocket_hub import ws_hub

router = APIRouter(prefix="/market", tags=["Market Data"])

class TriggerNewsRequest(BaseModel):
    headline: str
    source: str = "Urgent Geopolitical Wire"
    sentiment_score: float = -0.85
    severity: str = "URGENT"

@router.get("/ticker", response_model=Ticker)
async def get_ticker(symbol: str = Query("BTC/USDT")):
    return await crypto_feed.fetch_ticker(symbol)

@router.get("/candles", response_model=List[Candle])
async def get_candles(
    symbol: str = Query("BTC/USDT"),
    timeframe: str = Query("15m"),
    limit: int = Query(100, ge=10, le=500)
):
    """Returns OHLCV candlestick data ready for charting."""
    return await crypto_feed.fetch_candles(symbol, timeframe=timeframe, limit=limit)

@router.get("/orderbook", response_model=OrderbookSnapshot)
async def get_orderbook(symbol: str = Query("BTC/USDT")):
    return await crypto_feed.fetch_orderbook(symbol, limit=20)

@router.get("/regime", response_model=MarketRegimeSnapshot)
async def get_market_regime(symbol: str = Query("BTC/USDT")):
    candles = await crypto_feed.fetch_candles(symbol, timeframe="15m", limit=50)
    sentiment = await news_engine.get_latest_sentiment(symbol)
    return regime_detector.detect_regime(symbol, candles, sentiment)

@router.get("/news")
async def get_news_sentiment(symbol: str = Query("BTC/USDT")) -> Dict[str, Any]:
    return await news_engine.get_latest_sentiment(symbol)

@router.post("/news/trigger")
async def trigger_breaking_news(req: TriggerNewsRequest):
    """
    Simulates / injects breaking news (e.g. Geopolitical conflict).
    Activates the Volatility Shock regime, defends active paper positions, and regenerates signals.
    """
    alert = await news_engine.trigger_breaking_news(
        headline=req.headline,
        source=req.source,
        sentiment=req.sentiment_score,
        severity=req.severity
    )

    # 1. Active Position Guardian: Protect open long positions if news is bearish shock
    if req.sentiment_score < -0.5:
        for pos in list(paper_engine.positions.values()):
            if pos.side.value == "LONG" and pos.status.value == "OPEN":
                try:
                    paper_engine.move_stop_to_breakeven(pos.id)
                except Exception:
                    pass

    # 2. Broadcast breaking news alert via WebSocket
    await ws_hub.broadcast("BREAKING_NEWS_ALERT", alert)
    await ws_hub.broadcast("REGIME_SHIFT", {
        "regime": "VOLATILITY_SHOCK",
        "description": f"Breaking News Shock: {req.headline}",
        "sizing_multiplier": 0.35
    })

    # 3. Regenerate active signal in Volatility Shock mode (including Gold safe-haven PAXG/USDT)
    for sym in ["BTC/USDT", "ETH/USDT", "SOL/USDT", "PAXG/USDT"]:
        try:
            await signals_manager.generate_fresh_signal(sym)
        except Exception:
            pass

    # 4. Broadcast updated account
    await ws_hub.broadcast("ACCOUNT_UPDATE", paper_engine.get_account_summary().model_dump(mode="json"))
    return {"status": "SHOCK_DEFENSE_ACTIVATED", "alert": alert}

@router.post("/news/dismiss")
async def dismiss_breaking_news():
    news_engine.dismiss_active_shock()
    await ws_hub.broadcast("BREAKING_NEWS_DISMISSED", {})
    return {"status": "DISMISSED"}
