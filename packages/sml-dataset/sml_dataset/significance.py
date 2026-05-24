"""Task-specific feature significance checks."""

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.feature_selection import mutual_info_regression
from sklearn.linear_model import LinearRegression

from sml_dataset.task import TaskType


def run_significance_tests(df: pd.DataFrame, task: TaskType, targets: list[str]) -> dict[str, Any]:
    """Dispatch to WoE/IV for classification or correlation/MI/VIF for regression."""

    if task == TaskType.BINARY_CLASSIFICATION:
        return _classification_woe_iv(df, targets[0])
    return _regression_significance(df, targets)


def _classification_woe_iv(df: pd.DataFrame, target: str) -> dict[str, Any]:
    features = [col for col in df.columns if col != target]
    result: dict[str, Any] = {
        "method": "woe_iv",
        "iv_by_feature": {},
        "woe_bins": {},
        "chart_specs": [
            {"type": "bar", "title": "IV by feature", "x": "feature", "y": "iv", "color": "iv_grade"},
            {"type": "line", "title": "WoE binning plot", "x": "bin", "y": "woe"},
        ],
    }

    y = df[target].dropna()
    classes = sorted(y.unique().tolist())
    if len(classes) != 2:
        raise ValueError("WoE/IV requires a binary target with exactly two classes.")
    good_class, bad_class = classes[0], classes[1]

    for feature in features:
        table = _woe_table(df[[feature, target]].dropna(), feature, target, good_class, bad_class)
        iv = float(table["iv_component"].sum()) if not table.empty else 0.0
        result["iv_by_feature"][feature] = {"iv": iv, "grade": _iv_grade(iv)}
        result["woe_bins"][feature] = table.to_dict(orient="records")
    return result


def _woe_table(
    df: pd.DataFrame,
    feature: str,
    target: str,
    good_class: Any,
    bad_class: Any,
) -> pd.DataFrame:
    binned = _bin_feature(df[feature])
    grouped = pd.DataFrame({"bin": binned, "target": df[target]}).groupby("bin", dropna=False)
    table = grouped["target"].agg(
        good=lambda s: int((s == good_class).sum()),
        bad=lambda s: int((s == bad_class).sum()),
        total="count",
    ).reset_index()
    total_good = max(table["good"].sum(), 1)
    total_bad = max(table["bad"].sum(), 1)
    eps = 0.5
    table["good_dist"] = (table["good"] + eps) / (total_good + eps * len(table))
    table["bad_dist"] = (table["bad"] + eps) / (total_bad + eps * len(table))
    table["woe"] = np.log(table["good_dist"] / table["bad_dist"])
    table["iv_component"] = (table["good_dist"] - table["bad_dist"]) * table["woe"]
    table["bin"] = table["bin"].astype(str)
    return table


def _bin_feature(series: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(series) and series.nunique(dropna=True) > 5:
        try:
            return pd.qcut(series, q=5, duplicates="drop")
        except ValueError:
            return pd.cut(series, bins=5, duplicates="drop")
    return series.astype("object").where(series.notna(), "missing")


def _iv_grade(iv: float) -> str:
    if iv >= 0.3:
        return "strong"
    if iv >= 0.1:
        return "medium"
    if iv >= 0.02:
        return "weak"
    return "useless"


def _regression_significance(df: pd.DataFrame, targets: list[str]) -> dict[str, Any]:
    numeric_cols = [col for col in df.select_dtypes(include="number").columns if col not in targets]
    result: dict[str, Any] = {
        "method": "correlation_mutual_information_vif",
        "pearson": {},
        "mutual_information": {},
        "vif": _vif_scores(df[numeric_cols]) if numeric_cols else {},
        "chart_specs": [
            {"type": "heatmap", "title": "Correlation heatmap with p-value markers", "matrix": "pearson"},
            {"type": "bar", "title": "Mutual information by feature", "x": "feature", "y": "mi"},
            {"type": "bar", "title": "VIF by feature", "x": "feature", "y": "vif", "color": "threshold"},
        ],
    }
    for target in targets:
        target_pearson = {}
        for col in numeric_cols:
            pair = df[[col, target]].dropna()
            if len(pair) > 2 and pair[col].nunique() > 1 and pair[target].nunique() > 1:
                corr, pvalue = stats.pearsonr(pair[col], pair[target])
                target_pearson[col] = {
                    "correlation": _clean_number(corr),
                    "pvalue": _clean_number(pvalue),
                    "significant": bool(pvalue < 0.05),
                }
        result["pearson"][target] = target_pearson
        result["mutual_information"][target] = _mutual_information(df, numeric_cols, target)
    return result


def _mutual_information(df: pd.DataFrame, numeric_cols: list[str], target: str) -> dict[str, float]:
    if not numeric_cols:
        return {}
    pair = df[numeric_cols + [target]].dropna()
    if pair.empty:
        return {}
    scores = mutual_info_regression(pair[numeric_cols], pair[target], random_state=42)
    return {col: float(score) for col, score in zip(numeric_cols, scores, strict=False)}


def _vif_scores(numeric_df: pd.DataFrame) -> dict[str, dict[str, float | str]]:
    clean = numeric_df.dropna()
    if clean.shape[0] < 3 or clean.shape[1] < 2:
        return {}
    scores: dict[str, dict[str, float | str]] = {}
    for col in clean.columns:
        other_cols = [other for other in clean.columns if other != col]
        if not other_cols or clean[col].nunique() <= 1:
            continue
        model = LinearRegression()
        model.fit(clean[other_cols], clean[col])
        r2 = model.score(clean[other_cols], clean[col])
        vif = float("inf") if r2 >= 0.999999 else float(1.0 / (1.0 - r2))
        scores[col] = {"vif": _clean_number(vif), "threshold": _vif_threshold(vif)}
    return scores


def _vif_threshold(vif: float) -> str:
    if vif >= 10:
        return "high"
    if vif >= 5:
        return "warning"
    return "ok"


def _clean_number(value: float) -> float | None:
    if value is None or np.isnan(value) or np.isinf(value):
        return None
    return float(value)
