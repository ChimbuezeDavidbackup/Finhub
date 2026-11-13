"use client";

import React, { useState } from "react";
import { SignalData, StrategyProfile, TickerData } from "../../types";
import { ChartIndicatorToggles } from "../layout/TopWorkstationBar";

interface RightWorkstationPanelProps {
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  tickers: Record<string, TickerData>;
  signal: SignalData | null;
  currentProfile: StrategyProfile;
  onSelectProfile: (profile: StrategyProfile) => void;
  onExecuteTrade: (params: { margin: number; leverage: number; strategyProfile: string }) => void;
  isExecuting?: boolean;
  onRefreshAnalysis?: () => void;
  isAnalyzing?: boolean;
  indicators: ChartIndicatorToggles;
  onToggleIndicator: (key: keyof ChartIndicatorToggles) => void;
  activeTabOverride?: "OVERVIEW" | "ORDER";
  onTabChange?: (tab: "OVERVIEW" | "ORDER") => void;
}

const WATCHLIST_GROUPS = [
  {
    category: "COMMODITIES",
    items: [
      { id: "PAXG/USDT", code: "GOLD", name: "Gold / PAX Gold (XAU)", badge: "bg-[#F59E0B] text-black" },
    ],
  },
  {
    category: "CRYPTO",
    items: [
      { id: "BTC/USDT", code: "BTCUSD", name: "Bitcoin / U.S. Dollar", badge: "bg-[#F7931A] text-white" },
      { id: "ETH/USDT", code: "ETHUSD", name: "Ethereum / U.S. Dollar", badge: "bg-[#627EEA] text-white" },
      { id: "SOL/USDT", code: "SOLUSD", name: "Solana / U.S. Dollar", badge: "bg-[#9945FF] text-white" },
    ],
  },
];

