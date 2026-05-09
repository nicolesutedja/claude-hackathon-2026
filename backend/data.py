import random
from models import ApplicantInternal

random.seed(42)

# Fictional 3-digit ZIP zones.
# Lower zones correlate with red applicants.
# Higher zones correlate with purple applicants.
RED_ZONES = ["101", "112", "128"]
PURPLE_ZONES = ["784", "826", "913"]

EMPLOYMENT_TYPES = ["salaried", "hourly", "gig", "self_employed"]


def rounded_int(low, high, step):
    return random.randrange(low, high + step, step)


def rounded_float(low, high, step=0.01):
    value = random.uniform(low, high)
    return round(round(value / step) * step, 2)

def clamp(value, low=0.05, high=0.98):
    return max(low, min(high, value))

def rounded_normal(mean, std, low, high, step):
    """
    Generate a number from a normal distribution,
    clamp it between low/high, then round to a clean step.
    """
    value = random.gauss(mean, std)
    value = clamp(value, low, high)
    return int(round(value / step) * step)


def rounded_normal_float(mean, std, low, high, step=0.01):
    """
    Same as rounded_normal, but for decimal values like DTI.
    """
    value = random.gauss(mean, std)
    value = clamp(value, low, high)
    return round(round(value / step) * step, 2)

def calculate_true_repayment_likelihood(
    income,
    credit_score,
    debt_to_income,
    savings,
    rent_history_months,
    employment_years,
    monthly_payment,
):
    """
    Hidden ground truth.

    IMPORTANT:
    This does NOT use group_color or zip_code.
    Red applicants are not inherently worse.
    Bias comes from proxy variables and training patterns.
    """
    monthly_income = income / 12

    score = 0.35
    score += (credit_score - 580) / 500
    score += min(income / 130000, 1.0) * 0.15
    score += min(savings / 60000, 1.0) * 0.12
    score += min(rent_history_months / 72, 1.0) * 0.22
    score += min(employment_years / 8, 1.0) * 0.10
    score -= debt_to_income * 0.35
    score -= (monthly_payment / max(monthly_income, 1)) * 0.18

    return round(clamp(score), 2)


def make_context_note(group_color, zip_code, credit_score, rent_history_months, employment_type, savings):
    if credit_score >= 740 and savings >= 25000:
        return "Strong overall profile with solid credit depth and cash reserves."

    if credit_score >= 720:
        return "Credit history appears reliable and well-established."

    if rent_history_months >= 60 and credit_score < 690:
        return "Rent history is steady, though traditional credit depth is less developed."

    if rent_history_months >= 48 and savings >= 12000:
        return "Consistent housing payments with some financial cushion."

    if employment_type in ["gig", "self_employed"] and credit_score < 700:
        return "Income may require closer verification before approval."

    if employment_type in ["gig", "self_employed"]:
        return "Nontraditional income source; documentation appears important."

    if employment_type == "hourly" and savings < 8000:
        return "Hourly income and limited reserves may add repayment uncertainty."

    if credit_score < 640:
        return "Credit profile shows some risk indicators."

    if savings < 5000:
        return "Limited reserves could make unexpected expenses harder to absorb."

    if zip_code in RED_ZONES:
        return "Application comes from a market segment with historically mixed repayment outcomes."

    if zip_code in PURPLE_ZONES:
        return "Application comes from a market segment with historically stable repayment outcomes."

    return "Application appears complete and ready for review."


