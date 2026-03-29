# Pure deterministic math functions.
# No API calls, no AI — just formulas.
# Every number the agent quotes comes from these functions.

from knowledge_base import KNOWLEDGE_BASE


#1. SIP Calculator
def calc_sip(target: float, years: int, annual_rate: float = 0.12) -> float:
    """
    Monthly SIP amount needed to reach a target corpus.

    Formula: SIP = FV × r / [(1+r)^n − 1]
    where r = monthly rate, n = total months

    Args:
        target      : target corpus in ₹
        years       : investment horizon in years
        annual_rate : expected annual return (default 12% for equity)

    Returns:
        Monthly SIP amount in ₹
    """
    if years <= 0:
        return 0.0
    n = years * 12
    r = annual_rate / 12
    if r == 0:
        return round(target / n, 2)
    sip = target * r / ((1 + r) ** n - 1)
    return round(sip, 2)


#2. FIRE Corpus Calculator
def calc_fire_corpus(monthly_expense: float, inflation: float = None) -> float:
    """
    Target retirement corpus using the 25x rule (4% withdrawal rate).
    Adjusts for Indian inflation context.

    Formula: Corpus = Annual Expenses × 25

    Args:
        monthly_expense : current monthly expenses in ₹
        inflation       : annual inflation rate (uses KB default if None)

    Returns:
        FIRE corpus target in ₹
    """
    inflation = KNOWLEDGE_BASE["inflation"]["general_cpi"] if inflation is None else inflation
    annual_expense = monthly_expense * 12
    multiplier = KNOWLEDGE_BASE["rules_of_thumb"]["fire_corpus_multiplier"]
    # Inflate expenses by 1 year to account for planning lag
    corpus = annual_expense * (1 + inflation) * multiplier
    return round(corpus, 2)


#3. Future Value of Existing Investments
def calc_future_value(principal: float, annual_rate: float, years: int) -> float:
    """
    Compound interest — how much an existing lump sum grows to.

    Formula: FV = P × (1 + r)^n

    Args:
        principal   : current investment value in ₹
        annual_rate : expected annual return
        years       : number of years

    Returns:
        Future value in ₹
    """
    if years <= 0:
        return principal
    return round(principal * (1 + annual_rate) ** years, 2)


#4. Inflation-Adjusted Goal Amount
def calc_goal_future_cost(
    current_cost: float, years_away: int, inflation: float = 0.06
) -> float:
    """
    How much a goal will cost in the future after inflation.

    Example: A ₹20L wedding today costs ₹35L in 8 years at 7% inflation.

    Args:
        current_cost : today's cost of the goal in ₹
        years_away   : years until the goal
        inflation    : annual inflation for this goal type

    Returns:
        Future cost in ₹
    """
    return round(current_cost * (1 + inflation) ** years_away, 2)


#5. Emergency Fund Shortfall
def calc_emergency_shortfall(
    monthly_expense: float, liquid_savings: float
) -> dict:
    """
    Checks if the user has enough liquid buffer.
    Target = 6 months of expenses in liquid/low-risk instruments.

    Returns:
        dict with target, current, shortfall, and months_covered
    """
    months = KNOWLEDGE_BASE["rules_of_thumb"]["emergency_fund_months"]
    target = monthly_expense * months
    shortfall = max(0.0, target - liquid_savings)
    months_covered = round(liquid_savings / monthly_expense, 1) if monthly_expense > 0 else 0
    return {
        "target": round(target, 2),
        "current": round(liquid_savings, 2),
        "shortfall": round(shortfall, 2),
        "months_covered": months_covered,
        "is_sufficient": shortfall == 0,
    }


#6. Insurance Gap Calculator
def calc_insurance_gap(
    annual_income: float,
    existing_term_cover: float,
    existing_health_cover: float,
    age: int,
    city_tier: str = "metro",
) -> dict:
    """
    Calculates gaps in life and health insurance.

    Term insurance target: 12x annual income (SEBI/IRDAI guidance)
    Health cover target: ₹10L in metros, ₹5L in Tier-2/3

    Returns:
        dict with life_gap and health_gap
    """
    multiplier = KNOWLEDGE_BASE["rules_of_thumb"]["term_insurance_multiplier"]
    term_target = annual_income * multiplier
    term_gap = max(0.0, term_target - existing_term_cover)

    health_target = (
        KNOWLEDGE_BASE["insurance"]["min_health_cover_metro"]
        if city_tier == "metro"
        else KNOWLEDGE_BASE["rules_of_thumb"]["health_insurance_min_cover"]
    )
    health_gap = max(0.0, health_target - existing_health_cover)

    return {
        "term_target": round(term_target, 2),
        "term_gap": round(term_gap, 2),
        "health_target": round(health_target, 2),
        "health_gap": round(health_gap, 2),
        "term_sufficient": term_gap == 0,
        "health_sufficient": health_gap == 0,
    }


