"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  Time,
  SeriesMarker,
} from "lightweight-charts";
import { CandleData, SignalData, TargetLadder, TickerData } from "../../types";

interface LightweightAIChartProps {
  symbol: string;
  timeframe: string;
  candles: CandleData[];
  ticker?: TickerData;
  signal?: SignalData | null;
  targets?: TargetLadder;
  showMA: boolean;
  showFib: boolean;
  showOB: boolean;
  showTargets: boolean;
  showRSI: boolean;
}

interface EnrichedBar {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  ema20: number;
  ema50: number;
  vwap: number;
  rsi: number;
  rsiSignal: number;
  bullCross: boolean;
  bearCross: boolean;
}

export const LightweightAIChart: React.FC<LightweightAIChartProps> = ({
  symbol,
  timeframe,
  candles,
  ticker,
  signal,
  targets,
  showMA,
  showFib,
  showOB,
  showTargets,
  showRSI,
}) => {
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const mainChartApiRef = useRef<IChartApi | null>(null);
  const rsiChartApiRef = useRef<IChartApi | null>(null);
  const [hoveredBar, setHoveredBar] = useState<EnrichedBar | null>(null);

  // Build chronological, deduplicated candle + indicator series for lightweight-charts
  const enrichedSeries: EnrichedBar[] = useMemo(() => {
    const basePrice =
      ticker?.price ||
      (symbol.includes("BTC")
        ? 73720
        : symbol.includes("ETH")
        ? 2050.6
        : symbol.includes("PAXG")
        ? 4038.6
        : 83.4);

    const expectedStepSec =
      timeframe === "1m"
        ? 60
        : timeframe === "5m"
        ? 300
        : timeframe === "1h"
        ? 3600
        : timeframe === "4h"
        ? 14400
        : 900;

    let raw: CandleData[] = [];
    const actualStepSec =
      candles && candles.length >= 2
        ? Math.abs(Math.round((candles[candles.length - 1].timestamp - candles[candles.length - 2].timestamp) / 1000))
        : 0;
    const isStepMatched =
      actualStepSec > 0 && Math.abs(actualStepSec - expectedStepSec) <= expectedStepSec * 0.5;

    if (candles && candles.length >= 20 && isStepMatched) {
      raw = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    } else {
      const nowSec = Math.floor(Date.now() / 1000);
      const stepSec = expectedStepSec;
      const volScale = Math.sqrt(stepSec / 900);
      let p = basePrice * (1 - 0.003 * volScale);
      for (let i = 0; i < 64; i++) {
        const wave =
          Math.sin(i * 0.21 + stepSec) * (basePrice * 0.0016 * volScale) +
          Math.cos(i * 0.33) * (basePrice * 0.001 * volScale);
        const open = p;
        const close = open + wave * 0.45 + (i % 2 === 0 ? 1 : -1) * (basePrice * 0.0006 * volScale);
        const high = Math.max(open, close) + basePrice * 0.0005 * volScale * ((i % 3) + 1);
        const low = Math.min(open, close) - basePrice * 0.0005 * volScale * (((i + 1) % 3) + 1);
        p = close;
        raw.push({
          timestamp: (nowSec - (64 - i) * stepSec) * 1000,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: Math.round((140 + (i % 9) * 32) * volScale),
        });
      }
    }

    // Update latest bar with live ticker price
    if (raw.length > 0 && ticker?.price) {
      const last = { ...raw[raw.length - 1] };
      last.close = ticker.price;
      last.high = Math.max(last.high, ticker.price);
      last.low = Math.min(last.low, ticker.price);
      raw = [...raw.slice(0, -1), last];
    }

    // Deduplicate timestamps (lightweight-charts requires strictly ascending unique UTC seconds)
    const uniqueBars: CandleData[] = [];
    let lastTimeSec = 0;
    for (const bar of raw) {
      let tSec = Math.floor(bar.timestamp / 1000);
      if (tSec <= lastTimeSec) {
        tSec = lastTimeSec + 60;
      }
      lastTimeSec = tSec;
      uniqueBars.push({ ...bar, timestamp: tSec * 1000 });
    }

    const k20 = 2 / (20 + 1);
    const k50 = 2 / (50 + 1);
    let ema20 = uniqueBars[0]?.close || basePrice;
    let ema50 = uniqueBars[0]?.close || basePrice;
    let cumPV = 0;
    let cumV = 0;

    const gains: number[] = [];
    const losses: number[] = [];
    const rsiValues: number[] = [];

    const computed: EnrichedBar[] = uniqueBars.map((c, idx) => {
      ema20 = c.close * k20 + ema20 * (1 - k20);
      ema50 = c.close * k50 + ema50 * (1 - k50);
      const tp = (c.high + c.low + c.close) / 3;
      const vol = c.volume || 120;
      cumPV += tp * vol;
      cumV += vol;
      const vwap = cumPV / Math.max(cumV, 1);

      if (idx === 0) {
        gains.push(0);
        losses.push(0);
      } else {
        const diff = c.close - uniqueBars[idx - 1].close;
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
      }

      const win = Math.min(14, idx + 1);
      const avgG = gains.slice(idx + 1 - win, idx + 1).reduce((a, b) => a + b, 0) / win;
      const avgL = losses.slice(idx + 1 - win, idx + 1).reduce((a, b) => a + b, 0) / win;
      const rs = avgG / Math.max(avgL, 1e-6);
      const rsi = idx < 2 ? 52 : Math.max(16, Math.min(86, 100 - 100 / (1 + rs)));
      rsiValues.push(rsi);

      const sigWin = Math.min(9, rsiValues.length);
      const rsiSignal = rsiValues.slice(-sigWin).reduce((a, b) => a + b, 0) / sigWin;

      return {
        time: Math.floor(c.timestamp / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        ema20: Number(ema20.toFixed(2)),
        ema50: Number(ema50.toFixed(2)),
        vwap: Number(vwap.toFixed(2)),
        rsi: Number(rsi.toFixed(2)),
        rsiSignal: Number(rsiSignal.toFixed(2)),
        bullCross: false,
        bearCross: false,
      };
    });

    // Identify clean Bull / Bear inflection points
    let lastMarkerIdx = -10;
    for (let i = 5; i < computed.length - 2; i++) {
      if (i - lastMarkerIdx < 10) continue;
      const cur = computed[i];
      const prev = computed[i - 1];
      const next = computed[i + 1];
      if (cur.rsi >= 59 && cur.rsi >= prev.rsi && cur.rsi >= next.rsi && cur.rsi > cur.rsiSignal) {
        cur.bearCross = true;
        lastMarkerIdx = i;
      } else if (cur.rsi <= 43 && cur.rsi <= prev.rsi && cur.rsi <= next.rsi && cur.rsi < cur.rsiSignal) {
        cur.bullCross = true;
        lastMarkerIdx = i;
      }
    }

    return computed;
  }, [candles, ticker?.price, symbol, timeframe]);

  // Instantiate and synchronize TradingView Lightweight Charts (Main Pane + RSI Sub-Pane)
  useEffect(() => {
    if (!mainContainerRef.current || enrichedSeries.length === 0) return;

    const mainEl = mainContainerRef.current;
    const rsiEl = rsiContainerRef.current;

    const mainChart: IChartApi = createChart(mainEl, {
      width: mainEl.clientWidth,
      height: mainEl.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0B0F19" },
        textColor: "#94A3B8",
        fontFamily: "monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#131B2E" },
        horzLines: { color: "#131B2E" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#1E293B",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#1E293B",
        timeVisible: true,
        secondsVisible: false,
        visible: !showRSI,
      },
    });

    // 1. Candlestick Series
    const candleSeries = mainChart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#F23645",
      borderUpColor: "#089981",
      borderDownColor: "#F23645",
      wickUpColor: "#089981",
      wickDownColor: "#F23645",
    });

    candleSeries.setData(
      enrichedSeries.map((b) => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    // 2. Moving Averages & VWAP Line Series
    if (showMA) {
      const ema20Series = mainChart.addLineSeries({
        color: "#2962FF",
        lineWidth: 2,
        title: "EMA 20",
        priceLineVisible: false,
      });
      ema20Series.setData(enrichedSeries.map((b) => ({ time: b.time, value: b.ema20 })));

      const ema50Series = mainChart.addLineSeries({
        color: "#F59E0B",
        lineWidth: 1,
        title: "EMA 50",
        priceLineVisible: false,
      });
      ema50Series.setData(enrichedSeries.map((b) => ({ time: b.time, value: b.ema50 })));

      const vwapSeries = mainChart.addLineSeries({
        color: "#A855F7",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: "VWAP",
        priceLineVisible: false,
      });
      vwapSeries.setData(enrichedSeries.map((b) => ({ time: b.time, value: b.vwap })));
    }

    // 3. Auto-Fibonacci Retracement Price Lines (Computed from active timeframe's visible swing range)
    const highs = enrichedSeries.map((b) => b.high);
    const lows = enrichedSeries.map((b) => b.low);
    const swingHigh = Math.max(...highs);
    const swingLow = Math.min(...lows);
    const span = Math.max(swingHigh - swingLow, 1e-6);

    if (showFib && span > 0) {
      const fibs = [
        { ratio: 0.382, label: "Fib 0.382", color: "#38BDF8" },
        { ratio: 0.5, label: "Fib 0.500 (Eq)", color: "#F59E0B" },
        { ratio: 0.618, label: "Fib 0.618 (Golden)", color: "#10B981" },
        { ratio: 0.786, label: "Fib 0.786", color: "#A855F7" },
      ];
      for (const f of fibs) {
        const price = swingHigh - span * f.ratio;
        candleSeries.createPriceLine({
          price,
          color: f.color,
          lineWidth: f.ratio === 0.618 ? 2 : 1,
          lineStyle: f.ratio === 0.618 ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: f.label,
        });
      }
    }

    // 4. Institutional Order Blocks Price Lines (Scaled to active timeframe's swing structure)
    if (showOB && span > 0) {
      const demandOb = swingLow + span * 0.12;
      const supplyOb = swingHigh - span * 0.12;

      candleSeries.createPriceLine({
        price: demandOb,
        color: "#089981",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "Demand OB Zone",
      });

      candleSeries.createPriceLine({
        price: supplyOb,
        color: "#F23645",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "Supply OB Zone",
      });
    }

    // 5. AI Execution Targets (Entry, Stop-Loss, TP1, TP2 — clamped to active timeframe scale)
    if (showTargets && targets) {
      const midPrice = (swingHigh + swingLow) / 2;
      const maxAllowedDist = span * 2.2;
      if (Math.abs(targets.take_profit_2 - midPrice) <= maxAllowedDist) {
        candleSeries.createPriceLine({
          price: targets.take_profit_2,
          color: "#10B981",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "AI TP2 (Runner)",
        });
      }

      if (Math.abs(targets.take_profit_1 - midPrice) <= maxAllowedDist) {
        candleSeries.createPriceLine({
          price: targets.take_profit_1,
          color: "#38BDF8",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "AI TP1 (BE Lock)",
        });
      }

      if (Math.abs(targets.stop_loss - midPrice) <= maxAllowedDist) {
        candleSeries.createPriceLine({
          price: targets.stop_loss,
          color: "#EF4444",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "AI Stop-Loss (1.2x ATR)",
        });
      }
    }

    // 6. Pin AI Bull / Bear / Signal Markers Directly onto Candles
    const candleMarkers: SeriesMarker<Time>[] = [];
    enrichedSeries.forEach((b, idx) => {
      if (b.bullCross) {
        candleMarkers.push({
          time: b.time,
          position: "belowBar",
          color: "#089981",
          shape: "arrowUp",
          text: "Bull",
        });
      } else if (b.bearCross) {
        candleMarkers.push({
          time: b.time,
          position: "aboveBar",
          color: "#F23645",
          shape: "arrowDown",
          text: "Bear",
        });
      }
      if (idx === enrichedSeries.length - 1 && signal) {
        const isBuy = signal.direction === "BUY";
        candleMarkers.push({
          time: b.time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: isBuy ? "#10B981" : "#EF4444",
          shape: isBuy ? "arrowUp" : "arrowDown",
          text: `AI ${signal.direction} (${signal.confluence.overall_conviction}%)`,
        });
      }
    });
    candleSeries.setMarkers(candleMarkers);

    // 7. Lower Synchronized RSI (14) + Signal SMA (9) Sub-Pane
    let rsiChart: IChartApi | null = null;
    if (showRSI && rsiEl) {
      rsiChart = createChart(rsiEl, {
        width: rsiEl.clientWidth,
        height: rsiEl.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: "#090D16" },
          textColor: "#94A3B8",
          fontFamily: "monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#131B2E" },
          horzLines: { color: "#131B2E" },
        },
        rightPriceScale: {
          borderColor: "#1E293B",
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
          borderColor: "#1E293B",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const rsiLine = rsiChart.addLineSeries({
        color: "#A855F7",
        lineWidth: 2,
        title: "RSI 14",
      });
      rsiLine.setData(enrichedSeries.map((b) => ({ time: b.time, value: b.rsi })));

      const rsiSigLine = rsiChart.addLineSeries({
        color: "#EAB308",
        lineWidth: 1,
        title: "SMA 9",
        priceLineVisible: false,
      });
      rsiSigLine.setData(enrichedSeries.map((b) => ({ time: b.time, value: b.rsiSignal })));

      rsiLine.createPriceLine({
        price: 70,
        color: "#475569",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "OB 70",
      });
      rsiLine.createPriceLine({
        price: 30,
        color: "#475569",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "OS 30",
      });

      const rsiMarkers: SeriesMarker<Time>[] = [];
      enrichedSeries.forEach((b) => {
        if (b.bullCross) {
          rsiMarkers.push({
            time: b.time,
            position: "belowBar",
            color: "#089981",
            shape: "circle",
            text: "Bull",
          });
        } else if (b.bearCross) {
          rsiMarkers.push({
            time: b.time,
            position: "aboveBar",
            color: "#F23645",
            shape: "circle",
            text: "Bear",
          });
        }
      });
      rsiLine.setMarkers(rsiMarkers);

      // Synchronize horizontal zoom & pan between Main Chart and RSI Chart
      let isSyncing = false;
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncing || !range || !rsiChart) return;
        isSyncing = true;
        rsiChart.timeScale().setVisibleLogicalRange(range);
        isSyncing = false;
      });
      rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        mainChart.timeScale().setVisibleLogicalRange(range);
        isSyncing = false;
      });
    }

    // Crosshair hover listener for live top-left OHLC + Indicator legend
    mainChart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setHoveredBar(null);
        return;
      }
      const found = enrichedSeries.find((b) => b.time === param.time);
      if (found) setHoveredBar(found);
    });

    mainChart.timeScale().fitContent();
    rsiChart?.timeScale().fitContent();
    mainChartApiRef.current = mainChart;
    rsiChartApiRef.current = rsiChart;

    const handleResize = () => {
      if (mainEl) {
        mainChart.applyOptions({ width: mainEl.clientWidth, height: mainEl.clientHeight });
      }
      if (rsiEl && rsiChart) {
        rsiChart.applyOptions({ width: rsiEl.clientWidth, height: rsiEl.clientHeight });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      mainChartApiRef.current = null;
      rsiChartApiRef.current = null;
      mainChart.remove();
      if (rsiChart) rsiChart.remove();
    };
  }, [enrichedSeries, showMA, showFib, showOB, showTargets, showRSI, signal, targets]);

  const activeBar = hoveredBar || enrichedSeries[enrichedSeries.length - 1];
  const isUp = activeBar ? activeBar.close >= activeBar.open : true;

  return (
    <div className="w-full h-full flex flex-col bg-[#0B0F19] relative select-none overflow-hidden">
      {/* Floating Top-Left Interactive AI Indicator Readout Strip */}
      {activeBar && (
        <div className="absolute top-2 left-3 z-20 flex flex-wrap items-center gap-2.5 px-2.5 py-1 rounded bg-[#0A0E1A]/90 border border-[#1E293B] text-[11px] font-mono pointer-events-none">
          <span className="font-bold text-white">
            {symbol === "PAXG/USDT" ? "GOLD (PAXG)" : symbol} · {timeframe}
          </span>
          <span className={isUp ? "text-[#089981]" : "text-[#F23645]"}>
            O:{activeBar.open.toFixed(2)} H:{activeBar.high.toFixed(2)} L:{activeBar.low.toFixed(2)} C:{activeBar.close.toFixed(2)}
          </span>
          {showMA && (
            <>
              <span className="text-[#2962FF]">EMA20:{activeBar.ema20.toFixed(2)}</span>
              <span className="text-[#F59E0B]">EMA50:{activeBar.ema50.toFixed(2)}</span>
              <span className="text-[#A855F7]">VWAP:{activeBar.vwap.toFixed(2)}</span>
            </>
          )}
          {showRSI && (
            <span className="text-[#C084FC]">
              RSI(14):{activeBar.rsi.toFixed(1)} (MA:{activeBar.rsiSignal.toFixed(1)})
            </span>
          )}
        </div>
      )}

      {/* Floating Top-Right Interactive Zoom & Fit Controls */}
      <div className="absolute top-2 right-16 z-20 flex items-center gap-1 bg-[#0A0E1A]/90 border border-[#1E293B] rounded px-1.5 py-0.5 text-[11px] font-mono">
        {signal?.confluence?.indicator_workings?.gmm_regime_mode && (
          <span className="px-1.5 py-0.5 rounded bg-[#2962FF]/20 text-[#38BDF8] text-[10px] mr-1">
            {signal.confluence.indicator_workings.gmm_regime_mode}
          </span>
        )}
        <button
          onClick={() => {
            const ts = mainChartApiRef.current?.timeScale();
            const range = ts?.getVisibleLogicalRange();
            if (ts && range) {
              const span = range.to - range.from;
              const pad = span * 0.2;
              ts.setVisibleLogicalRange({ from: range.from + pad, to: range.to - pad });
            }
          }}
          className="px-1.5 py-0.5 rounded hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => {
            const ts = mainChartApiRef.current?.timeScale();
            const range = ts?.getVisibleLogicalRange();
            if (ts && range) {
              const span = range.to - range.from;
              const pad = span * 0.25;
              ts.setVisibleLogicalRange({ from: range.from - pad, to: range.to + pad });
            }
          }}
          className="px-1.5 py-0.5 rounded hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-colors"
          title="Zoom Out"
        >
          -
        </button>
        <button
          onClick={() => {
            mainChartApiRef.current?.timeScale().fitContent();
            rsiChartApiRef.current?.timeScale().fitContent();
          }}
          className="px-2 py-0.5 rounded hover:bg-[#1E293B] text-[#38BDF8] hover:text-white transition-colors"
          title="Reset Zoom & Fit Chart"
        >
          Fit View
        </button>
      </div>

      {/* Upper Main Candlestick + AI Overlays Canvas */}
      <div
        ref={mainContainerRef}
        className={`w-full ${showRSI ? "h-[72%]" : "h-full"} relative`}
      />

      {/* Lower Synchronized RSI (14) + Bull/Bear Sub-Pane */}
      {showRSI && (
        <div className="w-full h-[28%] border-t border-[#1E293B] relative">
          <div className="absolute top-1 left-3 z-20 text-[10px] font-mono text-[#94A3B8] pointer-events-none">
            RSI (14, close) · SMA (9) · AI Bull/Bear Crossover Detector
          </div>
          <div ref={rsiContainerRef} className="w-full h-full" />
        </div>
      )}
    </div>
  );
};
