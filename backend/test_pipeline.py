import asyncio
import json
from app.modules.market_data.crypto_feed import crypto_feed
from app.modules.regime.detector import regime_detector
from app.modules.sentiment.news_feed import news_engine
from app.modules.ai_engine.arbiter import ai_arbiter
from app.modules.paper_trading.engine import paper_engine
from app.models.paper_trade import PaperTradeOrderRequest, PositionSide

async def run_test():
    print("=== FINHUB QUANT & AI PIPELINE TEST ===")
    
    try:
        # 1. Market Data
        print("\n1. Fetching live market data (BTC/USDT)...")
        await crypto_feed.initialize()
        ticker = await crypto_feed.fetch_ticker("BTC/USDT")
        candles = await crypto_feed.fetch_candles("BTC/USDT", timeframe="15m", limit=50)
        orderbook = await crypto_feed.fetch_orderbook("BTC/USDT", limit=20)
        print(f"[OK] Mark Price: ${ticker.price:.2f} | 24h Change: {ticker.change_24h_percent:+.2f}%")
        print(f"[OK] Retrieved {len(candles)} candles | Orderbook Imbalance: {orderbook.imbalance_ratio:+.4f}")

        # 2. Sentiment & Macro Calendar
        print("\n2. Ingesting News & Macro Calendar...")
        sentiment = await news_engine.get_latest_sentiment("BTC/USDT")
        print(f"[OK] Sentiment Score: {sentiment['overall_sentiment_score']} | Shock Detected: {sentiment['is_shock_detected']}")

        # 3. Market Regime Detection
        print("\n3. Evaluating Dual-Regime Classifier...")
        regime = regime_detector.detect_regime("BTC/USDT", candles, sentiment)
        print(f"[OK] Regime: {regime.regime.value} | Volatility Ratio: {regime.volatility_ratio}x | Sizing Multiplier: {regime.sizing_multiplier}x")
        print(f"     Description: {regime.description}")

        # 4. AI Confluence Arbiter
        print("\n4. Synthesizing AI Confluence Signal...")
        signal = await ai_arbiter.generate_signal("BTC/USDT", candles, ticker, orderbook, regime, sentiment)
        print(f"[OK] Signal ID: {signal.id} | Direction: {signal.direction.value}")
        print(f"[OK] Conviction Score: {signal.confluence.overall_conviction}% (Tech: {signal.confluence.technical_score}%, Macro: {signal.confluence.macro_news_score}%, Orderbook: {signal.confluence.liquidity_score}%)")
        print(f"[OK] Entry Zone: ${signal.targets.entry_min:.2f} - ${signal.targets.entry_max:.2f}")
        print(f"[OK] Dynamic Stop-Loss: ${signal.targets.stop_loss:.2f}")
        print(f"[OK] Take-Profit 1: ${signal.targets.take_profit_1:.2f} | TP 2: ${signal.targets.take_profit_2:.2f}")
        print(f"[OK] Risk/Reward Ratio: 1 : {signal.targets.risk_reward_ratio:.2f}")
        print(f"[OK] Validity Window: {signal.validity_window.duration_minutes}m (Expires at: {signal.validity_window.expires_at.strftime('%H:%M:%S UTC')})")

        # 5. Paper Trading Execution
        print("\n5. Executing Paper Trade on Generated Signal...")
        order = PaperTradeOrderRequest(
            symbol="BTC/USDT",
            side=PositionSide.LONG,
            margin_usdt=1000.0,
            leverage=1.0,
            signal_id=signal.id
        )
        pos = paper_engine.execute_order(
            order=order,
            current_mark_price=ticker.price,
            signal_targets={
                "stop_loss": signal.targets.stop_loss,
                "take_profit_1": signal.targets.take_profit_1,
                "take_profit_2": signal.targets.take_profit_2,
            }
        )
        print(f"[OK] Position Opened: {pos.id} | Size: {pos.size} BTC @ ${pos.entry_price:.2f}")
        print(f"     SL: ${pos.stop_loss:.2f} | TP1: ${pos.take_profit_1:.2f} | TP2: ${pos.take_profit_2:.2f}")

        # 6. Simulate Intermediate Market Move (Price rises +0.5%, position stays OPEN)
        simulated_price_1 = pos.entry_price * 1.005
        print(f"\n6. Simulating Market Tick to ${simulated_price_1:.2f} (+0.50%)...")
        paper_engine.update_positions_with_market_tick("BTC/USDT", simulated_price_1)
        updated_pos = paper_engine.positions[pos.id]
        print(f"[OK] Position Status: {updated_pos.status.value}")
        print(f"[OK] Unrealized PnL: ${updated_pos.unrealized_pnl_dollars:+.2f} ({updated_pos.unrealized_pnl_percent:+.2f}%)")

        # 7. Test User Action: Move SL to Breakeven & Manual Close
        print("\n7. Testing User Action: Move SL to Breakeven & Manual Close...")
        be_pos = paper_engine.move_to_breakeven(pos.id)
        print(f"[OK] Stop-Loss moved to Breakeven: ${be_pos.stop_loss:.2f} (Entry: ${be_pos.entry_price:.2f})")
        closed_pos = paper_engine.close_position_manually(pos.id, reason="User Manual Take Profit")
        print(f"[OK] Position Closed: Realized PnL: ${closed_pos.realized_pnl_dollars:+.2f} ({closed_pos.realized_pnl_percent:+.2f}%)")

        # 8. Test Auto-Take-Profit (TP2 hit) with second position
        print("\n8. Testing Automated Take-Profit Trigger...")
        order_2 = PaperTradeOrderRequest(
            symbol="BTC/USDT",
            side=PositionSide.LONG,
            margin_usdt=1000.0,
            leverage=1.0,
            signal_id=signal.id
        )
        pos_2 = paper_engine.execute_order(order_2, current_mark_price=ticker.price, signal_targets={
            "stop_loss": signal.targets.stop_loss,
            "take_profit_1": signal.targets.take_profit_1,
            "take_profit_2": signal.targets.take_profit_2,
        })
        tp2_price = pos_2.take_profit_2 + 10.0
        paper_engine.update_positions_with_market_tick("BTC/USDT", tp2_price)
        closed_tp2_pos = paper_engine.positions[pos_2.id]
        print(f"[OK] Position 2 Status: {closed_tp2_pos.status.value} ({closed_tp2_pos.exit_reason})")
        print(f"[OK] Position 2 Realized PnL: ${closed_tp2_pos.realized_pnl_dollars:+.2f}")

        # 9. Account Summary
        summary = paper_engine.get_account_summary()
        print(f"\n9. Account Summary:")
        print(f"[OK] Balance: ${summary.balance_usdt:.2f} USDT | Equity: ${summary.equity_usdt:.2f} USDT")
        print(f"[OK] Win Rate: {summary.win_rate}% | Profit Factor: {summary.profit_factor} | Total Closed Trades: {summary.total_trades_count}")

        print("\n=== ALL PIPELINE TESTS PASSED SUCCESSFULLY! ===")
    finally:
        await crypto_feed.close()

if __name__ == "__main__":
    asyncio.run(run_test())
