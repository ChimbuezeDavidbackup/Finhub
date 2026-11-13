from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class MarketRegimeType(str, Enum):
    NORMAL_CONFLUENCE = "NORMAL_CONFLUENCE"
    VOLATILITY_SHOCK = "VOLATILITY_SHOCK"
    LIQUIDATION_CASCADE = "LIQUIDATION_CASCADE"
    RANGE_COMPRESSION = "RANGE_COMPRESSION"

class Candle(BaseModel):
    timestamp: int  # Milliseconds epoch
    open: float
    high: float
    low: float
    close: float
    volume: float
    datetime_str: Optional[str] = None

class Ticker(BaseModel):
    symbol: str
    price: float
    bid: float
    ask: float
    change_24h_percent: float
    high_24h: float
    low_24h: float
    volume_24h: float
    timestamp: int

class OrderbookLevel(BaseModel):
    price: float
    amount: float

class OrderbookSnapshot(BaseModel):
    symbol: str
    bids: List[OrderbookLevel]
    asks: List[OrderbookLevel]
    spread: float = 0.0
    imbalance_ratio: float = Field(default=0.0, description="Positive = bid heavy, Negative = ask heavy")
    timestamp: int

class MarketRegimeSnapshot(BaseModel):
    symbol: str
    regime: MarketRegimeType
    volatility_ratio: float = Field(description="Current ATR vs 20-period average ATR")
    volume_velocity: float = Field(description="Current 15m volume vs 20-period average")
    sentiment_delta: float = Field(description="-1.0 to +1.0 news sentiment score")
    description: str
    sizing_multiplier: float = Field(default=1.0, description="Recommended position sizing modifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
