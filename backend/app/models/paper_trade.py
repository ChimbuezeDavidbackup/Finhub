from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

class PositionSide(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"

class PositionStatus(str, Enum):
    PENDING_ENTRY = "PENDING_ENTRY"
    OPEN = "OPEN"
    BE_PROTECTED = "BE_PROTECTED"
    CLOSED_TP1 = "CLOSED_TP1"
    CLOSED_TP2 = "CLOSED_TP2"
    CLOSED_SL = "CLOSED_SL"
    CLOSED_TIME_STOP = "CLOSED_TIME_STOP"
    CLOSED_MANUAL = "CLOSED_MANUAL"
    CANCELLED = "CANCELLED"

class PaperPosition(BaseModel):
    id: str
    symbol: str
    side: PositionSide
    status: PositionStatus
    entry_price: float
    current_mark_price: float
    size: float  # Current active size in base asset
    initial_size: float
    margin_usdt: float  # Current margin locked
    initial_margin_usdt: float
    leverage: float = 1.0
    stop_loss: float
    initial_stop_loss: float
    take_profit_1: float
    take_profit_2: float
    trailing_sl_active: bool = False
    partial_tp1_filled: bool = False
    unrealized_pnl_dollars: float = 0.0
    unrealized_pnl_percent: float = 0.0
    realized_pnl_dollars: float = 0.0
    realized_pnl_percent: float = 0.0
    signal_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None
    max_hold_minutes: int = 90
    elapsed_minutes: int = 0
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    strategy_profile: str = "INTRADAY_15M"
    fees_paid_dollars: float = 0.0
    slippage_bps: float = 1.5

class PaperAccount(BaseModel):
    account_id: str = "demo_primary"
    balance_usdt: float = 10000.0
    equity_usdt: float = 10000.0
    free_margin_usdt: float = 10000.0
    used_margin_usdt: float = 0.0
    unrealized_pnl_usdt: float = 0.0
    realized_pnl_usdt: float = 0.0
    open_positions: List[PaperPosition] = []
    closed_positions: List[PaperPosition] = []
    win_rate: float = 0.0
    profit_factor: float = 0.0
    total_trades_count: int = 0
    winning_trades_count: int = 0
    losing_trades_count: int = 0
    rl_policy: Optional[dict] = None

class PaperTradeOrderRequest(BaseModel):
    symbol: str
    side: PositionSide
    margin_usdt: float = 1000.0
    leverage: float = 1.0
    signal_id: Optional[str] = None
    strategy_profile: str = "INTRADAY_15M"  # "SCALP_5M", "INTRADAY_15M", "SWING_1H"
    max_hold_minutes: Optional[int] = None
    custom_entry_price: Optional[float] = None
    custom_stop_loss: Optional[float] = None
    custom_take_profit_1: Optional[float] = None
    custom_take_profit_2: Optional[float] = None

class ClosePositionRequest(BaseModel):
    position_id: str
    reason: str = "MANUAL_CLOSE"

class MoveBreakevenRequest(BaseModel):
    position_id: str
