import { TickerData, CandleData, SignalData, PaperAccountSummary, PaperPosition } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1";

export async function fetchTicker(symbol: string = "BTC/USDT"): Promise<TickerData> {
  const res = await fetch(`${API_BASE}/market/ticker?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch ticker");
  return res.json();
}

export async function fetchCandles(symbol: string = "BTC/USDT", timeframe: string = "15m", limit: number = 60): Promise<CandleData[]> {
  const res = await fetch(`${API_BASE}/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch candles");
  return res.json();
}

export async function fetchLatestSignal(symbol: string = "BTC/USDT", strategy_profile: string = "INTRADAY_15M"): Promise<SignalData> {
  const res = await fetch(`${API_BASE}/signals/latest?symbol=${encodeURIComponent(symbol)}&strategy_profile=${encodeURIComponent(strategy_profile)}`);
  if (!res.ok) throw new Error("Failed to fetch signal");
  return res.json();
}

export async function refreshSignal(symbol: string = "BTC/USDT", strategy_profile: string = "INTRADAY_15M"): Promise<SignalData> {
  const res = await fetch(`${API_BASE}/signals/refresh?symbol=${encodeURIComponent(symbol)}&strategy_profile=${encodeURIComponent(strategy_profile)}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to generate fresh signal");
  return res.json();
}

export async function fetchAccountSummary(): Promise<PaperAccountSummary> {
  const res = await fetch(`${API_BASE}/paper/account`);
  if (!res.ok) throw new Error("Failed to fetch account summary");
  return res.json();
}

export async function executePaperTrade(order: {
  symbol: string;
  side: "LONG" | "SHORT";
  margin_usdt: number;
  leverage?: number;
  signal_id?: string;
  strategy_profile?: string;
  custom_stop_loss?: number;
  custom_take_profit_1?: number;
  custom_take_profit_2?: number;
}): Promise<PaperPosition> {
  const res = await fetch(`${API_BASE}/paper/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to execute paper trade" }));
    throw new Error(err.detail || "Failed to execute paper trade");
  }
  return res.json();
}

export async function moveStopLossToBreakeven(positionId: string): Promise<PaperPosition> {
  const res = await fetch(`${API_BASE}/paper/breakeven`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position_id: positionId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to move SL to breakeven" }));
    throw new Error(err.detail || "Failed to move SL to breakeven");
  }
  return res.json();
}

export async function closePaperPosition(positionId: string, reason: string = "USER_MANUAL"): Promise<PaperPosition> {
  const res = await fetch(`${API_BASE}/paper/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position_id: positionId, reason })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to close paper position" }));
    throw new Error(err.detail || "Failed to close paper position");
  }
  return res.json();
}

export async function resetDemoAccount(): Promise<PaperAccountSummary> {
  const res = await fetch(`${API_BASE}/paper/reset`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to reset demo account");
  return res.json();
}

export async function triggerBreakingNews(headline: string): Promise<any> {
  const res = await fetch(`${API_BASE}/market/news/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      headline,
      source: "Urgent Geopolitical Wire",
      sentiment_score: -0.85,
      severity: "URGENT"
    })
  });
  if (!res.ok) throw new Error("Failed to trigger breaking news");
  return res.json();
}

export async function dismissBreakingNews(): Promise<any> {
  const res = await fetch(`${API_BASE}/market/news/dismiss`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to dismiss breaking news");
  return res.json();
}
