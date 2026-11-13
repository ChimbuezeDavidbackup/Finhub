"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Sliders } from "lucide-react";
import { MarketRegimeType, StrategyProfile, TickerData } from "../../types";

export interface ChartIndicatorToggles {
  aiAutoMode?: boolean;
  showMA: boolean;
  showFib: boolean;
  showOB: boolean;
  showTargets: boolean;
  showRSI: boolean;
}

interface TopWorkstationBarProps {
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  tickers: Record<string, TickerData>;
  currentProfile: StrategyProfile;
  onSelectProfile: (profile: StrategyProfile) => void;
  onRunAnalysis: (symbol: string) => void;
  isAnalyzing?: boolean;
  regime?: MarketRegimeType;
  sizingMultiplier?: number;
  equity?: number;
  freeMargin?: number;
  unrealizedPnl?: number;
  onResetBalance: () => void;
  isResetting?: boolean;
  openPositionsCount?: number;
  isPaperPopupOpen?: boolean;
  onTogglePaperPopup?: () => void;
  indicators: ChartIndicatorToggles;
  onToggleIndicator: (key: keyof ChartIndicatorToggles) => void;
}

const SYMBOL_CATALOG = [
  { id: "BTC/USDT", code: "BTCUSD", name: "Bitcoin / U.S. Dollar", badge: "bg-[#F7931A] text-white" },
  { id: "ETH/USDT", code: "ETHUSD", name: "Ethereum / U.S. Dollar", badge: "bg-[#627EEA] text-white" },
  { id: "SOL/USDT", code: "SOLUSD", name: "Solana / U.S. Dollar", badge: "bg-[#9945FF] text-white" },
  { id: "PAXG/USDT", code: "GOLD", name: "Gold / PAX Gold (XAU)", badge: "bg-[#F59E0B] text-black" },
];

const TIMEFRAMES: { id: StrategyProfile; label: string }[] = [
  { id: "MICRO_1M", label: "1m" },
  { id: "SCALP_5M", label: "5m" },
  { id: "INTRADAY_15M", label: "15m" },
  { id: "SWING_1H", label: "1h" },
  { id: "MACRO_4H", label: "4h" },
];

