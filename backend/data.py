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

    Purple applicants usually look more traditionally qualified.
    Red applicants are more correlated with lower ZIP zones and thinner credit profiles.
    """
    group_color = "purple" if random.random() < 0.58 else "red"

    if group_color == "purple":
        zip_code = random.choice(PURPLE_ZONES)
        income = rounded_int(60000, 135000, 5000)
        credit_score = rounded_int(665, 820, 5)
        savings = rounded_int(12000, 75000, 1000)
        rent_history_months = rounded_int(12, 72, 6)
    else:
        zip_code = random.choice(RED_ZONES)
        income = rounded_int(35000, 95000, 5000)
        credit_score = rounded_int(585, 735, 5)
        savings = rounded_int(2000, 38000, 1000)
        rent_history_months = rounded_int(24, 84, 6)

    debt_to_income = rounded_float(0.18, 0.52, 0.01)
    employment_years = random.choice([0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10])
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

    This stage intentionally includes strong red applicants.
    If the AI learned biased proxy patterns from Stage 1,
    it may still deny these applicants despite strong profiles.
    """
    group_color = "red" if random.random() < 0.55 else "purple"

    if group_color == "red":
        zip_code = random.choice(RED_ZONES)

        # Strong red applicants in the AI stage.
        income = rounded_int(70000, 135000, 5000)
        credit_score = rounded_int(690, 805, 5)
        savings = rounded_int(18000, 70000, 1000)
        rent_history_months = rounded_int(48, 96, 6)
        debt_to_income = rounded_float(0.18, 0.36, 0.01)
        employment_years = random.choice([2, 3, 4, 5, 6, 8, 10])
    else:
        zip_code = random.choice(PURPLE_ZONES)
        income = rounded_int(60000, 130000, 5000)
        credit_score = rounded_int(650, 820, 5)
        savings = rounded_int(10000, 75000, 1000)
        rent_history_months = rounded_int(12, 84, 6)
        debt_to_income = rounded_float(0.18, 0.45, 0.01)
        employment_years = random.choice([1, 1.5, 2, 3, 4, 5, 6, 8, 10])

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