#7.Tax Saving Headroom
def calc_tax_headroom(
    annual_income: float,
    existing_80c: float = 0,
    existing_nps: float = 0,
    health_premium: float = 0,
    regime: str = "new",
) -> dict:
    """
    Calculates remaining tax-saving investment headroom.

    Args:
        annual_income  : gross annual income
        existing_80c   : already invested under 80C (EPF, LIC, etc.)
        existing_nps   : NPS contributions already made
        health_premium : health insurance premium paid
        regime         : "old" or "new" tax regime

    Returns:
        dict with remaining limits and estimated tax saving
    """
    kb = KNOWLEDGE_BASE["deductions"]

    if regime == "old":
        remaining_80c = max(0, kb["80C_limit"] - existing_80c)
        remaining_nps = max(0, kb["80CCD_1B_nps"] - existing_nps)
        remaining_health = max(0, kb["80D_self_below60"] - health_premium)
        total_remaining = remaining_80c + remaining_nps + remaining_health

        # Rough tax saving estimate at 20% slab (common for ₹5-10L income)
        slab_rate = 0.20 if annual_income <= 1000000 else 0.30
        estimated_saving = round(total_remaining * slab_rate * 1.04, 2)  # incl. cess

        return {
            "regime": "old",
            "remaining_80c": round(remaining_80c, 2),
            "remaining_nps_80ccd": round(remaining_nps, 2),
            "remaining_health_80d": round(remaining_health, 2),
            "total_remaining_deductions": round(total_remaining, 2),
            "estimated_tax_saving": estimated_saving,
        }
    else:
        # New regime — most deductions not available, only NPS employer
        return {
            "regime": "new",
            "note": "New regime has limited deductions. NPS employer contribution still exempt.",
            "remaining_80c": 0,
            "remaining_nps_80ccd": 0,
            "total_remaining_deductions": 0,
            "estimated_tax_saving": 0,
        }


#FIRE Date Estimator
def calc_fire_date(
    current_age: int,
    monthly_income: float,
    monthly_expense: float,
    current_corpus: float,
    annual_return: float = 0.12,
    inflation: float = 0.06,
    salary_growth: float = 0.08, 
) -> dict:
    """
    Estimates the age at which the user can retire using FIRE principles.
    Runs a year-by-year simulation.

    Returns:
        dict with fire_age, years_to_fire, fire_corpus_target
    """
    fire_corpus_target = calc_fire_corpus(monthly_expense, inflation)
    monthly_savings = monthly_income - monthly_expense
    corpus = current_corpus
    age = current_age
    max_years = 50

    for year in range(1, max_years + 1):
        corpus = corpus * (1 + annual_return)
        corpus += monthly_savings * 12               # this year's correct savings
        monthly_expense *= (1 + inflation)           # expenses grow
        monthly_income *= (1 + salary_growth)        # ← ADD: income grows too
        monthly_savings = monthly_income - monthly_expense   # ← ADD: recalculate
        fire_corpus_target = calc_fire_corpus(monthly_expense, inflation)
        
        age += 1
        if corpus >= fire_corpus_target:
            return {
                "fire_age": age,
                "years_to_fire": year,
                "fire_corpus_target": round(fire_corpus_target, 2),
                "projected_corpus": round(corpus, 2),
                "achievable": True,
            }

    return {
        "fire_age": None,
        "years_to_fire": None,
        "fire_corpus_target": round(fire_corpus_target, 2),
        "projected_corpus": round(corpus, 2),
        "achievable": False,
        "note": "FIRE not achievable in 50 years at current savings rate. Increase savings or reduce expenses.",
    }


#Asset Allocation with Market Tilt
def calc_asset_allocation(
    risk_profile: str, nifty_pe: float = None
) -> dict:
    """
    Returns recommended asset allocation with optional market valuation tilt.

    If Nifty P/E is high (>24), reduces equity allocation.
    If Nifty P/E is low (<18), increases equity allocation.

    Args:
        risk_profile : "conservative" | "moderate" | "aggressive" | "very_aggressive"
        nifty_pe     : current Nifty 50 P/E ratio (optional)

    Returns:
        dict with equity, debt, gold, liquid percentages
    """
    kb_alloc = KNOWLEDGE_BASE["asset_allocation"]
    kb_market = KNOWLEDGE_BASE["market_valuation"]

    base = dict(kb_alloc.get(risk_profile, kb_alloc["moderate"]))

    market_note = None
    if nifty_pe:
        if nifty_pe > kb_market["overvalued_pe_above"]:
            tilt = kb_market["equity_tilt_overvalued"]
            base["equity"] = max(0.10, base["equity"] + tilt)
            base["debt"] = min(0.80, base["debt"] - tilt)
            market_note = f"Market P/E at {nifty_pe:.1f} (elevated). Tilted toward debt."
        elif nifty_pe < kb_market["undervalued_pe_below"]:
            tilt = kb_market["equity_tilt_undervalued"]
            base["equity"] = min(0.90, base["equity"] + tilt)
            base["debt"] = max(0.05, base["debt"] - tilt)
            market_note = f"Market P/E at {nifty_pe:.1f} (attractive). Tilted toward equity."
        else:
            market_note = f"Market P/E at {nifty_pe:.1f} (fair value range). Base allocation applied."

    base["market_note"] = market_note
    return base


#Savings Rate Calculator
def calc_savings_rate(monthly_income: float, monthly_expense: float) -> dict:
    """
    Calculates savings rate and gives a qualitative assessment.
    """
    if monthly_income <= 0:
        return {"rate": 0, "assessment": "invalid_income"}

    rate = (monthly_income - monthly_expense) / monthly_income
    rate = round(rate, 4)

    if rate < 0:
        assessment = "spending_more_than_earning"
    elif rate < 0.10:
        assessment = "critical_low"
    elif rate < 0.20:
        assessment = "below_recommended"
    elif rate < 0.35:
        assessment = "healthy"
    elif rate < 0.50:
        assessment = "excellent"
    else:
        assessment = "fire_track"

    return {
        "rate": rate,
        "rate_percent": round(rate * 100, 1),
        "monthly_surplus": round(monthly_income - monthly_expense, 2),
        "assessment": assessment,
    }
