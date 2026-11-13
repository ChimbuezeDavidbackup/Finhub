from abc import ABC, abstractmethod
from typing import List
from app.models.market import Candle, Ticker, OrderbookSnapshot

class BaseMarketDataProvider(ABC):
    @abstractmethod
    async def initialize(self):
        """Initialize connection or exchange client."""
        pass

    @abstractmethod
    async def close(self):
        """Close connection."""
        pass

    @abstractmethod
    async def fetch_candles(self, symbol: str, timeframe: str = "15m", limit: int = 100) -> List[Candle]:
        """Fetch historical and live OHLCV candlestick data."""
        pass

    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> Ticker:
        """Fetch latest price ticker."""
        pass

    @abstractmethod
    async def fetch_orderbook(self, symbol: str, limit: int = 20) -> OrderbookSnapshot:
        """Fetch orderbook depth snapshot."""
        pass
