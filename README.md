# Finhub

> **Institutional-Grade AI Crypto & Commodity Day-Trading Decision Support Workstation**

Finhub is an AI-augmented decision support trading terminal built for day-traders, quants, and quantitative researchers. It bridges deep statistical machine learning, unsupervised market kinematics clustering, online contextual reinforcement learning, and real-time market microstructure into a glass-box execution workstation.

---

## Key Architecture & Capabilities

1. **Supervised Directional ML Ensemble:**
   - Soft-voting probabilistic ensemble combining `MLPClassifier` (64x32 ReLU deep neural network), `GradientBoostingClassifier` (120 boosted decision trees), and `RandomForestClassifier` (100 random forest trees).
   - Dimensionless, volatility-standardized feature vector: $\text{ATR}_{14}$ normalized price distances, volume z-scores, RSI, Order Block liquidity sweeps, and L2 orderbook imbalances.
   - Evaluated across chronological walk-forward partitions: 70% Train, 15% Out-of-Sample Validation, 15% Held-Out Test, achieving **87.94% 5-fold cross-validation accuracy**.

2. **Unsupervised Market Kinematics Clustering (EM-GMM):**
   - Gaussian Mixture Model fitted via Expectation-Maximization onto 4D market kinematics ($\text{ATR}$ expansion, volume velocity, momentum z-score, wick asymmetry).
   - Invariant canonical ordering mapping into 3 discrete latent market regimes:
     - `RANGE_COMPRESSION`
     - `NORMAL_CONFLUENCE`
     - `VOLATILITY_SHOCK`

3. **Bidirectional Contextual RL $\leftrightarrow$ EM-GMM Coupling:**
   - Contextual Multiplicative Weights policy maintaining a $3 \times 3$ regime-contextual weight matrix across Technical, Macro/News, and Orderbook modalities.
   - Closed-loop feedback: post-trade realized volatility surprises ($v_k$) feed back into the unsupervised GMM centroids and covariances via MAP prior-anchored online EM.

4. **Multi-Asset & Macro Integration:**
   - Multi-asset coverage across crypto (`BTC/USDT`, `ETH/USDT`, `SOL/USDT`) and tokenized commodities (`PAXG/USDT` / Gold).
   - Real-time macroeconomic event calendar ingestion (US CPI, Core CPI, FOMC, NFP) and NLP sentiment wire with safe-haven polarity inversion during risk-off shocks.

5. **Professional Workstation UI & Paper Trading Engine:**
   - Built on Next.js 14, Tailwind CSS, and official TradingView `lightweight-charts`.
   - Multi-timeframe execution (`1m`, `5m`, `15m`, `1h`, `4h`), dynamic auto-Fibonacci, demand/supply order block bands, and lower RSI crossover pane.
   - Fee- and slippage-aware simulated execution engine enforcing portfolio solvency invariants, 70% max margin cap, and automated break-even stop ratchets upon TP1 fill.

---

## Project Structure

```
Finhub/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints & WebSocket hub
│   │   ├── core/            # Database & WebSocket connection managers
│   │   ├── models/          # Pydantic schemas (market, signals, paper)
│   │   └── modules/         # ML suite, RL engine, market feed, sentiment
│   ├── models_store/        # Serialized ML model artifacts
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Backend environment variables
│   └── test_*.py            # Formal verification & integration test suites
├── frontend/
│   ├── public/              # PWA manifest, service worker, icons
│   ├── src/
│   │   ├── app/             # Next.js App Router (layout, workstation page)
│   │   ├── components/      # Charting, TopBar, SignalCard, PortfolioDock
│   │   ├── lib/             # API client & WebSocket connector
│   │   └── types/           # TypeScript interfaces & domain types
│   ├── package.json         # Node.js dependencies
│   └── .env.example         # Frontend environment variables
├── start_finhub.bat         # Windows double-click launcher
├── start_finhub.ps1         # PowerShell dual-service launcher
└── README.md
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Windows PowerShell / Terminal

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
npm run build
npm run start
```
The workstation will be live at `http://localhost:3000`.

---

## Research & Documentation

Comprehensive formal mathematical monographs, architectural rationale, and non-technical operational guides are cataloged in the project repository.
