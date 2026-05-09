def calculate_fairness_metrics(applicants, prediction_results):
    prediction_map = {
        item["applicant_id"]: item
        for item in prediction_results
    }

    groups = {}

    for applicant in applicants:
        if applicant.id not in prediction_map:
            continue

        group = applicant.group_color

        if group not in groups:
            groups[group] = {
                "total": 0,
                "approved": 0,
                "denied": 0,
                "review": 0,
                "qualified": 0,
                "false_denials": 0,
                "false_approvals": 0,
            }

        pred = prediction_map[applicant.id]["prediction"]

        groups[group]["total"] += 1

        if pred == "approve":
            groups[group]["approved"] += 1
        elif pred == "deny":
            groups[group]["denied"] += 1
        else:
            groups[group]["review"] += 1

        is_qualified = applicant.true_repayment_likelihood >= 0.70
        is_unqualified = applicant.true_repayment_likelihood <= 0.40

        if is_qualified:
            groups[group]["qualified"] += 1

        if is_qualified and pred == "deny":
            groups[group]["false_denials"] += 1

        if is_unqualified and pred == "approve":
            groups[group]["false_approvals"] += 1

    summary = {}

    for group, stats in groups.items():
        total = max(stats["total"], 1)
        qualified = max(stats["qualified"], 1)

        summary[group] = {
            **stats,
            "approval_rate": round(stats["approved"] / total, 2),
            "denial_rate": round(stats["denied"] / total, 2),
            "review_rate": round(stats["review"] / total, 2),
            "false_denial_rate": round(stats["false_denials"] / qualified, 2),
        }

    approval_rates = [stats["approval_rate"] for stats in summary.values()]

    approval_gap = 0
    if len(approval_rates) >= 2:
        approval_gap = round(max(approval_rates) - min(approval_rates), 2)

    red_stats = summary.get("red", {})
    purple_stats = summary.get("purple", {})

    red_false_denial = red_stats.get("false_denial_rate", 0)
    purple_false_denial = purple_stats.get("false_denial_rate", 0)

    false_denial_gap = round(abs(red_false_denial - purple_false_denial), 2)
    red_approval = summary.get("red", {}).get("approval_rate", 0)
    purple_approval = summary.get("purple", {}).get("approval_rate", 0)

    if red_approval < purple_approval:
        disadvantaged_group = "red"
    elif purple_approval < red_approval:
        disadvantaged_group = "purple"
    else:
        disadvantaged_group = "neither groups'"

    if approval_gap >= 0.25 or false_denial_gap >= 0.25:
        warning = (
            f"High fairness gap detected. In this run, {disadvantaged_group} applicants "
            "received worse outcomes. The model may be using proxy variables like ZIP zone, "
            "income, savings, or credit history in ways that reproduce patterns from training data."
        )
    elif approval_gap >= 0.10 or false_denial_gap >= 0.10:
        warning = (
            f"Moderate fairness gap detected. In this run, {disadvantaged_group} applicants "
            "received worse outcomes. The model should be audited before being used."
        )
    else:
        warning = "No large fairness gap detected in this run."

    return {
        "by_group": summary,
        "approval_gap": approval_gap,
        "false_denial_gap": false_denial_gap,
        "warning": warning,
        "proxy_bias_lesson": (
            "The model was not trained directly on group color. However, group color was correlated "
            "with ZIP code, income, savings, and credit history in the training data. This means the model "
            "can still discriminate indirectly through proxy variables."
        ),
    }