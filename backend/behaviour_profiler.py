# behaviour_profiler.py
# This is the USP of the product.
# Takes quiz answers + financial numbers → outputs a persona.
# The persona changes how the AI talks to the user and what
# it prioritises in the financial plan.
# Personas:
#   1. FIRE Seeker        — wants to retire early, savings-focused
#   2. YOLO Traveller     — experiences > savings, lifestyle-first
#   3. Family-First       — children/parents are the priority
#   4. Debt Slayer        — anxious about loans, wants to be debt-free
#   5. Wealth Builder     — ambitious, wants to grow aggressively
#   6. Balanced Builder   — middle-of-the-road, practical

from dataclasses import dataclass, asdict
from typing import Optional

@dataclass
class Persona:
    type: str                  # Persona name
    tone: str                  # How the AI should talk
    framing: str               # What the AI should emphasise
    risk_profile: str          # maps to asset_allocation key
    risk_score: int            # 1-10
    primary_motivation: str    # What drives them
    primary_fear: str          # What worries them most
    plan_style: str            # "number_heavy" | "story_driven" | "balanced"
    emoji_label: str           # For the PersonaCard UI

# ── Quiz answer keys ───────────────────────────────────────────
# These must match the values sent from your React onboarding form.
# Question 1: "₹50,000 extra this month — what do you do?"
Q1_INVEST_ALL   = "invest_all"
Q1_INVEST_HALF  = "invest_half_travel"
Q1_PAY_DEBT     = "pay_off_debt"
Q1_BUY_WANT     = "buy_something_wanted"
Q1_SAVE_FAMILY  = "save_for_family_goal"

# Question 2: "What's your single biggest financial fear?"
Q2_NOT_ENOUGH       = "not_having_enough_to_retire"
Q2_MISSING_OUT      = "missing_out_on_experiences"
Q2_DEBT_TRAP        = "stuck_in_debt_forever"
Q2_FAMILY_BURDEN    = "being_a_burden_on_family"
Q2_MARKET_CRASH     = "losing_money_in_market"

# Question 3: "When do you want to retire?"
Q3_BEFORE_45 = "before_45"
Q3_AT_60     = "at_60"
Q3_NEVER     = "never_want_to_retire"
Q3_FLEXIBLE  = "flexible_whenever_i_can"

# Question 4: "What % of last month's spend went to experiences?"
# (sent as an integer 0-100 from a slider)

