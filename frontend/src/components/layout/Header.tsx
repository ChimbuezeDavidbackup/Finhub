"use client";

import React from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { MarketRegimeType } from "../../types";

interface HeaderProps {
  regime?: MarketRegimeType;
  sizingMultiplier?: number;
  balance?: number;
  equity?: number;
  freeMargin?: number;
  usedMargin?: number;
  unrealizedPnl?: number;
  onResetBalance: () => void;
  isResetting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  regime = "NORMAL_CONFLUENCE",
  sizingMultiplier = 1.0,
  equity = 10000.0,
  freeMargin = 10000.0,
  usedMargin = 0.0,
  unrealizedPnl = 0.0,
  onResetBalance,
  isResetting = false,
}) => {
  const isShock = regime === "VOLATILITY_SHOCK";
  const hasOpenPosition = usedMargin > 0;
  const isProfit = unrealizedPnl >= 0;

  return (
    <header className="w-full bg-[#0B0F19] border-b border-[#1E293B] px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Brand & Subtitle (No icon, no V1) */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-wider text-white text-lg font-mono">FINHUB</span>
          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30">
            PRO
          </span>
        </div>
        <p className="text-[11px] text-[#94A3B8] font-medium tracking-tight">
          AI TRADING ARBITER & DECISION SUPPORT
        </p>
      </div>

      {/* Center & Right Badges */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Dual-Regime Classifier Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            isShock
              ? "bg-[#EF4444]/15 border-[#EF4444]/40 text-[#F87171] animate-pulse"
              : "bg-[#10B981]/10 border-[#10B981]/30 text-[#34D399]"
          }`}
        >
          {isShock ? (
            <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" />
          ) : (
            <Activity className="w-3.5 h-3.5 text-[#10B981]" />
          )}
          <span>
            {isShock ? "VOLATILITY SHOCK" : "NORMAL REGIME"} ({sizingMultiplier}x)
          </span>
        </div>

        {/* Dynamic Demo Account HUD: Equity + Free Margin + Reset */}
        <div className="flex items-center bg-[#131B2E] border border-[#1E293B] rounded-lg p-1.5 px-3.5 gap-4 text-xs font-mono">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#64748B] uppercase font-semibold">Total Equity</span>
              {hasOpenPosition && (
                <span
                  suppressHydrationWarning
                  className={`text-[10px] font-bold ${isProfit ? "text-[#34D399]" : "text-[#F87171]"}`}
                >
                  ({isProfit ? "+" : ""}${unrealizedPnl.toFixed(2)})
                </span>
              )}
            </div>
            <span
              className={`font-mono font-bold text-sm ${
                hasOpenPosition ? (isProfit ? "text-[#34D399]" : "text-[#F87171]") : "text-white"
              }`}
              suppressHydrationWarning
            >
              ${equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px] font-normal text-[#94A3B8] ml-1">USDT</span>
            </span>
          </div>

          <div className="hidden sm:flex flex-col border-l border-[#1E293B] pl-3 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">Available:</span>
              <span className="text-white font-medium" suppressHydrationWarning>
                ${freeMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {hasOpenPosition && (
              <div className="flex items-center gap-2">
                <span className="text-[#64748B]">In Margin:</span>
                <span className="text-[#38BDF8] font-medium" suppressHydrationWarning>
                  ${usedMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onResetBalance}
            disabled={isResetting}
            className="px-2.5 py-1.5 rounded-md bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white transition-all text-xs font-medium border border-[#334155] active:scale-95 disabled:opacity-50"
            title="Reset demo account to $10,000 USDT starting capital"
          >
            <span>{isResetting ? "Resetting..." : "Reset"}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
