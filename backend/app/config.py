import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Finhub"
    APP_ENV: str = "development"
    PORT: int = 8001
    HOST: str = "127.0.0.1"

    # AI Integration
    GEMINI_API_KEY: str = ""

    # Market Data
    DEFAULT_EXCHANGE: str = "binance"
    SUPPORTED_SYMBOLS: List[str] = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "PAXG/USDT"]
    DEFAULT_TIMEFRAME: str = "15m"

    # Paper Trading
    DEMO_STARTING_BALANCE_USDT: float = 10000.0

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///finhub.db"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
