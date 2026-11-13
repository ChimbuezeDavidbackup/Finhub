import aiosqlite
import json
import os
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger("finhub.database")
DB_PATH = "finhub.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS paper_account (
                account_id TEXT PRIMARY KEY,
                balance_usdt REAL,
                equity_usdt REAL,
                realized_pnl_usdt REAL,
                win_rate REAL,
                profit_factor REAL,
                total_trades_count INTEGER,
                winning_trades_count INTEGER,
                losing_trades_count INTEGER,
                updated_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS paper_positions (
                id TEXT PRIMARY KEY,
                symbol TEXT,
                side TEXT,
                status TEXT,
                entry_price REAL,
                current_mark_price REAL,
                size REAL,
                margin_usdt REAL,
                leverage REAL,
                stop_loss REAL,
                take_profit_1 REAL,
                take_profit_2 REAL,
                trailing_sl_active INTEGER,
                unrealized_pnl_dollars REAL,
                unrealized_pnl_percent REAL,
                realized_pnl_dollars REAL,
                realized_pnl_percent REAL,
                signal_id TEXT,
                created_at TEXT,
                closed_at TEXT,
                max_hold_minutes INTEGER,
                elapsed_minutes INTEGER,
                exit_price REAL,
                exit_reason TEXT,
                strategy_profile TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS rl_policy_state (
                id TEXT PRIMARY KEY,
                weights_json TEXT,
                total_episodes INTEGER,
                sharpe_ratio REAL,
                updated_at TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS signals_history (
                id TEXT PRIMARY KEY,
                symbol TEXT,
                direction TEXT,
                regime TEXT,
                risk_level TEXT,
                conviction_score INTEGER,
                payload TEXT,
                created_at TEXT
            )
        """)
        
        # Initialize default account if not exists
        async with db.execute("SELECT account_id FROM paper_account WHERE account_id = 'demo_primary'") as cursor:
            row = await cursor.fetchone()
            if not row:
                await db.execute("""
                    INSERT INTO paper_account (
                        account_id, balance_usdt, equity_usdt, realized_pnl_usdt,
                        win_rate, profit_factor, total_trades_count,
                        winning_trades_count, losing_trades_count, updated_at
                    ) VALUES (
                        'demo_primary', 10000.0, 10000.0, 0.0, 0.0, 0.0, 0, 0, 0, datetime('now')
                    )
                """)
        await db.commit()
    logger.info("Database schema initialized successfully.")

async def get_db_connection() -> aiosqlite.Connection:
    return await aiosqlite.connect(DB_PATH)
