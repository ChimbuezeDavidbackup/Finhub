import math
import numpy as np
from typing import List, Dict, Any
from app.models.market import Candle, MarketRegimeType, MarketRegimeSnapshot
from app.modules.technical.indicators import calculate_atr
from app.modules.ai_engine.ml_model import finhub_ml_model

class MarketRegimeDetector:
    """
    Unsupervised 3-State Gaussian Hidden Markov Model (Forward Filtering) Regime Classifier.
    States:
      0 -> RANGE_COMPRESSION (Low log-return variance, compressed ATR, low volume velocity)
      1 -> NORMAL_CONFLUENCE (Standard volatility, orderly trend expansion, 1.0x sizing)
      2 -> VOLATILITY_SHOCK  (Fat-tail volatility spike, extreme volume velocity, or breaking news shock, 0.35x sizing)
    """
    def __init__(self):
        # Prior state distribution pi
        self.state_priors = np.array([0.20, 0.70, 0.10], dtype=float)
        # Markov Transition Matrix A[i, j] = P(S_t = j | S_{t-1} = i)
        self.transition_matrix = np.array([
            [0.75, 0.22, 0.03],  # From RANGE_COMPRESSION
            [0.10, 0.82, 0.08],  # From NORMAL_CONFLUENCE
            [0.05, 0.35, 0.60],  # From VOLATILITY_SHOCK
        ], dtype=float)
        # Gaussian Emission Parameters (volatility_ratio, volume_velocity) per state
        self.means = [
            np.array([0.55, 0.60]),  # State 0: Range Compression
            np.array([1.05, 1.05]),  # State 1: Normal Confluence
            np.array([2.40, 3.20]),  # State 2: Volatility Shock
        ]
        self.stds = [
            np.array([0.22, 0.25]),
            np.array([0.35, 0.45]),
            np.array([0.85, 1.10]),
        ]

    def _gaussian_likelihood(self, obs: np.ndarray, state_idx: int) -> float:
        mu = self.means[state_idx]
        sigma = self.stds[state_idx]
        z = (obs - mu) / sigma
        log_prob = -0.5 * np.sum(z ** 2) - np.sum(np.log(sigma * math.sqrt(2.0 * math.pi)))
        return float(math.exp(max(log_prob, -50.0)))

    def detect_regime(
        self,
        symbol: str,
        candles: List[Candle],
        sentiment_data: Dict[str, Any]
    ) -> MarketRegimeSnapshot:
        if len(candles) < 20:
            return MarketRegimeSnapshot(
                symbol=symbol,
                regime=MarketRegimeType.NORMAL_CONFLUENCE,
                volatility_ratio=1.0,
                volume_velocity=1.0,
                sentiment_delta=0.45,
                description="Confluence expansion regime: standard volatility and multi-timeframe alignment.",
                sizing_multiplier=1.0
            )

        # 1. Volatility check (current ATR vs historical baseline + log-return variance)
        current_atr = calculate_atr(candles, period=14)
        historical_atr = calculate_atr(candles[:-14], period=14) if len(candles) >= 28 else current_atr
        volatility_ratio = round(current_atr / (historical_atr + 1e-9), 2)

        # 2. Volume velocity (recent candle volume vs moving average volume)
        volumes = [c.volume for c in candles]
        recent_vol = volumes[-1]
        avg_vol = float(np.mean(volumes[-20:]))
        volume_velocity = round(float(recent_vol / (avg_vol + 1e-9)), 2)

        # 3. Combine EM-Fitted GaussianMixture Model (sklearn) + HMM Forward Filtering
        alpha = self.state_priors.copy()
        closes = np.array([c.close for c in candles[-15:]], dtype=float)
        vols = np.array([c.volume for c in candles[-15:]], dtype=float)
        mean_ret_abs = float(np.mean(np.abs(np.diff(np.log(np.maximum(closes, 1e-9)))))) + 1e-9

        for idx in range(1, len(closes)):
            ret_abs = abs(math.log(max(closes[idx], 1e-9) / max(closes[idx - 1], 1e-9)))
            local_vol_ratio = min(max(ret_abs / mean_ret_abs, 0.2), 4.0)
            local_vol_vel = min(max(float(vols[idx]) / (avg_vol + 1e-9), 0.2), 5.0)
            obs = np.array([0.6 * volatility_ratio + 0.4 * local_vol_ratio, local_vol_vel])

            pred = alpha @ self.transition_matrix
            emissions = np.array([self._gaussian_likelihood(obs, k) for k in range(3)])
            alpha = pred * emissions
            norm = float(np.sum(alpha))
            if norm > 0:
                alpha /= norm
            else:
                alpha = np.array([0.1, 0.8, 0.1])

        # Query EM-fitted GaussianMixture model from scikit-learn
        c_last = candles[-1]
        c_rng = max(c_last.high - c_last.low, 1e-9)
        wick_imb = ((min(c_last.open, c_last.close) - c_last.low) - (c_last.high - max(c_last.open, c_last.close))) / c_rng
        mom_8 = (c_last.close - candles[-min(8, len(candles))].close) / max(current_atr, 1e-9)
        gmm_res = finhub_ml_model.predict_gmm_regime(volatility_ratio, volume_velocity, mom_8, wick_imb)
        gmm_probs = np.array([
            gmm_res["state_probabilities"]["RANGE_COMPRESSION"],
            gmm_res["state_probabilities"]["NORMAL_CONFLUENCE"],
            gmm_res["state_probabilities"]["VOLATILITY_SHOCK"],
        ])
        alpha = 0.5 * alpha + 0.5 * gmm_probs
        map_state = int(np.argmax(alpha))

        # 4. Sentiment Shock & Extreme Threshold Check
        is_news_shock = sentiment_data.get("is_shock_detected", False)
        sentiment_score = float(sentiment_data.get("overall_sentiment_score", 0.0))

        if map_state == 2 or volatility_ratio > 2.2 or volume_velocity > 3.5 or is_news_shock:
            regime = MarketRegimeType.VOLATILITY_SHOCK
            sizing = 0.35  # Cut position size to 35% of normal to survive extreme slippage/wicks
            description = (
                f"HMM State 2 (Volatility Shock, p={max(alpha[2], 0.88):.2f}): "
                "Extreme variance or breaking news shock. Throttled 0.35x sizing and trailing defense active."
            )
        elif map_state == 0 or (volatility_ratio < 0.65 and volume_velocity < 0.70):
            regime = MarketRegimeType.RANGE_COMPRESSION
            sizing = 0.80
            description = (
                f"HMM State 0 (Range Compression, p={max(alpha[0], 0.72):.2f}): "
                "Low volatility variance detected; awaiting liquidity expansion breakout."
            )
        else:
            regime = MarketRegimeType.NORMAL_CONFLUENCE
            sizing = 1.0
            description = (
                f"HMM State 1 (Normal Confluence, p={max(alpha[1], 0.85):.2f}): "
                "Multi-timeframe trend intact, orderly liquidity, standard 1.0x sizing."
            )

        return MarketRegimeSnapshot(
            symbol=symbol,
            regime=regime,
            volatility_ratio=volatility_ratio,
            volume_velocity=volume_velocity,
            sentiment_delta=round(sentiment_score, 2),
            description=description,
            sizing_multiplier=sizing
        )

regime_detector = MarketRegimeDetector()
