"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { TopWorkstationBar, ChartIndicatorToggles } from "../components/layout/TopWorkstationBar";
import { TradingViewChart } from "../components/chart/TradingViewChart";
import { SignalCard } from "../components/signals/SignalCard";
import { ConfluenceCards } from "../components/context/ConfluenceCards";
import { PortfolioDock } from "../components/paper/PortfolioDock";
import {
  fetchTicker,
  fetchCandles,
  fetchLatestSignal,
  fetchAccountSummary,
  executePaperTrade,
  moveStopLossToBreakeven,
  closePaperPosition,
  resetDemoAccount,
  refreshSignal,
} from "../lib/api";
import {
  TickerData,
  CandleData,
  SignalData,
  PaperAccountSummary,
  StrategyProfile,
  BreakingNewsAlert,
} from "../types";

export default function Home() {
  const [symbol, setSymbol] = useState<string>("PAXG/USDT");
  const [strategyProfile, setStrategyProfile] = useState<StrategyProfile>("INTRADAY_15M");
  const [timeframe, setTimeframe] = useState<string>("15m");
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [signalsCache, setSignalsCache] = useState<Record<string, SignalData>>({});
  const [accountSummary, setAccountSummary] = useState<PaperAccountSummary | null>(null);
  const [breakingNews, setBreakingNews] = useState<BreakingNewsAlert | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isPaperPopupOpen, setIsPaperPopupOpen] = useState<boolean>(false);

  const [indicators, setIndicators] = useState<ChartIndicatorToggles>({
    aiAutoMode: true,
    showMA: true,
    showRSI: true,
    showFib: true,
    showTargets: true,
    showOB: false,
  });

  // Dynamically apply regime-conditional non-collinear indicators when AI Auto Mode is active
  useEffect(() => {
    const rec = signal?.confluence?.indicator_workings?.recommended_toggles;
    if (indicators.aiAutoMode && rec) {
      setIndicators((prev) => ({
        ...prev,
        showMA: rec.showMA ?? prev.showMA,
        showRSI: rec.showRSI ?? prev.showRSI,
        showFib: rec.showFib ?? prev.showFib,
        showOB: rec.showOB ?? prev.showOB,
        showTargets: rec.showTargets ?? prev.showTargets,
      }));
    }
  }, [signal?.id, signal?.confluence?.indicator_workings?.recommended_toggles, indicators.aiAutoMode]);

  const handleToggleIndicator = useCallback(
    (key: keyof ChartIndicatorToggles) => {
      setIndicators((prev) => {
        if (key === "aiAutoMode") {
          const nextAuto = !prev.aiAutoMode;
          const rec = signal?.confluence?.indicator_workings?.recommended_toggles;
          if (nextAuto && rec) {
            return {
              aiAutoMode: true,
              showMA: rec.showMA ?? true,
              showRSI: rec.showRSI ?? true,
              showFib: rec.showFib ?? true,
              showOB: rec.showOB ?? false,
              showTargets: rec.showTargets ?? true,
            };
          }
          return { ...prev, aiAutoMode: nextAuto };
        }
        return { ...prev, aiAutoMode: false, [key]: !prev[key] };
      });
    },
    [signal]
  );

  const wsRef = useRef<WebSocket | null>(null);
  const signalsCacheRef = useRef<Record<string, SignalData>>({});
  const loadRequestIdRef = useRef<number>(0);

  useEffect(() => {
    signalsCacheRef.current = signalsCache;
  }, [signalsCache]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((n) => {
            if (n !== "finhub-cache-v7") caches.delete(n);
          });
        });
      }
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => r.update()))
          .catch(() => {});
      }
    }
  }, []);

  const profileToTimeframe = useCallback((profile: StrategyProfile): string => {
    return profile === "MICRO_1M"
      ? "1m"
      : profile === "SCALP_5M"
      ? "5m"
      : profile === "SWING_1H"
      ? "1h"
      : profile === "MACRO_4H"
      ? "4h"
      : "15m";
  }, []);

  const loadData = useCallback(
    async (currentSym: string, profile: StrategyProfile) => {
      const reqId = ++loadRequestIdRef.current;
      const tf = profileToTimeframe(profile);
      setTimeframe(tf);

      const cacheKey = `${currentSym}_${profile}`;
      if (signalsCacheRef.current[cacheKey]) {
        setSignal(signalsCacheRef.current[cacheKey]);
      }

      // 1. Prioritized Fast Path: Fetch candles & active signal for the selected timeframe first
      fetchCandles(currentSym, tf, 60)
        .then((candleList) => {
          if (loadRequestIdRef.current === reqId) {
            setCandles(candleList);
          }
        })
        .catch(() => {});

      fetchLatestSignal(currentSym, profile)
        .then((sig) => {
          setSignalsCache((prev) => ({ ...prev, [cacheKey]: sig }));
          if (loadRequestIdRef.current === reqId) {
            setSignal(sig);
          }
        })
        .catch(() => {});

      // 2. Background Path: Refresh tickers & account summary without blocking chart timeframe switch
      try {
        const [tickerBtc, tickerEth, tickerSol, tickerPaxg, acc] =
          await Promise.allSettled([
            fetchTicker("BTC/USDT"),
            fetchTicker("ETH/USDT"),
            fetchTicker("SOL/USDT"),
            fetchTicker("PAXG/USDT"),
            fetchAccountSummary(),
          ]);

        if (loadRequestIdRef.current !== reqId) return;

        const tickerMap: Record<string, TickerData> = {};
        if (tickerBtc.status === "fulfilled") tickerMap["BTC/USDT"] = tickerBtc.value;
        if (tickerEth.status === "fulfilled") tickerMap["ETH/USDT"] = tickerEth.value;
        if (tickerSol.status === "fulfilled") tickerMap["SOL/USDT"] = tickerSol.value;
        if (tickerPaxg.status === "fulfilled") tickerMap["PAXG/USDT"] = tickerPaxg.value;
        setTickers((prev) => ({ ...prev, ...tickerMap }));

        if (acc.status === "fulfilled") setAccountSummary(acc.value);
      } catch (e) {
        console.error("Error loading Finhub data:", e);
      }
    },
    [profileToTimeframe]
  );

  useEffect(() => {
    loadData(symbol, strategyProfile);
  }, [symbol, strategyProfile, loadData]);

  const handleSelectProfile = useCallback(
    (p: StrategyProfile) => {
      setTimeframe(profileToTimeframe(p));
      setStrategyProfile(p);
    },
    [profileToTimeframe]
  );

  useEffect(() => {
    let reconnectTimeout: any;

    const connectWs = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8001/api/v1/ws";
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "TICK" && msg.data) {
            const tick = msg.data;
            setTickers((prev) => ({
              ...prev,
              [tick.symbol]: tick,
            }));
          } else if ((msg.type === "SIGNAL_UPDATE" || msg.type === "NEW_SIGNAL") && msg.data) {
            const incomingProfile = msg.data.strategy_profile || "INTRADAY_15M";
            const key = `${msg.data.symbol}_${incomingProfile}`;
            setSignalsCache((prev) => ({ ...prev, [key]: msg.data }));
            if (msg.data.symbol === symbol && incomingProfile === strategyProfile) {
              setSignal(msg.data);
            }
          } else if (msg.type === "WINDOW_TICK" && msg.data) {
            const incomingProfile = msg.data.strategy_profile || "INTRADAY_15M";
            const cacheKey = `${msg.data.symbol}_${incomingProfile}`;
            setSignalsCache((prev) => {
              const cached = prev[cacheKey];
              if (!cached || cached.id !== msg.data.signal_id) return prev;
              return {
                ...prev,
                [cacheKey]: {
                  ...cached,
                  validity_window: {
                    ...cached.validity_window,
                    seconds_remaining: msg.data.seconds_remaining,
                  },
                },
              };
            });
            if (msg.data.symbol === symbol && incomingProfile === strategyProfile) {
              setSignal((prev) => {
                if (!prev || prev.id !== msg.data.signal_id) return prev;
                return {
                  ...prev,
                  validity_window: {
                    ...prev.validity_window,
                    seconds_remaining: msg.data.seconds_remaining,
                  },
                };
              });
            }
          } else if (
            (msg.type === "PAPER_ACCOUNT_UPDATE" || msg.type === "ACCOUNT_UPDATE") &&
            msg.data
          ) {
            setAccountSummary(msg.data);
          } else if (msg.type === "RL_POLICY_UPDATED" && msg.data) {
            const rl = msg.data;
            setSignal((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                confluence: {
                  ...prev.confluence,
                  weights: rl.weights,
                  rl_episodes: rl.total_episodes,
                  rl_sharpe: rl.sharpe_ratio,
                  rl_last_reward: rl.last_reward,
                },
              };
            });
          } else if (msg.type === "BREAKING_NEWS_ALERT" && msg.data) {
            setBreakingNews(msg.data);
          } else if (msg.type === "BREAKING_NEWS_DISMISSED") {
            setBreakingNews(null);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connectWs();

    const interval = setInterval(() => {
      fetchAccountSummary()
        .then(setAccountSummary)
        .catch(() => {});
      fetchTicker(symbol)
        .then((t) => {
          setTickers((prev) => ({ ...prev, [symbol]: t }));
        })
        .catch(() => {});
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [symbol, strategyProfile]);

  const handleExecuteTrade = async (params: {
    margin: number;
    leverage: number;
    strategyProfile: string;
  }) => {
    if (!signal) return;
    setIsExecuting(true);
    try {
      await executePaperTrade({
        symbol: signal.symbol,
        side: signal.direction === "BUY" ? "LONG" : "SHORT",
        margin_usdt: params.margin,
        leverage: params.leverage,
        signal_id: signal.id,
        strategy_profile: params.strategyProfile,
      });
      const updated = await fetchAccountSummary();
      setAccountSummary(updated);
      setIsPaperPopupOpen(true);
    } catch (e: any) {
      alert(`Order Execution: ${e.message || e}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleMoveToBreakeven = async (positionId: string) => {
    try {
      await moveStopLossToBreakeven(positionId);
      const updated = await fetchAccountSummary();
      setAccountSummary(updated);
    } catch (e: any) {
      alert(`Move SL: ${e.message || e}`);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    try {
      await closePaperPosition(positionId, "USER_MANUAL_TAKE_PROFIT");
      const updated = await fetchAccountSummary();
      setAccountSummary(updated);
      if (updated.rl_policy) {
        const rl = updated.rl_policy;
        setSignal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            confluence: {
              ...prev.confluence,
              weights: rl.weights,
              rl_episodes: rl.total_episodes,
              rl_sharpe: rl.sharpe_ratio,
              rl_last_reward: rl.last_reward,
            },
          };
        });
      }
    } catch (e) {}
  };

  const handleResetBalance = async () => {
    setIsResetting(true);
    try {
      const updated = await resetDemoAccount();
      setAccountSummary(updated);
    } catch (e) {
    } finally {
      setIsResetting(false);
    }
  };

  const handleRunAnalysis = async (targetSymbol: string) => {
    setIsAnalyzing(true);
    try {
      setSymbol(targetSymbol);
      const freshSignal = await refreshSignal(targetSymbol, strategyProfile);
      setSignal(freshSignal);
      const cacheKey = `${targetSymbol}_${strategyProfile}`;
      setSignalsCache((prev) => ({ ...prev, [cacheKey]: freshSignal }));

      const [t, c] = await Promise.allSettled([
        fetchTicker(targetSymbol),
        fetchCandles(targetSymbol, timeframe, 60),
      ]);
      if (t.status === "fulfilled") {
        setTickers((prev) => ({ ...prev, [targetSymbol]: t.value }));
      }
      if (c.status === "fulfilled") {
        setCandles(c.value);
      }
    } catch (e) {
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-white pb-14">
      {/* 1. Kept Top Bar (Screenshot 2) */}
      <div className="sticky top-0 z-50">
        <TopWorkstationBar
          currentSymbol={symbol}
          onSelectSymbol={(sym) => {
            setSymbol(sym);
          }}
          tickers={tickers}
          currentProfile={strategyProfile}
          onSelectProfile={handleSelectProfile}
          onRunAnalysis={handleRunAnalysis}
          isAnalyzing={isAnalyzing}
          regime={signal?.regime || "NORMAL_CONFLUENCE"}
          sizingMultiplier={signal?.recommended_size_multiplier || 1.0}
          equity={accountSummary?.equity_usdt || 10000.0}
          freeMargin={accountSummary?.free_margin_usdt ?? accountSummary?.balance_usdt ?? 10000.0}
          unrealizedPnl={accountSummary?.unrealized_pnl_usdt ?? 0.0}
          openPositionsCount={accountSummary?.open_positions?.length || 0}
          isPaperPopupOpen={isPaperPopupOpen}
          onTogglePaperPopup={() => setIsPaperPopupOpen((prev) => !prev)}
          onResetBalance={handleResetBalance}
          isResetting={isResetting}
          indicators={indicators}
          onToggleIndicator={handleToggleIndicator}
        />
      </div>

      {/* 2. Urgent Breaking News Shock Banner */}
      {breakingNews && (
        <div className="w-full bg-[#EF4444]/15 border-b border-[#EF4444]/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#F87171]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#EF4444] text-white font-extrabold text-[10px] tracking-wider uppercase">
              BREAKING NEWS SHOCK
            </span>
            <span className="font-bold text-white text-xs">{breakingNews.headline}</span>
            <span className="text-[#94A3B8] text-[11px]">({breakingNews.source})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#F87171] hidden md:inline">
              {breakingNews.ai_defense_action}
            </span>
            <button
              onClick={() => setBreakingNews(null)}
              className="px-2.5 py-1 rounded bg-[#1E293B] text-white hover:bg-[#334155] border border-[#334155] text-[11px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 3. Restored Main Command Grid: Left Column (TradingView Chart + ConfluenceCards) & Right Column (SignalCard) */}
      <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8 flex flex-col gap-4 sm:gap-6 max-w-[1600px] w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          {/* Left Column: Official Interactive TradingView Chart & Confluence Cards */}
          <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-6 w-full">
            <TradingViewChart
              candles={candles}
              symbol={symbol}
              targets={signal?.targets}
              signal={signal}
              currentTimeframe={timeframe}
              onTimeframeChange={(tf) => {
                const mappedProfile: StrategyProfile =
                  tf === "1m"
                    ? "MICRO_1M"
                    : tf === "5m"
                    ? "SCALP_5M"
                    : tf === "1h"
                    ? "SWING_1H"
                    : tf === "4h"
                    ? "MACRO_4H"
                    : "INTRADAY_15M";
                handleSelectProfile(mappedProfile);
              }}
              currentPrice={tickers[symbol]?.price}
              ticker={tickers[symbol]}
              indicators={indicators}
            />

            <ConfluenceCards signal={signal} isAnalyzing={isAnalyzing} />
          </div>

          {/* Right Column: Original Multi-Horizon Signal Card */}
          <div className="lg:col-span-4 w-full">
            <SignalCard
              signal={signal}
              currentProfile={strategyProfile}
              onSelectProfile={handleSelectProfile}
              onExecuteTrade={handleExecuteTrade}
              isExecuting={isExecuting}
              onRefreshAnalysis={() => handleRunAnalysis(symbol)}
              isAnalyzing={isAnalyzing}
            />
          </div>
        </div>
      </main>

      {/* 4. Kept Bottom Bar / Slide-Up Drawer (Screenshot 1) */}
      <PortfolioDock
        summary={accountSummary}
        signal={signal}
        onMoveToBreakeven={handleMoveToBreakeven}
        onClosePosition={handleClosePosition}
        isOpen={isPaperPopupOpen}
        onToggleOpen={() => setIsPaperPopupOpen((prev) => !prev)}
      />
    </div>
  );
}
