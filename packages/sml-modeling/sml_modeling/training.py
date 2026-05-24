"""Train, evaluate, and persist models from dataset version artifacts."""

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from sml_modeling.io import load_dataset_version, save_model_artifact
from sml_modeling.metrics import evaluate_predictions
from sml_modeling.registry import available_algorithms, build_model, resolve_hyperparameters
from sml_modeling.task import ModelingTask


@dataclass(frozen=True)
class TrainingResult:
    """Algorithm-level result returned to CLI/API callers."""

    algorithm: str
    status: str
    metrics: dict[str, Any]
    model_path: str | None
    hyperparameters: dict[str, Any]
    diagnostics: dict[str, Any]
    message: str | None = None


def train_algorithms(
    dataset_path: str | Path,
    task: ModelingTask,
    algorithms: list[str] | None = None,
    artifact_dir: str | Path = "artifacts/models",
    test_size: float = 0.2,
    random_state: int = 42,
    hyperparameters: dict[str, dict[str, Any]] | None = None,
) -> list[TrainingResult]:
    """Train selected algorithms and save one model artifact per algorithm."""

    dataset = load_dataset_version(dataset_path)
    features: pd.DataFrame = dataset["features"]
    targets: pd.DataFrame = dataset["targets"]
    target_count = targets.shape[1]
    target_names = targets.columns.tolist()

    selected = algorithms or available_algorithms(task)
    y = _target_array(task, targets)
    stratify = y if task == ModelingTask.BINARY_CLASSIFICATION else None
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    results: list[TrainingResult] = []
    for algorithm in selected:
        algorithm_params = (hyperparameters or {}).get(algorithm, {})
        resolved_params = resolve_hyperparameters(task, algorithm, algorithm_params)
        try:
            model = build_model(algorithm, task, target_count, algorithm_params)
            model.fit(x_train, y_train)
            y_pred = model.predict(x_test)
            y_score = _score_if_available(model, x_test, task)
            metrics = evaluate_predictions(task, y_test, y_pred, y_score, target_names)
            diagnostics = _diagnostics(model, task, x_test, y_test, y_pred, features.columns.tolist(), target_names)
            model_path = _model_path(artifact_dir, dataset["version_id"], algorithm)
            save_model_artifact(
                model_path,
                {
                    "algorithm": algorithm,
                    "task": task.value,
                    "dataset_version_id": dataset["version_id"],
                    "created_at": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
                    "model": model,
                    "metrics": metrics,
                    "hyperparameters": resolved_params,
                    "diagnostics": diagnostics,
                    "feature_columns": features.columns.tolist(),
                    "target_columns": target_names,
                    "split": {"test_size": test_size, "random_state": random_state},
                },
            )
            results.append(
                TrainingResult(
                    algorithm=algorithm,
                    status="trained",
                    metrics=metrics,
                    model_path=str(model_path),
                    hyperparameters=resolved_params,
                    diagnostics=diagnostics,
                )
            )
        except Exception as exc:
            results.append(
                TrainingResult(
                    algorithm=algorithm,
                    status="skipped",
                    metrics={},
                    model_path=None,
                    hyperparameters=resolved_params,
                    diagnostics={},
                    message=str(exc),
                )
            )
    return results


def results_as_dicts(results: list[TrainingResult]) -> list[dict[str, Any]]:
    """Convert dataclass results into JSON-serializable dictionaries."""

    return [asdict(result) for result in results]


def _target_array(task: ModelingTask, targets: pd.DataFrame) -> Any:
    if task in {ModelingTask.BINARY_CLASSIFICATION, ModelingTask.SINGLE_REGRESSION}:
        return targets.iloc[:, 0]
    return targets


def _score_if_available(model: Any, x_test: pd.DataFrame, task: ModelingTask) -> Any | None:
    if task != ModelingTask.BINARY_CLASSIFICATION:
        return None
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(x_test)
        if probabilities.shape[1] >= 2:
            return probabilities[:, 1]
    if hasattr(model, "decision_function"):
        return model.decision_function(x_test)
    return None


def _diagnostics(
    model: Any,
    task: ModelingTask,
    x_test: pd.DataFrame,
    y_test: Any,
    y_pred: Any,
    feature_names: list[str],
    target_names: list[str],
) -> dict[str, Any]:
    if task == ModelingTask.BINARY_CLASSIFICATION:
        return {
            "chart_specs": [
                {"type": "roc_curve", "title": "ROC Curve", "source": "metrics.roc_curve"},
                {"type": "confusion_matrix", "title": "Confusion Matrix", "source": "metrics.confusion_matrix"},
                {"type": "bar", "title": "Feature Importance", "source": "diagnostics.feature_importance"},
            ],
            "feature_importance": _feature_importance(model, feature_names),
        }
    return {
        "chart_specs": [
            {"type": "scatter", "title": "Predicted vs Actual", "source": "diagnostics.predicted_vs_actual"},
            {"type": "residual", "title": "Residual Plot", "source": "diagnostics.residuals"},
        ],
        "predicted_vs_actual": _predicted_vs_actual(y_test, y_pred, target_names),
        "residuals": _residuals(y_test, y_pred, target_names),
    }


def _feature_importance(model: Any, feature_names: list[str]) -> dict[str, float]:
    if hasattr(model, "feature_importances_"):
        values = model.feature_importances_
    elif hasattr(model, "coef_"):
        values = np.abs(np.ravel(model.coef_))
    else:
        return {}
    return {
        feature: float(value)
        for feature, value in zip(feature_names, values, strict=False)
    }


def _predicted_vs_actual(y_true: Any, y_pred: Any, target_names: list[str]) -> dict[str, list[dict[str, float]]]:
    true_df = pd.DataFrame(np.asarray(y_true), columns=target_names or None).reset_index(drop=True)
    pred_df = pd.DataFrame(np.asarray(y_pred), columns=true_df.columns).reset_index(drop=True)
    return {
        str(col): [
            {"actual": float(actual), "predicted": float(predicted)}
            for actual, predicted in zip(true_df[col], pred_df[col], strict=False)
        ]
        for col in true_df.columns
    }


def _residuals(y_true: Any, y_pred: Any, target_names: list[str]) -> dict[str, list[float]]:
    true_df = pd.DataFrame(np.asarray(y_true), columns=target_names or None).reset_index(drop=True)
    pred_df = pd.DataFrame(np.asarray(y_pred), columns=true_df.columns).reset_index(drop=True)
    return {
        str(col): (true_df[col] - pred_df[col]).astype(float).tolist()
        for col in true_df.columns
    }


def _model_path(artifact_dir: str | Path, dataset_version_id: str, algorithm: str) -> Path:
    created_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return Path(artifact_dir) / f"{dataset_version_id}_{algorithm}_{created_at}.pkl"
