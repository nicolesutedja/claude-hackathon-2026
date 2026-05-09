import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline


# Matches the player-facing dossier: income (annual), credit, savings, DTI,
# employment tenure, ZIP, and loan amount. Rent history, payment, and job
# category are not model inputs.
NUMERIC_FEATURES = [
    "income",
    "credit_score",
    "debt_to_income",
    "savings",
    "employment_years",
    "loan_amount",
]

CATEGORICAL_FEATURES = [
    "zip_code",
]

LOW_ZONES = ["101", "112", "128"]
HIGH_ZONES = ["784", "826", "913"]


class LoanModel:
    def __init__(self):
        self.pipeline = None
        self.is_trained = False

        # Learned from player decisions.
        self.global_approval_rate = 0.5
        self.zip_approval_rates = {}
        self.zone_group_approval_rates = {
            "low": 0.5,
            "high": 0.5,
        }

    def applicant_to_row(self, applicant):
        return {
            "income": applicant.income,
            "credit_score": applicant.credit_score,
            "debt_to_income": applicant.debt_to_income,
            "savings": applicant.savings,
            "employment_years": applicant.employment_years,
            "loan_amount": applicant.loan_amount,
            "zip_code": applicant.zip_code,
        }

    def train(self, applicants, decisions):
        rows = []
        labels = []

        decision_map = {
            d.applicant_id: d.decision
            for d in decisions
            if d.decision in ["approve", "deny"]
        }

        training_applicants = []

        for applicant in applicants:
            if applicant.id in decision_map:
                rows.append(self.applicant_to_row(applicant))
                labels.append(1 if decision_map[applicant.id] == "approve" else 0)
                training_applicants.append(applicant)

        if len(rows) < 8:
            raise ValueError("Need at least 8 approve/deny decisions to train the model.")

        if len(set(labels)) < 2:
            raise ValueError("Need both approvals and denials to train the model.")

        X = pd.DataFrame(rows)
        y = np.array(labels)

        self.global_approval_rate = float(np.mean(y))
        self._learn_proxy_patterns(training_applicants, decision_map)

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
            "approval_rate": self.global_approval_rate,
            "zip_approval_rates": self.zip_approval_rates,
            "zone_group_approval_rates": self.zone_group_approval_rates,
            "note": (
                "Model was trained without group color on dossier fields only (income, "
                "credit, savings, DTI, employment tenure, ZIP, loan amount) plus your "
                "approve/deny labels."
            ),
        }

    def _learn_proxy_patterns(self, training_applicants, decision_map):
        zip_counts = {}
        zone_counts = {
            "low": {"approved": 0, "total": 0},
            "high": {"approved": 0, "total": 0},
        }

        for applicant in training_applicants:
            decision = decision_map.get(applicant.id)
            if decision not in ["approve", "deny"]:
                continue

            approved = 1 if decision == "approve" else 0

            if applicant.zip_code not in zip_counts:
                zip_counts[applicant.zip_code] = {"approved": 0, "total": 0}

            zip_counts[applicant.zip_code]["approved"] += approved
            zip_counts[applicant.zip_code]["total"] += 1

            if applicant.zip_code in LOW_ZONES:
                zone = "low"
            elif applicant.zip_code in HIGH_ZONES:
                zone = "high"
            else:
                zone = None

            if zone:
                zone_counts[zone]["approved"] += approved
                zone_counts[zone]["total"] += 1

        self.zip_approval_rates = {}

        for zip_code, counts in zip_counts.items():
            self.zip_approval_rates[zip_code] = counts["approved"] / max(counts["total"], 1)

        for zone, counts in zone_counts.items():
            if counts["total"] > 0:
                self.zone_group_approval_rates[zone] = counts["approved"] / counts["total"]

    def predict(self, applicant):
        if not self.is_trained:
            raise ValueError("Model has not been trained yet.")

        X = pd.DataFrame([self.applicant_to_row(applicant)])
        base_probability = float(self.pipeline.predict_proba(X)[0][1])

        adjusted_probability = self._apply_proxy_adjustment(applicant, base_probability)

        if adjusted_probability >= 0.58:
            decision = "approve"
        elif adjusted_probability <= 0.40:
            decision = "deny"
        else:
            decision = "review"

        return decision, float(adjusted_probability)

    def _apply_proxy_adjustment(self, applicant, probability):
        """
        No manual bias penalty.

        The model is not explicitly biased here.
        Any unequal outcome should come from the training data:
        lower ZIP zones were associated with more denials during manual review,
        so the model may learn ZIP zone as a proxy.
        """
        return max(0.01, min(0.99, probability))

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

        if applicant.savings >= 20000:
            explanations.append("Savings provide a buffer against financial shocks.")
        elif applicant.savings < 5000:
            explanations.append("Low savings may make financial shocks harder to handle.")

        if applicant.employment_years >= 5:
            explanations.append("Longer employment tenure is a stability signal.")
        elif applicant.employment_years < 2:
            explanations.append("Shorter employment history may have increased perceived risk.")

        if applicant.income >= 95000:
            explanations.append("Higher stated income supports repayment capacity in the model.")
        elif applicant.income < 48000:
            explanations.append("Lower stated income may have reduced approval likelihood.")

        if applicant.loan_amount >= 280_000:
            explanations.append("A larger loan amount can increase modeled risk.")
        elif applicant.loan_amount <= 120_000:
            explanations.append("A more modest loan size can align with lower modeled risk.")

        if applicant.zip_code in LOW_ZONES:
            low_rate = self.zone_group_approval_rates.get("low", 0.5)
            high_rate = self.zone_group_approval_rates.get("high", 0.5)

            if low_rate < high_rate:
                explanations.append(
                    "Proxy warning: lower ZIP zones were approved less often in training data."
                )
            else:
                explanations.append(
                    "This applicant is from a lower ZIP zone included in training patterns."
                )

        if applicant.zip_code in HIGH_ZONES:
            explanations.append(
                "This applicant is from a higher ZIP zone that may have been associated with prior approvals."
            )

        if probability > 0.65:
            explanations.append("The model predicts this applicant resembles people you approved.")
        elif probability < 0.35:
            explanations.append("The model predicts this applicant resembles people you denied.")
        else:
            explanations.append("The model is uncertain, so this case should receive human review.")

        return explanations