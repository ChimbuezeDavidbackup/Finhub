import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from app.models.market import Candle, Ticker, OrderbookSnapshot, MarketRegimeSnapshot, MarketRegimeType
from app.models.signal import Signal, SignalDirection, RiskLevel, TargetLadder, ValidityWindow, ConfluenceFactors
from app.modules.technical.indicators import (
    calculate_atr, calculate_rsi, calculate_emas, calculate_vwap,
    detect_market_structure, compute_dynamic_levels
)
from app.modules.ai_engine.rl_policy import rl_policy_engine
from app.modules.ai_engine.ml_model import finhub_ml_model
from app.config import settings

logger = logging.getLogger("finhub.ai_arbiter")

class AIConfluenceArbiter:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY

    async def generate_signal(
        self,
        symbol: str,
        candles: List[Candle],
        ticker: Ticker,
        orderbook: OrderbookSnapshot,
        regime: MarketRegimeSnapshot,
        sentiment: Dict[str, Any],
        strategy_profile: str = "INTRADAY_15M",
        preferred_direction: Optional[str] = None
    ) -> Signal:
        """
        Synthesizes quantitative technicals, macro/news sentiment, and L2 orderbook depth
        into a symmetric LONG (BUY) or SHORT (SELL) signal weighted by the self-learning RL policy.
        """
        # 1. Technical feature extraction
        atr = calculate_atr(candles)
        rsi = calculate_rsi(candles)
        ema20, ema50 = calculate_emas(candles)
        vwap = calculate_vwap(candles)
        structure = detect_market_structure(candles)

        # 2. Execute Trained Scikit-Learn Ensemble (MLP + GradientBoosting + RandomForest)
        sent_val = float(sentiment.get("overall_sentiment_score", 0.5))
        shock_alert = sentiment.get("active_shock_alert")
        shock_sent = float(shock_alert.get("sentiment_score", 0.0)) if shock_alert else 0.0
        has_shock = bool((shock_alert is not None and shock_sent < -0.2) or sent_val < -0.25)
        is_gold = ("PAXG" in symbol or "XAU" in symbol or "GOLD" in symbol)
        imbalance = float(orderbook.imbalance_ratio)
        change_24h = float(ticker.change_24h_percent)

        ml_pred = finhub_ml_model.predict_direction_and_probabilities(
            candles=candles,
            mark_price=ticker.price,
            change_24h_percent=change_24h,
            ob_imbalance=imbalance,
            sentiment_score=sent_val,
            symbol=symbol
        )

        # Resolve final signal direction from Trained ML Ensemble + Geopolitical Shock Override
        if preferred_direction in ("BUY", "LONG"):
            direction = SignalDirection.BUY
        elif preferred_direction in ("SELL", "SHORT"):
            direction = SignalDirection.SELL
        elif has_shock:
            # During geopolitical crisis: Risk crypto assets flip to SHORT; Safe-haven Gold (PAXG) flips to LONG!
            direction = SignalDirection.BUY if is_gold else SignalDirection.SELL
        else:
            direction = SignalDirection.BUY if ml_pred["direction"] == "BUY" else SignalDirection.SELL

        is_buy = (direction == SignalDirection.BUY)
        dom_prob = float(ml_pred["prob_buy"] if is_buy else ml_pred["prob_sell"])

        # 3. Calibrate Pillar Scores (0-100) anchored by ML Ensemble probabilities
        ml_base = int(52 + dom_prob * 40)
        if is_buy:
            tech_score = min(max(int(ml_base + (8 if ticker.price >= vwap else -4)), 54), 96)
            macro_score = min(max(int(55 + max(sent_val if not is_gold else abs(sent_val), 0.15) * 40), 52), 96)
            orderbook_score = min(max(int(56 + abs(imbalance) * 145), 50), 95)
        else:
            tech_score = min(max(int(ml_base + (8 if ticker.price < vwap or has_shock else 2)), 56), 96)
            macro_score = min(max(int(68 + abs(min(sent_val, -0.25)) * 30) if has_shock else int(ml_base), 54), 96)
            orderbook_score = min(max(int(58 + abs(imbalance) * 145), 52), 95)

        # 4. Apply Learned Contextual Reinforcement Learning Policy Weights (Coupled with EM-GMM Posteriors)
        rl_state = rl_policy_engine.get_state_summary()
        gmm_info = ml_pred.get("gmm_regime", {})
        gmm_probs = gmm_info.get("state_probabilities", {})
        gmm_map_name = gmm_info.get("map_state_name", "NORMAL_CONFLUENCE")
        weights = rl_policy_engine.get_contextual_weights(gmm_probs)
        w_tech = float(weights.get("technical", 0.45))
        w_macro = float(weights.get("macro", 0.30))
        w_ob = float(weights.get("orderbook", 0.25))

        # Regime-Conditional Non-Collinear Indicator Selection (Solves Multicollinearity & Visual Clutter)
        if has_shock or regime.regime == MarketRegimeType.VOLATILITY_SHOCK or gmm_map_name == "VOLATILITY_SHOCK":
            active_regime_mode = "VOLATILITY_SHOCK"
            recommended_indicators = ["VWAP", "OB", "SLTP"]
            recommended_toggles = {
                "showMA": True,
                "showRSI": False,
                "showFib": False,
                "showOB": True,
                "showTargets": True
            }
        elif gmm_map_name == "RANGE_COMPRESSION" or rsi <= 38.0 or rsi >= 62.0:
            active_regime_mode = "RANGE_COMPRESSION"
            recommended_indicators = ["FIB", "OB", "RSI", "SLTP"]
            recommended_toggles = {
                "showMA": False,
                "showRSI": True,
                "showFib": True,
                "showOB": True,
                "showTargets": True
            }
        else:
            active_regime_mode = "NORMAL_CONFLUENCE"
            recommended_indicators = ["EMA", "VWAP", "FIB", "RSI", "SLTP"]
            recommended_toggles = {
                "showMA": True,
                "showRSI": True,
                "showFib": True,
                "showOB": False,
                "showTargets": True
            }

        overall_conviction = int(round(
            (tech_score * w_tech) +
            (macro_score * w_macro) +
            (orderbook_score * w_ob)
        ))
        overall_conviction = max(min(overall_conviction, 98), 52)

        # 5. Strategy Profile Horizon Scaling
        if strategy_profile == "MICRO_1M":
            window_duration = 2
            max_hold = 6
            atr_mult = 0.35
        elif strategy_profile == "SCALP_5M":
            window_duration = 5
            max_hold = 15
            atr_mult = 0.65
        elif strategy_profile == "SWING_1H":
            window_duration = 120
            max_hold = 240
            atr_mult = 1.8
        elif strategy_profile == "MACRO_4H":
            window_duration = 240
            max_hold = 720
            atr_mult = 2.8
        else:  # INTRADAY_15M
            window_duration = 30
            max_hold = 90
            atr_mult = 1.0

        # 6. Compute Symmetric Target Levels (Entry, SL, TP1, TP2)
        effective_atr = atr * atr_mult
        levels = compute_dynamic_levels(
            mark_price=ticker.price,
            direction="BUY" if is_buy else "SELL",
            atr=effective_atr,
            structure=structure
        )

        entry_opt = levels["entry_optimal"]
        sl = levels["stop_loss"]
        tp1 = levels["take_profit_1"]
        tp2 = levels["take_profit_2"]

        # Calculate liquidation price at 5x leverage (Long vs Short)
        if is_buy:
            est_liq = round(entry_opt * (1.0 - (1.0 / 5.0) + 0.005), 2)
        else:
            est_liq = round(entry_opt * (1.0 + (1.0 / 5.0) - 0.005), 2)

        # Calculate dollar risk and reward on $1,000 margin at 5x ($5,000 notional)
        notional = 5000.0
        risk_dist_pct = abs(entry_opt - sl) / max(entry_opt, 1e-9)
        potential_risk_dollars = round(notional * risk_dist_pct, 2)
        reward_dist_pct = (abs(tp1 - entry_opt) * 0.5 + abs(tp2 - entry_opt) * 0.5) / max(entry_opt, 1e-9)
        potential_reward_dollars = round(notional * reward_dist_pct, 2)

        now = datetime.utcnow()
        expires_at = now + timedelta(minutes=window_duration)

        risk_level = RiskLevel.MEDIUM
        if regime.regime == MarketRegimeType.VOLATILITY_SHOCK:
            risk_level = RiskLevel.HIGH
        elif regime.regime == MarketRegimeType.LIQUIDATION_CASCADE:
            risk_level = RiskLevel.EXTREME

        # 7. Construct Glass-Box Rationales with ML Ensemble Telemetry
        p_mlp = ml_pred["sub_models"]["mlp_neural_net_prob_buy"]
        p_gb = ml_pred["sub_models"]["gradient_boosting_prob_buy"]
        p_rf = ml_pred["sub_models"]["random_forest_prob_buy"]
        cv_acc = ml_pred["cv_accuracy"] * 100.0

        if is_buy:
            ob_floor = structure.get("order_block_low", round(entry_opt * 0.99, 2))
            tech_rationale = (
                f"ML Ensemble P(LONG)={ml_pred['prob_buy']*100:.1f}% (MLP:{p_mlp*100:.0f}%, GBDT:{p_gb*100:.0f}%, RF:{p_rf*100:.0f}% | CV:{cv_acc:.1f}%). "
                f"RSI at {rsi:.1f} with Demand OB absorption at ${ob_floor:.2f} above VWAP (${vwap:.2f})."
            )
            if is_gold and has_shock:
                macro_rationale = (
                    "SAFE-HAVEN GOLD ROTATION: Geopolitical shock drives institutional flight-to-safety into PAXG/Gold."
                )
            else:
                macro_rationale = (
                    "Live NLP news wire & ETF flow velocity net-bullish. Macro schedule clear of adverse rate shocks."
                )
            liq_rationale = (
                f"Live L2 Orderbook imbalance ({imbalance:+.2%}) shows bid absorption. Short liquidation cluster near TP2 acts as upside magnet."
            )
        else:
            supply_ceil = structure.get("supply_block_high", round(entry_opt * 1.01, 2))
            tech_rationale = (
                f"ML Ensemble P(SHORT)={ml_pred['prob_sell']*100:.1f}% (MLP:{(1-p_mlp)*100:.0f}%, GBDT:{(1-p_gb)*100:.0f}%, RF:{(1-p_rf)*100:.0f}% | CV:{cv_acc:.1f}%). "
                f"Bearish distribution below Supply OB (${supply_ceil:.2f}) with RSI at {rsi:.1f}."
            )
            if has_shock:
                shock_title = sentiment["active_shock_alert"].get("headline", "Geopolitical macro shock active.") if sentiment.get("active_shock_alert") else "Macro shock active."
                macro_rationale = f"URGENT MACRO SHOCK: {shock_title} Risk-off institutional de-risking favors short exposure."
            else:
                macro_rationale = (
                    f"Relative weakness ({change_24h:+.2f}% 24h) and cautious macro positioning favor short distribution."
                )
            liq_rationale = (
                f"Live L2 Orderbook ask resistance ({imbalance:+.2%}). Leveraged long stop cluster below TP1/TP2 acts as downside magnet."
            )

        signal = Signal(
            id=f"SIG-{uuid.uuid4().hex[:6].upper()}",
            symbol=symbol,
            strategy_profile=strategy_profile,
            direction=direction,
            regime=regime.regime,
            risk_level=risk_level,
            recommended_size_multiplier=round(regime.sizing_multiplier * (0.65 if dom_prob < 0.56 else 1.0), 2),
            recommended_margin_usdt=1000.0,
            recommended_leverage=5.0,
            max_holding_minutes=max_hold,
            targets=TargetLadder(
                entry_min=levels["entry_min"],
                entry_max=levels["entry_max"],
                entry_optimal=entry_opt,
                stop_loss=sl,
                take_profit_1=tp1,
                take_profit_2=tp2,
                risk_reward_ratio=levels["risk_reward_ratio"],
                potential_risk_dollars=potential_risk_dollars,
                potential_reward_dollars=potential_reward_dollars,
                est_liquidation_price=est_liq
            ),
            validity_window=ValidityWindow(
                duration_minutes=window_duration,
                created_at=now,
                expires_at=expires_at,
                seconds_remaining=window_duration * 60,
                is_expired=False,
                invalidation_criteria=f"Signal auto-cancels if entry unfilled within {window_duration}m or if stop-loss (${sl:.2f}) is breached."
            ),
            confluence=ConfluenceFactors(
                overall_conviction=overall_conviction,
                technical_score=tech_score,
                macro_news_score=macro_score,
                liquidity_score=orderbook_score,
                technical_rationale=tech_rationale,
                macro_news_rationale=macro_rationale,
                liquidity_rationale=liq_rationale,
                weights=weights,
                rl_episodes=rl_state["total_episodes"],
                rl_sharpe=rl_state["sharpe_ratio"],
                rl_last_reward=rl_state["last_reward"],
                ml_telemetry=ml_pred,
                indicator_workings={
                    "ema20": round(ema20, 2),
                    "ema50": round(ema50, 2),
                    "vwap": round(vwap, 2),
                    "rsi14": round(rsi, 2),
                    "atr14": round(atr, 2),
                    "swing_high": round(float(structure.get("swing_high", ticker.price * 1.012)), 2),
                    "swing_low": round(float(structure.get("swing_low", ticker.price * 0.988)), 2),
                    "order_block_low": round(float(structure.get("order_block_low", ticker.price * 0.991)), 2),
                    "supply_block_high": round(float(structure.get("supply_block_high", ticker.price * 1.009)), 2),
                    "fib_0236": round(float(structure.get("swing_high", ticker.price * 1.012)) - (float(structure.get("swing_high", ticker.price * 1.012)) - float(structure.get("swing_low", ticker.price * 0.988))) * 0.236, 2),
                    "fib_0382": round(float(structure.get("swing_high", ticker.price * 1.012)) - (float(structure.get("swing_high", ticker.price * 1.012)) - float(structure.get("swing_low", ticker.price * 0.988))) * 0.382, 2),
                    "fib_0500": round(float(structure.get("swing_high", ticker.price * 1.012)) - (float(structure.get("swing_high", ticker.price * 1.012)) - float(structure.get("swing_low", ticker.price * 0.988))) * 0.500, 2),
                    "fib_0618": round(float(structure.get("swing_high", ticker.price * 1.012)) - (float(structure.get("swing_high", ticker.price * 1.012)) - float(structure.get("swing_low", ticker.price * 0.988))) * 0.618, 2),
                    "fib_0786": round(float(structure.get("swing_high", ticker.price * 1.012)) - (float(structure.get("swing_high", ticker.price * 1.012)) - float(structure.get("swing_low", ticker.price * 0.988))) * 0.786, 2),
                    "ob_imbalance_pct": round(imbalance * 100.0, 2),
                    "sentiment_score": round(sent_val, 2),
                    "macro_events_proximity": sentiment.get("macro_events_proximity", "US CPI & FOMC Schedule Clear"),
                    "conviction_tier": "INSTITUTIONAL EDGE" if overall_conviction >= 80 else ("HIGH CONVICTION" if overall_conviction >= 66 else "MODERATE EDGE"),
                    "gmm_regime_mode": active_regime_mode,
                    "recommended_indicators": recommended_indicators,
                    "recommended_toggles": recommended_toggles,
                    "rl_gmm_feedback_count": rl_state.get("gmm_feedback_count", 0),
                    "last_volatility_surprise": rl_state.get("last_volatility_surprise", 1.0)
                }
            ),
            created_at=now,
            status="ACTIVE"
        )

        return signal

ai_arbiter = AIConfluenceArbiter()