def generate_training_applicant(applicant_id):
    """
    Stage 1 applicant.

    This creates a subtle biased training environment:
    - Purple applicants are slightly more common.
    - Purple applicants are slightly more likely to have traditional approval signals.
    - Red applicants are correlated with lower ZIP zones and slightly thinner financial profiles.
    - The gap is not extreme, so the bias feels realistic instead of obvious.
    """
    group_color = "purple" if random.random() < 0.58 else "red"

    if group_color == "purple":
        zip_code = random.choice(PURPLE_ZONES)

        # Slightly stronger traditional profile on average.
        # Still overlaps heavily with red applicants.
        income = rounded_normal(
            mean=90000,
            std=20000,
            low=50000,
            high=135000,
            step=5000,
        )

        credit_score = rounded_normal(
            mean=720,
            std=45,
            low=620,
            high=820,
            step=5,
        )

        savings = rounded_normal(
            mean=32000,
            std=18000,
            low=5000,
            high=75000,
            step=1000,
        )

        rent_history_months = rounded_normal(
            mean=54,
            std=18,
            low=12,
            high=96,
            step=6,
        )

        debt_to_income = rounded_normal_float(
            mean=0.31,
            std=0.07,
            low=0.18,
            high=0.48,
            step=0.01,
        )

        employment_years = rounded_normal(
            mean=4,
            std=2,
            low=0.5,
            high=10,
            step=1,
        )

    else:
        zip_code = random.choice(RED_ZONES)

        # Slightly thinner traditional profile on average.
        # Not worse across the board; lots of overlap with purple.
        income = rounded_normal(
            mean=75000,
            std=20000,
            low=40000,
            high=130000,
            step=5000,
        )

        credit_score = rounded_normal(
            mean=630,
            std=50,
            low=590,
            high=810,
            step=5,
        )

        savings = rounded_normal(
            mean=24000,
            std=17000,
            low=2000,
            high=70000,
            step=1000,
        )

        rent_history_months = rounded_normal(
            mean=58,
            std=20,
            low=12,
            high=96,
            step=6,
        )

        debt_to_income = rounded_normal_float(
            mean=0.35,
            std=0.08,
            low=0.18,
            high=0.52,
            step=0.01,
        )

        employment_years = rounded_normal(
            mean=3.2,
            std=2,
            low=0.5,
            high=10,
            step=1,
        )

    loan_amount = rounded_int(180000, 520000, 10000)
    monthly_payment = rounded_int(1100, 3600, 100)
    employment_type = random.choice(EMPLOYMENT_TYPES)

    likelihood = calculate_true_repayment_likelihood(
        income,
        credit_score,
        debt_to_income,
        savings,
        rent_history_months,
        employment_years,
        monthly_payment,
    )

    context_note = make_context_note(
        group_color,
        zip_code,
        credit_score,
        rent_history_months,
        employment_type,
        savings,
    )

    return ApplicantInternal(
        id=applicant_id,
        group_color=group_color,
        income=income,
        credit_score=credit_score,
        debt_to_income=debt_to_income,
        savings=savings,
        rent_history_months=rent_history_months,
        employment_years=employment_years,
        loan_amount=loan_amount,
        monthly_payment=monthly_payment,
        zip_code=zip_code,
        employment_type=employment_type,
        context_note=context_note,
        true_repayment_likelihood=likelihood,
    )


def generate_ai_stage_applicant(applicant_id):
    """
    Stage 2 applicant.

    This is the automation test:
    - Red and purple applicants are more balanced
    - Both groups have overlapping/qualified profiles
    - Red applicants still come from lower ZIP zones
    - Purple applicants still come from higher ZIP zones

    If the model learned from biased Stage 1 data, lower ZIP zones may still
    receive worse outcomes even when individual profiles are strong.
    """
    group_color = "red" if random.random() < 0.50 else "purple"

    if group_color == "red":
        zip_code = random.choice(RED_ZONES)
    else:
        zip_code = random.choice(PURPLE_ZONES)

    # Balanced applicant quality in Stage 2.
    # Both groups draw from similar distributions.
    income = rounded_normal(
            mean=90000,
            std=20000,
            low=50000,
            high=135000,
            step=5000,
        )

    credit_score = rounded_normal(
            mean=720,
            std=45,
            low=620,
            high=820,
            step=5,
        )

    savings = rounded_normal(
            mean=32000,
            std=18000,
            low=5000,
            high=75000,
            step=1000,
        )

    rent_history_months = rounded_normal(
            mean=54,
            std=18,
            low=12,
            high=96,
            step=6,
        )

    debt_to_income = rounded_normal_float(
            mean=0.31,
            std=0.07,
            low=0.18,
            high=0.48,
            step=0.01,
        )

    employment_years = rounded_normal(
            mean=4,
            std=2,
            low=0.5,
            high=10,
            step=1,
        )

    loan_amount = rounded_int(180000, 520000, 10000)
    monthly_payment = rounded_int(1100, 3600, 100)
    employment_type = random.choice(EMPLOYMENT_TYPES)

    likelihood = calculate_true_repayment_likelihood(
        income,
        credit_score,
        debt_to_income,
        savings,
        rent_history_months,
        employment_years,
        monthly_payment,
    )

    context_note = make_context_note(
        group_color,
        zip_code,
        credit_score,
        rent_history_months,
        employment_type,
        savings,
    )

    return ApplicantInternal(
        id=applicant_id,
        group_color=group_color,
        income=income,
        credit_score=credit_score,
        debt_to_income=debt_to_income,
        savings=savings,
        rent_history_months=rent_history_months,
        employment_years=employment_years,
        loan_amount=loan_amount,
        monthly_payment=monthly_payment,
        zip_code=zip_code,
        employment_type=employment_type,
        context_note=context_note,
        true_repayment_likelihood=likelihood,
    )


TRAINING_APPLICANTS = [generate_training_applicant(i) for i in range(1, 46)]
AI_APPLICANTS = [generate_ai_stage_applicant(i) for i in range(46, 91)]
APPLICANTS = TRAINING_APPLICANTS + AI_APPLICANTS


def get_public_applicant(applicant: ApplicantInternal):
    data = applicant.model_dump()
    data.pop("true_repayment_likelihood")
    return data