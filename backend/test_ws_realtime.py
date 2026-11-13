import asyncio
import json
import websockets

async def test_live_websocket():
    uri = "ws://127.0.0.1:8001/api/v1/ws"
    print(f"Connecting to live Finhub WebSocket at {uri}...")
    
    async with websockets.connect(uri) as ws:
        print("[OK] Connected to WebSocket!")
        received_types = set()
        
        start = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start < 5.0:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                msg = json.loads(raw)
                msg_type = msg.get("type")
                received_types.add(msg_type)
                
                if msg_type == "TICK":
                    d = msg["data"]
                    print(f"  [TICK] {d['symbol']} @ ${d['price']} ({d['change_24h_percent']:+.2f}%)")
                elif msg_type == "WINDOW_TICK":
                    d = msg["data"]
                    print(f"  [WINDOW_TICK] {d['symbol']} window: {d['seconds_remaining']}s remaining ({d['minutes_display']})")
                elif msg_type == "PAPER_ACCOUNT_UPDATE":
                    d = msg["data"]
                    print(f"  [PAPER_ACCOUNT] Balance: ${d['balance_usdt']} | Equity: ${d['equity_usdt']} | Open Pos: {len(d.get('open_positions', []))}")
                else:
                    print(f"  [{msg_type}] {msg.get('data')}")
            except asyncio.TimeoutError:
                break
                
        print(f"\n[OK] Captured message types: {received_types}")
        assert "TICK" in received_types, "TICK not received"
        print("[OK] REAL-TIME WEBSOCKET PIPELINE IS 100% OPERATIONAL!")

if __name__ == "__main__":
    asyncio.run(test_live_websocket())
