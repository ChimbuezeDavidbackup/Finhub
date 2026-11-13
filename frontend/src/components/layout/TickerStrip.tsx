"use client";

import React from "react";
import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { TickerData } from "../../types";

interface TickerStripProps {
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  tickers: Record<string, TickerData>;
  onRunAnalysis?: (symbol: string) => void;
  isAnalyzing?: boolean;
}

export const TickerStrip: React.FC<TickerStripProps> = ({
  currentSymbol,
  onSelectSymbol,
  tickers,
  onRunAnalysis,
  isAnalyzing = false,
}) => {
  const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "PAXG/USDT"];
  const assetName = currentSymbol === "PAXG/USDT" ? "GOLD" : currentSymbol.split("/")[0];

  return (
    <div className="w-full bg-[#0F1626] border-b border-[#1E293B] px-4 md:px-8 py-2.5 flex items-center justify-between overflow-x-auto no-scrollbar gap-4 text-xs">
      {/* Symbol Buttons & CTA */}
      <div className="flex items-center gap-2.5">
        {symbols.map((sym) => {
          const t = tickers[sym];
          const isSelected = currentSymbol === sym;
          const changePercent = t?.change_24h_percent ?? t?.change_24h ?? 0;
          const isPositive = changePercent > 0;
          const isNegative = changePercent < 0;
          const sign = isPositive ? "+" : "";
          const price = t?.price ?? 0;

          return (
            <button
              key={sym}
              onClick={() => onSelectSymbol(sym)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border transition-all text-left ${
                isSelected
                  ? "bg-[#1E293B] border-[#10B981] text-white shadow-sm ring-1 ring-[#10B981]/50"
                  : "bg-[#131B2E] border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]"
              }`}
            >
              <span className="font-semibold font-mono">
                {sym === "PAXG/USDT" ? "GOLD (PAXG)" : sym.split("/")[0]}
              </span>
              <span className="font-mono text-white font-medium" suppressHydrationWarning>
                {price > 0 ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
              </span>
              <span
                suppressHydrationWarning
                className={`flex items-center text-[11px] font-mono ${
                  isPositive ? "text-[#34D399]" : isNegative ? "text-[#F87171]" : "text-[#94A3B8]"
                }`}
              >
                {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : isNegative ? <TrendingDown className="w-3 h-3 mr-0.5 inline" /> : null}
                {`${sign}${changePercent.toFixed(2)}%`}
              </span>
            </button>
          );
        })}

        {/* PROMINENT GET ANALYSIS CTA BUTTON */}
        <button
          onClick={() => onRunAnalysis?.(currentSymbol)}
          disabled={isAnalyzing}
          className="ml-2 min-h-[36px] px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-mono font-bold text-xs flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all active:scale-95 border border-[#34D399]/60 shrink-0"
          title={`Generate fresh AI confluence trade analysis for ${currentSymbol}`}
        >
          <span>
            {isAnalyzing ? `ANALYZING ${assetName}...` : `GET AI ANALYSIS (${assetName})`}
          </span>
        </button>
      </div>

      {/* Macro Indicators Bar */}
      <div className="hidden lg:flex items-center gap-6 text-[#94A3B8] text-[11px] font-mono shrink-0">
        <div>
          <span className="text-[#64748B] mr-1.5">24h Vol:</span>
          <span className="text-white font-medium">$42.85B</span>
        </div>
        <div>
          <span className="text-[#64748B] mr-1.5">Funding Rate:</span>
          <span className="text-[#34D399] font-medium">+0.0102%</span>
        </div>
        <div>
          <span className="text-[#64748B] mr-1.5">Liquidations (24h):</span>
          <span className="text-[#F87171] font-medium">$84.2M</span>
        </div>
      </div>
    </div>
  );
};
