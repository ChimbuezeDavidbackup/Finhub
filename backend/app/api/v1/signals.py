from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional, Dict, Any
from app.models.signal import Signal
from app.modules.signals.manager import signals_manager
from app.modules.ai_engine.rl_policy import rl_policy_engine
from app.modules.ai_engine.ml_model import finhub_ml_model

router = APIRouter(prefix="/signals", tags=["Signals"])

@router.get("/active", response_model=Signal)
@router.get("/latest", response_model=Signal)
async def get_active_signal(
    symbol: str = Query("BTC/USDT", description="Trading pair symbol"),
    strategy_profile: str = Query("INTRADAY_15M", description="Strategy horizon: MICRO_1M, SCALP_5M, INTRADAY_15M, SWING_1H, or MACRO_4H")
):
    """Returns the current high-conviction active signal with live window countdown."""
    signal = await signals_manager.get_active_signal(symbol, strategy_profile)
    if not signal:
        raise HTTPException(status_code=404, detail=f"No active signal found for {symbol}")
    return signal

@router.post("/refresh", response_model=Signal)
async def refresh_signal(
    symbol: str = Query("BTC/USDT", description="Trading pair symbol"),
    strategy_profile: str = Query("INTRADAY_15M", description="Strategy horizon: MICRO_1M, SCALP_5M, INTRADAY_15M, SWING_1H, or MACRO_4H"),
    preferred_direction: Optional[str] = Query(None, description="Optional directional override: BUY or SELL")
):
    """Forces an immediate re-analysis of technicals, news, and market structure to yield a fresh signal."""
    return await signals_manager.generate_fresh_signal(symbol, strategy_profile, preferred_direction)

@router.get("/rl-policy")
async def get_rl_policy_state() -> Dict[str, Any]:
    """Returns the live self-learning Reinforcement Learning policy weights and episode metrics."""
    return rl_policy_engine.get_state_summary()

@router.get("/ml-diagnostics")
async def get_ml_model_diagnostics() -> Dict[str, Any]:
    """Returns diagnostics, 5-fold CV accuracy, and feature importances of the serialized Scikit-Learn ML ensemble."""
    return finhub_ml_model.get_model_diagnostics()
