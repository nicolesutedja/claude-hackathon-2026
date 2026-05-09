import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline


NUMERIC_FEATURES = [
    "income",
    "credit_score",
    "debt_to_income",
    "savings",
    "rent_history_months",
    "employment_years",
    "loan_amount",
    "monthly_payment",
]

CATEGORICAL_FEATURES = [
    "zip_code",
    "employment_type",
]

# IMPORTANT:
# group_color is intentionally NOT included.
# The model can still learn bias through proxy variables like zip_code and income.


class LoanModel:
    def __init__(self):
        self.pipeline = None
        self.is_trained = False

    def applicant_to_row(self, applicant):
        return {
            "income": applicant.income,
            "credit_score": applicant.credit_score,
            "debt_to_income": applicant.debt_to_income,
            "savings": applicant.savings,
            "rent_history_months": applicant.rent_history_months,
            "employment_years": applicant.employment_years,
            "loan_amount": applicant.loan_amount,
            "monthly_payment": applicant.monthly_payment,
            "zip_code": applicant.zip_code,
            "employment_type": applicant.employment_type,
        }

    def train(self, applicants, decisions):
        rows = []
        labels = []

        decision_map = {
            d.applicant_id: d.decision
            for d in decisions
            if d.decision in ["approve", "deny"]
        }

        for applicant in applicants:
            if applicant.id in decision_map:
                rows.append(self.applicant_to_row(applicant))
                labels.append(1 if decision_map[applicant.id] == "approve" else 0)

        if len(rows) < 8:
            raise ValueError("Need at least 8 approve/deny decisions to train the model.")

        if len(set(labels)) < 2:
            raise ValueError("Need both approvals and denials to train the model.")

        X = pd.DataFrame(rows)
        y = np.array(labels)

        preprocessor = ColumnTransformer(
            transformers=[
                ("num", StandardScaler(), NUMERIC_FEATURES),
                ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
            ]
        )

        self.pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("classifier", LogisticRegression(max_iter=1000)),
            ]
        )

        self.pipeline.fit(X, y)
        self.is_trained = True

        return {
            "training_examples": len(rows),
            "approval_rate": float(np.mean(y)),
            "note": "Model was trained without group color, but it can still learn proxy patterns from ZIP code, income, and credit history."
        }

    def predict(self, applicant):
        if not self.is_trained:
            raise ValueError("Model has not been trained yet.")

        X = pd.DataFrame([self.applicant_to_row(applicant)])
        probability = self.pipeline.predict_proba(X)[0][1]

        if probability >= 0.65:
            decision = "approve"
        elif probability <= 0.35:
            decision = "deny"
        else:
            decision = "review"

        return decision, float(probability)

    def explain(self, applicant, probability):
        explanations = []

        if applicant.credit_score >= 720:
            explanations.append("Strong credit score should support approval.")
        elif applicant.credit_score < 630:
            explanations.append("Lower credit score reduced approval probability.")

        if applicant.debt_to_income > 0.43:
            explanations.append("High debt-to-income ratio increased risk.")
        elif applicant.debt_to_income < 0.30:
            explanations.append("Low debt-to-income ratio should support approval.")

        if applicant.rent_history_months >= 48:
            explanations.append("Strong rent payment history is a positive repayment signal.")

        if applicant.savings >= 20000:
            explanations.append("Savings provide a buffer against financial shocks.")
        elif applicant.savings < 5000:
            explanations.append("Low savings may make financial shocks harder to handle.")

        if applicant.employment_type in ["gig", "self_employed"]:
            explanations.append("Nontraditional income may have affected the model decision.")

        if applicant.zip_code in ["101", "112", "128"]:
            explanations.append(
                "Proxy warning: this ZIP code is associated with the red group in the training data."
            )
        if applicant.zip_code in ["784", "826", "913"]:
            explanations.append(
                "This higher ZIP zone was associated with more approvals in the training data."
            )

        if probability > 0.65:
            explanations.append("The model predicts this applicant resembles people you approved.")
        elif probability < 0.35:
            explanations.append("The model predicts this applicant resembles people you denied.")
        else:
            explanations.append("The model is uncertain, so this case should receive human review.")

        return explanations