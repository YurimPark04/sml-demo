"""Task-specific model evaluation metrics."""

from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
    roc_auc_score,
    roc_curve,
)

from sml_modeling.task import ModelingTask


def evaluate_predictions(
    task: ModelingTask,
    y_true: Any,
    y_pred: Any,
    y_score: Any | None = None,
    target_names: list[str] | None = None,
) -> dict[str, Any]:
    """Return metrics required by the modeling process document."""

    if task == ModelingTask.BINARY_CLASSIFICATION:
        return _classification_metrics(y_true, y_pred, y_score)
    if task == ModelingTask.MULTI_REGRESSION:
        return _multi_regression_metrics(y_true, y_pred, target_names or [])
    return _single_regression_metrics(y_true, y_pred)


def _classification_metrics(y_true: Any, y_pred: Any, y_score: Any | None) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).astype(int).tolist(),
        "roc_auc": None,
        "roc_curve": None,
    }
    if y_score is not None:
        try:
            metrics["roc_auc"] = float(roc_auc_score(y_true, y_score))
            fpr, tpr, thresholds = roc_curve(y_true, y_score)
            metrics["roc_curve"] = {
                "fpr": fpr.astype(float).tolist(),
                "tpr": tpr.astype(float).tolist(),
                "thresholds": [_json_number(value) for value in thresholds.astype(float).tolist()],
            }
        except ValueError:
            pass
    return metrics


def _single_regression_metrics(y_true: Any, y_pred: Any) -> dict[str, float]:
    return _regression_metric_dict(y_true, y_pred)


def _multi_regression_metrics(y_true: Any, y_pred: Any, target_names: list[str]) -> dict[str, Any]:
    true_df = pd.DataFrame(y_true, columns=target_names or None)
    pred_df = pd.DataFrame(y_pred, columns=true_df.columns)
    by_target = {
        str(col): _regression_metric_dict(true_df[col], pred_df[col])
        for col in true_df.columns
    }
    return {
        "by_target": by_target,
        "average": {
            metric: float(np.mean([target_metrics[metric] for target_metrics in by_target.values()]))
            for metric in ["mae", "rmse", "mape", "r2"]
        },
    }


def _regression_metric_dict(y_true: Any, y_pred: Any) -> dict[str, float]:
    mse = mean_squared_error(y_true, y_pred)
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mse)),
        "mape": float(mean_absolute_percentage_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def _json_number(value: float) -> float | None:
    if np.isnan(value) or np.isinf(value):
        return None
    return float(value)