def detect_persona(
    quiz_answers: list[str],
    monthly_income: float,
    monthly_expense: float,
    experience_spend_pct: int = 20,
    has_dependants: bool = False,
    outstanding_debt: float = 0,
) -> dict:
    """
    Main persona detection function.

    Args:
        quiz_answers        : list of 3 answer keys from the quiz
        monthly_income      : take-home monthly income in ₹
        monthly_expense     : total monthly expenses in ₹
        experience_spend_pct: % of expenses on travel/dining/events (0-100)
        has_dependants      : True if user has children or elderly parents
        outstanding_debt    : total outstanding loans in ₹

    Returns:
        Persona dict (serialised dataclass)
    """
    savings_rate = (
        (monthly_income - monthly_expense) / monthly_income
        if monthly_income > 0
        else 0
    )

    q1 = quiz_answers[0] if len(quiz_answers) > 0 else ""
    q2 = quiz_answers[1] if len(quiz_answers) > 1 else ""
    q3 = quiz_answers[2] if len(quiz_answers) > 2 else ""

    #Scoring system
    scores = {
        "fire":    0,
        "yolo":    0,
        "family":  0,
        "debt":    0,
        "wealth":  0,
    }

    # Q1 scoring
    if q1 == Q1_INVEST_ALL:
        scores["fire"] += 3; scores["wealth"] += 2
    elif q1 == Q1_INVEST_HALF:
        scores["yolo"] += 3
    elif q1 == Q1_PAY_DEBT:
        scores["debt"] += 4
    elif q1 == Q1_BUY_WANT:
        scores["yolo"] += 2
    elif q1 == Q1_SAVE_FAMILY:
        scores["family"] += 4

    # Q2 scoring
    if q2 == Q2_NOT_ENOUGH:
        scores["fire"] += 3
    elif q2 == Q2_MISSING_OUT:
        scores["yolo"] += 3
    elif q2 == Q2_DEBT_TRAP:
        scores["debt"] += 4
    elif q2 == Q2_FAMILY_BURDEN:
        scores["family"] += 3
    elif q2 == Q2_MARKET_CRASH:
        scores["fire"] += 1  # conservative FIRE type

    # Q3 scoring
    if q3 == Q3_BEFORE_45:
        scores["fire"] += 4
    elif q3 == Q3_AT_60:
        scores["wealth"] += 2
    elif q3 == Q3_NEVER:
        scores["yolo"] += 2; scores["wealth"] += 1
    elif q3 == Q3_FLEXIBLE:
        pass  # neutral

    # Contextual boosts
    if savings_rate >= 0.40:
        scores["fire"] += 2
    if experience_spend_pct >= 35:
        scores["yolo"] += 2
    if has_dependants:
        scores["family"] += 2
    if outstanding_debt > monthly_income * 24:  # >2 years income in debt
        scores["debt"] += 3

    #Pick the winning persona
    winner = max(scores, key=scores.get)
    sorted_scores = sorted(scores.values(), reverse=True)
    if sorted_scores[0] - sorted_scores[1] <= 2:   # top two within 2 pts → balanced
        winner = "balanced"
    risk_score = _calc_risk_score(savings_rate, winner, q2)

    persona_map = {
        "fire": Persona(
            type="FIRE Seeker",
            tone="structured",
            framing=(
                "This user wants to retire early. Be number-heavy and precise. "
                "Always show the FIRE date with current trajectory vs optimised. "
                "Frame every suggestion as 'this brings your FIRE date X years closer'. "
                "Never suggest lifestyle cuts — show how to earn or invest more instead."
            ),
            risk_profile="aggressive" if risk_score >= 7 else "moderate",
            risk_score=risk_score,
            primary_motivation="Freedom from the 9-to-5",
            primary_fear="Working until 60",
            plan_style="number_heavy",
            emoji_label="Target: Early retirement",
        ),
        "yolo": Persona(
            type="YOLO Traveller",
            tone="casual",
            framing=(
                "This user values experiences and lifestyle above all. "
                "NEVER suggest cutting travel, dining, or experiences budgets — it will disengage them. "
                "Instead, show how automating ₹X/month in SIPs first leaves their full lifestyle intact. "
                "Frame wealth as 'funding more and better experiences in the future'. "
                "Keep the tone light and conversational, not preachy."
            ),
            risk_profile="moderate",
            risk_score=risk_score,
            primary_motivation="Living fully in the present",
            primary_fear="Regretting not living enough",
            plan_style="story_driven",
            emoji_label="Lifestyle-first wealth building",
        ),
        "family": Persona(
            type="Family-First Planner",
            tone="warm",
            framing=(
                "This user's financial decisions revolve around family — children's education, "
                "parents' healthcare, or both. Always prioritise goals in this order: "
                "1) Family protection (insurance), 2) Children's education fund, 3) Personal retirement. "
                "Acknowledge the emotional weight of these responsibilities. "
                "Be warm, reassuring, and specific about timelines for family goals."
            ),
            risk_profile="moderate",
            risk_score=risk_score,
            primary_motivation="Securing family's future",
            primary_fear="Being unable to provide for family",
            plan_style="balanced",
            emoji_label="Family security focused",
        ),
        "debt": Persona(
            type="Debt Slayer",
            tone="direct",
            framing=(
                "This user is anxious about their debt and wants to be free of it above all else. "
                "Lead with a debt payoff timeline — show them exactly when they'll be debt-free. "
                "Use the avalanche method (highest interest first) by default. "
                "Only recommend investments after emergency fund is secure. "
                "Frame investing as 'what you do after you're debt-free' to keep them motivated."
            ),
            risk_profile="conservative",
            risk_score=min(risk_score, 5),
            primary_motivation="Being debt-free",
            primary_fear="Debt spiralling out of control",
            plan_style="number_heavy",
            emoji_label="Debt freedom first",
        ),
        "wealth": Persona(
            type="Wealth Builder",
            tone="ambitious",
            framing=(
                "This user is driven by wealth creation and financial growth. "
                "They are comfortable with risk and want to know the most optimal strategy. "
                "Lead with portfolio strategy and asset allocation. "
                "Can discuss more advanced concepts like factor investing, international funds, REITs. "
                "Show compound growth projections over 10/20/30 years. "
                "Frame everything in terms of net worth milestones."
            ),
            risk_profile="aggressive" if risk_score >= 6 else "moderate",
            risk_score=risk_score,
            primary_motivation="Building maximum wealth",
            primary_fear="Underperforming the market",
            plan_style="number_heavy",
            emoji_label="Aggressive wealth builder",
        ),
        "balanced": Persona(
            type="Balanced Builder",
            tone="friendly",
            framing="This user has no single dominant financial priority...",
            risk_profile="moderate",
            risk_score=risk_score,
            primary_motivation="Steady, sustainable financial progress",
            primary_fear="Making the wrong financial move",
            plan_style="balanced",
            emoji_label="Balanced wealth building",
        ),
    }

    persona = persona_map.get(winner, persona_map["wealth"])
    result = asdict(persona)
    result["score_breakdown"] = scores  
    return result


def _calc_risk_score(
    savings_rate: float, persona_type: str, fear_answer: str
) -> int:
    """
    Generates a 1-10 risk score.
    Higher = more risk tolerant.
    """
    base = 5

    if savings_rate >= 0.50:
        base += 2
    elif savings_rate >= 0.30:
        base += 1
    elif savings_rate < 0.10:
        base -= 2

    persona_adjustment = {
        "fire": +1,
        "yolo": 0,
        "family": -1,
        "debt": -2,
        "wealth": +2,
        "balanced": 0,
    }
    base += persona_adjustment.get(persona_type, 0)

    if fear_answer == Q2_MARKET_CRASH:
        base -= 2

    return max(1, min(10, base))

VALID_ANSWERS = [
    {Q1_INVEST_ALL, Q1_INVEST_HALF, Q1_PAY_DEBT, Q1_BUY_WANT, Q1_SAVE_FAMILY},
    {Q2_NOT_ENOUGH, Q2_MISSING_OUT, Q2_DEBT_TRAP, Q2_FAMILY_BURDEN, Q2_MARKET_CRASH},
    {Q3_BEFORE_45, Q3_AT_60, Q3_NEVER, Q3_FLEXIBLE},
]