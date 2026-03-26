# market_data.py
# ─────────────────────────────────────────────────────────────
# Fetches live market data from free public APIs.
# Every fetch has a hardcoded fallback so a failed API
# never crashes the app — especially important during a demo.
#
# APIs used:
#   1. exchangerate-api.com  → USD/INR (no key needed)
#   2. Alpha Vantage         → Gold ETF price (free key)
#   3. NSE India             → Nifty data (tricky headers needed)
#   4. RBI / hardcoded       → Repo rate (changes ~6x/year)
# ─────────────────────────────────────────────────────────────

import os
import httpx
from dotenv import load_dotenv
import asyncio

load_dotenv()

ALPHA_KEY = os.getenv("ALPHA_VANTAGE_KEY", "demo")

# ── Fallback values (update monthly) ──────────────────────────
# These are used when any API call fails.
FALLBACKS = {
    "usd_inr": 83.5,
    "repo_rate": 6.50,       # RBI repo rate — update when RBI changes it
    "cpi_inflation": 5.10,   # Latest CPI — check RBI monthly bulletin
    "nifty_pe": 22.3,        # Update from NSE website weekly
    "nifty_price": 22500,    # Approximate — update before hackathon demo
    "gold_price_per_10g": 72000,  # Approx — update before demo
    "fd_best_rate": 7.25,    # Best 1-year FD rate among major banks
}


async def fetch_usd_inr() -> float:
    """
    Fetches live USD/INR exchange rate.
    Source: exchangerate-api.com (free, no key needed, 1500 req/month)
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            r.raise_for_status()
            rate = r.json()["rates"]["INR"]
            return round(float(rate), 2)
    except Exception as e:
        print(f"[market_data] USD/INR fetch failed: {e} — using fallback")
        return FALLBACKS["usd_inr"]


async def fetch_gold_price() -> float:
    """
    Fetches gold ETF price via Alpha Vantage (SOVEREIGN GOLD BOND proxy).
    Free key: 25 requests/day on free tier.
    Sign up at: https://www.alphavantage.co/support/#api-key
    """
    try:
        url = (
            f"https://www.alphavantage.co/query"
            f"?function=GLOBAL_QUOTE"
            f"&symbol=GOLDBEES.BSE"
            f"&apikey={ALPHA_KEY}"
        )
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            price = float(data["Global Quote"]["05. price"])
            return round(price, 2)
    except Exception as e:
        print(f"[market_data] Gold price fetch failed: {e} — using fallback")
        return FALLBACKS["gold_price_per_10g"]


async def fetch_nifty_data() -> dict:
    """
    Attempts to fetch Nifty 50 P/E and price from NSE India.
    NSE blocks server-side requests without browser-like headers.
    If it fails, returns fallback — update fallback values weekly.

    Alternative: Tickertape API (more reliable for server use)
    https://api.tickertape.in/screener/query (check their docs)
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
            # First hit the homepage to get cookies
            await client.get("https://www.nseindia.com")
            # Then fetch market data
            r = await client.get(
                "https://www.nseindia.com/api/allIndices",
                headers=headers,
            )
            r.raise_for_status()
            indices = r.json().get("data", [])
            nifty = next((i for i in indices if i.get("indexSymbol") == "NIFTY 50"), None)
            if nifty:
                return {
                    "nifty_price": round(float(nifty.get("last", FALLBACKS["nifty_price"])), 2),
                    "nifty_pe": round(float(nifty.get("pe", FALLBACKS["nifty_pe"])), 2),
                    "nifty_change_pct": round(float(nifty.get("percentChange", 0)), 2),
                }
    except Exception as e:
        print(f"[market_data] NSE fetch failed: {e} — using fallback")

    return {
        "nifty_price": FALLBACKS["nifty_price"],
        "nifty_pe": FALLBACKS["nifty_pe"],
        "nifty_change_pct": 0.0,
    }


async def get_market_snapshot() -> dict:
    """
    Master function — calls all APIs concurrently and assembles
    a single clean dict that gets injected into the system prompt.

    Uses asyncio-style concurrent fetching via httpx.
    Falls back gracefully on any failure.
    """

    # Run all fetches concurrently — much faster than sequential
    usd_inr, gold_price, nifty_data = await asyncio.gather(
        fetch_usd_inr(),
        fetch_gold_price(),
        fetch_nifty_data(),
        return_exceptions=True,  # Don't let one failure kill the others
    )

    # Handle any exceptions that slipped through gather
    if isinstance(usd_inr, Exception):
        usd_inr = FALLBACKS["usd_inr"]
    if isinstance(gold_price, Exception):
        gold_price = FALLBACKS["gold_price_per_10g"]
    if isinstance(nifty_data, Exception):
        nifty_data = {
            "nifty_price": FALLBACKS["nifty_price"],
            "nifty_pe": FALLBACKS["nifty_pe"],
            "nifty_change_pct": 0.0,
        }

    return {
        # Forex
        "usd_inr": usd_inr,

        # Market indices
        "nifty_price": nifty_data["nifty_price"],
        "nifty_pe": nifty_data["nifty_pe"],
        "nifty_change_pct": nifty_data["nifty_change_pct"],

        # Commodities
        "gold_price": gold_price,

        # Macro (slowly changing — update manually)
        "repo_rate": FALLBACKS["repo_rate"],
        "cpi_inflation": FALLBACKS["cpi_inflation"],
        "fd_best_rate": FALLBACKS["fd_best_rate"],

        # Derived signal for the agent
        "market_signal": _get_market_signal(nifty_data["nifty_pe"]),
    }


def _get_market_signal(pe: float) -> str:
    """
    Converts Nifty P/E into a plain-English signal for the agent.
    """
    if pe > 26:
        return "significantly_overvalued"
    elif pe > 22:
        return "slightly_overvalued"
    elif pe > 18:
        return "fair_value"
    elif pe > 14:
        return "attractive"
    else:
        return "significantly_undervalued"
