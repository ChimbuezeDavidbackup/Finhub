from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.paper_trade import (
    PaperAccount, PaperPosition, PaperTradeOrderRequest,
    ClosePositionRequest, MoveBreakevenRequest
)
from app.modules.paper_trading.engine import paper_engine
from app.modules.market_data.crypto_feed import crypto_feed
from app.modules.signals.manager import signals_manager
from app.core.websocket_hub import ws_hub

router = APIRouter(prefix="/paper", tags=["Paper Trading"])

@router.get("/account", response_model=PaperAccount)
async def get_paper_account():
    """Returns the live paper trading portfolio, balances, and performance journal."""
    return paper_engine.get_account_summary()

@router.post("/order", response_model=PaperPosition)
async def execute_paper_order(order: PaperTradeOrderRequest):
    """Executes a 1-click paper trade using live market price or active signal levels."""
    ticker = await crypto_feed.fetch_ticker(order.symbol)
    
    signal_targets = None
    if order.signal_id:
        active_signal = await signals_manager.get_active_signal(order.symbol)
        if active_signal and active_signal.id == order.signal_id:
            signal_targets = {
                "stop_loss": active_signal.targets.stop_loss,
                "take_profit_1": active_signal.targets.take_profit_1,
                "take_profit_2": active_signal.targets.take_profit_2,
            }

    try:
        position = paper_engine.execute_order(
            order=order,
            current_mark_price=ticker.price,
            signal_targets=signal_targets
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await ws_hub.broadcast("POSITION_OPENED", position.model_dump(mode="json"))
    await ws_hub.broadcast("ACCOUNT_UPDATE", paper_engine.get_account_summary().model_dump(mode="json"))
    return position

@router.post("/breakeven", response_model=PaperPosition)
async def move_to_breakeven(req: MoveBreakevenRequest):
    """Moves Stop-Loss of an open position directly to entry price to lock risk-free trade."""
    try:
        pos = paper_engine.move_stop_to_breakeven(req.position_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not pos:
        raise HTTPException(status_code=404, detail="Active open position not found")
    await ws_hub.broadcast("POSITION_UPDATED", pos.model_dump(mode="json"))
    return pos

@router.post("/close", response_model=PaperPosition)
async def close_position(req: ClosePositionRequest):
    """Closes an open paper position at current mark price."""
    pos = paper_engine.positions.get(req.position_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Active open position not found")
    
    ticker = await crypto_feed.fetch_ticker(pos.symbol)
    closed_pos = paper_engine.close_position_manually(req.position_id, current_mark_price=ticker.price)
    if not closed_pos:
        raise HTTPException(status_code=404, detail="Could not close position")
        
    await ws_hub.broadcast("POSITION_CLOSED", closed_pos.model_dump(mode="json"))
    await ws_hub.broadcast("ACCOUNT_UPDATE", paper_engine.get_account_summary().model_dump(mode="json"))
    return closed_pos

@router.post("/reset", response_model=PaperAccount)
async def reset_paper_account():
    """Resets demo balance back to 10,000 USDT and clears open positions."""
    await paper_engine.reset_account()
    summary = paper_engine.get_account_summary()
    await ws_hub.broadcast("ACCOUNT_RESET", summary.model_dump(mode="json"))
    return summary
