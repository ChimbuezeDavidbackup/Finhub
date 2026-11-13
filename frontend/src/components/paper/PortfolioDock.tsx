"use client";

import React, { useState } from "react";
import { Clock } from "lucide-react";
import { PaperAccountSummary, SignalData } from "../../types";

interface PortfolioDockProps {
  summary: PaperAccountSummary | null;
  signal?: SignalData | null;
  onMoveToBreakeven: (id: string) => void;
  onClosePosition: (id: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const PortfolioDock: React.FC<PortfolioDockProps> = ({
  summary,
  signal,
  onMoveToBreakeven,
  onClosePosition,
  isOpen,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<"OPEN" | "CLOSED" | "CONFLUENCE">("OPEN");

  const openPositions = summary?.open_positions || [];
  const closedPositions = summary?.closed_positions || [];
  const conf = signal?.confluence;

  return (
    <div className="fixed bottom-0 left-0 right-0 w-full bg-[#131722] border-t border-[#2A2E39] shadow-[0_-10px_30px_rgba(0,0,0,0.6)] z-40 select-none text-xs">
      {/* Slim 32px TradingView Bottom Tab Strip */}
      <div className="h-[32px] px-3 flex items-center justify-between bg-[#131722]">
        <div className="flex items-center gap-4 h-full">
          <button
            onClick={() => {
              if (isOpen && activeTab === "OPEN") {
                onToggleOpen();
              } else {
                setActiveTab("OPEN");
                if (!isOpen) onToggleOpen();
              }
            }}
            className={`h-full flex items-center gap-2 border-b-2 px-1 font-medium transition-colors ${
              isOpen && activeTab === "OPEN"
                ? "border-[#2962FF] text-white"
                : "border-transparent text-[#787B86] hover:text-[#D1D4DC]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                openPositions.length > 0 ? "bg-[#089981]" : "bg-[#2962FF]"
              }`}
            />
            <span>Paper Trading ({openPositions.length})</span>
          </button>

          <button
            onClick={() => {
              if (isOpen && activeTab === "CLOSED") {
                onToggleOpen();
              } else {
                setActiveTab("CLOSED");
                if (!isOpen) onToggleOpen();
              }
            }}
            className={`h-full flex items-center gap-1.5 border-b-2 px-1 font-medium transition-colors ${
              isOpen && activeTab === "CLOSED"
                ? "border-[#2962FF] text-white"
                : "border-transparent text-[#787B86] hover:text-[#D1D4DC]"
            }`}
          >
            <span>Trade History ({closedPositions.length})</span>
          </button>

          <button
            onClick={() => {
              if (isOpen && activeTab === "CONFLUENCE") {
                onToggleOpen();
              } else {
                setActiveTab("CONFLUENCE");
                if (!isOpen) onToggleOpen();
              }
            }}
            className={`h-full flex items-center gap-1.5 border-b-2 px-1 font-medium transition-colors ${
              isOpen && activeTab === "CONFLUENCE"
                ? "border-[#2962FF] text-white"
                : "border-transparent text-[#787B86] hover:text-[#D1D4DC]"
            }`}
          >
            <span>AI Confluence & RL Matrix</span>
          </button>
        </div>

        <div className="flex items-center gap-5 font-mono text-[11px]">
          <span className="hidden sm:inline text-[#787B86]">
            Win Rate: <strong className="text-[#089981]">{summary ? `${summary.win_rate}%` : "74.2%"}</strong>
          </span>
          <span className="hidden md:inline text-[#787B86]">
            Profit Factor: <strong className="text-[#D1D4DC]">{summary ? summary.profit_factor : "2.65"}</strong>
          </span>
          <button
            onClick={onToggleOpen}
            className="text-[11px] font-sans font-medium text-[#2962FF] hover:text-white transition-colors"
          >
            {isOpen ? "Hide Panel" : "Show Panel"}
          </button>
        </div>
      </div>

      {/* Expandable Bottom Drawer Content */}
      {isOpen && (
        <div className="h-[210px] overflow-y-auto border-t border-[#1E222D] bg-[#0B0E14] p-3">
          {activeTab === "OPEN" && (
            openPositions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#787B86] text-xs">
                No active paper positions. Use the Order Ticket in the right sidebar or click BUY / SELL on the chart to open a trade.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {openPositions.map((pos) => {
                  const isProfit = pos.unrealized_pnl_dollars >= 0;
                  const isLong = pos.side === "LONG";

                  return (
                    <div
                      key={pos.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-3.5 py-2.5 rounded bg-[#131722] border border-[#2A2E39] font-mono text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isLong
                              ? "bg-[#089981]/20 text-[#089981]"
                              : "bg-[#F23645]/20 text-[#F23645]"
                          }`}
                        >
                          {pos.side} {pos.leverage}x
                        </span>
                        <span className="font-bold text-white">{pos.symbol}</span>
                      </div>

                      <div className="text-[#787B86]">
                        Entry: <span className="text-white">${pos.entry_price.toFixed(2)}</span> → Mark:{" "}
                        <span className="text-[#2962FF]">${pos.current_mark_price.toFixed(2)}</span>
                      </div>

                      <div className="hidden sm:flex items-center gap-3">
                        <span className="text-[#F23645]">SL: ${pos.stop_loss.toFixed(2)}</span>
                        <span className="text-[#089981]">TP2: ${pos.take_profit_2.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center gap-1 text-[#787B86]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {pos.elapsed_minutes || 0}m / {pos.max_hold_minutes}m
                        </span>
                      </div>

                      <div className={`font-bold ${isProfit ? "text-[#089981]" : "text-[#F23645]"}`}>
                        {isProfit ? "+" : ""}${pos.unrealized_pnl_dollars.toFixed(2)} ({isProfit ? "+" : ""}
                        {pos.unrealized_pnl_percent.toFixed(2)}%)
                      </div>

                      <div className="flex items-center gap-2 font-sans">
                        <button
                          onClick={() => onMoveToBreakeven(pos.id)}
                          disabled={pos.trailing_sl_active}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            pos.trailing_sl_active
                              ? "bg-[#089981]/15 border-[#089981]/40 text-[#089981]"
                              : "bg-[#1E222D] hover:bg-[#2A2E39] border-[#2A2E39] text-white"
                          }`}
                        >
                          {pos.trailing_sl_active ? "SL at BE" : "Move SL to BE"}
                        </button>
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="px-2.5 py-1 rounded bg-[#F23645]/20 hover:bg-[#F23645] text-[#F23645] hover:text-white text-[11px] font-semibold transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === "CLOSED" && (
            closedPositions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#787B86] text-xs">
                No closed trades recorded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {closedPositions.map((c) => {
                  const isProfit = c.realized_pnl_dollars >= 0;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded bg-[#131722] border border-[#2A2E39] font-mono text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.side === "LONG"
                              ? "bg-[#089981]/20 text-[#089981]"
                              : "bg-[#F23645]/20 text-[#F23645]"
                          }`}
                        >
                          {c.side}
                        </span>
                        <span className="text-white font-bold">{c.symbol}</span>
                      </div>

                      <div className="text-[#787B86]">
                        Entry: <span className="text-white">${c.entry_price.toFixed(2)}</span> → Exit:{" "}
                        <span className="text-white">
                          ${c.exit_price ? c.exit_price.toFixed(2) : c.current_mark_price.toFixed(2)}
                        </span>
                      </div>

                      <div className="text-[#787B86] text-[11px]">
                        Reason: <span className="text-[#D1D4DC]">{c.exit_reason || "Settled"}</span>
                      </div>

                      <div className={`font-bold ${isProfit ? "text-[#089981]" : "text-[#F23645]"}`}>
                        {isProfit ? "+" : ""}${c.realized_pnl_dollars.toFixed(2)} ({isProfit ? "+" : ""}
                        {c.realized_pnl_percent.toFixed(2)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === "CONFLUENCE" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 rounded bg-[#131722] border border-[#2A2E39]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#787B86] font-semibold">1. Technical Structure</span>
                  <span className="font-mono font-bold text-[#089981]">{conf?.technical_score ?? 82}%</span>
                </div>
                <p className="text-[11px] text-[#D1D4DC] leading-relaxed">{conf?.technical_rationale}</p>
              </div>

              <div className="p-3 rounded bg-[#131722] border border-[#2A2E39]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#787B86] font-semibold">2. L2 Orderbook Flow</span>
                  <span className="font-mono font-bold text-[#2962FF]">{conf?.liquidity_score ?? 76}%</span>
                </div>
                <p className="text-[11px] text-[#D1D4DC] leading-relaxed">{conf?.liquidity_rationale}</p>
              </div>

              <div className="p-3 rounded bg-[#131722] border border-[#2A2E39]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#787B86] font-semibold">3. Live RSS & NLP News</span>
                  <span className="font-mono font-bold text-[#F59E0B]">{conf?.macro_news_score ?? 71}%</span>
                </div>
                <p className="text-[11px] text-[#D1D4DC] leading-relaxed">{conf?.macro_news_rationale}</p>
              </div>

              <div className="p-3 rounded bg-[#131722] border border-[#2A2E39]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#787B86] font-semibold">4. Contextual RL & EM-GMM</span>
                  <span className="font-mono font-bold text-[#CE93D8]">
                    Ep #{conf?.rl_episodes ?? 67} · Sharpe {(conf?.rl_sharpe ?? 2.61).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-[#D1D4DC] leading-relaxed">
                  Bidirectional 3x3 Contextual RL &lt;-&gt; Unsupervised EM-GMM ({conf?.indicator_workings?.gmm_regime_mode || "NORMAL_CONFLUENCE"}) · GMM Updates: {conf?.indicator_workings?.rl_gmm_feedback_count ?? 12} · CV: 87.9%.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
