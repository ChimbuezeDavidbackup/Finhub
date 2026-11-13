import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional, List
from app.models.signal import Signal
from app.modules.market_data.crypto_feed import crypto_feed
from app.modules.regime.detector import regime_detector
from app.modules.sentiment.news_feed import news_engine
from app.modules.ai_engine.arbiter import ai_arbiter
from app.core.websocket_hub import ws_hub

logger = logging.getLogger("finhub.signals_manager")

class SignalsManager:
    def __init__(self):
        self.active_signals: Dict[str, Signal] = {}
        self._is_running = False

    def _get_key(self, symbol: str, strategy_profile: str) -> str:
        return f"{symbol}_{strategy_profile}"

    async def get_active_signal(self, symbol: str = "BTC/USDT", strategy_profile: str = "INTRADAY_15M") -> Optional[Signal]:
        key = self._get_key(symbol, strategy_profile)
        signal = self.active_signals.get(key)
        if not signal or signal.validity_window.is_expired:
            signal = await self.generate_fresh_signal(symbol, strategy_profile)
        return signal

    async def generate_fresh_signal(
        self,
        symbol: str = "BTC/USDT",
        strategy_profile: str = "INTRADAY_15M",
        preferred_direction: Optional[str] = None
    ) -> Signal:
        logger.info(f"Generating fresh {strategy_profile} signal for {symbol}...")
        if strategy_profile == "MICRO_1M":
            tf = "1m"
        elif strategy_profile == "SCALP_5M":
            tf = "5m"
        elif strategy_profile == "SWING_1H":
            tf = "1h"
        elif strategy_profile == "MACRO_4H":
            tf = "4h"
        else:
            tf = "15m"
        candles = await crypto_feed.fetch_candles(symbol, timeframe=tf, limit=60)
        ticker = await crypto_feed.fetch_ticker(symbol)
        orderbook = await crypto_feed.fetch_orderbook(symbol, limit=20)
        sentiment = await news_engine.get_latest_sentiment(symbol)
        regime = regime_detector.detect_regime(symbol, candles, sentiment)

        signal = await ai_arbiter.generate_signal(
            symbol=symbol,
            candles=candles,
            ticker=ticker,
            orderbook=orderbook,
            regime=regime,
            sentiment=sentiment,
            strategy_profile=strategy_profile,
            preferred_direction=preferred_direction
        )

        key = self._get_key(symbol, strategy_profile)
        self.active_signals[key] = signal
        await ws_hub.broadcast("NEW_SIGNAL", signal.model_dump(mode="json"))
        return signal

    async def start_background_timer(self):
        """Ticks every second to decrement remaining validity window and broadcast to WebSocket clients."""
        self._is_running = True
        logger.info("Signal validity countdown loop started.")
        while self._is_running:
            try:
                now = datetime.utcnow()
                for key, signal in list(self.active_signals.items()):
                    if signal.status != "ACTIVE":
                        continue

                    rem_seconds = int((signal.validity_window.expires_at - now).total_seconds())
                    if rem_seconds <= 0:
                        signal.validity_window.seconds_remaining = 0
                        signal.validity_window.is_expired = True
                        signal.status = "EXPIRED"
                        logger.info(f"Signal {signal.id} ({signal.symbol} {signal.strategy_profile}) validity expired.")
                        await ws_hub.broadcast("SIGNAL_EXPIRED", {
                            "signal_id": signal.id,
                            "symbol": signal.symbol,
                            "strategy_profile": signal.strategy_profile
                        })
                        # Auto-regenerate fresh signal
                        asyncio.create_task(self.generate_fresh_signal(signal.symbol, signal.strategy_profile))
                    else:
                        signal.validity_window.seconds_remaining = rem_seconds
                
                # Broadcast window ticks every 2 seconds
                if int(now.timestamp()) % 2 == 0:
                    for key, sig in self.active_signals.items():
                        await ws_hub.broadcast("WINDOW_TICK", {
                            "symbol": sig.symbol,
                            "strategy_profile": sig.strategy_profile,
                            "signal_id": sig.id,
                            "seconds_remaining": sig.validity_window.seconds_remaining,
                            "minutes_display": f"{sig.validity_window.seconds_remaining // 60}m {sig.validity_window.seconds_remaining % 60:02d}s"
                        })

                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error in countdown timer loop: {e}")
                await asyncio.sleep(2)

    def stop(self):
        self._is_running = False

signals_manager = SignalsManager()
