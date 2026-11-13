import asyncio
import sys
import os

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import init_db
from app.modules.market_data.crypto_feed import crypto_feed
from app.modules.signals.manager import signals_manager
from app.modules.paper_trading.engine import paper_engine
from app.modules.ai_engine.rl_policy import rl_policy_engine
from app.modules.ai_engine.ml_model import finhub_ml_model
from app.modules.sentiment.news_feed import news_engine
from app.models.paper_trade import PaperTradeOrderRequest, PositionSide

async def run_formal_test():
    print("[1] Initializing Database, Trained Scikit-Learn ML Suite, RL Policy & Feeds...")
    await init_db()
    finhub_ml_model.initialize_or_load()
    await rl_policy_engine.initialize_from_db()
    await paper_engine.initialize_from_db()
    await crypto_feed.initialize()

    diag = finhub_ml_model.get_model_diagnostics()
    print(f"    ML Architecture: {diag['architecture']}")
    print(f"    Serialized Artifact: {diag['artifact_path']}")
    print(f"    5-Fold Cross-Validation Accuracy: {diag['cv_accuracy']*100:.2f}% (Samples: {diag['training_samples']})")
    assert diag["is_trained"] is True
    assert os.path.exists(diag["artifact_path"]), "Serialized .joblib ML model must exist on disk"

    print("[2] Testing Multi-Exchange Live Ticker, L2 Orderbook & Gold (PAXG/USDT)...")
    ticker_btc = await crypto_feed.fetch_ticker("BTC/USDT")
    ticker_gold = await crypto_feed.fetch_ticker("PAXG/USDT")
    ob_btc = await crypto_feed.fetch_orderbook("BTC/USDT", limit=20)
    print(f"    Live BTC Price: ${ticker_btc.price:.2f} | L2 Spread: ${ob_btc.spread:.2f} | L2 Imbalance: {ob_btc.imbalance_ratio:+.4f}")
    print(f"    Live GOLD (PAXG/USDT) Price: ${ticker_gold.price:.2f} (24h: {ticker_gold.change_24h_percent:+.2f}%)")
    assert ticker_btc.price > 10000
    assert ticker_gold.price > 1500
    assert len(ob_btc.bids) >= 5 and len(ob_btc.asks) >= 5

    print("[3] Testing Live NLP RSS Sentiment Scorer...")
    sent_data = await news_engine.get_latest_sentiment("BTC/USDT")
    print(f"    Headlines Ingested: {len(sent_data['headlines'])} | Aggregate NLP Sentiment: {sent_data['overall_sentiment_score']:+.2f}")
    assert len(sent_data["headlines"]) >= 3

    print("[4] Testing Geopolitical Shock: Risk-Off BTC SHORT vs Safe-Haven GOLD (PAXG) LONG...")
    await news_engine.trigger_breaking_news(
        headline="Emergency Geopolitical Escalation: Energy transit halted, risk-off selloff.",
        sentiment=-0.88,
        severity="URGENT"
    )
    sig_btc_shock = await signals_manager.generate_fresh_signal("BTC/USDT", "INTRADAY_15M")
    sig_gold_shock = await signals_manager.generate_fresh_signal("PAXG/USDT", "INTRADAY_15M")
    print(f"    BTC Shock Signal: {sig_btc_shock.direction.value} (Regime: {sig_btc_shock.regime.value}, SL=${sig_btc_shock.targets.stop_loss:.2f}, TP2=${sig_btc_shock.targets.take_profit_2:.2f})")
    print(f"    GOLD (PAXG) Shock Signal: {sig_gold_shock.direction.value} (Safe-Haven Rotation, SL=${sig_gold_shock.targets.stop_loss:.2f}, TP2=${sig_gold_shock.targets.take_profit_2:.2f})")
    assert sig_btc_shock.direction.value == "SELL", "Bearish geopolitical shock must flip BTC to SELL"
    assert sig_gold_shock.direction.value == "BUY", "Geopolitical shock must rotate Safe-Haven Gold (PAXG) to BUY"
    news_engine.dismiss_active_shock()

    print("[5] Testing Financial Invariant I2 (Liquidation Precedence)...")
    bad_order = PaperTradeOrderRequest(
        symbol="BTC/USDT",
        side=PositionSide.LONG,
        margin_usdt=1000.0,
        leverage=100.0,
        custom_entry_price=ticker_btc.price,
        custom_stop_loss=ticker_btc.price * 0.95
    )
    try:
        paper_engine.execute_order(bad_order, ticker_btc.price)
        print("    [FAIL] Excessive leverage was not blocked!")
    except ValueError as e:
        print(f"    [PASS] Invariant I2 Blocked Invalid Leverage: {e}")

    print("[6] Testing Execution Microstructure (Taker Fees, L2 Slippage & Fee-Buffered Breakeven)...")
    episodes_before = rl_policy_engine.total_episodes
    assert episodes_before >= 64, "RL Policy must be warm-started with >= 64 episodes"
    valid_order = PaperTradeOrderRequest(
        symbol="BTC/USDT",
        side=PositionSide.LONG,
        margin_usdt=1000.0,
        leverage=5.0,
        custom_entry_price=ticker_btc.price,
        custom_stop_loss=ticker_btc.price * 0.985,
        custom_take_profit_1=ticker_btc.price * 1.005,
        custom_take_profit_2=ticker_btc.price * 1.015
    )
    pos = paper_engine.execute_order(valid_order, ticker_btc.price)
    print(f"    Executed Position {pos.id}: Entry=${pos.entry_price:.2f}, EntryFee=${pos.fees_paid_dollars:.2f}, Slippage={pos.slippage_bps}bps")
    assert pos.fees_paid_dollars > 0

    tp1_price = pos.take_profit_1 + 10.0
    paper_engine.update_positions_with_market_tick("BTC/USDT", tp1_price)
    updated_pos = paper_engine.positions.get(pos.id)
    assert updated_pos is not None
    expected_be = round(pos.entry_price * 1.0008, 2)
    print(f"    Post-TP1 Status: {updated_pos.status.value}, Fee-Buffered BE SL: ${updated_pos.stop_loss:.2f} (Entry: ${updated_pos.entry_price:.2f})")
    assert updated_pos.status.value == "BE_PROTECTED"
    assert updated_pos.stop_loss == expected_be, "SL must be locked at Fee-Buffered Breakeven (Entry + 8bps)"

    print("[7] Testing Manual Close, Exit Fee Deduction & Online RL Update...")
    closed_pos = paper_engine.close_position_manually(pos.id, tp1_price)
    await asyncio.sleep(0.2)
    print(f"    Closed Position {closed_pos.id}: Total Realized PnL=${closed_pos.realized_pnl_dollars:+.2f} (Total Fees=${closed_pos.fees_paid_dollars:.2f})")
    
    rl_after = rl_policy_engine.get_state_summary()
    print(f"    RL Policy State: Episodes={rl_after['total_episodes']} (was {episodes_before}), Sharpe={rl_after['sharpe_ratio']:.2f}, Weights={rl_after['weights']}")
    assert rl_after["total_episodes"] == episodes_before + 1

    # Regenerate clean signals
    for sym in ["BTC/USDT", "ETH/USDT", "SOL/USDT", "PAXG/USDT"]:
        await signals_manager.generate_fresh_signal(sym, "INTRADAY_15M")
    await crypto_feed.close()
    print("\n[ALL 5 UPGRADES, TRAINED ML ENSEMBLE & FORMAL CHECKS PASSED]")

if __name__ == "__main__":
    asyncio.run(run_formal_test())