export const RightWorkstationPanel: React.FC<RightWorkstationPanelProps> = ({
  currentSymbol,
  onSelectSymbol,
  tickers,
  signal,
  currentProfile,
  onExecuteTrade,
  isExecuting = false,
  onRefreshAnalysis,
  isAnalyzing = false,
  indicators,
  onToggleIndicator,
  activeTabOverride,
  onTabChange,
}) => {
  const [localTab, setLocalTab] = useState<"OVERVIEW" | "ORDER">("OVERVIEW");
  const [marginUsdt, setMarginUsdt] = useState<number>(1000);
  const [leverage, setLeverage] = useState<number>(5);

  const activeTab = activeTabOverride ?? localTab;
  const setTab = (t: "OVERVIEW" | "ORDER") => {
    setLocalTab(t);
    onTabChange?.(t);
  };

  const activeTicker = tickers[currentSymbol];
  const price = activeTicker?.price ?? 0;
  const chgPct = activeTicker?.change_24h_percent ?? activeTicker?.change_24h ?? 0;
  const chgAbs = price * (chgPct / 100);
  const isUp = chgPct >= 0;

  const activeMeta =
    WATCHLIST_GROUPS.flatMap((g) => g.items).find((i) => i.id === currentSymbol) ||
    WATCHLIST_GROUPS[1].items[0];

  const isBuy = signal?.direction === "BUY";
  const isSell = signal?.direction === "SELL";

  const fmt = (n?: number) =>
    n !== undefined
      ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  return (
    <aside className="w-full lg:w-[325px] xl:w-[345px] shrink-0 h-full bg-[#131722] border-l border-[#2A2E39] flex flex-col select-none overflow-hidden text-xs">
      {/* 1. TOP HALF: TRADINGVIEW WATCHLIST */}
      <div className="border-b border-[#2A2E39] flex flex-col shrink-0">
        <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-[#1E222D]">
          <span className="font-semibold text-[13px] text-[#D1D4DC]">Watchlist</span>
          <span className="text-[11px] text-[#787B86]">Spot & Perp</span>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-12 px-3.5 py-1.5 text-[11px] text-[#787B86] border-b border-[#1E222D]">
          <span className="col-span-5">Symbol</span>
          <span className="col-span-3 text-right">Last</span>
          <span className="col-span-2 text-right">Chg</span>
          <span className="col-span-2 text-right">Chg%</span>
        </div>

        {/* Grouped Rows */}
        <div className="divide-y divide-[#1E222D]">
          {WATCHLIST_GROUPS.map((group) => (
            <div key={group.category}>
              <div className="px-3.5 py-1 text-[10px] font-semibold text-[#787B86] tracking-wider uppercase bg-[#131722]">
                ∨ {group.category}
              </div>
              {group.items.map((item) => {
                const t = tickers[item.id];
                const p = t?.price ?? 0;
                const pct = t?.change_24h_percent ?? t?.change_24h ?? 0;
                const diff = p * (pct / 100);
                const selected = item.id === currentSymbol;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectSymbol(item.id)}
                    className={`w-full grid grid-cols-12 items-center px-3.5 py-2 transition-colors text-left font-mono ${
                      selected
                        ? "bg-[#2962FF]/15 border-l-2 border-l-[#2962FF]"
                        : "hover:bg-[#1E222D]"
                    }`}
                  >
                    <div className="col-span-5 flex items-center gap-2 font-sans">
                      <span
                        className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${item.badge}`}
                      >
                        {item.code[0]}
                      </span>
                      <span className="font-semibold text-[#D1D4DC] text-xs truncate">
                        {item.code}
                      </span>
                    </div>

                    <span
                      className="col-span-3 text-right text-[#D1D4DC] text-xs"
                      suppressHydrationWarning
                    >
                      {p > 0 ? fmt(p) : "—"}
                    </span>

                    <span
                      suppressHydrationWarning
                      className={`col-span-2 text-right text-[11px] ${
                        pct >= 0 ? "text-[#089981]" : "text-[#F23645]"
                      }`}
                    >
                      {p > 0 ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}
                    </span>

                    <span
                      suppressHydrationWarning
                      className={`col-span-2 text-right text-[11px] ${
                        pct >= 0 ? "text-[#089981]" : "text-[#F23645]"
                      }`}
                    >
                      {`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 2. BOTTOM HALF: ACTIVE SYMBOL DETAIL PANE (Overview & Key Facts vs Order Ticket) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Symbol Header + Mode Switcher */}
        <div className="px-3.5 pt-3 pb-2 border-b border-[#1E222D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${activeMeta.badge}`}
            >
              {activeMeta.code[0]}
            </span>
            <span className="font-bold text-white text-[13px]">{activeMeta.code}</span>
          </div>

          <div className="flex items-center bg-[#1E222D] p-0.5 rounded text-[11px]">
            <button
              onClick={() => setTab("OVERVIEW")}
              className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                activeTab === "OVERVIEW"
                  ? "bg-[#2A2E39] text-white"
                  : "text-[#787B86] hover:text-[#D1D4DC]"
              }`}
            >
              Key Facts
            </button>
            <button
              onClick={() => setTab("ORDER")}
              className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                activeTab === "ORDER"
                  ? "bg-[#2962FF] text-white"
                  : "text-[#787B86] hover:text-[#D1D4DC]"
              }`}
            >
              Order Ticket
            </button>
          </div>
        </div>

        {activeTab === "OVERVIEW" ? (
          <div className="p-3.5 flex flex-col gap-3.5">
            {/* Subtitle & Large Price Readout (Matches TradingView Reference Screenshot) */}
            <div>
              <div className="text-[11px] text-[#787B86]">{activeMeta.name} · Quantitative Feed</div>
              <div className="text-[11px] text-[#787B86] mb-2">
                {currentSymbol === "PAXG/USDT" ? "Commodity · Safe Haven" : "Spot & Perpetual · Crypto"}
              </div>

              <div className="flex items-baseline gap-2 flex-wrap font-mono">
                <span className="text-2xl font-bold text-white tracking-tight" suppressHydrationWarning>
                  {price > 0 ? fmt(price) : "—"}
                </span>
                <span className="text-[11px] text-[#787B86] font-sans">USD</span>
                <span
                  suppressHydrationWarning
                  className={`text-xs font-semibold ${isUp ? "text-[#089981]" : "text-[#F23645]"}`}
                >
                  {isUp ? "+" : ""}
                  {chgAbs.toFixed(2)} {isUp ? "+" : ""}
                  {chgPct.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#089981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
                <span>Market open</span>
              </div>
            </div>

            {/* Volume vs Avg Volume Bar (Exact TradingView Reference Element) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#787B86]">
                  Volume <strong className="text-[#D1D4DC] font-mono ml-1">173.84K</strong>
                </span>
                <span className="text-[#787B86]">
                  Avg. volume (30D) <strong className="text-[#D1D4DC] font-mono ml-1">102.21K</strong>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#1E222D] overflow-hidden flex">
                <div className="h-full bg-[#00BCD4] w-[62%]" />
                <div className="h-full bg-[#2962FF] w-[38%]" />
              </div>
            </div>

            {/* Purple-Bordered "Key facts" AI Card (Matches Image 3) */}
            <div className="p-3 rounded-lg bg-[#181C27] border border-[#7E57C2]/45 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#CE93D8]">
                  ✦ Key facts · AI Model Workings
                </span>
                {signal && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                      isBuy
                        ? "bg-[#089981]/20 text-[#089981]"
                        : isSell
                        ? "bg-[#F23645]/20 text-[#F23645]"
                        : "bg-[#2A2E39] text-[#D1D4DC]"
                    }`}
                  >
                    {signal.direction} ({signal.confluence?.overall_conviction ?? 84}%)
                  </span>
                )}
              </div>

              <p className="text-xs text-[#D1D4DC] leading-relaxed">
                {signal?.confluence?.technical_rationale ||
                  "AI Ensemble (87.9% CV) plotted EMA(20) and RSI(14) Bull/Bear inflection flags directly on the chart."}
              </p>

              {/* Quick Layer Pills so the user can toggle additional AI drawings without clutter */}
              <div className="pt-1 border-t border-[#2A2E39] flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[#787B86] w-full">
                  Show additional AI workings on chart:
                </span>
                <button
                  onClick={() => onToggleIndicator("showFib")}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium border transition-colors ${
                    indicators.showFib
                      ? "bg-[#089981]/20 border-[#089981] text-[#089981]"
                      : "bg-[#131722] border-[#2A2E39] text-[#787B86] hover:text-white"
                  }`}
                >
                  Fibonacci
                </button>
                <button
                  onClick={() => onToggleIndicator("showTargets")}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium border transition-colors ${
                    indicators.showTargets
                      ? "bg-[#2962FF]/20 border-[#2962FF] text-[#60A5FA]"
                      : "bg-[#131722] border-[#2A2E39] text-[#787B86] hover:text-white"
                  }`}
                >
                  SL / TP Lines
                </button>
                <button
                  onClick={() => onToggleIndicator("showOB")}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-medium border transition-colors ${
                    indicators.showOB
                      ? "bg-[#F59E0B]/20 border-[#F59E0B] text-[#FBBF24]"
                      : "bg-[#131722] border-[#2A2E39] text-[#787B86] hover:text-white"
                  }`}
                >
                  Order Blocks
                </button>
              </div>
            </div>

            {/* Key Stats Table (Matches Bottom-Right of Image 3) */}
            <div className="flex flex-col gap-2 pt-1">
              <span className="font-semibold text-xs text-[#D1D4DC]">Key stats</span>
              <div className="divide-y divide-[#1E222D] text-xs">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-[#787B86]">AI Entry Zone</span>
                  <span className="font-mono text-[#D1D4DC]">
                    {signal?.targets
                      ? `$${fmt(signal.targets.entry_min)} – $${fmt(signal.targets.entry_max)}`
                      : "—"}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-[#787B86]">Stop Loss (1.2x ATR)</span>
                  <span className="font-mono text-[#F23645]">
                    {signal?.targets ? `$${fmt(signal.targets.stop_loss)}` : "—"}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-[#787B86]">Take Profit 1 (BE Lock)</span>
                  <span className="font-mono text-[#2962FF]">
                    {signal?.targets ? `$${fmt(signal.targets.take_profit_1)}` : "—"}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-[#787B86]">Take Profit 2 (Runner)</span>
                  <span className="font-mono text-[#089981]">
                    {signal?.targets ? `$${fmt(signal.targets.take_profit_2)}` : "—"}
                  </span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-[#787B86]">Risk / Reward Ratio</span>
                  <span className="font-mono text-white font-semibold">
                    1 : {signal?.targets?.risk_reward_ratio ?? "2.4"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons (Strict Rule: Text Only, No Icons) */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setTab("ORDER")}
                className="flex-1 py-2 rounded bg-[#2962FF] hover:bg-[#1E53E5] text-white font-semibold text-xs transition-all"
              >
                Open Order Ticket
              </button>
              <button
                onClick={onRefreshAnalysis}
                disabled={isAnalyzing}
                className="px-3 py-2 rounded bg-[#1E222D] hover:bg-[#2A2E39] text-[#D1D4DC] font-medium text-xs transition-all"
              >
                {isAnalyzing ? "..." : "Refresh"}
              </button>
            </div>
          </div>
        ) : (
          /* CLEAN, SPACIOUS ORDER TICKET TAB */
          <div className="p-3.5 flex flex-col gap-4">
            <div className="p-3 rounded bg-[#181C27] border border-[#2A2E39] flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#787B86] uppercase">AI Signal Direction</div>
                <div
                  className={`text-base font-bold font-mono ${
                    isBuy ? "text-[#089981]" : isSell ? "text-[#F23645]" : "text-[#D1D4DC]"
                  }`}
                >
                  {signal?.direction || "BUY"} · {signal?.confluence?.overall_conviction || 82}% Conviction
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-[10px] text-[#787B86]">Mark Price</div>
                <div className="text-sm font-bold text-white">${fmt(price)}</div>
              </div>
            </div>

            {/* Margin Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#787B86]">Margin Allocation</span>
                <span className="font-mono font-bold text-white">${marginUsdt.toLocaleString()} USDT</span>
              </div>
              <input
                type="range"
                min={100}
                max={5000}
                step={100}
                value={marginUsdt}
                onChange={(e) => setMarginUsdt(Number(e.target.value))}
                className="w-full accent-[#2962FF] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#787B86] font-mono">
                <span>$100</span>
                <span>$1,000</span>
                <span>$2,500</span>
                <span>$5,000</span>
              </div>
            </div>

            {/* Leverage Selector */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#787B86]">Leverage</span>
                <span className="font-mono text-[#D1D4DC]">
                  Notional: ${(marginUsdt * leverage).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 font-mono">
                {[1, 2, 3, 5, 10].map((lev) => (
                  <button
                    key={lev}
                    onClick={() => setLeverage(lev)}
                    className={`py-1.5 rounded text-xs font-semibold border transition-colors ${
                      leverage === lev
                        ? "bg-[#2962FF]/20 border-[#2962FF] text-white"
                        : "bg-[#181C27] border-[#2A2E39] text-[#787B86] hover:text-white"
                    }`}
                  >
                    {lev}x
                  </button>
                ))}
              </div>
            </div>

            {/* Pre-Filled Protection Levels */}
            <div className="p-3 rounded bg-[#181C27] border border-[#2A2E39] flex flex-col gap-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#787B86]">Auto Stop-Loss:</span>
                <span className="text-[#F23645]">${fmt(signal?.targets?.stop_loss)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787B86]">Take Profit 1 (BE Lock):</span>
                <span className="text-[#2962FF]">${fmt(signal?.targets?.take_profit_1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787B86]">Take Profit 2 (Runner):</span>
                <span className="text-[#089981]">${fmt(signal?.targets?.take_profit_2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#2A2E39] text-[10px]">
                <span className="text-[#787B86]">Est. Taker Fee (4 bps):</span>
                <span className="text-[#D1D4DC]">${(marginUsdt * leverage * 0.0004).toFixed(2)}</span>
              </div>
            </div>

            {/* Primary Order Execution Button (Clean Text Only, No Icons) */}
            <button
              onClick={() =>
                onExecuteTrade({
                  margin: marginUsdt,
                  leverage,
                  strategyProfile: currentProfile,
                })
              }
              disabled={isExecuting || signal?.direction === "NEUTRAL"}
              className={`w-full py-2.5 rounded font-bold text-xs tracking-wide transition-all active:scale-95 ${
                signal?.direction === "NEUTRAL"
                  ? "bg-[#2A2E39] text-[#787B86] cursor-not-allowed"
                  : isSell
                  ? "bg-[#F23645] hover:bg-[#D32F2F] text-white"
                  : "bg-[#089981] hover:bg-[#067A67] text-white"
              }`}
            >
              <span>
                {isExecuting
                  ? "ROUTING ORDER..."
                  : signal?.direction === "NEUTRAL"
                  ? "AWAITING CONFLUENCE"
                  : `EXECUTE ${signal?.direction || "BUY"} ORDER`}
              </span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
