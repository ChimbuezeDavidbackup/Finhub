from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.models.market import MarketRegimeType

class SignalDirection(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    NO_TRADE = "NO_TRADE"
    WAIT = "WAIT"

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    EXTREME = "EXTREME"

class ValidityWindow(BaseModel):
    duration_minutes: int = 30
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    seconds_remaining: int
    is_expired: bool = False
    invalidation_criteria: str = "Setup auto-cancels if entry unfilled before window expiry or if price breaches Stop-Loss."

class TargetLadder(BaseModel):
    entry_min: float
    entry_max: float
    entry_optimal: float
    stop_loss: float
    take_profit_1: float
    take_profit_2: float
    risk_reward_ratio: float = Field(description="e.g. 2.82 for 1:2.82 R:R")
    potential_risk_dollars: float = Field(default=35.0, description="Estimated dollar risk per 1,000 USDT position")
    potential_reward_dollars: float = Field(default=98.0, description="Estimated reward at TP1/TP2 blend")
    est_liquidation_price: float = Field(default=0.0, description="Estimated liquidation price at 5x cross leverage")

class ConfluenceFactors(BaseModel):
    overall_conviction: int = Field(ge=0, le=100, description="Calibrated conviction score 0-100%")
    technical_score: int = Field(ge=0, le=100, description="Technical indicators & market structure score")
    macro_news_score: int = Field(ge=0, le=100, description="Macro calendar & breaking news sentiment score")
    liquidity_score: int = Field(ge=0, le=100, description="Orderbook & liquidation depth score")
    technical_rationale: str
    macro_news_rationale: str
    liquidity_rationale: str
    weights: Dict[str, float] = Field(
        default_factory=lambda: {"technical": 0.45, "macro": 0.30, "orderbook": 0.25},
        description="Learned RL policy feature weights"
    )
    rl_episodes: int = Field(default=0, description="Total self-learning trade episodes completed")
    rl_sharpe: float = Field(default=2.15, description="Rolling risk-adjusted RL Sharpe ratio")
    rl_last_reward: float = Field(default=0.0, description="Last episode R-multiple reward")
    ml_telemetry: Optional[Dict[str, Any]] = Field(default=None, description="Trained ML Ensemble (MLP + GBDT + RF + EM-GMM) probabilities & diagnostics")
    indicator_workings: Optional[Dict[str, Any]] = Field(default=None, description="Exact mathematical indicator levels computed by the AI Arbiter for chart plotting")

class Signal(BaseModel):
    id: str
    symbol: str
    strategy_profile: str = "INTRADAY_15M"  # "SCALP_5M", "INTRADAY_15M", "SWING_1H"
    direction: SignalDirection
    regime: MarketRegimeType
    risk_level: RiskLevel
    recommended_size_multiplier: float = 1.0  # 1.0x normal, 0.35x for shock
    recommended_margin_usdt: float = 1000.0
    recommended_leverage: float = 5.0
    max_holding_minutes: int = 90
    targets: TargetLadder
    validity_window: ValidityWindow
    confluence: ConfluenceFactors
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "ACTIVE"  # ACTIVE, EXPIRED, FILLED, INVALIDATED
