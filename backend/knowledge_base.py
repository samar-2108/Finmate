# knowledge_base.py
# ─────────────────────────────────────────────────────────────
# All static Indian financial knowledge encoded as Python dicts.
# This is the "brain" of the system prompt — compiled from SEBI,
# AMFI, Income Tax Act, and RBI public sources.
# Update tax slabs at the start of each financial year (April).
# ─────────────────────────────────────────────────────────────

KNOWLEDGE_BASE = {

    # ── Tax slabs ──────────────────────────────────────────────
    "tax": {
        "new_regime_fy2025": [
            {"upto": 300000,   "rate": 0.00},
            {"upto": 600000,   "rate": 0.05},
            {"upto": 900000,   "rate": 0.10},
            {"upto": 1200000,  "rate": 0.15},
            {"upto": 1500000,  "rate": 0.20},
            {"above": 1500000, "rate": 0.30},
        ],
        "old_regime_fy2025": [
            {"upto": 250000,   "rate": 0.00},
            {"upto": 500000,   "rate": 0.05},
            {"upto": 1000000,  "rate": 0.20},
            {"above": 1000000, "rate": 0.30},
        ],
        "surcharge_threshold": 5000000,
        "cess_rate": 0.04,   # Health & Education cess
        "standard_deduction_old": 50000,
        "standard_deduction_new": 75000,  # Updated in Budget 2024
    },

    # ── 80C / 80D / NPS deduction limits ──────────────────────
    "deductions": {
        "80C_limit": 150000,          # ELSS, PPF, EPF, NSC, LIC, ULIP, home loan principal
        "80D_self_below60": 25000,    # Health insurance premium (self + family)
        "80D_parents_below60": 25000,
        "80D_parents_above60": 50000,
        "80CCD_1B_nps": 50000,        # Additional NPS deduction over 80C
        "80TTA_savings_interest": 10000,  # Interest on savings account
        "hra_exemption_metro_percent": 0.50,
        "hra_exemption_nonmetro_percent": 0.40,
    },

    # ── Investment instruments ─────────────────────────────────
    "instruments": {
        "ppf": {
            "current_rate": 0.071,    # 7.1% p.a. as of Q1 FY25 — update quarterly
            "lock_in_years": 15,
            "annual_limit": 150000,
            "tax_status": "EEE",      # Exempt-Exempt-Exempt
            "risk": "very_low",
        },
        "elss": {
            "expected_cagr": 0.12,    # Historical avg — not guaranteed
            "lock_in_years": 3,
            "annual_limit": 150000,   # within 80C
            "tax_status": "ETE",      # LTCG taxed above 1L
            "risk": "high",
        },
        "nps": {
            "expected_cagr": 0.10,    # Blended Tier-1 return estimate
            "lock_in": "till_60",
            "tax_status": "EET",
            "extra_deduction": 50000, # 80CCD(1B)
            "risk": "moderate",
        },
        "fd": {
            "current_rate_range": [0.065, 0.075],  # Major banks, update periodically
            "tax_status": "taxable",
            "risk": "very_low",
        },
        "liquid_fund": {
            "expected_return": 0.065,
            "exit_load": "nil_after_7_days",
            "use_case": "emergency_fund",
            "risk": "very_low",
        },
        "gold": {
            "historical_cagr": 0.11,  # 20-year Indian gold CAGR in INR
            "recommended_allocation_max": 0.10,
            "instrument": "sovereign_gold_bond_or_gold_etf",
            "risk": "moderate",
        },
        "nifty50_index_fund": {
            "historical_cagr": 0.126,  # Nifty 50 TRI 20-year CAGR approx
            "expense_ratio_typical": 0.002,
            "risk": "high",
            "horizon_min_years": 5,
        },
    },

    # ── Asset allocation rules by risk profile ─────────────────
    "asset_allocation": {
        "conservative": {
            "equity": 0.20, "debt": 0.60, "gold": 0.10, "liquid": 0.10
        },
        "moderate": {
            "equity": 0.50, "debt": 0.35, "gold": 0.10, "liquid": 0.05
        },
        "aggressive": {
            "equity": 0.75, "debt": 0.15, "gold": 0.05, "liquid": 0.05
        },
        "very_aggressive": {
            "equity": 0.85, "debt": 0.10, "gold": 0.00, "liquid": 0.05
        },
    },

    # ── Nifty P/E valuation zones ──────────────────────────────
    # Used to tilt equity allocation up or down dynamically
    "market_valuation": {
        "undervalued_pe_below": 18,
        "fair_value_pe_range": [18, 24],
        "overvalued_pe_above": 24,
        "equity_tilt_undervalued": +0.10,   # Add 10% to equity allocation
        "equity_tilt_overvalued": -0.10,    # Cut 10% from equity allocation
    },

    # ── Rules of thumb ─────────────────────────────────────────
    "rules_of_thumb": {
        "emergency_fund_months": 6,
        "term_insurance_multiplier": 12,      # 12x annual income
        "health_insurance_min_cover": 500000, # ₹5 lakh minimum
        "fire_withdrawal_rate": 0.04,          # 4% safe withdrawal rate
        "fire_corpus_multiplier": 25,          # 25x annual expenses
        "savings_rate_minimum": 0.20,
        "savings_rate_fire": 0.40,
        "rule_of_72_divisor": 72,              # Years to double = 72 / rate%
    },

    # ── Inflation assumptions ──────────────────────────────────
    "inflation": {
        "general_cpi": 0.06,
        "education_inflation": 0.10,   # Higher than CPI
        "healthcare_inflation": 0.10,
        "lifestyle_inflation": 0.07,
    },

    # ── Insurance benchmarks ───────────────────────────────────
    "insurance": {
        "term_premium_estimate_30yr_1cr": 8000,  # ₹8,000/yr approx for ₹1Cr cover
        "health_floater_2_members": 15000,
        "critical_illness_rider": "recommended_above_40",
        "min_health_cover_metro": 1000000,        # ₹10L in metros
    },

    # ── Common Indian life goals with inflation rate ───────────
    "goal_inflation_rates": {
        "child_education": 0.10,
        "child_marriage": 0.08,
        "home_purchase": 0.07,
        "retirement": 0.06,
        "travel": 0.05,
        "car_purchase": 0.04,
    },
}
