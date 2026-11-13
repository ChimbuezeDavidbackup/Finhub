export type MarketRegimeType = "NORMAL_CONFLUENCE" | "VOLATILITY_SHOCK" | "RANGE_COMPRESSION" | "LIQUIDATION_CASCADE";
export type SignalDirection = "BUY" | "SELL" | "NEUTRAL" | "NO_TRADE" | "WAIT";
export type PositionSide = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "BE_PROTECTED" | "CLOSED_TP1" | "CLOSED_TP2" | "CLOSED_SL" | "CLOSED_TIME_STOP" | "CLOSED_MANUAL" | "CANCELLED";
export type StrategyProfile = "MICRO_1M" | "SCALP_5M" | "INTRADAY_15M" | "SWING_1H" | "MACRO_4H";

export interface TickerData {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  change_24h_percent?: number;
  change_24h?: number;
  high_24h?: number;
  low_24h?: number;
  volume_24h?: number;
  timestamp?: number;
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketRegimeSnapshot {
  symbol: string;
  regime: MarketRegimeType;
  volatility_ratio: number;
  atr_current?: number;
  atr_baseline?: number;
  sizing_multiplier: number;
  description: string;
  timestamp: string;
}

export interface TargetLadder {
  entry_min: number;
  entry_max: number;
  entry_optimal?: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward_ratio: number;
  potential_risk_dollars?: number;
  potential_reward_dollars?: number;
  est_liquidation_price?: number;
}

export interface RLPolicyState {
  policy_id?: string;
  weights: {
    technical: number;
    macro: number;
    orderbook: number;
  };
  total_episodes: number;
  sharpe_ratio: number;
  last_reward: number;
  cumulative_reward?: number;
}

export interface ConfluenceFactors {
  overall_conviction: number;
  technical_score: number;
  macro_news_score: number;
  liquidity_score: number;
  technical_rationale?: string;
  macro_news_rationale?: string;
  liquidity_rationale?: string;
  rationale_points?: string[];
  weights?: {
    technical: number;
    macro: number;
    orderbook: number;
  };
  rl_episodes?: number;
  rl_sharpe?: number;
  rl_last_reward?: number;
  ml_telemetry?: {
    direction: string;
    prob_buy: number;
    prob_sell: number;
    dominant_probability: number;
    sub_models?: {
      mlp_neural_net_prob_buy: number;
      gradient_boosting_prob_buy: number;
      random_forest_prob_buy: number;
    };
    cv_accuracy?: number;
    training_samples?: number;
    architecture?: string;
  };
  indicator_workings?: {
    ema20: number;
    ema50: number;
    vwap: number;
    rsi14: number;
    atr14: number;
    swing_high: number;
    swing_low: number;
    order_block_low: number;
    supply_block_high: number;
    fib_0236: number;
    fib_0382: number;
    fib_0500: number;
    fib_0618: number;
    fib_0786: number;
    ob_imbalance_pct: number;
    sentiment_score: number;
    macro_events_proximity: string;
    conviction_tier: string;
    gmm_regime_mode?: string;
    recommended_indicators?: string[];
    recommended_toggles?: {
      showMA: boolean;
      showRSI: boolean;
      showFib: boolean;
      showOB: boolean;
      showTargets: boolean;
    };
    rl_gmm_feedback_count?: number;
    last_volatility_surprise?: number;
  };
}

export interface ValidityWindow {
  duration_minutes: number;
  expires_at: string;
  seconds_remaining: number;
  is_expired?: boolean;
  is_active?: boolean;
  invalidation_criteria?: string;
}

export interface SignalData {
  id: string;
  symbol: string;
  strategy_profile?: StrategyProfile;
  direction: SignalDirection;
  status: "ACTIVE" | "EXPIRED" | "TRIGGERED" | "INVALIDATED" | string;
  regime: MarketRegimeType;
  risk_level?: string;
  recommended_size_multiplier?: number;
  recommended_margin_usdt?: number;
  recommended_leverage?: number;
  max_holding_minutes?: number;
  targets: TargetLadder;
  confluence: ConfluenceFactors;
  validity_window: ValidityWindow;
  created_at: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  side: PositionSide;
  status: PositionStatus;
  entry_price: number;
  current_mark_price: number;
  size: number;
  initial_size?: number;
  margin_usdt: number;
  initial_margin_usdt?: number;
  leverage: number;
  stop_loss: number;
  initial_stop_loss?: number;
  take_profit_1: number;
  take_profit_2: number;
  trailing_sl_active: boolean;
  partial_tp1_filled?: boolean;
  unrealized_pnl_dollars: number;
  unrealized_pnl_percent: number;
  realized_pnl_dollars: number;
  realized_pnl_percent: number;
  signal_id?: string;
  created_at: string;
  closed_at?: string;
  max_hold_minutes: number;
  elapsed_minutes: number;
  exit_price?: number;
  exit_reason?: string;
  strategy_profile?: string;
}

export interface PaperAccountSummary {
  account_id: string;
  balance_usdt: number;
  equity_usdt: number;
  free_margin_usdt?: number;
  used_margin_usdt?: number;
  unrealized_pnl_usdt: number;
  realized_pnl_usdt: number;
  open_positions: PaperPosition[];
  closed_positions: PaperPosition[];
  total_trades_count: number;
  winning_trades_count?: number;
  losing_trades_count?: number;
  win_rate: number;
  profit_factor: number;
  rl_policy?: RLPolicyState;
}

export interface BreakingNewsAlert {
  id: string;
  headline: string;
  source: string;
  severity: "URGENT" | "HIGH" | "MEDIUM";
  sentiment_score: number;
  timestamp: string;
  ai_defense_action: string;
}
