"use client";

import React, { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, Target, Zap, AlertTriangle, Sliders } from "lucide-react";
import { SignalData, StrategyProfile } from "../../types";

interface SignalCardProps {
  signal: SignalData | null;
  currentProfile?: StrategyProfile;
  onSelectProfile?: (profile: StrategyProfile) => void;
  onExecuteTrade: (params: { margin: number; leverage: number; strategyProfile: string }) => void;
  isExecuting?: boolean;
  onRefreshAnalysis?: () => void;
  isAnalyzing?: boolean;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  currentProfile = "INTRADAY_15M",
  onSelectProfile,
  onExecuteTrade,
  isExecuting = false,
  onRefreshAnalysis,
  isAnalyzing = false,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(1800);
  const [margin, setMargin] = useState<number>(1000);
  const [leverage, setLeverage] = useState<number>(5);
  const lastSignalIdRef = React.useRef<string | null>(null);

  // Reset countdown when a genuinely new signal ID arrives, or gently sync downward
  useEffect(() => {
    if (!signal) return;
    const incomingSec = signal.validity_window.seconds_remaining ?? 1800;
    if (lastSignalIdRef.current !== signal.id) {
      lastSignalIdRef.current = signal.id;
      setSecondsRemaining(incomingSec);
    } else {
      setSecondsRemaining((prev) => {
        // Monotonic downward sync for the same signal ID
        if (incomingSec < prev && prev - incomingSec <= 15) {
          return incomingSec;
        }
        return prev;
      });
    }
  }, [signal?.id, signal?.validity_window?.seconds_remaining]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!signal) {
    return (
      <div className="w-full bg-[#0D1322] border border-[#1E293B] rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[460px]">
        <div className="w-12 h-12 rounded-full bg-[#1E293B] flex items-center justify-center text-[#64748B] mb-3 animate-pulse">
          <Zap className="w-6 h-6" />
        </div>
        <p className="text-white font-medium text-sm">Evaluating Confluence Arbiter...</p>
        <p className="text-[#64748B] text-xs mt-1">Aggregating multi-timeframe order flow & macro news</p>
      </div>
    );
  }

  const isBuy = signal.direction === "BUY";
  const isExpired = secondsRemaining <= 0;
  const initialTtlSeconds = (signal.validity_window.duration_minutes || 15) * 60;
  const amberWarningThreshold = Math.max(30, Math.floor(initialTtlSeconds * 0.25));
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const entryAvg = (signal.targets.entry_min + signal.targets.entry_max) / 2;
  const slPercent = Math.abs((signal.targets.stop_loss - entryAvg) / entryAvg) * 100;
  const notionalPosition = margin * leverage;
  const maxRiskDollars = notionalPosition * (slPercent / 100);
  const tp2Percent = Math.abs((signal.targets.take_profit_2 - entryAvg) / entryAvg) * 100;
  const potentialGainDollars = notionalPosition * (tp2Percent / 100);

  // Liquidation calculation at current leverage
  const estLiqPrice = isBuy
    ? entryAvg * (1.0 - (1.0 / Math.max(leverage, 1.0)) + 0.005)
    : entryAvg * (1.0 + (1.0 / Math.max(leverage, 1.0)) - 0.005);
  const isLiquidationSafe = isBuy ? estLiqPrice < signal.targets.stop_loss : estLiqPrice > signal.targets.stop_loss;

