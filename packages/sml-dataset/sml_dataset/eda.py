"""Task-aware EDA summaries and chart specifications.

The dataset module returns JSON-friendly statistics and chart specs instead of
rendered charts. Frontend code can map these specs to Plotly, ECharts, Chart.js,
or any other visualization library.
"""

from typing import Any

import pandas as pd

from sml_dataset.task import TaskType


def run_eda(df: pd.DataFrame, task: TaskType, targets: list[str]) -> dict[str, Any]:
    """Run common EDA plus task-specific EDA."""

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    datetime_cols = df.select_dtypes(include=["datetime", "datetimetz"]).columns.tolist()
    categorical_cols = [
        col for col in df.columns if col not in numeric_cols and col not in datetime_cols
    ]

    result: dict[str, Any] = {
        "task": task.value,
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "datetime_columns": datetime_cols,
        "data_type_analysis": _data_type_analysis(df, numeric_cols, categorical_cols, datetime_cols),
        "missing_by_column": df.isna().sum().astype(int).to_dict(),
        "missing_ratio_by_column": df.isna().mean().astype(float).to_dict(),
        "duplicate_rows": int(df.duplicated().sum()),
        "outlier_counts": _outlier_counts(df[numeric_cols]) if numeric_cols else {},
        "numeric_summary": df[numeric_cols].describe().fillna(0).to_dict() if numeric_cols else {},
        "categorical_summary": {
            col: df[col].value_counts(dropna=False).head(20).astype(int).to_dict()
            for col in categorical_cols
        },
        "chart_specs": _common_chart_specs(numeric_cols, categorical_cols),
    }

    if task == TaskType.BINARY_CLASSIFICATION:
        result["classification_eda"] = _classification_eda(df, targets[0], numeric_cols)
        result["chart_specs"].extend(_classification_chart_specs(targets[0], numeric_cols))
    else:
        result["regression_eda"] = _regression_eda(df, targets, numeric_cols)
        result["chart_specs"].extend(_regression_chart_specs(targets, numeric_cols))

    return result


def _data_type_analysis(
    df: pd.DataFrame,
    numeric_cols: list[str],
    categorical_cols: list[str],
    datetime_cols: list[str],
) -> dict[str, dict[str, Any]]:
    semantic_types = {
        **{col: "numeric" for col in numeric_cols},
        **{col: "categorical" for col in categorical_cols},
        **{col: "datetime" for col in datetime_cols},
    }
    return {
        col: {
            "dtype": str(df[col].dtype),
            "semantic_type": semantic_types.get(col, "unknown"),
            "cardinality": int(df[col].nunique(dropna=True)),
        }
        for col in df.columns
    }


def _outlier_counts(numeric_df: pd.DataFrame, factor: float = 1.5) -> dict[str, int]:
    counts: dict[str, int] = {}
    for col in numeric_df.columns:
        q1 = numeric_df[col].quantile(0.25)
        q3 = numeric_df[col].quantile(0.75)
        iqr = q3 - q1
        if pd.isna(iqr) or iqr == 0:
            counts[col] = 0
            continue
        lower = q1 - factor * iqr
        upper = q3 + factor * iqr
        counts[col] = int(((numeric_df[col] < lower) | (numeric_df[col] > upper)).sum())
    return counts


def _classification_eda(df: pd.DataFrame, target: str, numeric_cols: list[str]) -> dict[str, Any]:
    counts = df[target].value_counts(dropna=False).astype(int)
    ratios = df[target].value_counts(dropna=False, normalize=True).astype(float)
    min_ratio = float(ratios.min()) if not ratios.empty else 0.0
    return {
        "target_distribution": counts.to_dict(),
        "target_ratio": ratios.to_dict(),
        "class_imbalance_warning": min_ratio < 0.10,
        "minimum_class_ratio": min_ratio,
        "feature_distribution_by_class": {
            col: df.groupby(target)[col].describe().fillna(0).to_dict()
            for col in numeric_cols
            if col != target
        },
    }


def _regression_eda(df: pd.DataFrame, targets: list[str], numeric_cols: list[str]) -> dict[str, Any]:
    corr_cols = list(dict.fromkeys([*numeric_cols, *targets]))
    return {
        "target_summary": df[targets].describe().fillna(0).to_dict(),
        "target_correlations": (
            df[corr_cols].corr(numeric_only=True)[targets].fillna(0).to_dict()
            if corr_cols
            else {}
        ),
        "feature_correlation_matrix": (
            df[corr_cols].corr(numeric_only=True).fillna(0).to_dict()
            if corr_cols
            else {}
        ),
    }


def _common_chart_specs(numeric_cols: list[str], categorical_cols: list[str]) -> list[dict[str, str]]:
    specs: list[dict[str, str]] = []
    for col in numeric_cols:
        specs.append({"type": "histogram", "title": f"{col} distribution", "x": col})
        specs.append({"type": "box", "title": f"{col} boxplot", "y": col})
    specs.extend(
        {"type": "bar", "title": f"{col} frequency", "x": col, "y": "count"}
        for col in categorical_cols
    )
    return specs


def _classification_chart_specs(target: str, numeric_cols: list[str]) -> list[dict[str, str]]:
    specs = [{"type": "bar", "title": f"{target} class distribution", "x": target, "y": "count"}]
    specs.extend(
        {"type": "violin", "title": f"{col} by {target}", "x": target, "y": col}
        for col in numeric_cols
        if col != target
    )
    return specs


def _regression_chart_specs(targets: list[str], numeric_cols: list[str]) -> list[dict[str, str]]:
    specs: list[dict[str, str]] = [
        {"type": "heatmap", "title": "Feature correlation heatmap", "matrix": "feature_correlation_matrix"}
    ]
    for target in targets:
        specs.append({"type": "histogram", "title": f"{target} target distribution", "x": target})
        for col in numeric_cols:
            if col not in targets:
                specs.append({"type": "scatter", "title": f"{col} vs {target}", "x": col, "y": target})
    return specs
