"use client";

import React from "react";
import { LineChart, Globe, Layers } from "lucide-react";
import { SignalData } from "../../types";

interface ConfluenceCardsProps {
  signal: SignalData | null;
  isAnalyzing?: boolean;
}

export const ConfluenceCards: React.FC<ConfluenceCardsProps> = ({ signal }) => {
  const isShock = signal?.regime === "VOLATILITY_SHOCK";
  const isBuy = (signal?.direction || "BUY") === "BUY";
  const workings = signal?.confluence?.indicator_workings;
  const sentScore = workings?.sentiment_score ?? 0.54;
  const obImb = workings?.ob_imbalance_pct ?? 14.2;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {/* 1. Technical Structure Card */}
      <div className="bg-[#0D1322] border border-[#1E293B] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-medium text-xs">
            <LineChart className="w-4 h-4 text-[#10B981]" />
            <span>Technical Market Structure</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30">
            {signal?.confluence?.technical_score ?? 75}%
          </span>
        </div>

        <p className="text-xs text-[#CBD5E1] leading-relaxed line-clamp-3">
          {signal?.confluence?.technical_rationale ||
            "Multi-timeframe trend intact. Price oscillating above VWAP with clean 15m order block absorption retest."}
        </p>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#1E293B]/70 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Trend Bias:</span>
            <span
              className={`font-mono font-medium ${
                isShock || !isBuy ? "text-[#F87171]" : "text-[#34D399]"
              }`}
            >
              {isShock
                ? "Volatility Shock Defense"
                : isBuy
                ? `Bullish Expansion (${workings?.fib_0618 ? `Fib 0.618: $${workings.fib_0618}` : "EMA20 > EMA50"})`
                : `Bearish Distribution (${workings?.supply_block_high ? `Supply: $${workings.supply_block_high}` : "EMA20 < EMA50"})`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Regime Model (EM-GMM):</span>
            <span className="text-[#38BDF8] font-mono">
              {signal?.regime === "VOLATILITY_SHOCK"
                ? `Shock Regime (${signal?.recommended_size_multiplier ?? 0.35}x)`
                : `Normal Confluence (${signal?.recommended_size_multiplier ?? 1.0}x)`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Macro & Sentiment Context Card */}
      <div className="bg-[#0D1322] border border-[#1E293B] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-medium text-xs">
            <Globe className="w-4 h-4 text-[#38BDF8]" />
            <span>Macro Calendar & News</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30">
            {signal?.confluence?.macro_news_score ?? 75}%
          </span>
        </div>

        <p className="text-xs text-[#CBD5E1] leading-relaxed line-clamp-3">
          {signal?.confluence?.macro_news_rationale ||
            "High-impact macroeconomic schedule clear of FOMC/CPI interest rate surprises. ETF flow velocity net positive."}
        </p>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#1E293B]/70 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Macro Schedule:</span>
            <span
              className={`font-mono font-medium truncate max-w-[190px] ${
                isShock ? "text-[#EF4444]" : "text-[#34D399]"
              }`}
              title={workings?.macro_events_proximity}
            >
              {isShock ? "HIGH IMPACT SHOCK" : workings?.macro_events_proximity || "US CPI & FOMC Stable"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">NLP Sentiment Score:</span>
            <span className={`font-mono font-semibold ${sentScore >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>
              {sentScore >= 0 ? "+" : ""}
              {sentScore.toFixed(2)} ({sentScore >= 0 ? "Bullish Inflow" : "Risk-Off"})
            </span>
          </div>
        </div>
      </div>

      {/* 3. Orderbook Depth & Liquidity Card */}
      <div className="bg-[#0D1322] border border-[#1E293B] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-medium text-xs">
            <Layers className="w-4 h-4 text-[#A855F7]" />
            <span>Orderbook Depth & Liquidity</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#A855F7]/20 text-[#C084FC] border border-[#A855F7]/30">
            {signal?.confluence?.liquidity_score ?? 71}%
          </span>
        </div>

        <p className="text-xs text-[#CBD5E1] leading-relaxed line-clamp-3">
          {signal?.confluence?.liquidity_rationale ||
            "Cumulative Volume Delta (CVD) positive. Dense short liquidation pool near TP2 acts as high-probability upside target magnet."}
        </p>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#1E293B]/70 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Kraken L2 Imbalance:</span>
            <span className={`font-mono font-medium ${obImb >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>
              {obImb >= 0 ? "+" : ""}
              {obImb.toFixed(2)}% {obImb >= 0 ? "Bid Support" : "Ask Pressure"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Risk/Reward Setup:</span>
            <span className="text-white font-mono">
              1 : {signal?.targets?.risk_reward_ratio?.toFixed(2) ?? "2.82"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
