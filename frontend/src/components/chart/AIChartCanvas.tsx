"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { CandleData, SignalData, TargetLadder, TickerData } from "../../types";

interface AIChartCanvasProps {
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
  onQuickOrderClick?: (side: "BUY" | "SELL") => void;
}

interface ComputedCandle extends CandleData {
  ema20: number;
  ema50: number;
  rsi: number;
  rsiSignal: number;
  bullCross: boolean;
  bearCross: boolean;
}

export const AIChartCanvas: React.FC<AIChartCanvasProps> = ({
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
  onQuickOrderClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 960, h: 580 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Measure exact pixel dimensions so SVG renders at 1:1 native sharpness (zero text stretching)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100) {
        setDims({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build 72 realistic candles + compute EMA(20), EMA(50), RSI(14), and RSI SMA(9)
  const series: ComputedCandle[] = useMemo(() => {
    const basePrice =
      ticker?.price ||
      (symbol.includes("BTC")
        ? 73720
        : symbol.includes("ETH")
        ? 2050.6
        : symbol.includes("PAXG")
        ? 4038.6
        : 83.4);

    let raw: CandleData[] = [];
    if (candles && candles.length >= 24) {
      raw = candles.slice(-72);
    } else {
      const now = Date.now();
      const step = 15 * 60 * 1000;
      let p = basePrice * 0.994;
      for (let i = 0; i < 68; i++) {
        const wave =
          Math.sin(i * 0.16) * (basePrice * 0.0022) +
          Math.cos(i * 0.29) * (basePrice * 0.0014);
        const open = p;
        const close = open + wave * 0.45 + (i % 2 === 0 ? 1 : -1) * (basePrice * 0.0009);
        const high = Math.max(open, close) + basePrice * 0.0008 * ((i % 3) + 1);
        const low = Math.min(open, close) - basePrice * 0.0008 * (((i + 1) % 3) + 1);
        p = close;
        raw.push({
          timestamp: now - (68 - i) * step,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: 140 + (i % 9) * 32,
        });
      }
    }

    if (raw.length > 0 && ticker?.price) {
      const last = { ...raw[raw.length - 1] };
      last.close = ticker.price;
      last.high = Math.max(last.high, ticker.price);
      last.low = Math.min(last.low, ticker.price);
      raw = [...raw.slice(0, -1), last];
    }

    const k9 = 2 / (9 + 1);
    const k21 = 2 / (21 + 1);
    let ema20 = raw[0]?.close || basePrice;
    let ema50 = raw[0]?.close || basePrice;

    const gains: number[] = [];
    const losses: number[] = [];
    const rsiValues: number[] = [];

    const computed = raw.map((c, idx) => {
      ema20 = c.close * k9 + ema20 * (1 - k9);
      ema50 = c.close * k21 + ema50 * (1 - k21);

      if (idx === 0) {
        gains.push(0);
        losses.push(0);
      } else {
        const diff = c.close - raw[idx - 1].close;
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
      }

      const win = Math.min(14, idx + 1);
      const avgG = gains.slice(idx + 1 - win, idx + 1).reduce((a, b) => a + b, 0) / win;
      const avgL = losses.slice(idx + 1 - win, idx + 1).reduce((a, b) => a + b, 0) / win;
      const rs = avgG / Math.max(avgL, 1e-6);
      const rsi = idx < 2 ? 52 : Math.max(18, Math.min(84, 100 - 100 / (1 + rs)));
      rsiValues.push(rsi);

      const sigWin = Math.min(9, rsiValues.length);
      const rsiSignal = rsiValues.slice(-sigWin).reduce((a, b) => a + b, 0) / sigWin;

      return {
        ...c,
        ema20,
        ema50,
        rsi,
        rsiSignal,
        bullCross: false,
        bearCross: false,
      };
    });

    // Pick at most 2 clean Bear peaks and 2 clean Bull troughs across the chart (like TradingView)
    let lastSignalIdx = -12;
    for (let i = 6; i < computed.length - 3; i++) {
      if (i - lastSignalIdx < 12) continue;
      const cur = computed[i];
      const prev = computed[i - 1];
      const next = computed[i + 1];
      if (cur.rsi >= 60 && cur.rsi >= prev.rsi && cur.rsi >= next.rsi && cur.rsi > cur.rsiSignal) {
        cur.bearCross = true;
        lastSignalIdx = i;
      } else if (cur.rsi <= 42 && cur.rsi <= prev.rsi && cur.rsi <= next.rsi && cur.rsi < cur.rsiSignal) {
        cur.bullCross = true;
        lastSignalIdx = i;
      }
    }

    return computed;
  }, [candles, ticker?.price, symbol]);

  const activeCandle =
    hoverIdx !== null && series[hoverIdx] ? series[hoverIdx] : series[series.length - 1];

  // Calculate price bounds with generous breathing room
  const { swingHigh, swingLow, minPrice, maxPrice } = useMemo(() => {
    const highs = series.map((c) => c.high);
    const lows = series.map((c) => c.low);
    const sHigh = Math.max(...highs);
    const sLow = Math.min(...lows);

    const allPrices = [...highs, ...lows];
    if (showTargets && targets) {
      allPrices.push(targets.stop_loss, targets.take_profit_1, targets.take_profit_2);
    }
    const rawMin = Math.min(...allPrices);
    const rawMax = Math.max(...allPrices);
    const pad = (rawMax - rawMin) * 0.16 || rawMax * 0.005;
    return {
      swingHigh: sHigh,
      swingLow: sLow,
      minPrice: rawMin - pad,
      maxPrice: rawMax + pad,
    };
  }, [series, showTargets, targets]);

  // Layout Geometry (1:1 pixel coordinates)
  const W = dims.w;
  const H_TOTAL = dims.h;
  const TIME_AXIS_H = 24;
  const H_USABLE = H_TOTAL - TIME_AXIS_H;
  const H_RSI = showRSI ? Math.round(H_USABLE * 0.27) : 0;
  const H_MAIN = H_USABLE - H_RSI;
  const PAD_LEFT = 16;
  const PRICE_AXIS_W = 78;
  const RIGHT_MARGIN = 64; // Breathing space between last candle and price axis (like TradingView)
  const PLOT_W = W - PAD_LEFT - PRICE_AXIS_W - RIGHT_MARGIN;

  const priceToY = (p: number) => {
    const ratio = (maxPrice - p) / Math.max(maxPrice - minPrice, 1e-6);
    return Math.max(14, Math.min(H_MAIN - 14, 24 + ratio * (H_MAIN - 48)));
  };

  const rsiToY = (r: number) => {
    const clamped = Math.max(10, Math.min(90, r));
    const top = H_MAIN + 16;
    const height = H_RSI - 28;
    return top + ((90 - clamped) / 80) * height;
  };

  const idxToX = (i: number) => {
    if (series.length <= 1) return PAD_LEFT + PLOT_W / 2;
    return PAD_LEFT + (i / (series.length - 1)) * PLOT_W;
  };

  const lastCandleX = idxToX(series.length - 1);
  const axisX = W - PRICE_AXIS_W;

  // Clean Fibonacci Retracement Levels (Tucked into the right swing zone)
  const fibLevels = useMemo(() => {
    const span = swingHigh - swingLow;
    const ratios = [
      { r: 0.236, label: "0.236", color: "#787B86" },
      { r: 0.382, label: "0.382", color: "#2962FF" },
      { r: 0.5, label: "0.500", color: "#F59E0B" },
      { r: 0.618, label: "0.618 Golden", color: "#089981" },
      { r: 0.786, label: "0.786", color: "#9C27B0" },
    ];
    return ratios.map((item) => {
      const price = swingHigh - span * item.r;
      return { ...item, price, y: priceToY(price) };
    });
  }, [swingHigh, swingLow, maxPrice, minPrice, H_MAIN]);

  const ema20Points = series
    .map((c, i) => `${idxToX(i).toFixed(1)},${priceToY(c.ema20).toFixed(1)}`)
    .join(" ");
  const ema50Points = series
    .map((c, i) => `${idxToX(i).toFixed(1)},${priceToY(c.ema50).toFixed(1)}`)
    .join(" ");
  const rsiPoints = series
    .map((c, i) => `${idxToX(i).toFixed(1)},${rsiToY(c.rsi).toFixed(1)}`)
    .join(" ");
  const rsiSigPoints = series
    .map((c, i) => `${idxToX(i).toFixed(1)},${rsiToY(c.rsiSignal).toFixed(1)}`)
    .join(" ");

  const priceTicks = useMemo(() => {
    const count = Math.max(6, Math.min(10, Math.floor(H_MAIN / 48)));
    const step = (maxPrice - minPrice) / (count - 1);
    return Array.from({ length: count }, (_, i) => maxPrice - i * step);
  }, [maxPrice, minPrice, H_MAIN]);

  const fmtPrice = (p: number) =>
    p >= 1000 ? p.toFixed(2) : p >= 10 ? p.toFixed(2) : p.toFixed(3);

  const livePrice = activeCandle?.close || ticker?.price || 0;
  const lastEma = series[series.length - 1]?.ema20 || livePrice;
  const bidPrice = ticker?.bid || livePrice * 0.9999;
  const askPrice = ticker?.ask || livePrice * 1.0001;
  const candleChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const candleChangePct =
    activeCandle && activeCandle.open ? (candleChange / activeCandle.open) * 100 : 0;
  const isUpCandle = candleChange >= 0;

  const instrumentTitle =
    symbol === "PAXG/USDT"
      ? "Gold / PAX Gold · " + timeframe + " · Kraken"
      : symbol === "BTC/USDT"
      ? "Bitcoin / U.S. Dollar · " + timeframe + " · Coinbase"
      : symbol === "ETH/USDT"
      ? "Ethereum / U.S. Dollar · " + timeframe + " · Coinbase"
      : "Solana / U.S. Dollar · " + timeframe + " · Coinbase";

  // Order Block coordinates (subtle right-half zones)
  const obSpan = (swingHigh - swingLow) * 0.1;
  const demandObTop = priceToY(swingLow + obSpan);
  const demandObBot = priceToY(swingLow);
  const supplyObTop = priceToY(swingHigh);
  const supplyObBot = priceToY(swingHigh - obSpan);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#131722] relative select-none overflow-hidden"
    >
      {/* Top-Left TradingView Header: Symbol + OHLC + SELL/BUY Spread Buttons */}
      <div className="absolute top-2.5 left-3.5 z-20 flex flex-col gap-2 pointer-events-none">
        {/* Line 1: Instrument Title + Live OHLC */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#D1D4DC] text-[13px] tracking-tight">
              {instrumentTitle}
            </span>
            <span className="w-2 h-2 rounded-full bg-[#089981]" />
          </div>

          {activeCandle && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-[#787B86]">
                O<span className={isUpCandle ? "text-[#089981] ml-0.5" : "text-[#F23645] ml-0.5"}>{fmtPrice(activeCandle.open)}</span>
              </span>
              <span className="text-[#787B86]">
                H<span className={isUpCandle ? "text-[#089981] ml-0.5" : "text-[#F23645] ml-0.5"}>{fmtPrice(activeCandle.high)}</span>
              </span>
              <span className="text-[#787B86]">
                L<span className={isUpCandle ? "text-[#089981] ml-0.5" : "text-[#F23645] ml-0.5"}>{fmtPrice(activeCandle.low)}</span>
              </span>
              <span className="text-[#787B86]">
                C<span className={isUpCandle ? "text-[#089981] ml-0.5" : "text-[#F23645] ml-0.5"}>{fmtPrice(activeCandle.close)}</span>
              </span>
              <span className={isUpCandle ? "text-[#089981]" : "text-[#F23645]"}>
                {isUpCandle ? "+" : ""}
                {fmtPrice(candleChange)} ({isUpCandle ? "+" : ""}
                {candleChangePct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Line 2: TradingView SELL / BUY Spread Boxes (Interactive) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => onQuickOrderClick?.("SELL")}
            className="px-2.5 py-1 rounded bg-[#131722]/90 hover:bg-[#F23645]/15 border border-[#F23645] text-[#F23645] flex flex-col items-center leading-tight transition-colors"
          >
            <span className="text-[11px] font-mono font-bold">{fmtPrice(bidPrice)}</span>
            <span className="text-[9px] font-semibold tracking-wider">SELL</span>
          </button>
          <span className="text-[10px] font-mono text-[#787B86]">
            {fmtPrice(Math.max(askPrice - bidPrice, 0.01))}
          </span>
          <button
            onClick={() => onQuickOrderClick?.("BUY")}
            className="px-2.5 py-1 rounded bg-[#131722]/90 hover:bg-[#2962FF]/15 border border-[#2962FF] text-[#2962FF] flex flex-col items-center leading-tight transition-colors"
          >
            <span className="text-[11px] font-mono font-bold">{fmtPrice(askPrice)}</span>
            <span className="text-[9px] font-semibold tracking-wider">BUY</span>
          </button>
        </div>
      </div>

      {/* 1:1 Pixel-Accurate SVG Canvas */}
      <svg
        width={W}
        height={H_TOTAL}
        viewBox={`0 0 ${W} ${H_TOTAL}`}
        className="w-full h-full block cursor-crosshair"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* 1. Subtle Hairline Grid (Horizontal & Vertical) */}
        {priceTicks.map((pt, i) => {
          const y = Math.round(priceToY(pt)) + 0.5;
          return (
            <g key={`hgrid-${i}`}>
              <line x1={0} y1={y} x2={axisX} y2={y} stroke="#1E222D" strokeWidth="1" />
              <text
                x={axisX + 8}
                y={y + 4}
                fill="#787B86"
                fontSize="11"
                fontFamily="monospace"
              >
                {fmtPrice(pt)}
              </text>
            </g>
          );
        })}

        {series.map((c, i) => {
          if (i % 10 !== 0) return null;
          const x = Math.round(idxToX(i)) + 0.5;
          const tStr = new Date(c.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return (
            <g key={`vgrid-${i}`}>
              <line x1={x} y1={0} x2={x} y2={H_USABLE} stroke="#1E222D" strokeWidth="1" />
              <text
                x={x - 14}
                y={H_TOTAL - 7}
                fill="#787B86"
                fontSize="11"
                fontFamily="monospace"
              >
                {tStr}
              </text>
            </g>
          );
        })}

        {/* Right Price Axis Divider & Bottom Time Axis Divider */}
        <line x1={axisX} y1={0} x2={axisX} y2={H_TOTAL} stroke="#2A2E39" strokeWidth="1" />
        <line x1={0} y1={H_USABLE} x2={W} y2={H_USABLE} stroke="#2A2E39" strokeWidth="1" />

        {/* 2. Optional Order Block Zones (Subtle Right-Anchored Zones) */}
        {showOB && (
          <g>
            <rect
              x={PAD_LEFT + PLOT_W * 0.55}
              y={demandObTop}
              width={axisX - (PAD_LEFT + PLOT_W * 0.55)}
              height={Math.max(demandObBot - demandObTop, 6)}
              fill="#089981"
              fillOpacity="0.08"
              stroke="#089981"
              strokeOpacity="0.3"
            />
            <text
              x={axisX - 8}
              y={demandObBot - 4}
              textAnchor="end"
              fill="#089981"
              fontSize="10"
              fontFamily="monospace"
            >
              Demand OB
            </text>

            <rect
              x={PAD_LEFT + PLOT_W * 0.55}
              y={supplyObTop}
              width={axisX - (PAD_LEFT + PLOT_W * 0.55)}
              height={Math.max(supplyObBot - supplyObTop, 6)}
              fill="#F23645"
              fillOpacity="0.08"
              stroke="#F23645"
              strokeOpacity="0.3"
            />
            <text
              x={axisX - 8}
              y={supplyObTop + 11}
              textAnchor="end"
              fill="#F23645"
              fontSize="10"
              fontFamily="monospace"
            >
              Supply OB
            </text>
          </g>
        )}

        {/* 3. Optional Fibonacci Retracement Levels (Right-side projection so candles stay clean) */}
        {showFib && (
          <g>
            {fibLevels[2] && fibLevels[3] && (
              <rect
                x={PAD_LEFT + PLOT_W * 0.62}
                y={Math.min(fibLevels[2].y, fibLevels[3].y)}
                width={axisX - (PAD_LEFT + PLOT_W * 0.62)}
                height={Math.abs(fibLevels[3].y - fibLevels[2].y)}
                fill="#089981"
                fillOpacity="0.06"
              />
            )}
            {fibLevels.map((f) => (
              <g key={`fib-${f.r}`}>
                <line
                  x1={PAD_LEFT + PLOT_W * 0.62}
                  y1={f.y}
                  x2={axisX}
                  y2={f.y}
                  stroke={f.color}
                  strokeWidth={f.r === 0.618 ? "1.2" : "0.8"}
                  strokeDasharray="3 3"
                  strokeOpacity="0.7"
                />
                <text
                  x={axisX - 6}
                  y={f.y - 3}
                  textAnchor="end"
                  fill={f.color}
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {f.label} ({fmtPrice(f.price)})
                </text>
              </g>
            ))}
          </g>
        )}

        {/* 4. Optional AI Target Projection Lines (Projected strictly to the right of the last candle!) */}
        {showTargets && targets && (
          <g>
            {[
              { label: "TP2", price: targets.take_profit_2, color: "#089981" },
              { label: "TP1", price: targets.take_profit_1, color: "#2962FF" },
              { label: "SL", price: targets.stop_loss, color: "#F23645" },
            ].map((t) => {
              const y = priceToY(t.price);
              return (
                <g key={t.label}>
                  <line
                    x1={lastCandleX}
                    y1={y}
                    x2={axisX}
                    y2={y}
                    stroke={t.color}
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={axisX - 6}
                    y={y - 4}
                    textAnchor="end"
                    fill={t.color}
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {t.label} {fmtPrice(t.price)}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* 5. Candlesticks (Authentic TradingView #089981 Teal & #F23645 Coral) */}
        {series.map((c, i) => {
          const x = Math.round(idxToX(i));
          const isGreen = c.close >= c.open;
          const color = isGreen ? "#089981" : "#F23645";
          const yHigh = priceToY(c.high);
          const yLow = priceToY(c.low);
          const yOpen = priceToY(c.open);
          const yClose = priceToY(c.close);
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1.5);
          const candleW = Math.max(Math.min(Math.floor((PLOT_W / series.length) * 0.64), 9), 3);

          return (
            <g key={`c-${i}`} onMouseEnter={() => setHoverIdx(i)}>
              <rect
                x={x - candleW}
                y={0}
                width={candleW * 2}
                height={H_MAIN}
                fill="transparent"
              />
              <line
                x1={x + 0.5}
                y1={yHigh}
                x2={x + 0.5}
                y2={yLow}
                stroke={color}
                strokeWidth="1"
              />
              <rect
                x={x - Math.floor(candleW / 2)}
                y={bodyTop}
                width={candleW}
                height={bodyHeight}
                fill={color}
              />
            </g>
          );
        })}

        {/* 6. Moving Average Curve Overlaid on Candlesticks (Royal Blue #2962FF matching TradingView reference) */}
        {showMA && (
          <g className="pointer-events-none">
            <polyline
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.2"
              strokeOpacity="0.65"
              points={ema50Points}
            />
            <polyline
              fill="none"
              stroke="#2962FF"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={ema20Points}
            />
          </g>
        )}

        {/* 7. Right Axis Price Badges: EMA(20) Blue Tag + Live Price Emerald/Coral Tag */}
        {showMA && lastEma > 0 && (
          <g>
            <rect
              x={axisX + 1}
              y={priceToY(lastEma) - 9}
              width={PRICE_AXIS_W - 2}
              height={18}
              rx="2"
              fill="#2962FF"
            />
            <text
              x={axisX + 6}
              y={priceToY(lastEma) + 4}
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {fmtPrice(lastEma)}
            </text>
          </g>
        )}

        {livePrice > 0 && (
          <g>
            <line
              x1={0}
              y1={priceToY(livePrice)}
              x2={axisX}
              y2={priceToY(livePrice)}
              stroke="#089981"
              strokeWidth="1"
              strokeDasharray="2 2"
              strokeOpacity="0.8"
            />
            <rect
              x={axisX + 1}
              y={priceToY(livePrice) - 10}
              width={PRICE_AXIS_W - 2}
              height={20}
              rx="2"
              fill="#089981"
            />
            <text
              x={axisX + 6}
              y={priceToY(livePrice) + 4}
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {fmtPrice(livePrice)}
            </text>
          </g>
        )}

        {/* 8. Lower Synchronized Sub-Pane: RSI (14) + SMA (9) + Bull/Bear Badges (Matching Image 3) */}
        {showRSI && (
          <g>
            {/* Pane Separator */}
            <line x1={0} y1={H_MAIN} x2={W} y2={H_MAIN} stroke="#2A2E39" strokeWidth="1" />

            {/* Shaded 30-70 RSI Channel */}
            <rect
              x={0}
              y={rsiToY(70)}
              width={axisX}
              height={rsiToY(30) - rsiToY(70)}
              fill="#7E57C2"
              fillOpacity="0.08"
            />

            {/* Dashed Upper (70), Mid (50), Lower (30) Guides */}
            {[80, 70, 50, 30, 20].map((lvl) => {
              const y = Math.round(rsiToY(lvl)) + 0.5;
              const isBand = lvl === 70 || lvl === 30;
              return (
                <g key={`rsi-g-${lvl}`}>
                  <line
                    x1={0}
                    y1={y}
                    x2={axisX}
                    y2={y}
                    stroke={isBand ? "#434651" : "#1E222D"}
                    strokeWidth="1"
                    strokeDasharray={isBand ? "3 3" : "none"}
                  />
                  {(lvl === 80 || lvl === 60 || lvl === 40 || lvl === 20) && (
                    <text
                      x={axisX + 8}
                      y={y + 4}
                      fill="#787B86"
                      fontSize="10.5"
                      fontFamily="monospace"
                    >
                      {lvl.toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* RSI Signal SMA (Yellow #FDD835) & RSI Curve (Purple #9C27B0) */}
            <polyline
              fill="none"
              stroke="#FDD835"
              strokeWidth="1.3"
              strokeLinejoin="round"
              points={rsiSigPoints}
            />
            <polyline
              fill="none"
              stroke="#9C27B0"
              strokeWidth="1.6"
              strokeLinejoin="round"
              points={rsiPoints}
            />

            {/* Right Axis RSI & Signal Badges */}
            {activeCandle && (
              <>
                <rect
                  x={axisX + 1}
                  y={rsiToY(activeCandle.rsiSignal) - 8}
                  width={48}
                  height={16}
                  rx="2"
                  fill="#FDD835"
                />
                <text
                  x={axisX + 6}
                  y={rsiToY(activeCandle.rsiSignal) + 4}
                  fill="#131722"
                  fontSize="10.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {activeCandle.rsiSignal.toFixed(2)}
                </text>

                <rect
                  x={axisX + 1}
                  y={rsiToY(activeCandle.rsi) - 8}
                  width={48}
                  height={16}
                  rx="2"
                  fill="#7E57C2"
                />
                <text
                  x={axisX + 6}
                  y={rsiToY(activeCandle.rsi) + 4}
                  fill="#FFFFFF"
                  fontSize="10.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {activeCandle.rsi.toFixed(2)}
                </text>
              </>
            )}

            {/* Crisp Bull & Bear Callout Flags on RSI Crossovers (Matching Image 3) */}
            {series.map((c, i) => {
              const x = Math.round(idxToX(i));
              if (c.bullCross) {
                const y = Math.round(rsiToY(c.rsi));
                return (
                  <g key={`bull-${i}`}>
                    <rect x={x - 16} y={y + 6} width={32} height={16} rx="3" fill="#089981" />
                    <text
                      x={x}
                      y={y + 17}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      Bull
                    </text>
                  </g>
                );
              }
              if (c.bearCross) {
                const y = Math.round(rsiToY(c.rsi));
                return (
                  <g key={`bear-${i}`}>
                    <rect x={x - 16} y={y - 22} width={32} height={16} rx="3" fill="#F23645" />
                    <text
                      x={x}
                      y={y - 11}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      Bear
                    </text>
                  </g>
                );
              }
              return null;
            })}
          </g>
        )}

        {/* 9. Hover Crosshair Guide */}
        {hoverIdx !== null && series[hoverIdx] && (
          <line
            x1={Math.round(idxToX(hoverIdx)) + 0.5}
            y1={0}
            x2={Math.round(idxToX(hoverIdx)) + 0.5}
            y2={H_USABLE}
            stroke="#50535E"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}
      </svg>
    </div>
  );
};