export const TopWorkstationBar: React.FC<TopWorkstationBarProps> = ({
  currentSymbol,
  onSelectSymbol,
  tickers,
  currentProfile,
  onSelectProfile,
  onRunAnalysis,
  isAnalyzing = false,
  regime = "NORMAL_CONFLUENCE",
  sizingMultiplier = 1.0,
  equity = 10000.0,
  unrealizedPnl = 0.0,
  onResetBalance,
  isResetting = false,
  openPositionsCount = 0,
  isPaperPopupOpen = false,
  onTogglePaperPopup,
  indicators,
  onToggleIndicator,
}) => {
  const [symbolMenuOpen, setSymbolMenuOpen] = useState(false);
  const [indMenuOpen, setIndMenuOpen] = useState(false);
  const symRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (symRef.current && !symRef.current.contains(e.target as Node)) {
        setSymbolMenuOpen(false);
      }
      if (indRef.current && !indRef.current.contains(e.target as Node)) {
        setIndMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeMeta = SYMBOL_CATALOG.find((s) => s.id === currentSymbol) || SYMBOL_CATALOG[0];
  const isShock = regime === "VOLATILITY_SHOCK";
  const activeCount = [
    indicators.showMA,
    indicators.showRSI,
    indicators.showFib,
    indicators.showTargets,
    indicators.showOB,
  ].filter(Boolean).length;

  return (
    <header className="w-full h-[42px] bg-[#131722] border-b border-[#2A2E39] px-3 flex items-center justify-between select-none relative z-50 text-xs">
      {/* LEFT WORKSTATION TOOLBAR (TradingView Exact Pattern) */}
      <div className="flex items-center h-full gap-1">
        {/* Brand Badge (No icon, no V1) */}
        <div className="flex items-center gap-1.5 pr-2.5 mr-1 border-r border-[#2A2E39] h-5">
          <span className="font-extrabold text-white tracking-wider text-xs font-mono">
            FINHUB
          </span>
        </div>

        {/* Active Symbol Pill Tied to Chart */}
        <div className="relative" ref={symRef}>
          <button
            onClick={() => setSymbolMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-[#2A2E39]/70 transition-colors text-[#D1D4DC] font-semibold"
          >
            <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${activeMeta.badge}`}>
              {activeMeta.code[0]}
            </span>
            <span className="text-[13px] font-bold text-white tracking-tight">{activeMeta.code}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#787B86]" />
          </button>

          {symbolMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-md bg-[#1E222D] border border-[#2A2E39] shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1 text-[10px] text-[#787B86] uppercase tracking-wider font-semibold">
                Switch Chart Symbol
              </div>
              {SYMBOL_CATALOG.map((item) => {
                const t = tickers[item.id];
                const chg = t?.change_24h_percent ?? t?.change_24h ?? 0;
                const selected = item.id === currentSymbol;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectSymbol(item.id);
                      setSymbolMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between hover:bg-[#2A2E39] transition-colors ${
                      selected ? "bg-[#2962FF]/15 text-white" : "text-[#D1D4DC]"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-left">
                      <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${item.badge}`}>
                        {item.code[0]}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-white leading-tight">{item.code}</div>
                        <div className="text-[10px] text-[#787B86] leading-tight">{item.name}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-semibold text-white">
                        {t?.price ? t.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                      </div>
                      <div className={`text-[10px] ${chg >= 0 ? "text-[#089981]" : "text-[#F23645]"}`}>
                        {chg >= 0 ? "+" : ""}
                        {chg.toFixed(2)}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#2A2E39] mx-1" />

        {/* Clean TradingView Timeframe Buttons */}
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map((tf) => {
            const active = currentProfile === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => onSelectProfile(tf.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#2962FF]/20 text-[#2962FF] font-bold"
                    : "text-[#D1D4DC] hover:bg-[#2A2E39]/70 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-[1px] bg-[#2A2E39] mx-1 hidden sm:block" />

        {/* Clean "Indicators" Menu (Replaces the 6 crowded pills) */}
        <div className="relative" ref={indRef}>
          <button
            onClick={() => setIndMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-[#2A2E39]/70 text-[#D1D4DC] hover:text-white transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#787B86]" />
            <span className="font-medium">Indicators</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#2962FF]/20 text-[#2962FF] text-[10px] font-bold">
              {activeCount}
            </span>
            <ChevronDown className="w-3 h-3 text-[#787B86]" />
          </button>

          {indMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-68 rounded-md bg-[#1E222D] border border-[#2A2E39] shadow-2xl py-2 z-50">
              <div className="px-3 py-1 text-[10px] text-[#787B86] uppercase tracking-wider font-semibold border-b border-[#2A2E39]/60 mb-1 flex items-center justify-between">
                <span>AI Model Chart Studies</span>
                {indicators.aiAutoMode && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-mono">
                    REGIME AUTO
                  </span>
                )}
              </div>
              <button
                onClick={() => onToggleIndicator("aiAutoMode")}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#2A2E39] transition-colors text-left border-b border-[#2A2E39]/60 mb-1"
              >
                <div>
                  <div className="text-xs font-bold text-[#38BDF8]">AI Auto (Regime-Conditional)</div>
                  <div className="text-[10px] text-[#787B86]">Auto-selects non-collinear studies per regime</div>
                </div>
                <span
                  className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                    indicators.aiAutoMode ? "bg-[#10B981] justify-end" : "bg-[#363A45] justify-start"
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-white block" />
                </span>
              </button>
              {[
                { key: "showMA" as const, label: "Moving Average (EMA 20 & 50)", desc: "Trend ribbon on price" },
                { key: "showRSI" as const, label: "RSI (14) + Bull/Bear Flags", desc: "Lower momentum oscillator" },
                { key: "showFib" as const, label: "Auto-Fibonacci Retracement", desc: "0.382 / 0.500 / 0.618 Golden Zone" },
                { key: "showTargets" as const, label: "AI Execution Targets (SL/TP)", desc: "Stop-loss & Take-profit lines" },
                { key: "showOB" as const, label: "Institutional Order Blocks", desc: "Supply & demand liquidity zones" },
              ].map((item) => {
                const enabled = indicators[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => onToggleIndicator(item.key)}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#2A2E39] transition-colors text-left"
                  >
                    <div>
                      <div className="text-xs font-medium text-white">{item.label}</div>
                      <div className="text-[10px] text-[#787B86]">{item.desc}</div>
                    </div>
                    <span
                      className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                        enabled ? "bg-[#2962FF] justify-end" : "bg-[#363A45] justify-start"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full bg-white block" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#2A2E39] mx-1 hidden md:block" />

        {/* Clean CTA Button (Strict Rule: Text Only, No Icons) */}
        <button
          onClick={() => onRunAnalysis(currentSymbol)}
          disabled={isAnalyzing}
          className="inline-flex items-center px-3 py-1 rounded bg-[#2962FF] hover:bg-[#1E53E5] text-white font-semibold text-xs transition-all active:scale-95"
        >
          <span>{isAnalyzing ? "Analyzing..." : "AI Analyze"}</span>
        </button>
      </div>

      {/* RIGHT WORKSTATION CLUSTER (Clean Regime + Equity + Trade Drawer Button) */}
      <div className="flex items-center gap-2">
        {/* Subtle Regime Indicator */}
        <div
          className={`hidden xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium ${
            isShock
              ? "bg-[#F23645]/15 text-[#F23645] border border-[#F23645]/30"
              : "bg-[#089981]/10 text-[#089981] border border-[#089981]/25"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isShock ? "bg-[#F23645]" : "bg-[#089981]"}`} />
          <span>
            {isShock ? "Shock Regime" : "Normal Regime"} ({sizingMultiplier}x)
          </span>
        </div>

        {/* Clean Equity Display + Reset */}
        <div className="flex items-center gap-2 bg-[#1E222D] border border-[#2A2E39] rounded px-2.5 py-1">
          <span className="text-[11px] text-[#787B86] hidden sm:inline">Equity</span>
          <span className="font-mono font-bold text-white text-xs" suppressHydrationWarning>
            ${equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {unrealizedPnl !== 0 && (
            <span
              suppressHydrationWarning
              className={`font-mono text-[11px] font-semibold ${
                unrealizedPnl >= 0 ? "text-[#089981]" : "text-[#F23645]"
              }`}
            >
              ({unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)})
            </span>
          )}
          <button
            onClick={onResetBalance}
            disabled={isResetting}
            className="text-[10px] text-[#787B86] hover:text-white pl-1.5 border-l border-[#2A2E39] transition-colors"
          >
            {isResetting ? "..." : "Reset"}
          </button>
        </div>

        {/* TradingView-Style "Trade" Button (Clean Text Only, No Icons) */}
        <button
          onClick={onTogglePaperPopup}
          className={`px-3 py-1 rounded text-xs font-semibold transition-all border ${
            isPaperPopupOpen || openPositionsCount > 0
              ? "bg-[#2962FF] border-[#2962FF] text-white"
              : "bg-[#1E222D] border-[#2A2E39] text-[#D1D4DC] hover:text-white hover:border-[#363A45]"
          }`}
        >
          <span>Trade {openPositionsCount > 0 ? `(${openPositionsCount})` : ""}</span>
        </button>
      </div>
    </header>
  );
};
