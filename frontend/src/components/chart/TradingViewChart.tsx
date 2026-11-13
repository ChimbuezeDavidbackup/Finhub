"use client";

import React, { useMemo, useState } from "react";
import { BarChart2 } from "lucide-react";
import { TargetLadder, SignalData, CandleData, TickerData } from "../../types";
import { ChartIndicatorToggles } from "../layout/TopWorkstationBar";
import { LightweightAIChart } from "./LightweightAIChart";

interface TradingViewChartProps {
  symbol: string;
  targets?: TargetLadder;
  signal?: SignalData | null;
  currentTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  currentPrice?: number;
  candles?: CandleData[];
  ticker?: TickerData;
  indicators?: ChartIndicatorToggles;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  targets,
  signal,
  currentTimeframe = "15m",
  onTimeframeChange,
  currentPrice,
  candles = [],
  ticker,
  indicators,
}) => {
  // Default tab is TradingView, with AI Chart as the second tab
  const [activeTab, setActiveTab] = useState<"LIVE_TV" | "AI_LIGHTWEIGHT">("LIVE_TV");

  const tvSymbol = useMemo(() => {
    if (symbol === "PAXG/USDT") return "BINANCE:PAXGUSDT";
    const raw = symbol.replace("/", "").toUpperCase();
    return `BINANCE:${raw}`;
  }, [symbol]);

  const tvInterval = useMemo(() => {
    switch (currentTimeframe.toLowerCase()) {
      case "1m":
        return "1";
      case "5m":
        return "5";
      case "15m":
        return "15";
      case "1h":
        return "60";
      case "4h":
        return "240";
      default:
        return "15";
    }
  }, [currentTimeframe]);

  const studiesParam = useMemo(() => {
    const list: string[] = [];
    if (!indicators || indicators.showMA) {
      list.push("MASimple@tv-basicstudies");
    }
    if (!indicators || indicators.showRSI) {
      list.push("RSI@tv-basicstudies");
    }
    if (indicators?.showFib) {
      list.push("BB@tv-basicstudies");
    }
    if (indicators?.showTargets) {
      list.push("VWAP@tv-basicstudies");
    }
    if (indicators?.showOB) {
      list.push("MACD@tv-basicstudies");
    }
    return encodeURIComponent(JSON.stringify(list));
  }, [indicators]);

  const iframeSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(
    tvSymbol
  )}&interval=${tvInterval}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=0B0F19&theme=dark&style=1&timezone=Etc%2FUTC&studies=${studiesParam}&withdateranges=1&hideideas=1&locale=en`;

  return (
    <div className="w-full bg-[#0D1322] border border-[#1E293B] rounded-xl flex flex-col overflow-hidden shadow-lg">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-[#0A0E1A] border-b border-[#1E293B] gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <BarChart2 className="w-4 h-4 text-[#10B981]" />
          <span className="font-bold text-white text-sm font-mono">
            {symbol === "PAXG/USDT" ? "GOLD (PAXG/USDT)" : symbol}
          </span>
          {/* Interactive Timeframe Selector Synchronized Across Both Chart Modes */}
          <div className="flex items-center gap-0.5 p-0.5 rounded bg-[#131B2E] border border-[#1E293B] font-mono text-[11px]">
            {["1m", "5m", "15m", "1h", "4h"].map((tf) => {
              const isSelected = currentTimeframe.toLowerCase() === tf;
              return (
                <button
                  key={tf}
                  onClick={() => onTimeframeChange?.(tf)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    isSelected
                      ? "bg-[#2962FF] text-white font-bold"
                      : "text-[#94A3B8] hover:text-white hover:bg-[#1E293B]"
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>
          {currentPrice && (
            <span className="text-xs font-mono font-bold text-[#34D399]" suppressHydrationWarning>
              ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Mode Switcher: TradingView (Default) vs AI Chart */}
        <div className="flex items-center p-0.5 bg-[#131B2E] border border-[#1E293B] rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveTab("LIVE_TV")}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              activeTab === "LIVE_TV"
                ? "bg-[#10B981] text-[#080B12] font-bold"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            TradingView
          </button>
          <button
            onClick={() => setActiveTab("AI_LIGHTWEIGHT")}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              activeTab === "AI_LIGHTWEIGHT"
                ? "bg-[#2962FF] text-white font-bold"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            AI Chart
          </button>
        </div>
      </div>

      {/* Main Chart Body */}
      <div className="w-full h-[440px] sm:h-[500px] lg:h-[540px] bg-[#0B0F19] relative">
        {activeTab === "AI_LIGHTWEIGHT" ? (
          <LightweightAIChart
            symbol={symbol}
            timeframe={currentTimeframe}
            candles={candles}
            ticker={ticker}
            signal={signal}
            targets={targets}
            showMA={indicators?.showMA ?? true}
            showRSI={indicators?.showRSI ?? true}
            showFib={indicators?.showFib ?? true}
            showTargets={indicators?.showTargets ?? true}
            showOB={indicators?.showOB ?? true}
          />
        ) : (
          <iframe
            key={`${tvSymbol}-${tvInterval}-${studiesParam}`}
            title={`TradingView Chart ${symbol}`}
            src={iframeSrc}
            className="w-full h-full border-0"
            loading="lazy"
            allow="fullscreen"
          />
        )}
      </div>

      {/* Bottom AI Target Levels Strip */}
      {targets && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-2.5 bg-[#0A0E1A] border-t border-[#1E293B] text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748B] uppercase">AI Entry Zone</span>
            <span className="text-[#38BDF8] font-bold">
              ${targets.entry_min.toLocaleString("en-US", { minimumFractionDigits: 2 })} – $
              {targets.entry_max.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748B] uppercase">Stop-Loss (1.2x ATR)</span>
            <span className="text-[#F87171] font-bold">
              ${targets.stop_loss.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748B] uppercase">TP1 (50% & BE Lock)</span>
            <span className="text-[#34D399] font-bold">
              ${targets.take_profit_1.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748B] uppercase">TP2 (Runner Target)</span>
            <span className="text-[#10B981] font-bold">
              ${targets.take_profit_2.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