  return (
    <div className="w-full bg-[#0D1322] border border-[#1E293B] rounded-xl flex flex-col p-5 gap-4 shadow-lg relative overflow-hidden">
      {/* Strategy Profile Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#090D18] border border-[#1E293B] rounded-lg">
          {[
            { id: "MICRO_1M" as StrategyProfile, label: "1M SCALP" },
            { id: "SCALP_5M" as StrategyProfile, label: "5M SCALP" },
            { id: "INTRADAY_15M" as StrategyProfile, label: "15M DAY" },
            { id: "SWING_1H" as StrategyProfile, label: "1H SWING" },
            { id: "MACRO_4H" as StrategyProfile, label: "4H SWING" },
          ].map((item) => {
            const isSelected = currentProfile === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectProfile?.(item.id)}
                className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-mono font-semibold transition-all ${
                  isSelected
                    ? "bg-[#10B981] text-white shadow-sm ring-1 ring-[#10B981]/50"
                    : "text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/40"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Validity Countdown Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
            isExpired
              ? "bg-[#EF4444]/15 border-[#EF4444]/40 text-[#EF4444]"
              : secondsRemaining <= amberWarningThreshold
              ? "bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#FBBF24] animate-pulse"
              : "bg-[#10B981]/10 border-[#10B981]/30 text-[#34D399]"
          }`}
          title="Signal entry validity countdown."
        >
          <Clock className="w-3.5 h-3.5" />
          <span suppressHydrationWarning>{isExpired ? "EXPIRED" : `${timeFormatted} valid`}</span>
        </div>
      </div>

      {/* Action Hero Badge & Conviction Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#090D18] border border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shadow-md ${
              isBuy
                ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                : "bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40"
            }`}
          >
            {isBuy ? <ArrowUpRight className="w-7 h-7 stroke-[2.5]" /> : <ArrowDownRight className="w-7 h-7 stroke-[2.5]" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-extrabold font-mono tracking-tight ${isBuy ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {isBuy ? "STRONG BUY / LONG" : "STRONG SELL / SHORT"}
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              {signal.regime === "VOLATILITY_SHOCK"
                ? "Volatility Shock: Extreme variance detected. 0.35x sizing active."
                : "Normal Confluence: Multi-timeframe trend & orderly orderbook."}
            </p>
          </div>
        </div>

        {/* Big Overall Conviction Score */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Arbiter Conviction</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-white" suppressHydrationWarning>
              {signal.confluence.overall_conviction}%
            </span>
            <span className="text-[11px] font-bold text-[#10B981] uppercase">
              {signal.confluence.indicator_workings?.conviction_tier || (signal.confluence.overall_conviction >= 75 ? "HIGH" : "MODERATE")}
            </span>
          </div>
        </div>
      </div>

      {/* Stacked Conviction Sub-Meters with Learned RL Weights */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-2.5 rounded-lg bg-[#131B2E] border border-[#1E293B] flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#64748B] uppercase font-semibold">Technicals</span>
            <span className="text-[9px] font-mono text-[#10B981]">
              {Math.round((signal.confluence.weights?.technical ?? 0.45) * 100)}%w
            </span>
          </div>
          <span className="font-mono text-white text-sm font-bold mt-0.5">{signal.confluence.technical_score}%</span>
          <div className="w-full bg-[#1E293B] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[#10B981] h-full rounded-full transition-all duration-500"
              style={{ width: `${signal.confluence.technical_score}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#131B2E] border border-[#1E293B] flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#64748B] uppercase font-semibold">Macro/News</span>
            <span className="text-[9px] font-mono text-[#38BDF8]">
              {Math.round((signal.confluence.weights?.macro ?? 0.30) * 100)}%w
            </span>
          </div>
          <span className="font-mono text-white text-sm font-bold mt-0.5">{signal.confluence.macro_news_score}%</span>
          <div className="w-full bg-[#1E293B] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[#38BDF8] h-full rounded-full transition-all duration-500"
              style={{ width: `${signal.confluence.macro_news_score}%` }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#131B2E] border border-[#1E293B] flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#64748B] uppercase font-semibold">Orderbook</span>
            <span className="text-[9px] font-mono text-[#A855F7]">
              {Math.round((signal.confluence.weights?.orderbook ?? 0.25) * 100)}%w
            </span>
          </div>
          <span className="font-mono text-white text-sm font-bold mt-0.5">{signal.confluence.liquidity_score}%</span>
          <div className="w-full bg-[#1E293B] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[#A855F7] h-full rounded-full transition-all duration-500"
              style={{ width: `${signal.confluence.liquidity_score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Target Ladder (Entry, SL, TP1, TP2) */}
      <div className="flex flex-col gap-2 rounded-xl bg-[#090D18] border border-[#1E293B] p-3 text-xs font-mono">
        <div className="flex items-center justify-between py-1 border-b border-[#1E293B]/60">
          <span className="text-[#94A3B8] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#94A3B8]" /> Entry Zone:
          </span>
          <span className="font-bold text-white">
            ${signal.targets.entry_min.toFixed(2)} — ${signal.targets.entry_max.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-[#1E293B]/60">
          <span className="text-[#F87171] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Stop-Loss:
          </span>
          <span className="font-bold text-[#F87171]">
            ${signal.targets.stop_loss.toFixed(2)} <span className="text-[10px] font-normal text-[#EF4444]/80">({isBuy ? "-" : "+"}{slPercent.toFixed(2)}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-[#1E293B]/60">
          <span className="text-[#38BDF8] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" /> Take-Profit 1 (BE Lock):
          </span>
          <span className="font-bold text-[#38BDF8]">
            ${signal.targets.take_profit_1.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-[#1E293B]/60">
          <span className="text-[#34D399] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Take-Profit 2 (Runner):
          </span>
          <span className="font-bold text-[#34D399]">
            ${signal.targets.take_profit_2.toFixed(2)} <span className="text-[10px] font-normal text-[#10B981]/80">({isBuy ? "+" : "-"}{tp2Percent.toFixed(2)}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-[#64748B]">
          <span>Risk/Reward: <strong className="text-white">1 : {signal.targets.risk_reward_ratio.toFixed(2)}</strong></span>
          <span>Time Horizon: <strong className="text-white">{signal.max_holding_minutes || 90}m Max Stop</strong></span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#1E293B]/60 text-[10px] text-[#64748B]">
          <span>RL Self-Learning Policy:</span>
          <span className="text-[#38BDF8] font-semibold">
            Ep #{signal.confluence.rl_episodes ?? 0} | Sharpe {(signal.confluence.rl_sharpe ?? 2.15).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Margin Allocation & Leverage Controls */}
      <div className="p-3 bg-[#131B2E] border border-[#1E293B] rounded-xl flex flex-col gap-2.5 text-xs font-mono">
        <div className="flex items-center justify-between">
          <span className="text-[#94A3B8] font-semibold flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#10B981]" /> Margin & Sizing:
          </span>
          <div className="flex items-center gap-1">
            {[250, 500, 1000, 2500].map((val) => (
              <button
                key={val}
                onClick={() => setMargin(val)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  margin === val
                    ? "bg-[#10B981] text-white"
                    : "bg-[#1E293B] text-[#94A3B8] hover:text-white"
                }`}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Leverage Selector Row */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1E293B]/60">
          <span className="text-[#94A3B8] text-[11px]">Leverage Multiplier:</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 5, 10].map((lev) => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  leverage === lev
                    ? "bg-[#2962FF] text-white"
                    : "bg-[#1E293B] text-[#94A3B8] hover:text-white"
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[#1E293B]/60">
          <div>
            <span className="text-[10px] text-[#64748B] block uppercase">Position Value</span>
            <span className="text-white font-bold">${notionalPosition.toLocaleString()} USDT</span>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block uppercase">Max Risk</span>
            <span className="text-[#F87171] font-bold">-${maxRiskDollars.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block uppercase">Target Gain</span>
            <span className="text-[#34D399] font-bold">+${potentialGainDollars.toFixed(2)}</span>
          </div>
        </div>

        {/* Liquidation Precedence Indicator */}
        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#1E293B]/60">
          <span className="text-[#64748B]">
            Est. Liquidation: <strong className="text-white font-mono">${estLiqPrice.toFixed(2)}</strong>
          </span>
          <span className={`font-semibold flex items-center gap-1 ${isLiquidationSafe ? "text-[#34D399]" : "text-[#EF4444]"}`}>
            <ShieldCheck className="w-3 h-3" />
            {isLiquidationSafe ? "LIQUIDATION SAFE (>SL)" : "LEVERAGE TOO HIGH"}
          </span>
        </div>
      </div>

      {/* 1-Click Primary Execution CTA */}
      <button
        onClick={() => onExecuteTrade({ margin, leverage, strategyProfile: signal.strategy_profile || currentProfile })}
        disabled={isExecuting || isExpired || !isLiquidationSafe}
        aria-label={`Execute paper ${isBuy ? "Long" : "Short"} position`}
        className={`w-full min-h-[50px] rounded-xl font-bold font-mono tracking-wide text-sm flex items-center justify-center shadow-lg transition-all active:scale-[0.98] ${
          isExpired || !isLiquidationSafe
            ? "bg-[#1E293B] text-[#64748B] cursor-not-allowed border border-[#334155]"
            : isBuy
            ? "bg-[#10B981] hover:bg-[#059669] text-white shadow-[#10B981]/25 hover:shadow-[#10B981]/40 border border-[#34D399]/50"
            : "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-[#EF4444]/25 hover:shadow-[#EF4444]/40 border border-[#F87171]/50"
        }`}
      >
        <span>
          {isExecuting
            ? "TRANSMITTING DEMO ORDER..."
            : isExpired
            ? "VALIDITY WINDOW EXPIRED"
            : `EXECUTE PAPER ${isBuy ? "LONG" : "SHORT"} (${margin} USDT @ ${leverage}X)`}
        </span>
      </button>
    </div>
  );
};
